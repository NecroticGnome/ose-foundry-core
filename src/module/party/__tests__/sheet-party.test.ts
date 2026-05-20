/**
 * @file Contains tests for Party Sheet.
 */
import type { QuenchMethods } from "../../../e2e";
import { cleanUpActorsByKey, createMockActorKey, openV2AppsByClass, waitForElement } from "../../../e2e/testUtils";
import OsePartySheet from "../party-sheet";

export const key = "ose.party.sheet";
export const options = { displayName: "OSE: Party: Sheet" };

const createMockActor = async (type: string, data: object = {}) => createMockActorKey(type, data, key);

export default ({ describe, it, expect, assert, after }: QuenchMethods) => {
  describe("DEFAULT_OPTIONS", () => {
    it("Has correctly set defaults", () => {
      const opts = OsePartySheet.DEFAULT_OPTIONS;
      expect(opts.classes).contain("ose");
      expect(opts.classes).contain("dialog");
      expect(opts.classes).contain("party-sheet");
      expect(OsePartySheet.PARTS.main.template).contain("/templates/apps/party-sheet.html");
      expect(opts.position.width).equal(280);
      expect(opts.position.height).equal(400);
      assert(opts.window.resizable);
      expect(opts.dragDrop[0].dragSelector).equal(".actor-list .actor");
      expect(opts.dragDrop[0].dropSelector).equal(".party-members");
      assert(!opts.form.closeOnSubmit);
    });
  });

  describe("showPartySheet(options = {})", () => {
    it("Can render party sheet", async () => {
      OsePartySheet.showPartySheet();
      await waitForElement("#party-sheet");
      const dialogs = openV2AppsByClass("party-sheet");
      expect(dialogs.length).equal(1);
      await dialogs[0].close();
      expect(openV2AppsByClass("party-sheet").length).equal(0);
    });
  });

  describe("partySheet()", () => {
    it("Returns a partysheet", () => {
      const { partySheet } = OsePartySheet;
      expect(partySheet).is.not.undefined;
      expect(partySheet?.options.classes).contain("party-sheet");
    });
  });

  describe("title()", () => {
    it("Creates string in dialog window title", async () => {
      OsePartySheet.showPartySheet();
      await waitForElement("#party-sheet .window-title");
      const dialogTitle = document.querySelector("#party-sheet .window-title")?.innerHTML;
      expect(typeof dialogTitle).equal("string");
      const dialogs = openV2AppsByClass("party-sheet");
      expect(dialogs.length).equal(1);
      await dialogs[0].close();
      expect(openV2AppsByClass("party-sheet").length).equal(0);
    });
  });

  describe("_prepareContext()", () => {
    it("Returns proper data", async () => {
      const sheet = new OsePartySheet();
      const data = await sheet._prepareContext();
      const keys = Object.keys(data);
      expect(keys.length).equal(4);
      expect(keys).contain("partyActors");
      expect(keys).contain("config");
      expect(keys).contain("user");
      expect(keys).contain("settings");
    });
  });

  describe("_addActorToParty(actor)", () => {
    it("Monster returns undefined", async () => {
      const actor = await createMockActor("monster");
      const partySheet = new OsePartySheet();
      const promisedAnswer = await partySheet._addActorToParty(actor);
      expect(promisedAnswer).is.undefined;
      await actor.delete();
    });

    it("Adding a character updates the actor", async () => {
      const actor = await createMockActor("character");
      const partySheet = new OsePartySheet();
      const promisedAnswer = await partySheet._addActorToParty(actor);
      expect(promisedAnswer).is.undefined;
      assert(actor?.getFlag(game.system.id, "party"));
      await actor.delete();
    });
  });

  describe("_removeActorFromParty(actor)", async () => {
    it("Removing a character updates the actor flags", async () => {
      const actor = await createMockActor("character");
      const partySheet = new OsePartySheet();
      await partySheet._addActorToParty(actor);
      assert(actor?.getFlag(game.system.id, "party"));
      await partySheet._removeActorFromParty(actor);
      assert(!actor?.getFlag(game.system.id, "party"));
      await actor.delete();
    });
  });

  describe("_onDropActor(event, data)", () => {
    it("Dropping a non-existent uuid returns undefined", async () => {
      const partySheet = new OsePartySheet();
      const resolvedResponse = await partySheet._onDropActor({}, { type: "Actor", uuid: "Actor.does-not-exist" });
      expect(resolvedResponse).is.undefined;
    });

    it("Dropping an actor type updates the actor", async () => {
      const actor = await createMockActor("character");
      const data = {
        type: actor?.documentName,
        uuid: actor?.uuid,
      };
      const partySheet = new OsePartySheet();
      const promisedAnswer = await partySheet._onDropActor({}, data);
      expect(promisedAnswer).is.undefined;
      assert(actor?.getFlag(game.system.id, "party"));
      await actor?.delete();
    });
  });

  describe("_recursiveAddFolder(folder)", () => {
    it("Folder of actors add actors to party", async () => {
      const partySheet = new OsePartySheet();
      const folder = await Folder.create({ name: `Test Folder ${key}`, type: "Actor" });
      let actor = await createMockActor("character");
      actor = await actor?.update({ folder: folder?._id });
      expect(actor?.folder).equal(folder);
      await partySheet._recursiveAddFolder(folder);
      assert(actor?.getFlag(game.system.id, "party"));
      await actor?.delete();
      await folder?.delete();
    });

    it("Folder with sub-folders of actors add actors to party", async () => {
      const partySheet = new OsePartySheet();
      const folder = await Folder.create({ name: `Test Folder ${key}`, type: "Actor" });
      const subFolder = await Folder.create({
        name: `Test Folder ${key} subfolder`,
        type: "Actor",
        folder: folder._id,
      });
      const actor = await createMockActor("character");
      await actor?.update({ folder: subFolder?._id });
      expect(actor?.folder).equal(subFolder);
      await partySheet._recursiveAddFolder(folder);
      assert(actor?.getFlag(game.system.id, "party"));
      await actor?.delete();
    });
  });

  describe("_onDropFolder(event, data)", () => {
    it("Dropping a non-actor folder returns undefined", async () => {
      const partySheet = new OsePartySheet();
      const response = await partySheet._onDropFolder("", { uuid: "Folder.does-not-exist" });
      expect(response).is.undefined;
    });

    it("Dropping a folder with an actor in it adds it to the party", async () => {
      const partySheet = new OsePartySheet();
      const folder = await Folder.create({ name: `Test Folder ${key}`, type: "Actor" });
      let actor = await createMockActor("character");
      actor = await actor?.update({ folder: folder?._id });
      expect(actor?.folder).equal(folder);
      await partySheet._onDropFolder("", { uuid: folder.uuid });
      assert(actor?.getFlag(game.system.id, "party"));
      await actor?.delete();
      await folder?.delete();
    });
  });

  after(async () => {
    cleanUpActorsByKey(key);
    for (const a of game.folders?.contents?.filter((a) => a.name?.includes(`Test Folder ${key}`)) ?? []) {
      await a.delete();
    }
  });
};
