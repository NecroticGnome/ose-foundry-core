/**
 * @file The entry point for the OSE system
 *       We should handle most of our setup here.
 */
import OseActorSheetCharacter from "./module/actor/character-sheet";
import OseDataModelCharacter from "./module/actor/data-model-character";
import OseDataModelMonster from "./module/actor/data-model-monster";
import OseActor from "./module/actor/entity";
import OseActorSheetMonster from "./module/actor/monster-sheet";

import OseDataModelAbility from "./module/item/data-model-ability";
import OseDataModelArmor from "./module/item/data-model-armor";
import OseDataModelContainer from "./module/item/data-model-container";
import OseDataModelItem from "./module/item/data-model-item";
import OseDataModelSpell from "./module/item/data-model-spell";
import OseDataModelWeapon from "./module/item/data-model-weapon";
import OseItem from "./module/item/entity";
import OseItemSheet from "./module/item/item-sheet";

import { OSE } from "./module/config";
import registerFVTTModuleAPIs from "./module/fvttModuleAPIs";
import * as chat from "./module/helpers-chat";
import handlebarsHelpers from "./module/helpers-handlebars";
import * as macros from "./module/helpers-macros";
import * as party from "./module/helpers-party";
import * as treasure from "./module/helpers-treasure";
import OsePartySheet from "./module/party/party-sheet";
import templates from "./module/preloadTemplates";
import * as renderList from "./module/renderList";
import registerSettings from "./module/settings";

import { OSECombat } from "./module/combat/combat";
import OSECombatTracker from "./module/combat/combat-tracker";
import { OSECombatant } from "./module/combat/combatant";
import TokenRulerOSE from "./module/actor/token-ruler";

import "./e2e";

/* -------------------------------------------- */
/*  Foundry VTT Initialization                  */
/* -------------------------------------------- */

Hooks.once("init", async () => {
  // Give modules a chance to add encumbrance schemes
  // They can do so by adding their encumbrance schemes
  // to CONFIG.OSE.encumbranceOptions
  Hooks.call("ose-setup-encumbrance");

  CONFIG.OSE = OSE;

  if (game.system.id === "ose-dev") {
    CONFIG.debug = {
      ...CONFIG.debug,
      combat: true,
    };
  }

  // Register custom system settings
  registerSettings();

  CONFIG.Combat.documentClass = OSECombat;
  CONFIG.Combatant.documentClass = OSECombatant;
  const isGroupInitiative =
    game.settings.get(game.system.id, "initiative") === "group";
  CONFIG.Combat.initiative = {
    decimals: 2,
    formula: isGroupInitiative ? OSECombat.GROUP_FORMULA : OSECombat.FORMULA,
  };

  CONFIG.Combat.fallbackTurnMarker = "icons/svg/circle.svg";
  CONFIG.ui.combat = OSECombatTracker;
  CONFIG.Token.rulerClass = TokenRulerOSE;

  game.ose = {
    rollItemMacro: macros.rollItemMacro,
    rollTableMacro: macros.rollTableMacro,
  };

  // Init Party Sheet handler
  OsePartySheet.init();

  // Custom Handlebars helpers
  handlebarsHelpers();

  // Register APIs of Foundry VTT Modules we explicitly support that provide custom hooks
  registerFVTTModuleAPIs();

  CONFIG.Actor.documentClass = OseActor;
  CONFIG.Item.documentClass = OseItem;

  CONFIG.Actor.dataModels = {
    character: OseDataModelCharacter,
    monster: OseDataModelMonster,
  };
  CONFIG.Item.dataModels = {
    weapon: OseDataModelWeapon,
    armor: OseDataModelArmor,
    item: OseDataModelItem,
    spell: OseDataModelSpell,
    ability: OseDataModelAbility,
    container: OseDataModelContainer,
  };

  // Register sheet application classes
  foundry.documents.collections.Actors.unregisterSheet(
    "core",
    foundry.appv1.sheets.ActorSheet
  );
  foundry.documents.collections.Actors.registerSheet(
    game.system.id,
    OseActorSheetCharacter,
    {
      types: ["character"],
      makeDefault: true,
      label: "OSE.SheetClassCharacter",
    }
  );
  foundry.documents.collections.Actors.registerSheet(
    game.system.id,
    OseActorSheetMonster,
    {
      types: ["monster"],
      makeDefault: true,
      label: "OSE.SheetClassMonster",
    }
  );

  foundry.documents.collections.Items.unregisterSheet(
    "core",
    foundry.appv1.sheets.ItemSheet
  );
  foundry.documents.collections.Items.registerSheet(
    game.system.id,
    OseItemSheet,
    {
      makeDefault: true,
      label: "OSE.SheetClassItem",
    }
  );

  await templates();
});

/**
 * This function runs after game data has been requested and loaded from the servers, so entities exist
 */
Hooks.once("setup", () => {
  // Localize CONFIG objects once up-front
  ["saves_short", "saves_long", "scores", "armor", "colors", "tags"].forEach(
    (o) => {
      CONFIG.OSE[o] = Object.entries(CONFIG.OSE[o]).reduce((obj, e) => {
        const localized = { ...obj };
        localized[e[0]] = game.i18n.localize(e[1]);
        return localized;
      }, {});
    }
  );

  // Custom languages
  const languages = game.settings.get(game.system.id, "languages");
  if (languages !== "") {
    const langArray = languages.split(",").map((s) => s.trim());
    CONFIG.OSE.languages = langArray;
  }
});

Hooks.once("ready", async () => {
  Hooks.on("hotbarDrop", (bar, data, slot) => {
    macros.createOseMacro(data, slot);
    // Returning false to stop the rest of hotbarDrop handling.
    return false;
  });
});

// Party sheet control
Hooks.on("activateActorDirectory", party.addControl);

/**
 * @param {Application} app
 * @param {HTMLElement} html
 */
Hooks.on("renderSettings", async (app, html) => {
  const gamesystem = html.querySelector("section.info");
  const template = `${OSE.systemPath()}/templates/chat/license.html`;
  const rendered = await foundry.applications.handlebars.renderTemplate(
    template
  );
  gamesystem.insertAdjacentHTML("afterend", rendered);
});

Hooks.on("renderChatLog", (app, html) => OseItem.chatListeners(html));
Hooks.on("getChatLogEntryContext", chat.addChatMessageContextOptions);
Hooks.on("getChatMessageContextOptions", chat.addChatMessageContextOptions);
Hooks.on("renderChatMessageHTML", chat.addChatMessageButtons);
Hooks.on("renderRollTableSheet", treasure.augmentTable);
Hooks.on("updateActor", party.update);
/**
 * @param {OSECombatTracker} app - The combat tracker application
 * @param {HTMLElement} html - The HTML element of the combat tracker
 */
Hooks.on("renderCombatTracker", (app, html) =>
  app.renderGroups(html instanceof HTMLElement ? html : html[0])
);
/** @param {OSECombatant} combatant */
Hooks.on("createCombatant", (combatant) => {
  if (game.settings.get(game.system.id, "initiative") !== "group") return;
  combatant.assignGroup();
});

Hooks.on("renderCompendium", renderList.RenderCompendium);
Hooks.on("activateItemDirectory", renderList.RenderItemDirectory);

Hooks.on("OSE.Party.showSheet", OsePartySheet.showPartySheet);
