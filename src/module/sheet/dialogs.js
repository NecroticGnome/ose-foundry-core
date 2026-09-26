/**
 * @file DialogV2 launchers used from sheets.
 */
import OSE from "../config";
import OseEntityTweaks from "../dialog/entity-tweaks";
import { removeItemFromActor } from "./inventory-actions";

export const promptRemoveItemFromActor = (sheet, item) =>
  foundry.applications.api.DialogV2.confirm({
    window: { title: game.i18n.localize("OSE.dialog.deleteItem") },
    content: game.i18n.format("OSE.dialog.confirmDeleteItem", { name: item.name }),
    yes: {
      default: false,
      callback: () => removeItemFromActor(sheet.actor, item),
    },
    defaultYes: false,
  });

export const chooseItemType = async (choices = ["weapon", "armor", "shield", "gear"]) => {
  const templateData = {
    types: choices.reduce((obj, choice) => {
      obj[choice] = choice;
      return obj;
    }, {}),
  };
  const dlg = await foundry.applications.handlebars.renderTemplate(
    `${OSE.systemPath()}/templates/items/entity-create.html`,
    templateData,
  );
  return new Promise((resolve) => {
    new foundry.applications.api.DialogV2({
      window: { title: game.i18n.localize("OSE.dialog.createItem") },
      content: dlg,
      buttons: [
        {
          action: "ok",
          label: game.i18n.localize("OSE.Ok"),
          icon: "fas fa-check",
          default: true,
          callback: (_event, button) => {
            resolve(new foundry.applications.ux.FormDataExtended(button.form).object);
          },
        },
        {
          action: "cancel",
          icon: "fas fa-times",
          label: game.i18n.localize("OSE.Cancel"),
          callback: () => {},
        },
      ],
    }).render(true);
  });
};

export const openEntityTweaksFor = (sheet) =>
  OseEntityTweaks.open(sheet.actor, {
    position: {
      top: sheet.position.top + 40,
      left: sheet.position.left + (sheet.position.width - 400) / 2,
    },
  });
