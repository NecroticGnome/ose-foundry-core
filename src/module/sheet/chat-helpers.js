/**
 * @file Chat message builders used from sheet actions.
 */

export const displayItemInChat = async (sheet, event) => {
  const li = $(event.currentTarget).closest(".item-entry");
  const item = sheet.actor.items.get(li.data("itemId"));
  return item.show();
};
