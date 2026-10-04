/**
 * @file Chat message builders used from sheet actions.
 */

export const displayItemInChat = (sheet, target) =>
  sheet.actor.items.get(target.closest(".item-entry")?.dataset.itemId)?.show();
