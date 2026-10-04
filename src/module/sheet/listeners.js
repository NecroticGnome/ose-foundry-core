/**
 * @file DOM handlers for sheet expand/collapse state and inline UI toggles.
 */

const toggleList = (list, caretScope) => {
  if (!list) return;
  const hidden = list.style.display === "none";
  list.style.display = hidden ? "" : "none";
  const caret = caretScope.querySelector(".category-caret .fas");
  caret?.classList.toggle("fa-caret-down", hidden);
  caret?.classList.toggle("fa-caret-right", !hidden);
};

export const toggleItemCategory = (event, target) => {
  if (event.target.closest("input, .item-controls")) return;
  const list = target.nextElementSibling;
  if (list?.matches(".item-list")) toggleList(list, target);
};

export const toggleContainedItems = (target) => {
  const container = target.closest(".container");
  if (container) toggleList(container.querySelector(".item-list.contained-items"), container);
};

export const toggleItemSummary = (sheet, target) => {
  const item = target.closest(".item-entry.item");
  const itemSummary = item?.querySelector(".item-summary");
  if (!itemSummary) return;
  if (itemSummary.classList.toggle("expanded")) sheet._expanded.add(item.dataset.itemId);
  else sheet._expanded.delete(item.dataset.itemId);
};
