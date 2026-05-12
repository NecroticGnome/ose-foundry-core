/**
 * @file Helper functions related to treasure table rolls
 */
import { OSE } from "./config";

// eslint-disable-next-line import/prefer-default-export
export const augmentTable = (table, html) => {
  // Treasure Toggle
  const isTreasureTable = Boolean(table.document.getFlag(game.system.id, "treasure"));

  const treasureTableToggle = document.createElement("div");
  treasureTableToggle.className = "toggle-treasure";
  treasureTableToggle.title = "Toggle Treasure Table";
  if (isTreasureTable) {
    treasureTableToggle.classList.add("active");
  }

  const head = html.querySelector(".sheet-header");
  head.append(treasureTableToggle);

  html.querySelector(".toggle-treasure").addEventListener("click", () => {
    const isTreasure = Boolean(table.document.getFlag(game.system.id, "treasure"));
    table.document.setFlag(game.system.id, "treasure", !isTreasure);
  });

  // Treasure table formatting
  if (!isTreasureTable) {
    return;
  }

  // Hide irrelevant standard fields
  const rangeFields = html.querySelectorAll(".range");
  rangeFields.forEach((el) => {
    el.style.display = "none";
  });
  const normalizeResults = html.querySelector("button[data-action=normalizeResults]");
  if (normalizeResults) {
    normalizeResults.remove();
  }

  const chanceHeader = html.querySelector("thead .weight");
  if (chanceHeader) chanceHeader.textContent = "Chance (%)";

  const chanceColumn = html.querySelectorAll(".weight");
  chanceColumn.forEach((col) => {
    col.style.flex = "0 0 75px";
  });

  const formula = html.querySelector("input[name=formula]");
  if (formula) {
    formula.value = "1d100";
    formula.disabled = true;
  }

  // Replace Roll button
  const rollButton = document.createElement("button");
  rollButton.className = "roll-treasure";
  rollButton.type = "button";
  rollButton.innerHTML = `<i class="fas fa-gem"></i> ${game.i18n.localize("OSE.table.treasure.roll")}`;

  const footerRoll = html.querySelector(".form-footer [data-action='drawResult']");
  footerRoll.replaceWith(rollButton);

  rollButton.addEventListener("click", (ev) => {
    rollTreasure(table.document, { event: ev });
  });
};

/**
 *
 * @param table
 * @param data
 */
async function drawTreasure(table, data) {
  const percent = async (chance) => {
    const roll = new Roll("1d100");
    await roll.evaluate();
    return roll.total <= chance;
  };
  data.treasure = {};
  if (table.getFlag(game.system.id, "treasure")) {
    for (const r of table.results) {
      if (await percent(r.weight)) {
        const text = await r.getHTML();
        data.treasure[r.id] = {
          img: r.img,
          text: await foundry.applications.ux.TextEditor.implementation.enrichHTML(text, { async: true }),
        };
        const parsedUuid = foundry.utils.parseUuid(r.documentUuid);
        const documentCollection = parsedUuid?.collection?.metadata?.id ?? parsedUuid?.documentType ?? "";
        if (r.type === CONST.TABLE_RESULT_TYPES.DOCUMENT && documentCollection === "RollTable") {
          const embeddedTable = await fromUuid(r.documentUuid);
          await drawTreasure(embeddedTable, data.treasure[r.id]);
        }
      }
    }
  } else {
    const { results } = await table.roll();
    for (const s of results) {
      data.treasure[s.id] = { img: s.img, text: await s.getHTML() };
    }
  }
  return data;
}

/**
 *
 * @param table
 * @param options
 */
export async function rollTreasure(table, options = {}) {
  // Draw treasure
  const data = await drawTreasure(table, {});
  const templateData = {
    treasure: data.treasure,
    table,
  };

  // Animation
  if (options.event) {
    const results = $(options.event.currentTarget.parentElement).prev().find(".table-result");
    results.each((_, item) => {
      item.classList.remove("active");
      if (data.treasure[item.dataset.resultId]) {
        item.classList.add("active");
      }
    });
  }

  await new Promise((resolve) => requestAnimationFrame(resolve));
  const html = await foundry.applications.handlebars.renderTemplate(
    `${OSE.systemPath()}/templates/chat/roll-treasure.html`,
    templateData,
  );

  const chatData = {
    content: html,
    // sound: "systems/ose/assets/coins.mp3"
  };

  const rollMode = game.settings.get("core", "rollMode");
  if (["gmroll", "blindroll"].includes(rollMode)) chatData.whisper = ChatMessage.getWhisperRecipients("GM");
  if (rollMode === "selfroll") chatData.whisper = [game.user._id];
  if (rollMode === "blindroll") chatData.blind = true;

  ChatMessage.create(chatData);
}

export const functionsForTesting = {
  drawTreasure,
  rollTreasure,
};
