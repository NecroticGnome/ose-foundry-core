/**
 * @file Extend the basic ActorSheet with some very simple modifications
 */
import OSE from "../config";
import OseCharacterCreator from "../dialog/character-creation";
import OseCharacterGpCost from "../dialog/character-gp-cost";
import OseCharacterModifiers from "../dialog/character-modifiers";
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
      ],
      initial: "attributes",
    },
  };

  _isTabVisible(tabId) {
    if (tabId === "notes") return true;
    if (!this.actor.isOwnerOrObserver) return false;
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

    data.explorationSkills = prepareExplorationSkills(this.actor.system.exploration);

    const enrichOptions = { relativeTo: this.actor, secrets: game.user.isGM };
    data.enrichedBiography = await TextEditor.enrichHTML(this.actor.system.details.biography, enrichOptions);
    data.enrichedNotes = await TextEditor.enrichHTML(this.actor.system.details.notes, enrichOptions);

    return data;
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
}
