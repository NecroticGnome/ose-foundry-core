/**
 * @file Extend the basic ActorSheet with some very simple modifications
 */
import { describeDerivation } from "../classes/derive";
import { currentRows } from "../classes/tables";
import OSE from "../config";
import OseCharacterCreator from "../dialog/character-creation";
import OseCharacterGpCost from "../dialog/character-gp-cost";
import OseCharacterModifiers from "../dialog/character-modifiers";
import skipRollDialogCheck from "../helpers-behaviour";
import { convertSingleActor } from "../migration/convert-actor";
import { toggleItemEquipped } from "../sheet/inventory-actions";
import OseActorSheet from "./actor-sheet";
import { prepareExplorationSkills } from "./exploration-skills";

const TextEditor = foundry.applications.ux.TextEditor.implementation;

export default class OseActorSheetCharacter extends OseActorSheet {
  static DEFAULT_OPTIONS = {
    classes: ["character"],
    position: { width: 450, height: 558 },
    actions: {
      rollAbilityScore: OseActorSheetCharacter._onRollAbilityScore,
      rollExploration: OseActorSheetCharacter._onRollExploration,
      modifiers: OseActorSheetCharacter._onShowModifiers,
      gpCost: OseActorSheetCharacter._onShowGpCost,
      generateScores: OseActorSheetCharacter._onGenerateScores,
      pushLang: OseActorSheetCharacter._onPushLang,
      popLang: OseActorSheetCharacter._onPopLang,
      toggleEquipped: OseActorSheetCharacter._onToggleEquipped,
      levelUp: OseActorSheetCharacter._onLevelUp,
      convertClass: OseActorSheetCharacter._onConvertClass,
      toggleWarnings: OseActorSheetCharacter._onToggleWarnings,
      toggleClassTables: OseActorSheetCharacter._onToggleClassTables,
      rollClassSkill: OseActorSheetCharacter._onRollClassSkill,
      dismissWarning: OseActorSheetCharacter._onDismissWarning,
    },
  };

  static PARTS = {
    sheet: {
      root: true,
      template: "systems/__SYSTEM_ID__/dist/templates/actors/character-sheet.html",
      scrollable: [
        ...["abilities", "spells", "inventory"].map((tab) => `.tab[data-tab="${tab}"] .resizable`),
        '.tab[data-tab="notes"]',
      ],
    },
  };

  static TABS = {
    primary: {
      tabs: [
        { id: "attributes", label: "OSE.category.attributes" },
        { id: "abilities", label: "OSE.category.abilities" },
        { id: "spells", label: "OSE.category.spells" },
        { id: "inventory", label: "OSE.category.inventory" },
        { id: "notes", label: "OSE.category.notes" },
        { id: "effects", label: "OSE.category.effects" },
      ],
      initial: "attributes",
    },
  };

  _isTabVisible(tabId) {
    if (tabId === "notes") return true;
    if (!this.actor.isOwnerOrObserver) return false;
    if (tabId === "effects") return this._effectsTabEnabled();
    return tabId !== "spells" || this.actor.system.spells.enabled;
  }

  /**
   * Organize and classify Owned Items for Character sheets
   *
   * @param data
   * @private
   */
  _prepareItems(data) {
    // Assign and return
    data.owned = {
      items: this.actor.system.items,
      armors: this.actor.system.armor,
      weapons: this.actor.system.weapons,
      treasures: this.actor.system.treasures,
      containers: this.actor.system.containers,
    };
    data.treasure = this.actor.system.carriedTreasure;
    data.containers = this.actor.system.containers;
    data.abilities = this.actor.system.abilities;
    data.spells = this.actor.system.spells.spellList;
    data.slots = this.actor.system.spellSlots;

    // Sort by sort order (see ActorSheet)
    // biome-ignore lint/suspicious/useIterableCallbackReturn: .sort() is called for side effects on each array, return value unused
    [...Object.values(data.owned), ...Object.values(data?.spells?.spellList || {}), data.abilities].forEach((o) =>
      o.sort((a, b) => (a.sort || 0) - (b.sort || 0)),
    );
  }

  generateScores() {
    OseCharacterCreator.open(this.actor, {
      position: {
        top: this.position.top + 40,
        left: this.position.left + (this.position.width - 400) / 2,
      },
    });
  }

  async _prepareContext(options) {
    const data = await super._prepareContext(options);

    // Prepare owned items
    this._prepareItems(data);

    data.explorationSkills = prepareExplorationSkills(this.actor.system.exploration, this.actor.system.explorationFrom);

    const enrichOptions = { relativeTo: this.actor, secrets: game.user.isGM };
    data.enrichedBiography = await TextEditor.enrichHTML(this.actor.system.details.biography, enrichOptions);
    data.enrichedNotes = await TextEditor.enrichHTML(this.actor.system.details.notes, enrichOptions);

    this._prepareClasses(data);

    return data;
  }

