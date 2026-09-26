/**
 * @file An application used for setting up roll modifiers.
 */
const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

export default class OseCharacterModifiers extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(document, options = {}) {
    super(options);
    this.document = document;
  }

  /** Bring an open dialog forward (closing if it's for a different actor) before creating a new one. */
  static open(document, options = {}) {
    const existing = foundry.applications.instances.get("sheet-modifiers");
    if (existing?.document === document) {
      existing.bringToFront();
      return existing;
    }
    existing?.close();
    const sheet = new OseCharacterModifiers(document, options);
    sheet.render({ force: true });
    return sheet;
  }

  static DEFAULT_OPTIONS = {
    id: "sheet-modifiers",
    classes: ["ose", "dialog", "modifiers"],
    tag: "div",
    position: { width: 240, height: "auto" },
    window: { resizable: false },
  };

  static PARTS = {
    main: { template: "systems/__SYSTEM_ID__/dist/templates/actors/dialogs/modifiers-dialog.html" },
  };

  get title() {
    return `${this.document.name}: ${game.i18n.localize("OSE.Modifiers")}`;
  }

  async _prepareContext() {
    const context = this.document.toObject();
    context.user = game.user;
    return context;
  }
}
