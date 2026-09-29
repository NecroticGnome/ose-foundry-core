/**
 * @file Inventory-row context menu wired from the V2 actor sheet's
 *       `_onFirstRender`.
 */
import { promptRemoveItemFromActor } from "./dialogs";
import { toggleItemEquipped } from "./inventory-actions";

const EQUIPPABLE_TYPES = ["item", "armor", "weapon", "treasure", "container"];

const ROW_SELECTOR = ".item[data-item-id]";

/**
 * Resolve the item a context-menu row belongs to.
 * @param {Application} sheet - The actor sheet the menu is bound to.
 * @param {HTMLElement} element - The `.item` row the menu was opened on.
 * @returns {Item|undefined} The item, or undefined when the row has no id.
 */
const itemFromRow = (sheet, element) => sheet.actor?.items?.get(element.dataset?.itemId);

/**
 * Build the context-menu entries for an actor sheet's inventory rows.
 * @param {Application} sheet - The actor sheet the menu is bound to.
 * @returns {object[]} ContextMenu entry definitions.
 */
const inventoryEntries = (sheet) => {
  const isEditable = () => !!sheet.actor?.sheet?.isEditable;

  return [
    {
      name: "OSE.Show",
      icon: "<i class='fas fa-eye'></i>",
      callback: (element) => itemFromRow(sheet, element)?.show(),
    },
    {
      name: "OSE.items.Equip",
      icon: "<i class='fas fa-hand'></i>",
      condition: (element) => {
        if (sheet.actor?.type !== "character" || !isEditable()) return false;
        return EQUIPPABLE_TYPES.includes(itemFromRow(sheet, element)?.type);
      },
      callback: async (element) => {
        const item = itemFromRow(sheet, element);
        if (item) await toggleItemEquipped(item);
      },
    },
    {
      name: "OSE.Edit",
      icon: "<i class='fas fa-edit'></i>",
      condition: isEditable,
      callback: (element) => itemFromRow(sheet, element)?.sheet.render(true),
    },
    {
      name: "OSE.Delete",
      icon: "<i class='fas fa-trash'></i>",
      condition: isEditable,
      callback: (element) => {
        const item = itemFromRow(sheet, element);
        if (item) promptRemoveItemFromActor(sheet, item);
      },
    },
  ];
};

/**
 * Attach the inventory-row context menu to a rendered actor sheet.
 *
 * Bind once per sheet element; re-binding stacks menus.
 * @param {Application} sheet - The actor sheet being rendered.
 * @param {HTMLElement} root - The sheet's root element.
 * @returns {foundry.applications.ux.ContextMenu|null} The menu, or null when not applicable.
 */
export const bindInventoryContextMenu = (sheet, root) => {
  if (!sheet?.actor?.isOwnerOrObserver) return null;

  return new foundry.applications.ux.ContextMenu(root, ROW_SELECTOR, inventoryEntries(sheet), { jQuery: false });
};
