/**
 * @file An application used to manage Actor configuration.
 */
import { saveTweaks, tweakValues } from "../effects/tweak-effects";

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
    context.hasClasses = this.document.items.some((i) => i.type === "class");
    context.user = game.user;
    context.tweaks = tweakValues(this.document);
    context.config = {
      ...CONFIG.OSE,
      ascendingAC: game.settings.get(game.system.id, "ascendingAC"),
    };
    if (CONFIG.OSE.encumbrance.type === "itembased" && context.isCharacter) {
      const { max, packedMax } = context.system.encumbrance;
      context.itemBasedCaps = CONFIG.OSE.encumbrance.caps(max, packedMax);
    }
    return context;
  }

  static async #onSubmitForm(_event, _form, formData) {
    return this._submit(formData.object);
  }

  async _submit(raw) {
    const data = { ...raw };

    // For item-based encumbrance, store default equipped cap as null, and always store the packed value.
    const encumbranceMax = "system.encumbrance.max";
    const packedMax = "system.encumbrance.packedMax";
    if (CONFIG.OSE.encumbrance.type === "itembased" && encumbranceMax in data) {
      const { defaultMax, alternateMax } = this.document.system.encumbrance;
      if (data[encumbranceMax] === defaultMax || data[encumbranceMax] === alternateMax) data[encumbranceMax] = null;
      if (packedMax in data) data[packedMax] ??= alternateMax;
    }

    const { tweaks, ...rest } = foundry.utils.expandObject(data);
    await this.document.update(rest);
    if (tweaks) await saveTweaks(this.document, tweaks);
  }
}