  _prepareClasses(data) {
    const { system } = this.actor;
    data.classes = system.classes.map((c) => ({
      id: c.id,
      name: c.name,
      img: c.img,
      level: c.system.level,
      xp: c.system.xp,
      next: c.system.nextRow?.xp ?? null,
      canLevelUp: c.system.canLevelUp,
      hasTable: c.system.hasTable,
      bonus: system.classXpBonus(c) + system.xpBonusFromEffects,
      tables: this.#classTables(c),
      collapsed: this.#collapsedClasses.has(c.id),
    }));
    data.anyCanLevelUp = data.classes.some((c) => c.canLevelUp);
    const hdParts = system.classes.flatMap((c) =>
      c.system.currentRow?.hd ? [{ name: c.name, hd: c.system.currentRow.hd }] : [],
    );
    data.hdParts = hdParts.length > 1 ? hdParts : null;
    const race = system.race;
    data.race = race ? { id: race.id, name: race.name, img: race.img } : null;
    data.derivedFromClasses = system.derivedFromClasses;
    data.slotsEditable = !system.derivedFromClasses;
    const pooled = system.spellPools?.length > 1 || system.unallocatedSpells?.length > 0;
    data.spellPools = pooled ? system.spellPools : null;
    data.otherSpellLevels = pooled ? system.otherSpellLevels : [];
    data.warnings = (system.warnings ?? []).map((w) => ({ ...w, text: game.i18n.format(w.message, w.data) }));
    data.warnedItems = {};
    for (const w of data.warnings) {
      data.warnedItems[w.itemId] = [data.warnedItems[w.itemId], w.text].filter(Boolean).join(" ");
    }
    data.showWarnings = this._showWarnings && data.warnings.length > 0;
    data.canConvert = !data.classes.length && !!String(this.actor._source.system?.details?.class ?? "").trim();
    data.breakdown = system.derivedFromClasses
      ? foundry.utils.expandObject({
          ...describeDerivation(system.classes, {
            saves: this.#saveValues(),
            thac0: system.thac0.value,
            bba: system.thac0.bba,
          }),
          hd: system.hp.hd,
        })
      : {};
  }

