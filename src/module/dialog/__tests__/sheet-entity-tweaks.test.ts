/**
 * @file Contains tests for Entity Tweaks sheet.
 */
import type { QuenchMethods } from "../../../e2e";
import { cleanUpActorsByKey, createMockActorKey, openV2AppsByClass, waitForElement } from "../../../e2e/testUtils";
import OseEntityTweaks from "../entity-tweaks";

export const key = "ose.actor.sheet.dialog.entity-tweaks";
export const options = {
  displayName: "OSE: Actor: Dialog Sheet: Entity Tweaks",
};

const createMockActor = async (type: string, data: object = {}) => createMockActorKey(type, data, key);

export default ({ describe, it, expect, assert, after }: QuenchMethods) => {
  describe("DEFAULT_OPTIONS", () => {
    it("Has correctly set defaults", () => {
      const opts = OseEntityTweaks.DEFAULT_OPTIONS;
      expect(opts.classes).contain("sheet-tweaks");
      expect(OseEntityTweaks.PARTS.main.template).contain("/templates/actors/dialogs/tweaks-dialog.html");
      expect(opts.position.width).equal(440);
    });
  });

  describe("title()", () => {
    it("Creates string in dialog window title", async () => {
      const actor = await createMockActor("character");
      const sheet = new OseEntityTweaks(actor);
      await sheet.render({ force: true });
      await waitForElement(`#${sheet.id} .window-title`);
      expect(typeof sheet.title).equal("string");
      const dialogs = openV2AppsByClass("sheet-tweaks");
      expect(dialogs.length).equal(1);
      await dialogs[0].close();
      expect(openV2AppsByClass("sheet-tweaks").length).equal(0);
    });
  });

  describe("_prepareContext()", () => {
    it("Returns proper data for character", async () => {
      const actor = await createMockActor("character");
      const sheet = new OseEntityTweaks(actor);
      const data = await sheet._prepareContext();
      const keys = Object.keys(data);
      assert(keys.length >= 2);
      expect(keys).contain("config");
      expect(keys).contain("user");
      assert(data.isCharacter);
    });
  });

  // Submission is covered by integration smoke tests rather than unit tests
  // because V2's form.handler signature requires synthesizing a FormDataExtended.
  describe("_submit(data)", () => {});

  after(async () => {
    await cleanUpActorsByKey(key);
  });
};
