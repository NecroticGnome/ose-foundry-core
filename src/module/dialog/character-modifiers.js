/**
 * @file An application used for setting up roll modifiers
 */
import OSE from "../config";

export default class OseCharacterModifiers extends FormApplication {
  static get defaultOptions() {
    return foundry.utils.mergeObject(FormApplication.defaultOptions, {
      classes: ["ose", "dialog", "modifiers"],
      id: "sheet-modifiers",
      template: `${OSE.systemPath()}/templates/actors/dialogs/modifiers-dialog.html`,
      width: 240,
    });
  }

  /* -------------------------------------------- */

  /**
   * Add the Entity name into the window title
   *
   * @returns {string} - The app title
   */
  get title() {
    return `${this.object.name}: Modifiers`;
  }

  /* -------------------------------------------- */

  /**
   * Construct and return the data object used to render the HTML template for this form application.
   *
   * @returns {object} - The template data
   */
  getData() {
    const data = foundry.utils.deepClone(this.object);
    data.user = game.user;
    return data;
  }

  /* -------------------------------------------- */

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);
  }
}
