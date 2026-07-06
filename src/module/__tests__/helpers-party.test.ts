/**
 * @file Contains tests for party helpers
 */
// eslint-disable-next-line prettier/prettier, import/no-cycle
import type { QuenchMethods } from "../../e2e";
import { cleanUpActorsByKey, closeDialogs, createMockActorKey, openDialogs, waitForInput } from "../../e2e/testUtils";
import { update } from "../helpers-party";
import OsePartySheet from "../party/party-sheet";

export const key = "ose.helpers.party";
export const options = {
  displayName: "OSE: Helpers: Party",
};

/* MOCKING HELPERS */
const createMockActor = async (type: string, data: object = {}) => createMockActorKey(type, data, key);

/* CLEAN UP HELPERS */
const cleanUpActors = () => cleanUpActorsByKey(key);

export default ({ describe, it, expect, after }: QuenchMethods) => {
  after(() => {
    cleanUpActors();
  });

  // @todo: How to test?
  describe("addControl(object, html)", () => {});

  describe("update(actor)", () => {
    it("Doesn't render a partysheet when not in party", async () => {
      const actor = await createMockActor("character");
      update(actor);
      expect(openDialogs().length).equal(0);
      await actor?.delete();
    });

    it("Opens a partysheet when in party", async () => {
      const actor = await createMockActor("character");
      await actor?.setFlag(game.system.id, "party", true);
      update(actor);
      await waitForInput();
      await OsePartySheet?.partySheet?.render(true);
      await waitForInput();
      // The world may already hold other party members, so assert our actor is
      // among the rendered members rather than assuming it's the only/first one.
      const memberIds = Array.from(document.querySelectorAll(".party-members .actor")).map((el) =>
        el.getAttribute("data-actor-id"),
      );
      expect(memberIds).to.include(actor?.id);
      expect(openDialogs().length).equal(1);
      await closeDialogs();
      actor?.delete();
    });
  });
};
