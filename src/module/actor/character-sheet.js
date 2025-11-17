/**
 * @file Extend the basic ActorSheet with some very simple modifications
 */
import OSE from "../config";
import OseCharacterCreator from "../dialog/character-creation";
import OseCharacterGpCost from "../dialog/character-gp-cost";
import OseCharacterModifiers from "../dialog/character-modifiers";
import OseActorSheet from "./actor-sheet";

export default class OseActorSheetCharacter extends OseActorSheet {
  /**
   * Extend and override the default options used by the 5e Actor Sheet
   *
   * @returns {object} - The default options for this sheet.
   */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["ose", "sheet", "actor", "character"],
      template: `${OSE.systemPath()}/templates/actors/character-sheet.html`,
      width: 450,
      height: 530,
      resizable: true,
      tabs: [
        {
          navSelector: ".sheet-tabs",
          contentSelector: ".sheet-body",
          initial: "attributes",
        },
      ],
      scrollY: [".inventory"],
    });
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

    // These values are getters that aren't getting
    // cloned when `this.actor.system` is cloned
    data.system.usesAscendingAC = this.actor.system.usesAscendingAC;
    data.system.meleeMod = this.actor.system.meleeMod;
    data.system.rangedMod = this.actor.system.rangedMod;
    data.system.init = this.actor.system.init;

    // Sort by sort order (see ActorSheet)
    [
      ...Object.values(data.owned),
      ...Object.values(data?.spells?.spellList || {}),
      data.abilities,
    ].forEach((o) => o.sort((a, b) => (a.sort || 0) - (b.sort || 0)));
  }

  generateScores() {
    new OseCharacterCreator(this.actor, {
      top: this.position.top + 40,
      left: this.position.left + (this.position.width - 400) / 2,
    }).render(true);
  }

  /**
   * Prepare data for rendering the Actor sheet
   * The prepared data object contains both the actor data as well as additional sheet options
   */
  async getData() {
    const data = await super.getData();

    // Prepare owned items
    this._prepareItems(data);

    data.enrichedBiography =
      await foundry.applications.ux.TextEditor.implementation.enrichHTML(
        this.object.system.details.biography,
        { async: true }
      );
    data.enrichedNotes =
      await foundry.applications.ux.TextEditor.implementation.enrichHTML(
        this.object.system.details.notes,
        { async: true }
      );

    return data;
  }

  async _chooseLang() {
    const choices = CONFIG.OSE.languages;

    const templateData = { choices };
    const dlg = await foundry.applications.handlebars.renderTemplate(
      `${OSE.systemPath()}/templates/actors/dialogs/lang-create.html`,
      templateData
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
            callback: (event, button, html) => {
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
      }).render(true);
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
    const update = data[table].value.filter((el) => el != lang);
    const newData = {};
    newData[table] = { value: update };
    return this.actor.update({ system: newData });
  }

  /* -------------------------------------------- */

  _onShowModifiers(event) {
    event.preventDefault();
    new OseCharacterModifiers(this.actor, {
      top: this.position.top + 40,
      left: this.position.left + (this.position.width - 400) / 2,
    }).render(true);
  }

  /**
   * Prepare shopping cart data by filtering out items that have already been paid for
   */
  async _prepareShoppingCartData() {
    const data = await this.getData();

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

  async _onShowGpCost(event) {
    event.preventDefault();
    const cartData = await this._prepareShoppingCartData();
    new OseCharacterGpCost(this.actor, cartData, {
      top: this.position.top + 40,
      left: this.position.left + (this.position.width - 400) / 2,
    }).render(true);
  }

  /**
   * Activate event listeners using the prepared sheet HTML
   *
   * @param html - {HTML}   The prepared HTML object ready to be rendered into the DOM
   */
  activateListeners(html) {
    super.activateListeners(html);

    html.find(".ability-score .attribute-name a").click((ev) => {
      const actorObject = this.actor;
      const element = ev.currentTarget;
      const { score } = element.parentElement.parentElement.dataset;
      const { stat } = element.parentElement.parentElement.dataset;
      if (score) {
        actorObject.rollCheck(score, { event: ev });
      } else if (stat === "lr") {
        actorObject.rollLoyalty(score, { event: ev });
      }
    });

    html.find(".exploration .attribute-name a").click((ev) => {
      const actorObject = this.actor;
      const element = ev.currentTarget;
      const expl = element.parentElement.parentElement.dataset.exploration;
      actorObject.rollExploration(expl, { event: ev });
    });

    html.find("a[data-action='modifiers']").click((ev) => {
      this._onShowModifiers(ev);
    });

    html.find("a[data-action='gp-cost']").click((ev) => {
      this._onShowGpCost(ev);
    });

    // Everything below here is only needed if the sheet is editable
    if (!this.options.editable) return;

    // Language Management
    html.find(".item-push").click((ev) => {
      ev.preventDefault();
      const header = ev.currentTarget;
      const table = header.dataset.array;
      this._pushLang(table);
    });

    html.find(".item-pop").click((ev) => {
      ev.preventDefault();
      const header = ev.currentTarget;
      const table = header.dataset.array;
      this._popLang(table, $(ev.currentTarget).closest(".item").data("lang"));
    });

    // Toggle Equipment
    html.find(".item-toggle").click(async (ev) => {
      const li = $(ev.currentTarget).parents(".item");
      const item = this.actor.items.get(li.data("itemId"));
      await item.update({
        system: {
          equipped: !item.system.equipped,
        },
      });

    });

    html.find("a[data-action='generate-scores']").click((ev) => {
      this.generateScores(ev);
    });
  }
}