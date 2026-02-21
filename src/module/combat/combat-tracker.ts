import { OSE } from "../config";
import { OSECombatant } from "./combatant";

export default class OSECombatTracker extends foundry.applications.sidebar.tabs.CombatTracker {
  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    ...foundry.applications.sidebar.tabs.CombatTracker.DEFAULT_OPTIONS,
    actions: {
      ...foundry.applications.sidebar.tabs.CombatTracker.DEFAULT_OPTIONS.actions,
      casting: OSECombatTracker.#onCombatantControl,
      retreat: OSECombatTracker.#onCombatantControl,
    },
  };

  /** @inheritDoc */
  async _prepareTrackerContext(context, options) {
    await super._prepareTrackerContext(context, options);
    context.turns?.forEach((turn) => {
      const combatant = game.combat.combatants.get(turn.id);
      turn.isSlowed = turn.initiative === `${OSECombatant.INITIATIVE_VALUE_SLOWED}`;
      turn.isCasting = !!combatant.getFlag(game.system.id, "prepareSpell");
      turn.isRetreating = !!combatant.getFlag(game.system.id, "moveInCombat");
      turn.isOwnedByUser = !!combatant.actor?.isOwner;
      turn.group = combatant.group;
    });
    return context;
  }

  /** @inheritDoc */
  static #onCombatantControl(...args) {
    // biome-ignore lint/complexity/noThisInStatic: v2 Applications have `this` bound to the instance
    return this._onCombatantControl(...args);
  }

  /**
   * Handle performing some action for an individual combatant.
   *
   * @param {PointerEvent} event - The triggering event.
   * @param {HTMLElement} target - The action target element.
   * @protected
   */
  async _onCombatantControl(event, target) {
    event.preventDefault();
    event.stopPropagation();
    const btn = target || event.currentTarget;
    const { combatantId } = btn.closest(".combatant").dataset;
    const combatant = this.viewed.combatants.get(combatantId);
    const action = btn.dataset.control || btn.dataset.action;
    switch (action) {
      case "casting":
        await this.#toggleFlag(combatant as OSECombatant, "prepareSpell");
        return super._onCombatantControl(event, target);

      case "retreat":
        await this.#toggleFlag(combatant as OSECombatant, "moveInCombat");
        return super._onCombatantControl(event, target);
    }
    return super._onCombatantControl(event, target);
  }

  /** @override */
  _configureRenderOptions(options: object) {
    super._configureRenderOptions(options);

    // Replace the tracker template
    this.constructor.PARTS.tracker.template = `${OSE.systemPath()}/templates/sidebar/combat-tracker-combatant.hbs`;

    return options;
  }

  /**
   * Toggle a boolean flag value on the combatant.
   *
   * @param {OSECombatant} combatant - The combatant to toggle the flag on.
   * @param {string} flag - The flag name to toggle.
   * @private
   */
  async #toggleFlag(combatant: OSECombatant, flag: string) {
    const isActive = !!combatant.getFlag(game.system.id, flag);
    await combatant.setFlag(game.system.id, flag, !isActive);
  }

  /**
   * Get context menu entries for Combatants in the tracker.
   *
   * @returns {ContextMenuEntry[]}
   * @protected
   */
  _getEntryContextOptions() {
    const options = super._getEntryContextOptions();
    return [
      {
        name: game.i18n.localize("OSE.combat.SetCombatantAsActive"),
        icon: '<i class="fas fa-star-of-life"></i>',
        callback: (li: HTMLElement) => {
          const { combatantId } = li.dataset;
          const turnToActivate = this.viewed.turns.findIndex((t: OSECombatant) => t.id === combatantId);
          this.viewed.activateCombatant(turnToActivate);
        },
      },
      ...options,
    ];
  }

  /**
   * Adjust initiative tracker to group combatants.
   *
   * @param {HTMLElement} html - The combat tracker being rendered.
   */
  async renderGroups(html: HTMLElement) {
    if (!this.viewed || game.settings.get(game.system.id, "initiative") !== "group") {
      return;
    }

    const headerButtonContainer = html.querySelector(".combat-tracker-header .control-buttons");
    if (headerButtonContainer) {
      // Replace the buttons with the OSE versions
      const reRollButton = document.createElement("button");
      reRollButton.type = "button";
      reRollButton.classList.add("inline-control", "combat-control", "combat-button", "icon", "fa-solid", "fa-dice");
      reRollButton.dataset.action = "smartRerollInitiative";
      reRollButton.dataset.tooltip = game.i18n.localize("OSE.Reroll");
      reRollButton.ariaLabel = game.i18n.localize("OSE.Reroll");

      const setCombatantGroupsButton = document.createElement("button");
      setCombatantGroupsButton.type = "button";
      setCombatantGroupsButton.classList.add(
        "inline-control",
        "combat-control",
        "combat-button",
        "icon",
        "fa-solid",
        "fa-flag",
      );
      setCombatantGroupsButton.dataset.action = "setCombatantGroups";
      setCombatantGroupsButton.dataset.tooltip = game.i18n.localize("OSE.combat.SetCombatantGroups");
      setCombatantGroupsButton.ariaLabel = game.i18n.localize("OSE.combat.SetCombatantGroups");

      headerButtonContainer.replaceChildren(reRollButton, setCombatantGroupsButton);
    }

    const list = html.querySelector(".directory-list, .combat-tracker");
    for (const combatantGroup of this.viewed?.groups?.values() ?? []) {
      if (!combatantGroup.members?.size) {
        continue;
      }

      const children =
        list?.querySelectorAll(
          [...combatantGroup.members.map((c: OSECombatant) => `[data-combatant-id="${c?.id}"]`)].join(", "),
        ) || [];
      if (children.length === 0) {
        continue;
      }

      const label = combatantGroup.name;
      const groupContainer = document.createElement("li");

      const initiativeCounter = document.createElement("span");
      initiativeCounter.classList.add("create-button");
      initiativeCounter.style.fontSize = "1.25em";
      initiativeCounter.style.fontWeight = "600";
      initiativeCounter.style.flex = "0 0 20px";
      initiativeCounter.style.textAlign = "center";

      if (label === "slow") {
        initiativeCounter.innerHTML = `<i class="fa fa-weight-hanging"></i>`;
      } else {
        initiativeCounter.textContent = combatantGroup.initiative;
      }

      const groupHeader = document.createElement("div");
      groupHeader.className = "group-header flexrow";
      groupHeader.style.background = `linear-gradient(90deg, var(--ose-group-color-${label}, ${label}), transparent)`;

      const tokenName = document.createElement("div");
      tokenName.className = "token-name";

      const nameStrong = document.createElement("strong");
      nameStrong.className = "name";

      const diceIcon = document.createElement("i");
      diceIcon.className = "fas fa-dice-d6";
      nameStrong.append(diceIcon);

      nameStrong.append(" ", game.i18n.localize(label === "slow" ? "OSE.items.Slow" : `OSE.colors.${label}`));

      tokenName.append(nameStrong);
      groupHeader.append(tokenName);
      groupHeader.append(initiativeCounter.cloneNode(true));

      const wrapper = document.createElement("div");
      wrapper.className = "wrapper";

      const groupChildren = document.createElement("ol");
      groupChildren.className = "group-children";
      wrapper.append(groupChildren);

      groupContainer.append(groupHeader);
      groupContainer.append(wrapper);
      groupContainer.dataset.groupKey = label;
      groupContainer.dataset.initiative = label === "slow" ? "-1" : combatantGroup.initiative;
      children[0].before(groupContainer);
      groupContainer.querySelector(".group-children")?.replaceChildren(...children);
    }
  }
}
