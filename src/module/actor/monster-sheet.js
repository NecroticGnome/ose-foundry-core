/**
 * @file The sheet class for Actors of type Monster
 */
import OSE from "../config";
import OseActorSheet from "./actor-sheet";

const TextEditor = foundry.applications.ux.TextEditor.implementation;

/**
 * Extend the basic ActorSheet with some very simple modifications
 */
export default class OseActorSheetMonster extends OseActorSheet {
  static DEFAULT_OPTIONS = {
    classes: ["monster"],
    position: { width: 450, height: 573 },
    actions: {
      rollMorale: OseActorSheetMonster._onRollMorale,
      rollReaction: OseActorSheetMonster._onRollReaction,
      rollAppearing: OseActorSheetMonster._onRollAppearing,
      rollHP: OseActorSheetMonster._onRollHP,
      cyclePattern: OseActorSheetMonster._onCyclePattern,
      resetAttacks: OseActorSheetMonster._onResetAttacks,
      generateSaves: OseActorSheetMonster._onGenerateSaves,
    },
  };

  static PARTS = {
    sheet: {
      root: true,
      template: "systems/__SYSTEM_ID__/dist/templates/actors/monster-sheet.html",
      scrollable: ["attributes", "spells", "inventory"].map((tab) => `.tab[data-tab="${tab}"] .resizable`),
    },
  };

  static TABS = {
    primary: {
      tabs: [
        { id: "attributes", label: "OSE.category.attributes" },
        { id: "inventory", label: "OSE.category.inventory" },
        { id: "spells", label: "OSE.category.spells" },
        { id: "notes", label: "OSE.category.notes" },
      ],
      initial: "attributes",
    },
  };

  _isTabVisible(tabId) {
    if (tabId === "notes") return true;
    if (!this.actor.isOwnerOrObserver) return false;
    if (tabId === "inventory") return this.actor.system.config.enableInventory;
    if (tabId === "spells") return this.actor.system.spells.enabled;
    return true;
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
      weapons: this.actor.system.weapons,
      items: this.actor.system.items,
      containers: this.actor.system.containers,
      armors: this.actor.system.armor,
      treasures: this.actor.system.treasures,
    };

    data.attackPatterns = this.actor.system.attackPatterns;
    data.spells = this.actor.system.spells.spellList;
  }

  async _prepareContext(options) {
    const data = await super._prepareContext(options);
    // Prepare owned items
    this._prepareItems(data);

    // Settings
    data.config.morale = game.settings.get(game.system.id, "morale");
    const enrichOptions = { relativeTo: this.actor, secrets: game.user.isGM };
    data.treasureLink = await TextEditor.enrichHTML(this.actor.system.details.treasure.table, enrichOptions);
    data.isNew = this.actor.isNew();

    data.enrichedBiography = await TextEditor.enrichHTML(this.actor.system.details.biography, enrichOptions);

    // Monsters don't show an encumbrance bar
    data.encumbranceTemplate = "";

    return data;
  }

  /**
   * Monster creation helpers
   */
  async generateSave() {
    const choices = CONFIG.OSE.monster_saves;

    const templateData = { choices };
    const dlg = await foundry.applications.handlebars.renderTemplate(
      `${OSE.systemPath()}/templates/actors/dialogs/monster-saves.html`,
      templateData,
    );
    // Create Dialog window
    return new foundry.applications.api.DialogV2({
      window: { title: game.i18n.localize("OSE.dialog.generateSaves") },
      position: {
        width: 250,
      },
      content: dlg,
      buttons: [
        {
          action: "ok",
          label: game.i18n.localize("OSE.Ok"),
          icon: "fas fa-check",
          default: true,
          callback: (_event, button) => {
            const { hd } = new foundry.applications.ux.FormDataExtended(button.form).object;
            this.actor.generateSave(hd.replace(/[^\d+.-]/g, ""));
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
  }

  async _onDrop(event) {
    await super._onDrop(event);
    const data = TextEditor.getDragEventData(event);
    if (data.type !== "RollTable" || !this.isEditable) return;

    let link = "";
    if (data.pack) {
      const tableDatum = game.packs.get(data.pack).index.find((el) => el._id === data.id);
      link = `@UUID[${data.uuid}]{${tableDatum.name}}`;
    } else {
      link = `@UUID[${data.uuid}]`;
    }
    this.actor.update({ "system.details.treasure.table": link });
  }

  /* -------------------------------------------- */
  async _resetAttacks(_event) {
    return Promise.all(
      this.actor.items
        .filter((i) => i.type === "weapon")
        .map((weapon) =>
          weapon.update({
            "system.counter.value": Number.parseInt(weapon.system.counter.max, 10),
          }),
        ),
    );
  }

  async _updateAttackCounter(event) {
    const item = this._getItemFromActor(event.target);

    if (event.target.dataset.field === "value") {
      return item.update({
        "system.counter.value": Number.parseInt(event.target.value, 10),
      });
    }
    if (event.target.dataset.field === "max") {
      return item.update({
        "system.counter.max": Number.parseInt(event.target.value, 10),
      });
    }
  }

  _cycleAttackPatterns(target) {
    const item = this._getItemFromActor(target);
    const currentColor = item.system.pattern;
    // Attack patterns include all OSE colors and transparent
    const colors = Object.keys(CONFIG.OSE.colors);
    colors.push("transparent");
    let index = colors.indexOf(currentColor);
    if (index + 1 === colors.length) {
      index = 0;
    } else {
      index++;
    }
    item.update({
      "system.pattern": colors[index],
    });
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    this.element.querySelector(".treasure-table")?.addEventListener("contextmenu", (event) => {
      if (event.target.closest("a") && this.isEditable) this.actor.update({ "system.details.treasure.table": null });
    });
  }

  _onChangeForm(formConfig, event) {
    if (event.target.closest(".counter")) return this._updateAttackCounter(event);
    return super._onChangeForm(formConfig, event);
  }

  static _onRollMorale(event) {
    return this.actor.rollMorale({ event });
  }

  static _onRollReaction(event) {
    return this.actor.rollReaction({ event });
  }

  static _onRollAppearing(event, target) {
    return this.actor.rollAppearing({ event, check: target.closest(".check-field").dataset.check });
  }

  static _onRollHP(event) {
    if (this.isEditable) return this.actor.rollHP({ event });
  }

  static _onCyclePattern(_event, target) {
    if (this.isEditable) return this._cycleAttackPatterns(target);
  }

  static _onResetAttacks(event) {
    if (this.isEditable) return this._resetAttacks(event);
  }

  static _onGenerateSaves() {
    if (this.isEditable) return this.generateSave();
  }
}