  #saveValues() {
    return Object.fromEntries(Object.entries(this.actor.system.saves).map(([k, s]) => [k, s.value]));
  }

  _promptRemoveItemFromActor(item) {
    if (["class", "race"].includes(item.type)) return this.actor.removeGrantingItem(item);
    return super._promptRemoveItemFromActor(item);
  }

  _processFormData(event, form, formData) {
    const data = super._processFormData(event, form, formData);
    // Prevent the automatic class title from being saved to the character data.
    const details = data.system?.details;
    if (!this.actor._source.system.details.title && details?.title === this.actor.system.details.title) {
      delete details.title;
    }
    // Likewise skills raised by abilities.
    const exploration = data.system?.exploration ?? {};
    for (const key of Object.keys(this.actor.system.explorationFrom ?? {})) {
      if (Number(exploration[key]) === this.actor.system.exploration[key]) delete exploration[key];
    }
    return data;
  }

  _onChangeForm(formConfig, event) {
    const id = event.target.dataset?.classXp;
    if (!id) return super._onChangeForm(formConfig, event);
    return this.actor.items.get(id)?.update({ "system.xp": Number(event.target.value) || 0 });
  }

  async _chooseLang() {
    const choices = CONFIG.OSE.languages;

    const templateData = { choices };
    const dlg = await foundry.applications.handlebars.renderTemplate(
      `${OSE.systemPath()}/templates/actors/dialogs/lang-create.html`,
      templateData,
    );
    // Create Dialog window
    return new Promise((resolve) => {
      new foundry.applications.api.DialogV2({
        window: { title: "" },
        content: dlg,
        buttons: [
          {
            action: "ok",
            label: game.i18n.localize("OSE.Ok"),
            icon: "fas fa-check",
            default: true,
            callback: (_event, button, _html) => {
              resolve(new foundry.applications.ux.FormDataExtended(button.form).object);
            },
          },
          {
            action: "cancel",
            icon: "fas fa-times",
            label: game.i18n.localize("OSE.Cancel"),
            callback: () => {},
          },
        ],
      }).render({ force: true });
    });
  }

  _pushLang(table) {
    const data = this.actor.system;
    let update = data[table]; // V10 compatibility
    this._chooseLang().then((dialogInput) => {
      const name = CONFIG.OSE.languages[dialogInput.choice];
      if (update.value) {
        update.value.push(name);
      } else {
        update = { value: [name] };
      }

      const newData = {};
      newData[table] = update;
      return this.actor.update({ system: newData });
    });
  }

  _popLang(table, lang) {
    const data = this.actor.system;
    const update = data[table].value.filter((el) => el !== lang);
    const newData = {};
    newData[table] = { value: update };
    return this.actor.update({ system: newData });
  }

  /* -------------------------------------------- */

  static _onShowModifiers() {
    OseCharacterModifiers.open(this.actor, {
      position: {
        top: this.position.top + 40,
        left: this.position.left + (this.position.width - 400) / 2,
      },
    });
  }

  /**
   * Prepare shopping cart data by filtering out items that have already been paid for
   */
  async _prepareShoppingCartData() {
    const data = await this._prepareContext({});

    // Filter out items that have been marked as paid
    const filterUnpaidItems = (items) => {
      return items.filter((item) => !item.flags?.ose?.paid);
    };

    // Create a filtered copy of the data with only unpaid items
    const cartData = foundry.utils.deepClone(data);
    if (cartData.owned) {
      cartData.owned.items = filterUnpaidItems(cartData.owned.items || []);
      cartData.owned.weapons = filterUnpaidItems(cartData.owned.weapons || []);
      cartData.owned.armors = filterUnpaidItems(cartData.owned.armors || []);
      cartData.owned.containers = filterUnpaidItems(cartData.owned.containers || []);
    }

    // Also filter the flat items array if it exists
    if (cartData.items) {
      cartData.items = filterUnpaidItems(cartData.items);
    }

    return cartData;
  }

  static async _onShowGpCost() {
    const cartData = await this._prepareShoppingCartData();
    OseCharacterGpCost.open(this.actor, cartData, {
      position: {
        top: this.position.top + 40,
        left: this.position.left + (this.position.width - 400) / 2,
      },
    });
  }

  static _onRollAbilityScore(event, target) {
    const { score, stat } = target.closest(".ability-score").dataset;
    if (score) return this.actor.rollCheck(score, { event });
    if (stat === "lr") return this.actor.rollLoyalty(score, { event });
  }

  static _onRollExploration(event, target) {
    return this.actor.rollExploration(target.closest("[data-exploration]").dataset.exploration, { event });
  }

  static _onGenerateScores() {
    if (this.isEditable) this.generateScores();
  }

  static _onPushLang(_event, target) {
    if (this.isEditable) this._pushLang(target.dataset.array);
  }

  static _onPopLang(_event, target) {
    if (this.isEditable) return this._popLang(target.dataset.array, target.closest("[data-lang]").dataset.lang);
  }

  static _onToggleEquipped(_event, target) {
    const item = this._getItemFromActor(target);
    if (this.isEditable && item) return toggleItemEquipped(item);
  }

  static _onLevelUp(_event, target) {
    const item = this._getItemFromActor(target);
    if (this.isEditable && item) return this.actor.levelUp(item);
  }

  static async _onConvertClass() {
    if (!this.isEditable) return;
    return convertSingleActor(this.actor);
  }

  // Track which Class rows whose tables are hidden.
  #collapsedClasses = new Set();

  #classTables(cls) {
    const scope = game.system.id;
    const abilities = this.actor.items.filter((i) => i.type === "ability");
    const linked = (target) =>
      abilities.find((a) => {
        const link = a.getFlag(scope, "classTarget");
        return link ? link.classKey === cls.system.key && link.target === target : a.system.targetFrom === target;
      });
    const tables = this.actor.system.tables ?? {};
    return currentRows(cls.system.tables ?? [], cls.system.level).map((table) => ({
      ...table,
      cells: table.cells.map((cell) => {
        const ability = linked(`${table.key}.${cell.key}`);
        // Columns without their own name borrow the linked ability's.
        const name = cell.name !== cell.label ? cell.name : (ability?.name ?? cell.name);
        const current = tables[table.key]?.[cell.key]?.current;
        const sources = this.actor.system.tableSources(`${table.key}.${cell.key}`);
        if (current === undefined || !sources) return { ...cell, name, abilityId: ability?.id ?? "" };
        // A number replaces the cell's own (keeping a range such as "1-3"). Other values show as they are.
        const value = typeof current === "number" ? String(cell.value).replace(/\d+\s*$/, String(current)) : current;
        return { ...cell, value, name: `${name}: ${sources}`, abilityId: ability?.id ?? "" };
      }),
    }));
  }

  static _onToggleClassTables(_event, target) {
    const { classId } = target.dataset;
    if (!this.#collapsedClasses.delete(classId)) this.#collapsedClasses.add(classId);
    return this.render();
  }

  static _onRollClassSkill(event, target) {
    return this.actor.items.get(target.dataset.abilityId)?.rollFormula({ skipDialog: skipRollDialogCheck(event) });
  }

  static _onToggleWarnings() {
    this._showWarnings = !this._showWarnings;
    return this.render();
  }

  static _onDismissWarning(_event, target) {
    const item = this._getItemFromActor(target);
    if (this.isEditable && item) return item.dismissWarning(target.dataset.key, this.actor.system.warningContext);
  }
}
