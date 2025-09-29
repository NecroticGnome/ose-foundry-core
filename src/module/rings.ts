import OSE from "./config";

/**
 * Adds custom dynamic token ring option.
 * @param {foundry.canvas.tokens.TokenRingConfig} config - The TokenRingConfig to modify
 */
export function initializeTokenRing(
  config: foundry.canvas.tokens.TokenRingConfig
) {
  config.addConfig(
    "ose-default-black-white",
    new foundry.canvas.placeables.tokens.DynamicRingData({
      label: "OSE.rings.BlackWhite",
      spritesheet: `${OSE.assetsPath}/rings/black-white.json`,
    })
  );
}

/**
 * Prompts the user to select the default OSE dynamic token ring.
 * Will do nothing if the user has previously been prompted.
 */
export async function promptTokenRingSelection() {
  const hasPrompted = game.settings.get(
    game.system.id,
    "hasPromptedDefaultOSETokenRing"
  );
  if (hasPrompted) return;

  if (
    await foundry.applications.api.DialogV2.confirm({
      window: {
        title: game.i18n.localize("OSE.dialog.TokenRingPrompt.Title"),
      },
      content: game.i18n.localize("OSE.dialog.TokenRingPrompt.Content"),
    })
  ) {
    await game.settings.set(
      "core",
      "dynamicTokenRing",
      "ose-default-black-white"
    );
  }
  await game.settings.set(
    game.system.id,
    "hasPromptedDefaultOSETokenRing",
    true
  );
}
