/**
 * @file System-level modifications to the way combat works
 */
import { OSE } from "../config";
import OSECombatGroupSelector from "./combat-set-groups";
import type { OSECombatant } from "./combatant";

export const actionGroups = {
  slow: "OSE.items.Slow",
  cast: "OSE.spells.Cast",
};

/**
 * An extension of Foundry's Combat class that implements initiative for individual combatants.
 *
 * @todo Use a single chat card for rolling group initiative
 */
export class OSECombat extends foundry.documents.Combat {
  static FORMULA = "1d6 + @init";

  static GROUP_FORMULA = "1d6";

  static get GROUPS() {
    return {
      ...OSE.colors,
      ...Object.entries(actionGroups).reduce((acc, [key, value]) => {
        (acc as Record<string, string>)[key] = game.i18n.localize(value);
        return acc;
      }, {}),
    };
  }

  // Track combatant groups since multiple combatants can trigger group creation
  // at the same time.
  #combatantGroups = new Map<string, Promise<CombatantGroup>>();

  get #rerollBehavior() {
    return game.settings.get(game.system.id, "rerollInitiative");
  }

  /**
   * Returns whether the combat is using group initiative.
   *
   * @returns {boolean} True if the combat is using group initiative, false otherwise.
   */
  get isGroupInitiative(): boolean {
    return game.settings.get(game.system.id, "initiative") === "group";
  }

  // ===========================================================================
  // INITIATIVE MANAGEMENT
  // ===========================================================================

  /**
   * Roll initiative for all combatants.
   *
   * @param {object} [options={}] - Additional options which modify how initiative rolls are created or presented.
   * @param {boolean} [options.excludeAlreadyRolled=false] - If true, exclude combatants that have already rolled initiative.
   * @param {boolean} [options.updateTurn=false] - Update the Combat turn after adding new initiative scores to
   *                                               keep the turn on the same Combatant.
   * @private
   */
  async #rollAbsolutelyEveryone({ excludeAlreadyRolled = false, updateTurn = false } = {}) {
    const formula = this.isGroupInitiative ? OSECombat.GROUP_FORMULA : OSECombat.FORMULA;

    await this.rollInitiative(
      this.combatants.filter((c) => !c.defeated && (!excludeAlreadyRolled || c.initiative === null)).map((c) => c.id),
      {
        formula,
        updateTurn,
      },
    );
  }

  /**
   * Reroll initiative for all combatants.
   * If the initiative type is set to "group", reroll initiative for each group.
   *
   * @param {object} [options={}] - Additional options which modify how initiative rolls are created or presented.
   * @param {boolean} [options.excludeAlreadyRolled=false] - If true, exclude combatants that have already rolled initiative.
   * @param {boolean} [options.updateTurn=false] - Update the Combat turn after adding new initiative scores to
   *                                               keep the turn on the same Combatant.
   * @param {boolean} [options.npcOnly=false] - If true, only reroll groups with no player-owned combatants.
   */
  async smartRerollInitiative({ excludeAlreadyRolled = false, updateTurn = false, npcOnly = false } = {}) {
    if (!this.isGroupInitiative) {
      return this.#rollAbsolutelyEveryone({ excludeAlreadyRolled, updateTurn });
    }

    const groups = this.groups.filter(
      (group: CombatantGroup) =>
        group.members.size > 0 &&
        !(excludeAlreadyRolled && group.initiative !== null) &&
        !(npcOnly && group.members.some((c) => c.hasPlayerOwner)),
    );
    return this.rollGroupInitiative(groups);
  }

  /**
   * Roll one initiative per group and post them on a single chat card.
   *
   * @param {CombatantGroup[]} groups - The groups to roll for.
   */
  async rollGroupInitiative(groups: CombatantGroup[]) {
    const toRoll = groups.filter((g) => g.members.size > 0 && g.name !== "slow");
    if (!toRoll.length) return this;

    if (!this.isOwner) {
      const gm = game.users.activeGM;
      if (!gm) {
        ui.notifications.warn("OSE.combat.NoActiveGM", { localize: true });
        return this;
      }
      await gm.query(`${game.system.id}.rollGroupInitiative`, {
        combatId: this.id,
        groupIds: toRoll.map((g) => g.id),
        userId: game.user.id,
      });
      return this;
    }

    const rolls = [];
    const updates = [];
    const rows = [];
    for (const group of toRoll) {
      const roll = await new Roll(OSECombat.GROUP_FORMULA).evaluate();
      rolls.push(roll);
      updates.push({ _id: group.id, initiative: roll.total });
      const label = foundry.utils.escapeHTML(game.i18n.localize(`OSE.colors.${group.name}`));
      const anchor = (await roll.toAnchor()).outerHTML;
      rows.push(
        `<li class="ose-initiative-group" data-group-key="${group.name}"><strong>${label}</strong> ${anchor}</li>`,
      );
    }

    await this.updateEmbeddedDocuments("CombatantGroup", updates);
    await foundry.documents.ChatMessage.implementation.create({
      speaker: { alias: game.i18n.localize("OSE.Initiative") },
      flavor: game.i18n.localize("OSE.roll.individualInitGroup"),
      content: `<ul class="ose-initiative-groups">${rows.join("")}</ul>`,
      rolls,
      sound: CONFIG.sounds.dice,
      flags: { "core.initiativeRoll": true },
    });
    return this;
  }

  /**
   * Set a group's initiative directly. Null to clear it.
   *
   * @param {CombatantGroup} group - The group to set.
   * @param {number|null} value - The initiative value.
   */
  async setGroupInitiative(group: CombatantGroup, value: number | null) {
    if (this.isOwner) return group.update({ initiative: value });
    const gm = game.users.activeGM;
    if (!gm) {
      ui.notifications.warn("OSE.combat.NoActiveGM", { localize: true });
      return;
    }
    const applied = await gm.query(`${game.system.id}.rollGroupInitiative`, {
      combatId: this.id,
      groupIds: [group.id],
      userId: game.user.id,
      value,
    });
    if (!applied) ui.notifications.warn("OSE.combat.GroupInitiativeRefused", { localize: true });
  }

  /**
   * GM handler for a player's group initiative roll or manual value.
   *
   * @param {object} data - The query data.
   * @param {object} [context] - Query context; v14 includes the sending user.
   */
  static async handleRollGroupQuery(
    { combatId, groupIds, userId, value }: { combatId: string; groupIds: string[]; userId: string; value?: number },
    context: { user?: User } = {},
  ) {
    const combat = game.combats.get(combatId) as OSECombat | undefined;
    const user = context.user ?? game.users.get(userId);
    if (!combat || !user) return false;
    if (value !== undefined && !Number.isInteger(value)) return false;
    const groups = groupIds
      .map((id) => combat.groups.get(id))
      .filter(
        (g): g is CombatantGroup =>
          !!g && g.initiative === null && g.members.some((c) => c.testUserPermission(user, "OWNER")),
      );
    if (value !== undefined) {
      await combat.updateEmbeddedDocuments(
        "CombatantGroup",
        groups.map((g) => ({ _id: g.id, initiative: value })),
      );
    } else await combat.rollGroupInitiative(groups);
    return true;
  }

  /** @override */
  async rollInitiative(ids: string | string[], options = {}) {
    if (!this.isGroupInitiative) return super.rollInitiative(ids, options);
    const idList = typeof ids === "string" ? [ids] : ids;
    const groups = new Set<CombatantGroup>();
    const loose = [];
    for (const id of idList) {
      const group = this.combatants.get(id)?.group as CombatantGroup | undefined;
      if (group && group.name !== "slow") groups.add(group);
      else loose.push(id);
    }
    if (loose.length) await super.rollInitiative(loose, options);
    return this.rollGroupInitiative([...groups]);
  }

  /**
   * Reroll initiative for groups with no player-owned combatants.
   */
  async rerollNPCInitiative() {
    return this.smartRerollInitiative({ npcOnly: true });
  }

  /**
   * Handle updating a combatant group.
   */
  async onUpdateCombatantGroup() {
    this.setupTurns();
    await ui.combat.render({ force: true });
  }

  /** @override */
  async rollAll(options: object) {
    await super.rollAll(options);
    // Preserve the fact that it's no-one's turn currently.
    let turn = this.turn === null || this.turns.length === 0 ? null : 0;
    if (this.settings.skipDefeated && turn !== null) {
      turn = this.turns.findIndex((t) => !t.isDefeated);
      if (turn === -1) {
        ui.notifications.warn("COMBAT.NoneRemaining", { localize: true });
        turn = 0;
      }
    }
    await this.update({ turn });
    this.setupTurns();
    await ui.combat.render({ force: true });
    return this;
  }

  // ===========================================================================
  // COMBAT LIFECYCLE MANAGEMENT
  // ===========================================================================

  /** @override */
  async startCombat() {
    await super.startCombat();
    if (this.#rerollBehavior !== "reset")
      await this.smartRerollInitiative({
        excludeAlreadyRolled: true,
      });
    this.#warnUnrolled();
    return this;
  }

  /** @override */
  async nextTurn() {
    this.#warnUnrolled();
    return super.nextTurn();
  }

  /** Warn without blocking when an active combatant has no initiative yet. */
  #warnUnrolled() {
    const unrolled = this.combatants.some(
      (c) => !c.isDefeated && !c.isSlow && c.group?.name !== "slow" && c.initiative === null,
    );
    if (unrolled) ui.notifications.warn("OSE.combat.UnrolledInitiative", { localize: true });
  }

  /**
   * Reset the actions of all combatants in the combat.
   */
  async resetActions() {
    const flags = { [`flags.${game.system.id}.prepareSpell`]: false, [`flags.${game.system.id}.moveInCombat`]: false };
    await this.updateEmbeddedDocuments(
      "Combatant",
      this.combatants.map((c) => ({ _id: c.id, ...flags })),
    );
  }

  /** @override */
  async _manageTurnEvents() {
    // Re-roll before core picks who starts the round, so turn events go to the new first combatant.
    if (game.user.isActiveGM && this.started && this.previous?.round && this.current.round > this.previous.round) {
      const previous = { ...this.previous };
      await this.#onNewRound();
      // v13 overwrites the previous state on combatant updates even without turn events.
      Object.assign(this.previous, previous);
    }
    return super._manageTurnEvents();
  }

  /**
   * Re-roll or reset initiative and clear combatant actions for a new round.
   */
  async #onNewRound() {
    switch (this.#rerollBehavior) {
      case "reset":
        await this.resetAll({ updateTurn: false });
        break;

      case "reroll":
        await this.smartRerollInitiative();
        break;
      default:
        break;
    }
    await this.resetActions();
  }

  /** @override */
  async resetAll(args: object) {
    await super.resetAll(args);

    if (this.isGroupInitiative) {
      const groupUpdates = this.groups.map((g: CombatantGroup) => ({
        _id: g.id,
        initiative: null,
      }));

      if (groupUpdates.length > 0) {
        await this.updateEmbeddedDocuments("CombatantGroup", groupUpdates);
      }
    }
  }

  /**
   * Activate the given combatant within the combat.
   *
   * @param {number} turn - The turn number of the combatant to activate.
   */
  async activateCombatant(turn: number) {
    if (game.user.isGM) {
      await this.update({ turn });
    }
  }

  /**
   * Assign a combatant to a group, creating the group if it doesn't exist.
   * This method prevents multiple groups being created due to the async nature
   * of Foundry VTT.
   *
   * @param {OSECombatant} combatant - The combatant to assign to the group.
   * @param {string} groupName - The name of the group to assign the combatant to.
   */
  async assignGroup(combatant: OSECombatant, groupName: string) {
    if (!groupName) {
      return;
    }

    if (!this.groups.some((g: CombatantGroup) => g.name === groupName)) {
      if (!this.#combatantGroups.has(groupName)) {
        const groupCreation = this.createEmbeddedDocuments("CombatantGroup", [{ name: groupName, initiative: null }]);
        this.#combatantGroups.set(
          groupName,
          groupCreation.finally(() => this.#combatantGroups.delete(groupName)),
        );
      }
      await this.#combatantGroups.get(groupName);
    }

    const group = this.groups.find((g: CombatantGroup) => g.name === groupName);
    if (!group) {
      return;
    }
    await combatant.update({ group: group.id });
  }

  /**
   * Determine which group each combatant should be added to, or if a new group should be created.
   *
   * @returns {Map<string, { combatants: OSECombatant[], expanded: boolean }>}
   */
  async createGroups() {
    for (const combatant of this.combatants) {
      if (combatant.group) continue;

      const key = combatant.groupRaw;
      if (!key) continue;

      await this.assignGroup(combatant, key);
    }

    return this.groups;
  }

  /**
   * Prompts to set the combatant groups.
   */
  setCombatantGroups() {
    new OSECombatGroupSelector().render({ force: true, focus: true });
  }

  /** @override */
  _sortCombatants(a, b) {
    // First sort by initiative
    const ia = Number.isNumeric(a.initiative) ? a.initiative : Number.NEGATIVE_INFINITY;
    const ib = Number.isNumeric(b.initiative) ? b.initiative : Number.NEGATIVE_INFINITY;
    // Two unrolled initiatives give NaN, which falls through to the tie-breaks.
    const initiativeDiff = ib - ia;
    if (initiativeDiff) return initiativeDiff;

    // If still tied, sort by group name if available
    if (a.group?.name && b.group?.name && a.group?.name !== b.group?.name) {
      const colorsKeys = Object.keys(OSECombat.GROUPS);
      const indexA = colorsKeys.indexOf(a.group.name);
      const indexB = colorsKeys.indexOf(b.group.name);

      const colorDiff = indexA - indexB;
      if (colorDiff !== 0) return colorDiff;
    }

    // If still tied, sort by disposition
    // Higher values of CONST.TOKEN_DISPOSITIONS are sorted first (e.g. Friendly).
    const dispositionA = a.disposition ?? CONST.TOKEN_DISPOSITIONS.NEUTRAL;
    const dispositionB = b.disposition ?? CONST.TOKEN_DISPOSITIONS.NEUTRAL;
    if (dispositionA !== dispositionB) {
      // Return negative to prioritize higher disposition values
      return dispositionB - dispositionA;
    }

    // If still tied, sort by player ownership and retainer status together
    // Player-owned combatants come before non-player-owned ones
    if (a.hasPlayerOwner !== b.hasPlayerOwner) {
      return a.hasPlayerOwner ? -1 : 1;
    }
    if (a.hasPlayerOwner && b.hasPlayerOwner) {
      // Both are player-owned, sort non-retainers first
      const isRetainerA = !!a.system?.retainer?.enabled;
      const isRetainerB = !!b.system?.retainer?.enabled;
      if (isRetainerA !== isRetainerB) {
        return isRetainerA ? 1 : -1; // Reverse order for player-owned
      }
    } else if (!a.hasPlayerOwner && !b.hasPlayerOwner) {
      // For non-player owned, sort retainers before non-retainers
      const isRetainerA = !!a.system?.retainer?.enabled;
      const isRetainerB = !!b.system?.retainer?.enabled;
      if (isRetainerA !== isRetainerB) {
        return isRetainerA ? -1 : 1;
      }
    }

    if (a.name && a.name === b.name) {
      // Use ID comparison if the names are the same
      return a.id > b.id ? 1 : -1;
    }

    return (a.name || "").localeCompare(b.name || "");
  }
}
