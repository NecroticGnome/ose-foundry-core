/**
 * @file Action handlers for inventory operations (equip, stow, add, remove,
 *       quantity, container moves, rolls). Each takes the actor or sheet
 *       (V1 still calls these from instance methods; V2 will call from the
 *       static actions map).
 */
import skipRollDialogCheck from "../helpers-behaviour";
import { chooseItemType } from "./dialogs";

const getItemFromEvent = (sheet, event) => {
  const li = event.currentTarget.closest(".item-entry");
  return sheet.actor.items.get(li.dataset.itemId);
};

export const useConsumable = (sheet, event, decrement) => {
  const item = getItemFromEvent(sheet, event);
  if (!item) return null;
  let {
    quantity: { value: quantity },
  } = item.system;
  return item.update({
    "system.quantity.value": decrement ? --quantity : ++quantity,
  });
};

export const onSpellChange = async (sheet, event) => {
  event.preventDefault();
  const item = getItemFromEvent(sheet, event);
  if (event.target.dataset.field === "cast") {
    return item.update({ "system.cast": Number.parseInt(event.target.value, 10) });
  }
  if (event.target.dataset.field === "memorize") {
    return item.update({ "system.memorized": Number.parseInt(event.target.value, 10) });
  }
};

export const resetSpells = async (sheet, event) => {
  const spellsContainer = event.currentTarget.closest(".inventory.spells");
  const spellElements = spellsContainer.querySelectorAll(".item-entry");

  const updates = [];
  for (const el of spellElements) {
    const { itemId } = el.dataset;
    const item = sheet.actor.items.get(itemId);
    if (item?.system) {
      updates.push({ _id: item.id, "system.cast": item.system.memorized });
    }
  }
  if (updates.length > 0) {
    await sheet.actor.updateEmbeddedDocuments("Item", updates);
  }
};

export const rollAbility = async (sheet, event) => {
  const item = getItemFromEvent(sheet, event);
  const itemData = item?.system;
  if (item.type === "weapon") {
    if (sheet.actor.type === "monster") {
      await item.update({ "system.counter.value": itemData.counter.value - 1 });
    }
    item.rollWeapon({ skipDialog: skipRollDialogCheck(event) });
  } else if (item.type === "spell") {
    await item.spendSpell({ skipDialog: skipRollDialogCheck(event) });
  } else {
    await item.rollFormula({ skipDialog: skipRollDialogCheck(event) });
  }
};

export const rollSave = (sheet, event) => {
  const { save } = event.currentTarget.parentElement.parentElement.dataset;
  return sheet.actor.rollSave(save, { event });
};

export const rollAttack = (sheet, event) => {
  const { attack } = event.currentTarget.parentElement.parentElement.dataset;
  return sheet.actor.targetAttack({ roll: {} }, attack, {
    type: attack,
    skipDialog: skipRollDialogCheck(event),
  });
};

export const updateItemQuantity = async (sheet, event) => {
  event.preventDefault();
  const item = getItemFromEvent(sheet, event);
  if (event.target.dataset.field === "value") {
    return item.update({ "system.quantity.value": Number.parseInt(event.target.value, 10) });
  }
  if (event.target.dataset.field === "max") {
    return item.update({ "system.quantity.max": Number.parseInt(event.target.value, 10) });
  }
};

export const toggleItemEquipped = (item) => item.update({ system: { equipped: !item.system.equipped } });

export const removeItemFromActor = async (actor, item) => {
  if (item.type === "ability" || item.type === "spell") {
    return actor.deleteEmbeddedDocuments("Item", [item._id]);
  }
  if (item.type !== "container" && item.system.containerId !== "") {
    const { containerId } = item.system;
    const newItemIds = actor.items.get(containerId).system.itemIds.filter((o) => o !== item.id);
    await actor.updateEmbeddedDocuments("Item", [{ _id: containerId, system: { itemIds: newItemIds } }]);
  }
  if (item.type === "container" && item.system.itemIds) {
    const updateData = item.system.itemIds.reduce((acc, val) => {
      if (actor.items.get(val)) acc.push({ _id: val, "system.containerId": "" });
      return acc;
    }, []);
    await actor.updateEmbeddedDocuments("Item", updateData);
  }
  return actor.deleteEmbeddedDocuments("Item", [item._id]);
};

export const createItem = (sheet, event) => {
  event.preventDefault();
  const header = event.currentTarget;
  const { treasure, type, lvl } = header.dataset;
  const buildItem = (t, name) => ({
    name: name || `New ${t.capitalize()}`,
    type: t,
  });

  if (type === "choice") {
    const choices = header.dataset.choices.split(",");
    return chooseItemType(choices).then((dialogInput) => {
      const itemData = buildItem(dialogInput.type, dialogInput.name);
      return sheet.actor.createEmbeddedDocuments("Item", [itemData], {});
    });
  }
  const itemData = buildItem(type);
  if (treasure) itemData.system = { treasure: true };
  if (type === "spell") itemData.system = lvl ? { lvl } : { lvl: 1 };
  return sheet.actor.createEmbeddedDocuments("Item", [itemData], {});
};
