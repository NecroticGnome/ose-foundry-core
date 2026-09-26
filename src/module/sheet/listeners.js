/**
 * @file DOM event handlers for sheets that manage expand/collapse state
 *       and other inline UI toggles. Stage 6 keeps these jQuery-aware
 *       (called from V1 activateListeners); stage 7 will switch to native
 *       DOM via the V2 _onRender path.
 */

export const toggleItemCategory = (event) => {
  event.preventDefault();
  const targetCategory = $(event.currentTarget);
  const items = targetCategory.next(".item-list");

  if (items.css("display") === "none") {
    const el = $(event.currentTarget).find(".fas.fa-caret-right");
    el.removeClass("fa-caret-right").addClass("fa-caret-down");
    items.slideDown(200);
  } else {
    const el = $(event.currentTarget).find(".fas.fa-caret-down");
    el.removeClass("fa-caret-down").addClass("fa-caret-right");
    items.slideUp(200);
  }
};

export const toggleContainedItems = (event) => {
  event.preventDefault();
  const targetItems = $(event.target.closest(".container"));
  const items = targetItems.find(".item-list.contained-items");

  if (items.css("display") === "none") {
    const el = targetItems.find(".fas.fa-caret-right");
    el.removeClass("fa-caret-right").addClass("fa-caret-down");
    items.slideDown(200);
  } else {
    const el = targetItems.find(".fas.fa-caret-down");
    el.removeClass("fa-caret-down").addClass("fa-caret-right");
    items.slideUp(200);
  }
};

export const toggleItemSummary = (sheet, event) => {
  event.preventDefault();
  const item = event.currentTarget.closest(".item-entry.item");
  const itemSummary = item.querySelector(".item-summary");
  if (itemSummary.classList.contains("expanded")) {
    sheet._expanded.delete(item.dataset.itemId);
  } else {
    sheet._expanded.add(item.dataset.itemId);
  }
  itemSummary.classList.toggle("expanded");
};
