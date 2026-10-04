/**
 * @file Shared drag-and-drop handlers used by actor sheets.
 */

export const onDragStartItem = (sheet, event) => {
  const li = event.currentTarget;
  if (event.target.classList.contains("content-link")) return;

  let dragData;
  let itemIdsArray = [];

  if (li.dataset.itemId) {
    const item = sheet.actor.items.get(li.dataset.itemId);
    dragData = item.toDragData();
    dragData.item = item;
    dragData.type = "Item";
    if (item.type === "container" && item.system.itemIds.length > 0) {
      itemIdsArray = item.system.itemIds;
    }
  }

  dragData.actorId = sheet.actor.id;
  dragData.sceneId = sheet.actor.isToken ? canvas.scene?.id : null;
  dragData.tokenId = sheet.actor.isToken ? sheet.actor.token.id : null;
  dragData.pack = sheet.actor.pack;

  if (li.dataset.effectId) {
    const effect = sheet.actor.effects.get(li.dataset.effectId);
    dragData.type = "ActiveEffect";
    dragData.data = effect.data;
  }

  event.dataTransfer.setData(
    "text/plain",
    JSON.stringify(dragData, (key, value) => {
      if (key === "itemIds") return JSON.stringify(itemIdsArray);
      return value;
    }),
  );
};

export const onDropFolder = async (sheet, _event, folder) => {
  if (!folder || folder.type !== "Item") return;

  let itemArray = folder.contents || [];
  folder.getSubfolders(true).forEach((subfolder) => {
    itemArray.push(...subfolder.contents);
  });

  if (itemArray.length > 0 && itemArray[0]?.uuid?.includes("Compendium")) {
    const items = [];
    itemArray.forEach(async (item) => {
      items.push(await fromUuid(item.uuid));
    });
    itemArray = items;
  }
  return onDropItemCreate(sheet, itemArray);
};

export const onDropItem = async (sheet, event, item) => {
  const targetId = event.target.closest(".item")?.dataset?.itemId;
  const targetItem = sheet.actor.items.get(targetId);
  const targetIsContainer = targetItem?.type === "container";

  const itemData = item.toObject();

  const exists = !!sheet.actor.items.get(item.id);
  const isContainer = sheet.actor.items.get(item.system.containerId);

  if (item.id === targetId) return;
  if (!exists && !targetIsContainer) return onDropItemCreate(sheet, [itemData]);
  if (isContainer) return onContainerItemRemove(sheet, item, isContainer);
  if (targetIsContainer) return onContainerItemAdd(sheet, item, targetItem);
  if (item.parent?.uuid === sheet.actor.uuid) return sheet._onSortItem(event, item);
};

export const onContainerItemRemove = async (sheet, item, container) => {
  const newList = container.system.itemIds.filter((s) => s !== item.id);
  const itemObj = sheet.actor.items.get(item.id);
  await container.update({ system: { itemIds: newList } });
  await itemObj.update({ system: { containerId: "" } });
};

export const onContainerItemAdd = async (sheet, item, target) => {
  const alreadyExistsInActor = target.parent.items.find((i) => i.id === item.id);
  let latestItem = item;
  if (!alreadyExistsInActor) {
    const newItem = await onDropItemCreate(sheet, [item.toObject()]);
    latestItem = newItem.pop();
  }

  const alreadyExistsInContainer = target.system.itemIds.find((i) => i.id === latestItem.id);
  if (!alreadyExistsInContainer) {
    const newList = [...target.system.itemIds, latestItem.id];
    await target.update({ system: { itemIds: newList } });
    await latestItem.update({ system: { containerId: target.id, equipped: false } });
  }
};

export const onDropItemCreate = async (sheet, droppedItem, targetContainer = false) => {
  const droppedItemArray = Array.isArray(droppedItem) ? droppedItem : [droppedItem];
  droppedItemArray.forEach((item) => {
    if (item.system.containerId && item.system.containerId !== "") item.system.containerId = "";
    if (item.type === "container" && typeof item.system.itemIds === "string") {
      const containedItems = JSON.parse(item.system.itemIds);
      containedItems.forEach((containedItem) => {
        containedItem.system.containerId = "";
      });
      droppedItem.push(...containedItems);
    }
  });
  if (!targetContainer) {
    return sheet.actor.createEmbeddedDocuments("Item", droppedItem);
  }
  const { itemIds } = targetContainer.system;
  itemIds.push(droppedItem.id);
  const item = sheet.actor.items.get(droppedItem[0].id);
  await targetContainer.update({ system: { itemIds } });
  return item.update({ system: { containerId: targetContainer.id } });
};
