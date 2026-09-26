/**
 * @file The system-level sheet for items of any type.
 */
const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;
const TextEditor = foundry.applications.ux.TextEditor.implementation;

export default class OseItemSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["ose", "sheet", "item"],
    tag: "form",
    form: { submitOnChange: true, closeOnSubmit: false },
    position: { width: 560, height: 480 },
    window: { resizable: true },
    actions: {
      tagDelete: OseItemSheet._onTagDelete,
      meleeToggle: OseItemSheet._onMeleeToggle,
      missileToggle: OseItemSheet._onMissileToggle,
    },
  };

  static PARTS = {
    main: { template: "systems/__SYSTEM_ID__/dist/templates/items/item-sheet.html" },
  };

  _configureRenderParts(options) {
    const parts = super._configureRenderParts(options);
    parts.main = {
      ...parts.main,
      template: `systems/__SYSTEM_ID__/dist/templates/items/${this.item.type}-sheet.html`,
    };
    return parts;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const item = this.item;
    return Object.assign(context, {
      cssClass: this.options.classes.join(" "),
      name: item.name,
      img: item.img,
      type: item.type,
      system: item.system,
      owner: item.isOwner,
      config: {
        ...CONFIG.OSE,
        encumbrance: game.settings.get(game.system.id, "encumbranceOption"),
      },
      enriched: {
        description: await TextEditor.enrichHTML(item.system?.description ?? "", {
          relativeTo: item,
          secrets: game.user.isGM,
        }),
      },
    });
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const tagInput = this.element.querySelector('input[data-action="add-tag"]');
    if (!tagInput) return;
    tagInput.addEventListener("keydown", (ev) => {
      if (ev.key !== "Enter") return;
      ev.preventDefault();
      const value = ev.currentTarget.value;
      if (!value) return;
      this.item.pushManualTag(value.split(","));
      ev.currentTarget.value = "";
    });
  }

  // biome-ignore lint/complexity/noThisInStatic: V2 actions bind `this` to the application instance.
  static _onTagDelete(_event, target) {
    return this.item.popManualTag(target.closest("[data-tag]")?.dataset.tag);
  }

  // biome-ignore lint/complexity/noThisInStatic: V2 actions bind `this` to the application instance.
  static _onMeleeToggle() {
    return this.item.update({ "system.melee": !this.item.system.melee });
  }

  // biome-ignore lint/complexity/noThisInStatic: V2 actions bind `this` to the application instance.
  static _onMissileToggle() {
    return this.item.update({ "system.missile": !this.item.system.missile });
  }
}
