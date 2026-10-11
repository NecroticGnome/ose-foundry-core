/**
 * @file Shared drag-and-drop handlers used by actor sheets.
 */
import { rollsStartingHp } from "../classes/levels";
import { startingProgress } from "../classes/progression";
import OSE from "../config";

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

  const pool = event.target.closest?.("[data-spell-pool]")?.dataset.spellPool;
  if (exists && item.type === "spell" && pool && pool !== item.system.castAs) {
    return item.update({ "system.castAs": pool });
  }
  if (item.id === targetId) return;
  if (!exists && item.type === "class" && sheet.actor.type === "character") return onDropClass(sheet, itemData);
  if (!exists && item.type === "race" && sheet.actor.type === "character") return onDropRace(sheet, itemData);
  if (!exists && !targetIsContainer) return onDropItemCreate(sheet, [itemData]);
  if (isContainer) return onContainerItemRemove(sheet, item, isContainer);
  if (targetIsContainer) return onContainerItemAdd(sheet, item, targetItem);
  if (item.parent?.uuid === sheet.actor.uuid) return sheet._onSortItem(event, item);
};

const esc = (s) => foundry.utils.escapeHTML(s);

// Without the multiple classes rule, a new class replaces the old one.
// Ask which level a new class starts at, and whether to roll HP and offer abilities.
const promptClassStart = async (itemData, rollHp) => {
  const { levels = [], maxLevel, titles = [] } = itemData.system;
  const count = Math.max(levels.length, maxLevel || 0);
  const content = await foundry.applications.handlebars.renderTemplate(
    `${OSE.systemPath()}/templates/actors/dialogs/class-start.html`,
    {
      options: Array.from({ length: count }, (_, i) => ({
        value: i + 1,
        label: titles[i] ? `${i + 1} — ${titles[i]}` : i + 1,
      })),
      rollHp,
      offer: game.settings.get(game.system.id, "promptAddClassAbilities"),
    },
  );
  return foundry.applications.api.DialogV2.prompt({
    window: { title: game.i18n.format("OSE.classes.StartTitle", { cls: itemData.name }) },
    position: { width: 480 },
    content,
    ok: {
      label: game.i18n.localize("OSE.Add"),
      callback: (_event, button) => {
        const { level, rollHp, offer } = new foundry.applications.ux.FormDataExtended(button.form).object;
        return { level: Number(level) || 1, rollHp: !!rollHp, offer: !!offer };
      },
    },
    rejectClose: false,
  });
};

// Without the multiple classes rule, a new class replaces the old one.
export const onDropClass = async (sheet, itemData) => {
  const { actor } = sheet;
  const [existing] = actor.system.classes;
  if (existing && !game.settings.get(game.system.id, "multipleClasses")) {
    const ok = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize("OSE.classes.Replace") },
      content: `<p>${game.i18n.format("OSE.classes.ReplaceHint", { from: esc(existing.name), to: esc(itemData.name) })}</p>`,
      rejectClose: false,
    });
    if (!ok) return;
    itemData.system.level = existing.system.level;
    itemData.system.xp = existing.system.xp;
    const before = actor.classStats();
    await existing.delete();
    const created = await onDropItemCreate(sheet, [itemData]);
    const [cls] = created ?? [];
    if (cls) await actor.postClassChanges(cls, before);
    if (cls?.system.level === 1) await actor.offerAbilities(cls, 1);
    return created;
  }
  const start = await promptClassStart(
    itemData,
    rollsStartingHp({ isNew: actor.isNew(), hasClass: !!existing, level: Number(actor._source.system.details?.level) }),
  );
  if (!start) return;
  Object.assign(itemData.system, startingProgress(itemData.system.levels ?? [], start.level));
  const before = actor.classStats();
  const created = await onDropItemCreate(sheet, [itemData]);
  const [cls] = created ?? [];
  if (!cls) return created;
  const hp = start.rollHp ? await actor.rollStartingHp(cls, start.level) : null;
  await actor.postClassChanges(cls, before, hp);
  if (start.offer) await actor.offerAbilities(cls, start.level, { upTo: true });
  return created;
};

// One race per character; existing characters usually already include its modifiers.
export const onDropRace = async (sheet, itemData) => {
  const { actor } = sheet;
  const { DialogV2 } = foundry.applications.api;
  const existing = actor.system.race;
  if (existing) {
    const ok = await DialogV2.confirm({
      window: { title: game.i18n.localize("OSE.race.Replace") },
      content: `<p>${game.i18n.format("OSE.race.ReplaceHint", { from: esc(existing.name), to: esc(itemData.name) })}</p>`,
      rejectClose: false,
    });
    if (!ok) return;
    await existing.delete();
  }
  const scope = game.system.id;
  const modifiers = (itemData.effects ?? []).find((e) => e.flags?.[scope]?.raceModifiers);
  if (modifiers && !actor.isNew()) {
    const included = await DialogV2.confirm({
      window: { title: itemData.name },
      content: `<p>${game.i18n.format("OSE.race.AlreadyIncluded", { race: esc(itemData.name) })}</p>`,
      rejectClose: false,
    });
    if (included) modifiers.disabled = true;
  }
  const created = await onDropItemCreate(sheet, [itemData]);
  const [race] = created ?? [];
  if (race) await actor.offerAbilities(race, 1);
  return created;
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
