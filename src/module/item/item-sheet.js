/**
 * @file The system-level sheet for items of any type
 */
import OSE from "../config";

/**
 * Extend the basic ItemSheet with some very simple modifications
 */
export default class OseItemSheet extends foundry.appv1.sheets.ItemSheet {
  /**
   * Extend and override the default options used by the Simple Item Sheet
   * @returns {object} Options for rendering the sheet
   */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["ose", "sheet", "item"],
      width: 520,
      height: 390,
      resizable: true,
      tabs: [
        {
          navSelector: ".tabs",
          contentSelector: ".sheet-body",
          initial: "description",
        },
      ],
    });
  }

  /* -------------------------------------------- */

  /** @override */
  get template() {
    const path = `${OSE.systemPath()}/templates/items`;
    return `${path}/${this.item.type}-sheet.html`;
  }

  /**
   * Prepare data for rendering the Item sheet
   * The prepared data object contains both the actor data as well as additional sheet options
   * @returns {object} Data for the Handlebars template
   */
  async getData() {
    const { data } = super.getData();
    data.editable = this.document.sheet.isEditable;
    data.config = {
      ...CONFIG.OSE,
      encumbrance: game.settings.get(game.system.id, "encumbranceOption"),
    };
    data.enriched = {
      description:
        await foundry.applications.ux.TextEditor.implementation.enrichHTML(
          this.item.system?.description || "",
          { async: true }
        ),
    };
    return data;
  }

  /* -------------------------------------------- */

  /**
   * Activate event listeners using the prepared sheet HTML
   * @param {JQuery} html - The prepared HTML object ready to be rendered into the DOM
   */
  activateListeners(html) {
    super.activateListeners(html);
    html = html instanceof HTMLElement ? html : html[0];

    html
      .querySelector('input[data-action="add-tag"]')
      ?.addEventListener("keydown", (ev) => {
        if (ev.key !== "Enter") return;

        const value = ev.currentTarget?.value ?? "";
        const values = value
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean);

        if (values.length === 0) return;
        this.object.pushManualTag(values);
      });

    html.querySelectorAll(".tag-delete").forEach((el) => {
      el.addEventListener("click", (ev) => {
        const tag = ev.currentTarget?.parentElement?.dataset?.tag;
        if (!tag) return;
        this.object.popManualTag(tag);
      });
    });

    html.querySelectorAll("a.melee-toggle").forEach((el) => {
      el.addEventListener("click", () => {
        this.object.update({ "system.melee": !this.object.system.melee });
      });
    });

    html.querySelectorAll("a.missile-toggle").forEach((el) => {
      el.addEventListener("click", () => {
        this.object.update({ "system.missile": !this.object.system.missile });
      });
    });
  }
}
