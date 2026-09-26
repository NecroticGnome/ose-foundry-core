/**
 * @file An application used to manage Actor configuration.
 */
const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

export default class OseEntityTweaks extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(document, options = {}) {
    super(options);
    this.document = document;
  }

  /** Bring an open dialog forward (closing if it's for a different actor) before creating a new one. */
  static open(document, options = {}) {
    const existing = foundry.applications.instances.get("entity-tweaks");
    if (existing?.document === document) {
      existing.bringToFront();
      return existing;
    }
    existing?.close();
    const sheet = new OseEntityTweaks(document, options);
    sheet.render({ force: true });
    return sheet;
  }

  static DEFAULT_OPTIONS = {
    id: "entity-tweaks",
    classes: ["sheet-tweaks"],
    tag: "form",
    form: {
      handler: OseEntityTweaks.#onSubmitForm,
      submitOnChange: false,
      closeOnSubmit: true,
    },
    position: { width: 440, height: "auto" },
    window: { resizable: true },
  };

  static PARTS = {
    main: {
      template: "systems/__SYSTEM_ID__/dist/templates/actors/dialogs/tweaks-dialog.html",
    },
  };

  get title() {
    return `${this.document.name}: ${game.i18n.localize("OSE.dialog.tweaks")}`;
  }

  async _prepareContext() {
    const context = this.document.toObject();
    context.isCharacter = this.document.type === "character";
    context.user = game.user;
    context.config = {
      ...CONFIG.OSE,
      ascendingAC: game.settings.get(game.system.id, "ascendingAC"),
    };
    return context;
  }

  static async #onSubmitForm(_event, _form, formData) {
    // biome-ignore lint/complexity/noThisInStatic: V2 form.handler binds `this` to the application instance.
    return this._submit(formData.object);
  }

  async _submit(raw) {
    const data = { ...raw };

    // Item-based encumbrance tracks two separate values. If the user hasn't
    // changed the value, null it out so the default applies.
    const encumbranceMax = "system.encumbrance.max";
    if (
      CONFIG.OSE.encumbrance.type === "itembased" &&
      (data[encumbranceMax] === this.document.system.encumbrance.defaultMax ||
        data[encumbranceMax] === this.document.system.encumbrance.alternateMax)
    ) {
      data[encumbranceMax] = null;
    }

    await this.document.update(data);
  }
}
