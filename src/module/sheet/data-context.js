/**
 * @file Reusable getData / _prepareContext slices for actor sheets.
 */
import OSE from "../config";

export const prepareSheetConfig = () => ({
  ...CONFIG.OSE,
  ascendingAC: game.settings.get(game.system.id, "ascendingAC"),
  initiative: game.settings.get(game.system.id, "initiative") !== "group",
  encumbrance: game.settings.get(game.system.id, "encumbranceOption"),
  encumbranceStrengthMod:
    game.settings.get(game.system.id, "encumbranceItemStrengthMod") &&
    game.settings.get(game.system.id, "encumbranceOption") === "itembased",
});

export const prepareEncumbranceTemplate = () =>
  OSE.encumbrance?.templateEncumbranceBar || `${OSE.systemPath()}/templates/actors/partials/character-encumbrance.html`;

export const prepareActorContext = async (actor, expandedSet) => {
  for (const item of actor.items) {
    item.isExpanded = expandedSet.has(item.id);
    await item.prepareDerivedData();
  }
  return {
    owner: actor.isOwner,
    isOwnerOrObserver: actor.isOwnerOrObserver,
    isNew: actor.isNew(),
    config: prepareSheetConfig(),
    encumbranceTemplate: prepareEncumbranceTemplate(),
  };
};
