/**
 * @file A collection of helper utils for chat cards
 */
import OseActor from "./actor/entity";

import { OseContextMenuEntry } from "../global";

/**
 * Apply damage to a target actor
 *
 * @param {Actor | null} actor - The target actor to apply damage to
 * @param {string} amount - The amount of damage to apply
 * @param {1 | -1} multiplier - The multiplier to apply to the damage
 * @param {string} nameOrId - The name or ID of the target actor
 */
async function applyDamageToTarget(
  actor: Actor | null,
  amount: string,
  multiplier: 1 | -1,
  nameOrId: string
) {
  if (!game.user?.isGM || !(actor instanceof OseActor)) {
    ui.notifications?.error(
      game.i18n.format("OSE.error.cantDealDamageTo", { nameOrId })
    );
    return;
  }
  await actor.applyDamage(amount, multiplier);
}

/**
 * Apply rolled dice damage to the token or tokens which are currently controlled.
 * This allows for damage to be scaled by a multiplier to account for healing, critical hits, or resistance
 *
 * @param {HTMLElement} html - The chat entry which contains the roll data
 * @param {number} multiplier - A damage multiplier to apply to the rolled damage.
 */
function applyChatCardDamage(html: HTMLElement, multiplier: 1 | -1) {
  const diceTotalTargets = html.querySelectorAll(".dice-total");
  const lastDiceTotalTarget = diceTotalTargets[
    diceTotalTargets.length - 1
  ] as HTMLElement;
  const amount = lastDiceTotalTarget?.textContent || "0";
  const dmgTgt = game.settings.get(game.system.id, "applyDamageOption");
  if (dmgTgt === CONFIG.OSE.apply_damage_options.originalTarget) {
    const victimId = (html.querySelector(".chat-target") as HTMLElement)
      ?.dataset.id;
    (async () => {
      const actor = ((await fromUuid(victimId || "")) as TokenDocument)?.actor;
      await applyDamageToTarget(
        actor,
        amount,
        multiplier,
        actor?.name || victimId || "original target"
      );
    })();
  }
  if (dmgTgt === CONFIG.OSE.apply_damage_options.targeted) {
    game.user?.targets.forEach((t) =>
      applyDamageToTarget(t.actor, amount, multiplier, t.name)
    );
  }
  if (dmgTgt === CONFIG.OSE.apply_damage_options.selected) {
    canvas.tokens?.controlled.forEach((t) =>
      applyDamageToTarget(t.actor, amount, multiplier, t.name)
    );
  }
}

/**
 * Check if the chat card can apply damage
 *
 * @param {HTMLElement} html - The chat card HTML element
 */
function canApplyDamage(html: HTMLElement) {
  if (!game.user?.isGM) return false;

  if (!html.querySelector(".dice-total")) return false;
  const applyDamageOption = game.settings.get(
    game.system.id,
    "applyDamageOption"
  );
  switch (applyDamageOption) {
    case CONFIG.OSE.apply_damage_options.originalTarget:
      const chatTargets = html.querySelectorAll(".chat-target");
      const lastChatTarget = chatTargets[chatTargets.length - 1] as HTMLElement;
      return !!lastChatTarget?.dataset.id;

    case CONFIG.OSE.apply_damage_options.targeted:
      return !!game.user?.targets?.size;

    case CONFIG.OSE.apply_damage_options.selected:
      return !!canvas.tokens?.controlled.length;

    default:
      ui.notifications?.error(
        game.i18n.format("OSE.error.unexpectedSettings", {
          configName: "applyDamageOption",
          configValue: applyDamageOption,
        })
      );
      return false;
  }
}

const canApply: OseContextMenuEntry["condition"] = (li) => canApplyDamage(li);

/**
 * This function is used to hook into the Chat Log context menu to add additional options to each message
 * These options make it easy to conveniently apply damage to controlled tokens based on the value of a Roll
 *
 * @param {object} _ - Unused jQuery collection
 * @param {Array} options - The list of context menu options
 * @returns {undefined}
 */
export const addChatMessageContextOptions = (
  _: HTMLElement,
  options: OseContextMenuEntry[]
) => {
  options.push(
    {
      name: game.i18n.localize("OSE.messages.applyDamage"),
      icon: '<i class="fas fa-user-minus"></i>',
      condition: canApply,
      callback: (li) => applyChatCardDamage(li, 1),
    },
    {
      name: game.i18n.localize("OSE.messages.applyHealing"),
      icon: '<i class="fas fa-user-plus"></i>',
      condition: canApply,
      callback: (li) => applyChatCardDamage(li, -1),
    }
  );
  return options;
};

/* -------------------------------------------- */

export const addChatMessageButtons = (msg: ChatMessage, html: HTMLElement) => {
  // Hide blind rolls
  const blindable = html.querySelector(".blindable") as HTMLElement;
  if (
    // @ts-ignore need to add ChatMessage document property updates.
    msg?.blind &&
    !game.user?.isGM &&
    blindable &&
    blindable.dataset.blind === "true"
  ) {
    blindable.outerHTML =
      "<div class='dice-roll'><div class='dice-result'><div class='dice-formula'>???</div></div></div>";
  }
  // Buttons
  const roll = html.querySelector(".damage-roll");
  if (roll && canApplyDamage(html)) {
    const diceDamageDiv = document.createElement("div");
    diceDamageDiv.className = "dice-damage";

    const button = document.createElement("button");
    button.type = "button";
    button.dataset.action = "apply-damage";
    button.innerHTML = '<i class="fas fa-tint"></i>';

    diceDamageDiv.append(button);
    roll.append(diceDamageDiv);

    button.addEventListener("click", (ev) => {
      ev.preventDefault();
      applyChatCardDamage(html, 1);
    });
  }
};

export const functionsForTesting = {
  applyChatCardDamage,
};
