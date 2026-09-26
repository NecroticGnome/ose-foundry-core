/**
 * @file An application for deducting currency from an actor using the Shopping Cart feature.
 */
const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

export default class OseCharacterGpCost extends HandlebarsApplicationMixin(ApplicationV2) {
  static physicalItemTypes = new Set(["item", "container", "weapon", "armor"]);

  constructor(document, preparedData, options = {}) {
    super(options);
    this.document = document;
    this.preparedData = preparedData;
  }

  /** Bring an open dialog forward (closing if it's for a different actor) before creating a new one. */
  static open(document, preparedData, options = {}) {
    const existing = foundry.applications.instances.get("sheet-gp-cost");
    if (existing?.document === document) {
      existing.preparedData = preparedData;
      existing.render();
      existing.bringToFront();
      return existing;
    }
    existing?.close();
    const sheet = new OseCharacterGpCost(document, preparedData, options);
    sheet.render({ force: true });
    return sheet;
  }

  static DEFAULT_OPTIONS = {
    id: "sheet-gp-cost",
    classes: ["ose", "dialog", "gp-cost"],
    tag: "form",
    form: {
      handler: OseCharacterGpCost.#onSubmitForm,
      submitOnChange: false,
      closeOnSubmit: false,
    },
    position: { width: 240, height: "auto" },
    window: { resizable: true },
  };

  static PARTS = {
    main: { template: "systems/__SYSTEM_ID__/dist/templates/actors/dialogs/gp-cost-dialog.html" },
  };

  get title() {
    return `${this.document.name}: ${game.i18n.localize("OSE.dialog.shoppingCart")}`;
  }

  async _prepareContext() {
    const context = foundry.utils.deepClone(this.preparedData);
    context.totalCost = await this._getTotalCost(context);
    context.user = game.user;
    return context;
  }

  static async #onSubmitForm(_event, _form, _formData) {
    // biome-ignore lint/complexity/noThisInStatic: V2 form.handler binds `this` to the application instance.
    return this._submit();
  }

  async _submit() {
    const context = await this._prepareContext();
    const totalCost = context.totalCost;

    // Legacy behaviour used "GP" even for other languages
    const gp = this.document.items.find(
      (item) => (item.name === game.i18n.localize("OSE.items.gp.short") || item.name === "GP") && item.system.treasure,
    );
    if (!gp) {
      ui.notifications.error(game.i18n.localize("OSE.error.noGP"));
      return;
    }

    const newGP = gp.system.quantity.value - totalCost;
    if (newGP < 0) {
      ui.notifications.error(game.i18n.localize("OSE.error.notEnoughGP"));
      return;
    }

    await this.document.updateEmbeddedDocuments("Item", [{ _id: gp.id, "system.quantity.value": newGP }]);
    await this._markItemsAsPaid();

    // Post the cart receipt to chat
    const content = await foundry.applications.handlebars.renderTemplate(
      "systems/__SYSTEM_ID__/dist/templates/chat/inventory-list.html",
      context,
    );
    await ChatMessage.create({
      style: CONST.CHAT_MESSAGE_STYLES.OTHER,
      content,
      speaker: ChatMessage.getSpeaker({ actor: this.document }),
    });

    await this.close();
  }

  async _getTotalCost(data) {
    return data.items.reduce((total, item) => {
      const itemData = item.system;
      // Only count non-treasure physical items that haven't been paid for yet
      if (OseCharacterGpCost.physicalItemTypes.has(item.type) && !itemData.treasure && !item.flags?.ose?.paid) {
        return total + (itemData.quantity.max ? itemData.cost * itemData.quantity.value : itemData.cost);
      }
      return total;
    }, 0);
  }

  /**
   * Mark all items in the shopping cart as paid for so they no longer appear in
   * the cart on subsequent openings.
   */
  async _markItemsAsPaid() {
    const updates = [];
    for (const item of this.document.items) {
      const itemData = item.system;
      if (OseCharacterGpCost.physicalItemTypes.has(item.type) && !itemData.treasure && !item.flags?.ose?.paid) {
        updates.push({ _id: item.id, "flags.ose.paid": true });
      }
    }
    if (updates.length > 0) {
      await this.document.updateEmbeddedDocuments("Item", updates);
    }
  }
}
