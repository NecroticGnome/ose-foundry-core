/**
 * @file Functions that alter the way that sidebar and compendium lists render
 */
import OSE from "./config";

/**
 * Called when a compendium directory is rendered
 *
 * @param {foundry.applications.sidebar.tabs.DocumentDirectory} object - The compendium directory object
 */
export const RenderCompendium = async (object) => {
  if (object.documentName !== "Item") {
    return;
  }

  const html = object.element;
  const render = html.querySelectorAll(".item");
  const content = await object.collection.getDocuments();

  for (const item of render) {
    const foundryDocument = content.find((e) => e.id === item.dataset.entryId);

    const tagsHtml = await foundry.applications.handlebars.renderTemplate(
      `${OSE.systemPath()}/templates/actors/partials/item-auto-tags-partial.html`,
      { tags: foundryDocument.system.autoTags || [] },
    );
    item.insertAdjacentHTML("beforeend", tagsHtml);
  }
};

/**
 * Called when the sidebar item directory is rendered
 *
 * @param {foundry.applications.sidebar.tabs.ItemDirectory} object - The item directory object
 */
export const RenderItemDirectory = async (object) => {
  const html = object.element;
  const render = html.querySelectorAll(".item");
  const content = object.collection;

  for (const item of render) {
    const foundryDocument = content.find((e) => e.id === item.dataset.entryId);

    const tagsHtml = await foundry.applications.handlebars.renderTemplate(
      `${OSE.systemPath()}/templates/actors/partials/item-auto-tags-partial.html`,
      { tags: foundryDocument.system.autoTags || [] },
    );
    item.insertAdjacentHTML("beforeend", tagsHtml);
  }
};
