import { isAbilityOwned } from "../classes/abilities";
import { statChanges } from "../classes/changes";
import { abilitiesGrantedBy } from "../classes/granted";
import {
  applyXpBonus,
  divideHp,
  formatHp,
  hdFlatBonus,
  rollableHd,
  SAVE_KEYS,
  splitStartingHp,
  splitXp,
} from "../classes/progression";
import { tableRowValues } from "../classes/tables";
import OSE from "../config";
import skipRollDialogCheck from "../helpers-behaviour";
import OseDice from "../helpers-dice";
import OseItem from "../item/entity";

/**
 * Used in the rollAttack function to remove zeroes from rollParts arrays
 *
 * @param {[]} arr - an array
 * @returns {[]} - an array
 */
const removeFalsyElements = (arr) => arr.filter((b) => b);

export default class OseActor extends Actor {
  static migrateData(source) {
    // Fixing missing img
    if (source?.img === "") {
      source.img = "icons/svg/mystery-man.svg";
    }
    if (source?.prototypeToken?.texture?.img === "") {
      source.prototypeToken.texture.img = "icons/svg/mystery-man.svg";
    }
    // Fixing missing movement.value by moving it to details.movement
    if (source?.system?.movement?.value && !source?.system?.details.movement) {
      source.system.details.movement = source.system.movement.value;
      delete source.system.movement.value;
    }

    return source;
  }

  // Class table values for formulas, e.g. @classTables.thief.skills.hs.
  getRollData() {
    const data = super.getRollData();
    if (this.type !== "character") return data;
    const classes = this.system.classes ?? [];
    if (classes.length) {
      data.classTables = Object.fromEntries(
        classes.map((c) => [c.system.key || c.id, tableRowValues(c.system.tables ?? [], c.system.level)]),
      );
    }
    return data;
  }

  async update(data, options = {}) {
    const newData = { ...data };
    const {
      "system.ac.value": acValue,
      "system.aac.value": aacValue,
      "system.ac.mod": acMod,
      "system.aac.mod": aacMod,
      "system.thac0.bba": bbaValue,
      "system.thac0.value": thac0Value,
    } = newData;
    // Compute AAC from AC
    if (acValue !== undefined) {
      newData["system.aac.value"] = 19 - acValue;
    } else if (aacValue !== undefined) {
      newData["system.ac.value"] = 19 - aacValue;
    }

    // Ensure AAC and AC have the same mod value
    if (acMod !== undefined) {
      newData["system.aac.mod"] = acMod;
    } else if (aacMod !== undefined) {
      newData["system.ac.mod"] = aacMod;
    }

    // Compute Thac0 from BBA
    if (thac0Value !== undefined) {
      newData["system.thac0.bba"] = 19 - thac0Value;
    } else if (bbaValue !== undefined) {
      newData["system.thac0.value"] = 19 - bbaValue;
    }

    return super.update(newData, options);
  }

  async createEmbeddedDocuments(embeddedName, data = [], context = {}) {
    data.forEach((item) => {
      if (item.img === undefined) {
        item.img = OseItem.defaultIcons[item.type];
      }
    });
    return super.createEmbeddedDocuments(embeddedName, data, context);
  }

  /* -------------------------------------------- */
  /*  Socket Listeners and Handlers
    /* -------------------------------------------- */
  async getExperience(value, _options = {}) {
    if (this.type !== "character") return;
    const classes = this.system.classes;
    let gained;
    if (classes.length) {
      const shares = splitXp(value, classes.length).map((share, i) => {
        return applyXpBonus(share, this.system.classXpBonus(classes[i]) + this.system.xpBonusFromEffects);
      });
      await this.updateEmbeddedDocuments(
        "Item",
        classes.map((c, i) => ({ _id: c.id, "system.xp": c.system.xp + shares[i] })),
      );
      gained = shares.reduce((sum, n) => sum + n, 0);
    } else {
      gained = Math.floor(value + (this.system.details.xp.bonus * value) / 100);
      await this.update({ "system.details.xp.value": gained + this.system.details.xp.value });
    }
    ChatMessage.create({
      content: game.i18n.format("OSE.messages.GetExperience", { name: this.name, value: gained }),
      speaker: ChatMessage.getSpeaker({ actor: this }),
    });
  }

