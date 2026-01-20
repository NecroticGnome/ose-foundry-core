/**
 * @file Utilities for our Quench tests
 */

const inputDelay = 120;

export const delay = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/**
 * If there are messages, purge them.
 */
export const trashChat = (): any => {
  if (game.messages?.size) return game.messages?.documentClass.deleteDocuments([], { deleteAll: true });
};

/**
 * Delays execution so the UI can catch up.
 *
 * @returns {Promise} The delay.
 */
export const waitForInput = () => delay(inputDelay);

export const openWindows = (className: string) =>
  Object.values(ui.windows).filter((o) => o.options.classes.includes(className));

export const openDialogs = () => Object.values(ui.windows).filter((o) => o.options.classes.includes("dialog"));

export const openV2Dialogs = () =>
  Array.from(foundry.applications.instances.values()).filter((o) => o.options.classes.includes("dialog"));

export const closeDialogs = async () => {
  for (const o of openDialogs()) {
    await o.close();
  }
};

export const closeV2Dialogs = async () => {
  for (const o of openV2Dialogs()) {
    await o.close();
  }
};

export const closeSheets = async () => {
  for (const w of openWindows("sheet")) {
    await w.close();
  }
  waitForInput();
};

/**
 * Gets the active notifications from the UI. Needed because Foundry no longer
 * allows accessing the Notification class values directly.
 *
 * @returns {HTMLElement[]} An array of active notification elements.
 */
export const getActiveNotifications = (): HTMLElement[] =>
  Array.from(document.querySelectorAll("#notifications li").values() as unknown as HTMLElement[]);

/**
 * Checks if an object is a likely to be a Notification since Foundry
 * no longer allows accessing the Notification class values directly.
 *
 * @param obj
 */
export const objectIsNotification = (obj: any): obj is Notification =>
  typeof obj?.message === "string" && typeof obj?.type === "string" && typeof obj?.remove === "function";

/**
 * Returns the random number required to roll a specific number on a die.
 * This function is used to replace the `CONFIG.Dice.randomUniform` function as
 * it is then fed into the `randomFace` function of a DiceTerm.
 *
 * @param {number} requiredResult - The specific number you want to roll (e.g. 3 for rolling a 3 on a d6).
 * @param {number} diceFaces - The number of faces on the dice. (e.g. 6 for a d6)
 */
export const rollSpecificNumber = (requiredResult: number, diceFaces: number) => 1 - requiredResult / diceFaces;

/**
 * MOCKING HELPERS
 */

export const createMockActorKey = async (type: string, data: object = {}, key = "") =>
  CONFIG.Actor.documentClass.create({
    ...data,
    name: `Test Actor ${key}`,
    type,
  });

export const createWorldTestItem = async (type: string, name = `New World Test ${type.capitalize()}`) =>
  CONFIG.Item.documentClass.create({
    type,
    name,
  });

export const createActorTestItem = async (
  actor: StoredDocument<Actor> | undefined,
  type: string,
  name = `New Actor Test ${type.capitalize()}`,
  data: object = {},
) => actor?.createEmbeddedDocuments("Item", [{ type, name, ...data }]);

export const createMockMacro = async () =>
  CONFIG.Macro.documentClass.create({
    name: `Mock Macro ${foundry.utils.randomID()}`,
    type: "script",
    command: "console.log('Testing Macro');",
  });

export const createMockScene = async () => CONFIG.Scene.documentClass.create({ name: "Mock Scene", tokenVision: true });

export const getMockActorKey = async (key: string) => game.actors?.getName(`Test Actor ${key}`);

export const createMockCompendium = async (
  type: CompendiumCollection.Metadata["type"],
  // eslint-disable-next-line unicorn/consistent-function-scoping
): Promise<CompendiumCollection> =>
  // eslint-disable-next-line no-undef
  foundry.documents.collections.CompendiumCollection.createCompendium({
    label: "Test Compendium",
    name: "testcompendium",
    type,
    path: "",
    private: false,
    package: "world",
  });

// eslint-disable-next-line unicorn/consistent-function-scoping
export const cleanUpCompendium = async () => game.packs.get("world.testcompendium")?.deleteCompendium();

/**
 * CLEANUP HELPERS
 */

export const cleanUpMacros = async () => {
  const mockMacros = game.macros?.filter((o) => o.name?.includes("Mock Macro"));
  for (const o of mockMacros || []) {
    await o.delete();
  }
  return true;
};

export const cleanUpActorsByKey = async (key: string) => {
  for (const a of game.actors?.filter((a) => a.name === `Test Actor ${key}`)) {
    await a.delete();
  }
};

export const cleanUpWorldItems = async () => {
  for (const a of game.items?.filter((a) => a?.name?.includes("New World Test"))) {
    await a.delete();
  }
};

export const cleanUpScenes = async () => {
  for (const s of game.scenes?.filter((s) => s.name === "Mock Scene")) {
    await s.delete();
  }
};

/**
 * CONSTS
 */
export const itemTypes = new Set(["spell", "ability", "armor", "weapon", "item", "container"]);
