/**
 * @file v13/v14 wrappers for the chat-message visibility mode. v14 renamed
 *       core.rollMode to core.messageMode and changed the values; we keep
 *       the legacy publicroll/gmroll/blindroll/selfroll vocabulary so all
 *       call sites stay unchanged.
 */

const LEGACY_TO_MODE = { publicroll: "public", gmroll: "gm", blindroll: "blind", selfroll: "self" };
const MODE_TO_LEGACY = { public: "publicroll", gm: "gmroll", blind: "blindroll", self: "selfroll" };

const isV14OrLater = () => (game.release?.generation ?? 0) >= 14;

export const getRollMode = () => {
  if (!isV14OrLater()) return game.settings.get("core", "rollMode");
  const messageMode = game.settings.get("core", "messageMode");
  return MODE_TO_LEGACY[messageMode] ?? messageMode;
};

export const setRollMode = async (legacyValue) => {
  if (!isV14OrLater()) return game.settings.set("core", "rollMode", legacyValue);
  return game.settings.set("core", "messageMode", LEGACY_TO_MODE[legacyValue] ?? legacyValue);
};

export const getRollModes = () => {
  if (!isV14OrLater()) return CONFIG.Dice.rollModes;
  const modes = CONFIG.ChatMessage.modes;
  return { publicroll: modes.public, gmroll: modes.gm, blindroll: modes.blind, selfroll: modes.self };
};
