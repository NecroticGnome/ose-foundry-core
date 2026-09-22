/**
 * @file Contains tests for the Token resource attributes.
 */
// eslint-disable-next-line import/no-cycle
import type { QuenchMethods } from "../../../e2e";
import { cleanUpActorsByKey, createMockActorKey } from "../../../e2e/testUtils";
import trackableAttributes from "../trackable-attributes";

export const key = "ose.actor.trackableattributes";
export const options = { displayName: "OSE: Actor: Trackable Attributes" };

/** Foundry only offers an attribute whose value reads as a number. */
const isNumeric = (value: unknown) => value !== null && value !== "" && !Number.isNaN(Number(value));

/** Read a dot path out of an actor's system data, the way a Token bar does. */
const valueAtPath = (source: unknown, path: string): unknown =>
  path.split(".").reduce<unknown>((value, part) => (value as Record<string, unknown>)?.[part], source);

export default ({ describe, it, expect, after }: QuenchMethods) => {
  after(async () => {
    await cleanUpActorsByKey(key);
  });

  describe("CONFIG.Actor.trackableAttributes", () => {
    // An empty config sends Foundry back to walking the schema, which is the bug.
    it("is configured, so Foundry uses our list", () => {
      expect(Object.keys(CONFIG.Actor.trackableAttributes).length).greaterThan(0);
    });

    it("is the map this module exports", () => {
      expect(CONFIG.Actor.trackableAttributes).equal(trackableAttributes);
    });

    it("covers every actor type with a data model", () => {
      for (const type of Object.keys(CONFIG.Actor.dataModels)) {
        expect(Object.keys(trackableAttributes), type).to.include(type);
      }
    });
  });

  for (const [type, attributes] of Object.entries(trackableAttributes)) {
    describe(`${type} attribute paths`, () => {
      it("every bar path has a numeric value and max", async () => {
        const actor = await createMockActorKey(type, {}, key);
        for (const path of attributes.bar) {
          expect(isNumeric(valueAtPath(actor?.system, `${path}.value`)), `${path}.value`).is.true;
          expect(isNumeric(valueAtPath(actor?.system, `${path}.max`)), `${path}.max`).is.true;
        }
      });

      it("every value path resolves to a number", async () => {
        const actor = await createMockActorKey(type, {}, key);
        for (const path of attributes.value) {
          expect(isNumeric(valueAtPath(actor?.system, path)), path).is.true;
        }
      });

      it("lists no path twice", () => {
        const paths = [...attributes.bar, ...attributes.value];
        expect(new Set(paths).size, `${type} lists a duplicate path`).equal(paths.length);
      });
    });
  }
};
