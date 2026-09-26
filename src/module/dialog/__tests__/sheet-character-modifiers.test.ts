/**
 * @file Contains tests for Character Modifiers sheet.
 */
import type { QuenchMethods } from "../../../e2e";
import { cleanUpActorsByKey, createMockActorKey, openV2Dialogs, waitForElement } from "../../../e2e/testUtils";
import OseCharacterModifiers from "../character-modifiers";

export const key = "ose.actor.sheet.character.dialog.modifiers";
export const options = {
  displayName: "OSE: Actor: Dialog Sheet: Character Modifiers",
};

const createMockActor = async (type: string, data: object = {}) => createMockActorKey(type, data, key);

export default ({ describe, it, expect, assert, after }: QuenchMethods) => {
  describe("DEFAULT_OPTIONS", () => {
    it("Has correctly set defaults", () => {
      const opts = OseCharacterModifiers.DEFAULT_OPTIONS;
      expect(opts.id).equal("sheet-modifiers");
      expect(opts.classes).contain("ose");
      expect(opts.classes).contain("dialog");
      expect(opts.classes).contain("modifiers");
      expect(OseCharacterModifiers.PARTS.main.template).contain("/templates/actors/dialogs/modifiers-dialog.html");
      expect(opts.position.width).equal(240);
    });
  });

  describe("title()", () => {
    it("Creates string in dialog window title", async () => {
      const actor = await createMockActor("character");
      const sheet = new OseCharacterModifiers(actor);
      await sheet.render({ force: true });
      await waitForElement(`#${sheet.id} .window-title`);
      expect(typeof sheet.title).equal("string");
      const dialogs = openV2Dialogs().filter((d) => d.options.classes.includes("modifiers"));
      expect(dialogs.length).equal(1);
      await dialogs[0].close();
      expect(openV2Dialogs().filter((d) => d.options.classes.includes("modifiers")).length).equal(0);
    });
  });

  describe("_prepareContext()", () => {
    it("Returns proper data", async () => {
      const actor = await createMockActor("character");
      const sheet = new OseCharacterModifiers(actor);
      const data = await sheet._prepareContext();
      const keys = Object.keys(data);
      assert(keys.length > 0);
      expect(keys).contain("user");
    });
  });

  after(async () => {
    await cleanUpActorsByKey(key);
  });
};