  /**
   * Advance a class one level.
   *
   * @param {Item} classItem - An embedded class item
   */
  async levelUp(classItem) {
    const { system } = classItem;
    if (!system.nextRow) return;
    const before = this.classStats();
    const { gain, formula, fixed, roll } = await this.#rollLevelHp(classItem, system.level + 1);
    const count = this.system.classes.length || 1;
    const { whole, fraction } = divideHp(gain, count, this.system.hp.fraction ?? 0);
    await classItem.update({ "system.level": system.level + 1 });
    await this.update({
      "system.hp.max": (this.system.hp.max || 0) + whole,
      "system.hp.value": (this.system.hp.value || 0) + whole,
      "system.hp.fraction": fraction,
    });
    await this.postClassChanges(
      classItem,
      before,
      { rolls: [formula], gain, count, fixed, dice: roll ? [roll] : [] },
      { levelUp: true },
    );
    await this.offerAbilities(classItem, classItem.system.level);
  }

  // HP for reaching a level.
  async #rollLevelHp(classItem, level) {
    const { levels, hitDie } = classItem.system;
    const row = levels[level - 1];
    if (row && !row.hdcon) {
      const gain = hdFlatBonus(row.hd) - hdFlatBonus(levels[level - 2]?.hd ?? "");
      return { gain, formula: String(gain), fixed: true };
    }
    const die = hitDie || "1d6";
    const con = this.system.scores.con.mod || 0;
    // At least 1 HP per level, regardless of CON penalty.
    const formula = con ? `max(${die} ${con > 0 ? "+" : "-"} ${Math.abs(con)}, 1)` : die;
    const roll = await new Roll(formula).evaluate();
    return { gain: roll.total, formula, roll };
  }

  /**
   * Roll hit points for each level of a class added above 1st level.
   *
   * @param {Item} classItem - An embedded class item
   * @param {number} toLevel - The level the class starts at
   */
  async rollStartingHp(classItem, toLevel) {
    const rolls = [];
    for (let level = 1; level <= toLevel; level++) rolls.push(await this.#rollLevelHp(classItem, level));
    const gain = rolls.reduce((sum, r) => sum + r.gain, 0);
    const prevCount = Math.max(0, this.system.classes.length - 1);
    const { max = 0, value = 0, fraction: prevFraction = 0 } = this.system.hp;
    const { whole, fraction } = splitStartingHp({ max, fraction: prevFraction }, prevCount, gain);
    const update = {
      "system.hp.max": whole,
      "system.hp.value": prevCount ? (value || 0) + whole - (max || 0) : whole,
      "system.hp.fraction": fraction,
    };
    Hooks.callAll("ose.preApplyStartingHp", this, classItem, update);
    await this.update(update);
    return {
      rolls: rolls.map((r) => r.gain),
      gain,
      prevTotal: (max + prevFraction) * prevCount,
      count: prevCount + 1,
      dice: rolls.map((r) => r.roll).filter(Boolean),
    };
  }

  // The stats a class drives, for before/after comparison.
  classStats() {
    const { hp, thac0, saves, spells } = this.system;
    return {
      hp: (hp.max ?? 0) + (hp.fraction ?? 0),
      thac0: thac0.value ?? 0,
      saves: Object.fromEntries(SAVE_KEYS.map((k) => [k, saves[k]?.value ?? 0])),
      spells: Object.fromEntries([1, 2, 3, 4, 5, 6].map((l) => [l, spells?.slots?.[l]?.max ?? 0])),
    };
  }

  /**
   * Post a chat card describing what adding a class or levelling one up changed.
   *
   * @param {Item} classItem - The class just added or levelled up
   * @param {object} before - {@link classStats} from before the change
   * @param {object} [hp] - The hit points gained: { rolls, gain, count, prevTotal?, fixed? }
   * @param {object} [options]
   * @param {boolean} [options.levelUp] - Whether this was a level-up rather than a new class
   * @param {string} [options.title] - Replaces the default title
   * @param {string[]} [options.lines] - Extra paragraphs, before the stat changes
   * @param {{key: string, value: string}[]} [options.kept] - Adjustments kept from before a conversion
   */
  async postClassChanges(classItem, before, hp, { levelUp = false, title, lines = [], kept = [] } = {}) {
    const i18n = game.i18n;
    const key = (k) => `OSE.classes.changes.${k}`;
    const labels = {
      hp: i18n.localize("OSE.Health"),
      thac0: i18n.localize("OSE.Thac0"),
      ...Object.fromEntries(SAVE_KEYS.map((k) => [`saves.${k}`, i18n.localize(`OSE.saves.${k}.long`)])),
      ...Object.fromEntries(
        [1, 2, 3, 4, 5, 6].map((l) => [`spells.${l}`, i18n.format(key("SpellSlots"), { level: l })]),
      ),
      hd: i18n.localize("OSE.HitDice"),
    };
    const show = (k, v) => (k === "hp" ? formatHp(v) : v);
    const changes = statChanges(before, this.classStats()).map((c) => ({
      label: labels[c.key],
      from: show(c.key, c.from),
      to: show(c.key, c.to),
    }));
    const { max, fraction } = this.system.hp;
    const split = () =>
      levelUp
        ? i18n.format(key("LevelSplit"), { gain: hp.gain, count: hp.count, share: formatHp(hp.gain / hp.count) })
        : i18n.format(key("Split"), {
            prev: formatHp(hp.prevTotal),
            gain: hp.gain,
            count: hp.count,
            result: formatHp(max + (fraction || 0)),
          });
    const content = await foundry.applications.handlebars.renderTemplate(
      `${OSE.systemPath()}/templates/chat/class-changes.html`,
      {
        img: classItem.img,
        title:
          title ??
          i18n.format(key(levelUp ? "LevelTitle" : "Title"), {
            cls: classItem.name,
            level: classItem.system.level,
          }),
        lines,
        kept: kept.map((k) => ({ label: labels[k.key] ?? k.key, value: k.value })),
        keptTitle: kept.length && i18n.format(key("Kept"), { effect: i18n.localize("OSE.migration.EffectName") }),
        rolled:
          hp &&
          (hp.fixed
            ? i18n.format(key("Fixed"), { gain: hp.gain })
            : i18n.format(key("Rolled"), { rolls: hp.rolls.join(" + "), gain: hp.gain })),
        split: hp?.count > 1 && split(),
        changes,
        dice: await Promise.all((hp?.dice ?? []).map((r) => r.render())),
      },
    );
    return ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: this }), content });
  }

  /**
   * Offer the abilities an item grants at a level.
   *
   * @param {Item} item - An embedded class or race item
   * @param {number} level - The level just reached
   */
  async offerAbilities(item, level, { upTo = false } = {}) {
    if (!game.settings.get(game.system.id, "promptAddClassAbilities")) return;
    const owned = this.items
      .filter((i) => i.type === "ability")
      .map((i) => ({
        name: i.name,
        requirements: i.system.requirements ?? "",
        source: i._stats?.compendiumSource ?? i.flags?.core?.sourceId ?? "",
      }));
    const entries = [];
    for (const entry of (item.system.abilities ?? []).filter((a) => (upTo ? a.level <= level : a.level === level))) {
      const doc = await fromUuid(entry.uuid);
      if (!doc) continue;
      const candidate = { name: doc.name, requirements: doc.system?.requirements ?? "", uuid: entry.uuid };
      if (!isAbilityOwned(owned, candidate)) entries.push({ doc, entry });
    }
    if (!entries.length) return;
    const list = entries.map(({ doc }) => `<li>${foundry.utils.escapeHTML(doc.name)}</li>`).join("");
    const ok = await foundry.applications.api.DialogV2.confirm({
      window: { title: item.name },
      content: `<p>${game.i18n.localize("OSE.classes.AddAbilities")}</p><ul>${list}</ul>`,
      rejectClose: false,
    });
    if (!ok) return;
    const scope = game.system.id;
    const grantedBy = { type: item.type, key: item.system.key };
    const data = entries.map(({ doc, entry }) => {
      const base = doc.pack ? game.items.fromCompendium(doc) : doc.toObject();
      const flags = { grantedBy };
      const target = item.type === "class" ? entry.target || doc.system?.targetFrom : "";
      if (target) flags.classTarget = { classKey: item.system.key, target };
      return foundry.utils.mergeObject(base, { flags: { [scope]: flags } });
    });
    await this.createEmbeddedDocuments("Item", data);
  }

  /**
   * Delete a class or race, offering to delete the abilities it granted.
   *
   * @param {Item} item - An embedded class or race item
   */
  async removeGrantingItem(item) {
    const scope = game.system.id;
    const links = [];
    for (const { uuid } of item.system.abilities ?? []) {
      const doc = await fromUuid(uuid);
      if (doc) links.push({ uuid, name: doc.name, requirements: doc.system?.requirements ?? "" });
    }
    const owned = this.items
      .filter((i) => i.type === "ability")
      .map((i) => ({
        id: i.id,
        name: i.name,
        requirements: i.system.requirements ?? "",
        source: i._stats?.compendiumSource ?? i.flags?.core?.sourceId ?? "",
        grantedBy: i.getFlag(scope, "grantedBy"),
      }));
    const ids = abilitiesGrantedBy({ type: item.type, system: item.system, links }, owned);
    const esc = foundry.utils.escapeHTML;
    const boxes = ids
      .map(
        (id) =>
          `<label class="checkbox"><input type="checkbox" name="${id}" checked> ${esc(this.items.get(id).name)}</label>`,
      )
      .join("");
    const content = ids.length
      ? `<p>${game.i18n.format("OSE.classes.RemoveWithAbilities", { name: esc(item.name) })}</p><div class="granted-abilities">${boxes}</div>`
      : `<p>${game.i18n.format("OSE.dialog.confirmDeleteItem", { name: esc(item.name) })}</p>`;
    const chosen = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize("OSE.dialog.deleteItem") },
      content,
      yes: { callback: (_event, button) => ids.filter((id) => button.form.elements[id]?.checked) },
      rejectClose: false,
    });
    if (!chosen) return;
    await this.deleteEmbeddedDocuments("Item", [item.id, ...chosen]);
  }

  isNew() {
    return this.system.isNew;
  }

  /** @inheritDoc */
  // eslint-disable-next-line no-underscore-dangle
  async _preCreate(data, options, user) {
    // eslint-disable-next-line no-underscore-dangle
    await super._preCreate(data, options, user);

    // If this Actor came from a Compendium, do not change the values.
    // eslint-disable-next-line no-underscore-dangle
    if (this._stats?.compendiumSource?.startsWith("Compendium.")) return;

    // Configure prototype token settings
    const prototypeToken = {};
    if (this.type === "character") {
      Object.assign(prototypeToken, {
        // Only set actorLink if it's not already defined
        ...(data.prototypeToken?.actorLink === undefined && {
          actorLink: true,
        }),
        ...(data.prototypeToken?.disposition === undefined && {
          disposition: foundry.CONST.TOKEN_DISPOSITIONS.FRIENDLY,
        }),
      });
    }
    this.updateSource({ prototypeToken });
  }

  get isOwnerOrObserver() {
    return this.isOwner || this.testUserPermission(game.user, CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER);
  }

  generateSave(hd) {
    const parsedHd = hd.includes("+") ? Number.parseInt(hd, 10) + 1 : Number.parseInt(hd, 10);

    // Compute saves
    let saves = {};
    for (let i = 0; i <= parsedHd; i++) {
      const tmp = CONFIG.OSE.monster_saves[i];
      if (tmp) {
        saves = tmp;
      }
    }

    // Compute Thac0
    let thac0 = 20;
    Object.keys(CONFIG.OSE.monster_thac0).forEach((k) => {
      if (hd < Number.parseInt(k, 10)) return;
      thac0 = CONFIG.OSE.monster_thac0[k];
    });

    this.update({
      "system.thac0.value": thac0,
      "system.thac0.bba": 19 - thac0,
      "system.saves": {
        death: {
          value: saves.d,
        },
        wand: {
          value: saves.w,
        },
        paralysis: {
          value: saves.p,
        },
        breath: {
          value: saves.b,
        },
        spell: {
          value: saves.s,
        },
      },
    });
  }

  /* -------------------------------------------- */
  /*  Rolls                                       */
  /* -------------------------------------------- */

  async rollHP(_options = {}) {
    const { total } = await new Roll(this.system.hp.hd).evaluate();
    return this.update({ "system.hp": { max: total, value: total } });
  }

  rollSave(save, options = {}) {
    const label = game.i18n.localize(`OSE.saves.${save}.long`);
    const rollParts = ["1d20"];
    const actorData = this.system;
    const actorType = this.type;

    const data = {
      actor: this,
      roll: {
        type: "above",
        target: actorData.saves[save].value,
        magic: actorType === "character" ? actorData.scores.wis.mod + actorData.details.magic.bonus : 0,
        poison: actorType === "character" ? actorData.details.magic.bonus : 0,
      },
      details: game.i18n.format("OSE.roll.details.save", { save: label }),
    };

    const rollMethod = actorType === "character" ? OseDice.RollSave : OseDice.Roll;

    // Roll and return
    return rollMethod({
      event: options.event,
      parts: rollParts,
      data,
      skipDialog: options.fastForward || skipRollDialogCheck(options.event),
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: game.i18n.format("OSE.roll.save", { save: label }),
      title: game.i18n.format("OSE.roll.save", { save: label }),
      chatMessage: options.chatMessage,
    });
  }

  rollMorale(options = {}) {
    const actorData = this.system;

    const rollParts = ["2d6"];

    const data = {
      actor: this,
      roll: {
        type: "below",
        target: actorData.details.morale,
      },
    };

    // Roll and return
    return OseDice.Roll({
      event: options.event,
      parts: rollParts,
      data,
      skipDialog: true,
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: game.i18n.localize("OSE.roll.morale"),
      title: game.i18n.localize("OSE.roll.morale"),
    });
  }

  rollLoyalty(options = {}) {
    const label = game.i18n.localize("OSE.roll.loyalty");
    const rollParts = ["2d6"];

    const actorData = this.system;

    const data = {
      actor: this,
      roll: {
        type: "below",
        target: actorData.retainer.loyalty,
      },
    };

    // Roll and return
    return OseDice.Roll({
      event: options.event,
      parts: rollParts,
      data,
      skipDialog: true,
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: label,
      title: label,
    });
  }

  rollReaction(options = {}) {
    const rollParts = ["2d6"];

    const data = {
      actor: this,
      roll: {
        type: "table",
        table: {
          2: game.i18n.format("OSE.reaction.Hostile", {
            name: this.name,
          }),
          3: game.i18n.format("OSE.reaction.Unfriendly", {
            name: this.name,
          }),
          6: game.i18n.format("OSE.reaction.Neutral", {
            name: this.name,
          }),
          9: game.i18n.format("OSE.reaction.Indifferent", {
            name: this.name,
          }),
          12: game.i18n.format("OSE.reaction.Friendly", {
            name: this.name,
          }),
        },
      },
    };

    // Roll and return
    return OseDice.Roll({
      event: options.event,
      parts: rollParts,
      data,
      skipDialog: options.fastForward || skipRollDialogCheck(options.event),
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: game.i18n.localize("OSE.reaction.check"),
      title: game.i18n.localize("OSE.reaction.check"),
    });
  }

  rollCheck(score, options = {}) {
    const actorType = this.type;

    if (actorType !== "character") return;

    const actorData = this.system;

    const label = game.i18n.localize(`OSE.scores.${score}.long`);
    const rollParts = ["1d20"];

    const data = {
      actor: this,
      roll: {
        type: "check",
        target: actorData.scores[score].value,
      },

      details: game.i18n.format("OSE.roll.details.attribute", {
        score: label,
      }),
    };

    // Roll and return
    return OseDice.Roll({
      event: options.event,
      parts: rollParts,
      data,
      skipDialog: options.fastForward || skipRollDialogCheck(options.event),
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: game.i18n.format("OSE.roll.attribute", { attribute: label }),
      title: game.i18n.format("OSE.roll.attribute", { attribute: label }),
      chatMessage: options.chatMessage,
    });
  }

  rollHitDice(options = {}) {
    const actorType = this.type;

    const actorData = this.system;

    const label = game.i18n.localize("OSE.roll.hd");
    const hd = rollableHd(actorData.hp.hd);
    let rollParts = [hd];

    if (actorType === "character") {
      // A character always gains at least 1 hit point per Hit Die,
      // regardless of CON modifier.
      rollParts = [`max(${hd} + ${actorData.scores.con.mod * actorData.details.level}, ${hd[0]})`];
    }

    const data = {
      actor: this,
      roll: {
        type: "hitdice",
      },
    };

    // Roll and return
    return OseDice.Roll({
      event: options.event,
      parts: rollParts,
      data,
      skipDialog: true,
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: label,
      title: label,
    });
  }

  rollAppearing(options = {}) {
    const actorType = this.type;
    if (actorType !== "monster") return;

    const actorData = this.system;

    const rollParts = [];
    let label = "";
    if (options.check === "wilderness") {
      rollParts.push(actorData.details.appearing.w);
      label = game.i18n.localize("OSE.roll.appearingWilderness");
    } else {
      rollParts.push(actorData.details.appearing.d);
      label = game.i18n.localize("OSE.roll.appearingDungeon");
    }
    const data = {
      actor: this,
      roll: {
        type: {
          type: "appearing",
        },
      },
    };

    // Roll and return
    return OseDice.Roll({
      event: options.event,
      parts: rollParts,
      data,
      skipDialog: true,
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: game.i18n.format("OSE.roll.appearing", { type: label }),
      title: game.i18n.format("OSE.roll.appearing", { type: label }),
    });
  }

  /**
   * @param {import("../config").ExplorationSkill} expl - the exploration skill to test
   * @param {object} options - roll options
   * @param {Event} [options.event] - the originating UI event, used to position the roll dialog
   * @param {boolean} [options.fastForward] - whether to skip the roll dialog
   * @returns {OseDice.Roll | undefined} - the roll, or nothing for a non-character actor
   */
  rollExploration(expl, options = {}) {
    const actorType = this.type;
    if (actorType !== "character") return;
    const actorData = this.system;

    const label = game.i18n.localize(`OSE.exploration.${expl}.long`);
    const rollParts = ["1d6"];

    const data = {
      actor: this,
      roll: {
        type: "below",
        target: actorData.exploration[expl],
        blindroll: true,
      },
      details: game.i18n.format("OSE.roll.details.exploration", {
        expl: label,
      }),
    };

    // Roll and return
    return OseDice.Roll({
      event: options.event,
      parts: rollParts,
      data,
      skipDialog: options.fastForward || skipRollDialogCheck(options.event),
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: game.i18n.format("OSE.roll.exploration", { exploration: label }),
      title: game.i18n.format("OSE.roll.exploration", { exploration: label }),
    });
  }

  async rollDamage(attData, options = {}) {
    const data = this.system;

    const rollData = {
      actor: this,
      item: attData.item,
      roll: {
        type: "damage",
      },
    };

    const dmgParts = [];
    if (attData.roll?.dmg) {
      dmgParts.push(attData.roll.dmg);
    } else {
      dmgParts.push("1d6");
    }

    // Add Str to damage
    if (attData.roll?.type === "melee" && data.scores.str.mod) {
      dmgParts.push(data.scores.str.mod);
    }

    // Damage roll
    return OseDice.Roll({
      event: options.event,
      parts: dmgParts,
      data: rollData,
      skipDialog: true,
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: `${attData.label} - ${game.i18n.localize("OSE.Damage")}`,
      title: `${attData.label} - ${game.i18n.localize("OSE.Damage")}`,
    });
  }

  async targetAttack(data, type, options) {
    if (game.user.targets.size > 0) {
      for (const t of game.user.targets.values()) {
        data.roll.target = t;
        await this.rollAttack(data, {
          type,
          skipDialog: options.skipDialog,
        });
      }
    } else {
      await this.rollAttack(data, { type, skipDialog: options.skipDialog });
    }
  }

  /**
   * Constructs the attack roll formula for an attack
   *
   * @param {object} attData - the attack data
   * @param {OseItem} attData.item - the item being used in the attack
   * @param {OseActor} attData.actor - this actor (at least it should be!)
   * @param {object} attData.roll - the attack roll data
   * @param {string} attData.roll.save - the save roll that may be used against the attack
   * @param {OseActor} attData.roll.target - the target of the attack
   * @param {object} options - the type of attack and whether to skip the dialog
   * @param {string} options.type - the type of attack, i.e. melee or missile
   * @param {boolean} options.skipDialog - whether to skip the dialog
   * @returns {OseDice.Roll} - the attack roll with completed rollParts and other data
   */
  rollAttack(attData, options = {}) {
    const data = this.system;

    const label = attData.item
      ? game.i18n.format("OSE.roll.attacksWith", {
          name: attData.item.name,
        })
      : game.i18n.format("OSE.roll.attacks", {
          name: this.name,
        });

    const dmgParts = removeFalsyElements([
      // Weapon damage roll value
      attData.item?.system?.damage ?? "1d6",
    ]);

    // Weapon Damage Bonus
    const globalIgnoreAttackBonusOnDamageRoll = game.settings.get(game.system.id, "ignoreAttackBonusOnDamageRoll");

    // Global and per-actor flag to ignore bonus dmg are set
    if (!globalIgnoreAttackBonusOnDamageRoll && !this.system.config?.ignoreBonusDamage && attData.item?.system?.bonus)
      dmgParts.push(attData.item?.system?.bonus);

    const rollParts = ["1d20"];
    const ascending = game.settings.get(game.system.id, "ascendingAC");

    if (ascending && data.thac0.bba) rollParts.push(data.thac0.bba);

    // for each type of attack, add the Tweaks bonus
    // and str/dex modifier only if it's non-zero
    let attackMods = [];

    if (options.type === "melee") attackMods = [data.scores.str.mod, data.thac0.mod.melee];

    dmgParts.push(...removeFalsyElements(attackMods));

    // Add missile mod to attack roll only (missile attacks don't get bonus damage)
    if (options.type === "missile") attackMods = [data.scores.dex.mod, data.thac0.mod.missile];

    // Add weapon bonus to attack roll only (already added to dmgParts)
    if (attData.item) attackMods.push(attData.item?.system?.bonus);

    rollParts.push(...removeFalsyElements(attackMods));

    const rollData = {
      actor: this,
      item: attData.item,
      itemId: attData.item?._id,
      roll: {
        type: options.type,
        thac0: data.thac0.value,
        dmg: dmgParts,
        save: attData.roll.save,
        target: attData.roll.target,
      },
    };
    // Roll and return
    return OseDice.Roll({
      event: options.event,
      parts: rollParts,
      data: rollData,
      skipDialog: options.skipDialog,
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: label,
      flags: { ose: { roll: "attack", itemId: attData.item?._id } },
      title: label,
    });
  }

  /**
   * @param {number | string} amount
   * @param {1 | -1} multiplier
   * @returns
   */
  async applyDamage(amount = 0, multiplier = 1) {
    const damage = Math.floor(Number.parseInt(amount, 10) * multiplier);

    const { value, max } = this.system.hp;

    // Update the Actor
    return this.update({
      "system.hp.value": Math.clamp(value - damage, 0, max),
    });
  }
}
