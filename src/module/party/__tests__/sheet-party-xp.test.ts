/**
 * @file Contains tests for Party XP Sheet.
 */
import type { QuenchMethods } from "../../../e2e";
import { openV2AppsByClass, waitForElement } from "../../../e2e/testUtils";
import OsePartyXP from "../party-xp";

export const key = "ose.party-xp.sheet";
export const options = { displayName: "OSE: Party XP: Sheet" };

export default ({ describe, it, expect, assert }: QuenchMethods) => {
  describe("DEFAULT_OPTIONS", () => {
    it("Has correctly set defaults", () => {
      const opts = OsePartyXP.DEFAULT_OPTIONS;
      expect(opts.classes).contain("ose");
      expect(opts.classes).contain("dialog");
      expect(opts.classes).contain("party-xp");
      expect(OsePartyXP.PARTS.main.template).contain("/templates/apps/party-xp.html");
      expect(opts.position.width).equal(300);
      expect(opts.position.height).equal("auto");
      assert(!opts.window.resizable);
      assert(opts.form.closeOnSubmit);
    });
  });

  describe("title()", () => {
    it("Creates string in dialog window title", async () => {
      const partyXP = new OsePartyXP();
      await partyXP.render({ force: true });
      await waitForElement("#party-xp .window-title");
      const dialogTitle = document.querySelector("#party-xp .window-title")?.innerHTML;
      expect(typeof dialogTitle).equal("string");
      const dialogs = openV2AppsByClass("party-xp");
      expect(dialogs.length).equal(1);
      await dialogs[0].close();
      expect(openV2AppsByClass("party-xp").length).equal(0);
    });
  });

  describe("_prepareContext()", () => {
    it("Returns proper data", async () => {
      const sheet = new OsePartyXP();
      const data = await sheet._prepareContext();
      const keys = Object.keys(data);
      expect(keys.length).equal(4);
      expect(keys).contain("actors");
      expect(keys).contain("config");
      expect(keys).contain("user");
      expect(keys).contain("settings");
    });
  });
};
