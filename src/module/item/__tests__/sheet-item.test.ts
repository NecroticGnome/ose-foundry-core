/**
 * @file Contains tests for the Item Sheet.
 */
// eslint-disable-next-line prettier/prettier, import/no-cycle
import type { QuenchMethods } from "../../../e2e";
import { cleanUpWorldItems, createWorldTestItem } from "../../../e2e/testUtils";
import OseItemSheet from "../item-sheet";

export const key = "ose.item.sheet";
export const options = { displayName: "OSE: Item: Sheet" };

export default ({ describe, it, expect, after, assert }: QuenchMethods) => {
  after(async () => {
    await cleanUpWorldItems();
  });

  describe("DEFAULT_OPTIONS", () => {
    it("Has correctly set defaults", () => {
      const opts = OseItemSheet.DEFAULT_OPTIONS;
      expect(opts.classes).contain("ose");
      expect(opts.classes).contain("sheet");
      expect(opts.classes).contain("item");
      expect(opts.position.width).equal(560);
      expect(opts.position.height).equal(480);
      assert(opts.window.resizable);
      assert(opts.form.submitOnChange);
      assert(!opts.form.closeOnSubmit);
    });
  });

  describe("PARTS", () => {
    it("Falls back to item-sheet template path", () => {
      expect(OseItemSheet.PARTS.main.template).contain("/templates/items/item-sheet.html");
    });
  });

  describe("_configureRenderParts(options)", () => {
    it("Resolves per-type template path", async () => {
      const item = await createWorldTestItem("spell");
      const sheet = item?.sheet;
      const parts = sheet?._configureRenderParts({});
      expect(parts.main.template).contain("/templates/items/spell-sheet.html");
      await item?.delete();
    });
  });

  describe("_prepareContext()", () => {
    it("Returns enriched + config + system data", async () => {
      const item = await createWorldTestItem("item");
      const sheet = item?.sheet;
      const data = await sheet?._prepareContext({});
      const keys = Object.keys(data);
      expect(keys).contain("name");
      expect(keys).contain("img");
      expect(keys).contain("system");
      expect(keys).contain("config");
      expect(keys).contain("enriched");
      expect(data.enriched).is.not.undefined;
      expect(data.config.encumbrance).is.not.undefined;
      await item?.delete();
    });
  });
};
