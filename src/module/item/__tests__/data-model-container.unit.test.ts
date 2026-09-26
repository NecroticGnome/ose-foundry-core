import { describe, expect, it } from "vitest";
import OseDataModelContainer from "../data-model-container";

const CONTAINER_ID = "container-1";

const carried = (containerId: string, weight: number, quantity?: { value: number }) => ({
  system: { containerId, weight, quantity },
});

/** An Item document standing in for the container's `parent`, owned by an Actor. */
const parentIn = (items: unknown[]) => ({
  id: CONTAINER_ID,
  parent: { items },
});

describe("OseDataModelContainer", () => {
  describe("schema defaults", () => {
    it("initializes fields from defineSchema", () => {
      const container = new OseDataModelContainer();

      expect(container.itemIds).toEqual([]);
      expect(container.tags).toEqual([]);
      expect(container.equipped).toBe(false);
      expect(container.description).toBe("");
      expect(container.containerId).toBe("");
      expect(container.cost).toBe(0);
      expect(container.weight).toBe(0);
      expect(container.itemslots).toBe(1);
      expect(container.quantity).toEqual({ value: 0, max: 0 });
    });
  });

  describe("contents", () => {
    it("is null when the container has no parent Actor", () => {
      expect(new OseDataModelContainer().contents).toBeNull();
    });

    it("returns only the Actor's items whose containerId matches", () => {
      const mine = carried(CONTAINER_ID, 5);
      const theirs = carried("some-other-container", 3);
      const loose = carried("", 1);
      const container = new OseDataModelContainer({}, { parent: parentIn([mine, theirs, loose]) });

      expect(container.contents).toEqual([mine]);
    });

    it("is an empty array when the Actor carries nothing of ours", () => {
      const container = new OseDataModelContainer({}, { parent: parentIn([carried("elsewhere", 9)]) });

      expect(container.contents).toEqual([]);
    });
  });

  describe("totalWeight", () => {
    it("is 0 with no parent Actor", () => {
      expect(new OseDataModelContainer().totalWeight).toBe(0);
    });

    it("multiplies each item's weight by its quantity", () => {
      const container = new OseDataModelContainer(
        {},
        { parent: parentIn([carried(CONTAINER_ID, 5, { value: 3 }), carried(CONTAINER_ID, 2, { value: 4 })]) },
      );

      expect(container.totalWeight).toBe(23);
    });

    it("counts an item with no quantity as one", () => {
      const container = new OseDataModelContainer({}, { parent: parentIn([carried(CONTAINER_ID, 7)]) });

      expect(container.totalWeight).toBe(7);
    });

    it("counts a zero quantity as one, since the fallback is falsy-based", () => {
      const container = new OseDataModelContainer({}, { parent: parentIn([carried(CONTAINER_ID, 7, { value: 0 })]) });

      expect(container.totalWeight).toBe(7);
    });
  });

  describe("manualTags", () => {
    it("returns an empty array by default", () => {
      expect(new OseDataModelContainer().manualTags).toEqual([]);
    });

    it("echoes a stored tag back with label set to its value", () => {
      const container = new OseDataModelContainer({ tags: [{ title: "title", value: "value" }] });

      expect(container.manualTags).toEqual([{ title: "title", value: "value", label: "value" }]);
    });

    it("omits tags whose value matches a known auto-tag", () => {
      const container = new OseDataModelContainer({ tags: [{ value: CONFIG.OSE.tags.blunt }] });

      expect(container.manualTags).toEqual([]);
    });

    it("returns null when tags is absent entirely", () => {
      const container = new OseDataModelContainer();
      container.tags = undefined as never;

      expect(container.manualTags).toBeNull();
    });
  });

  describe("autoTags", () => {
    it("returns no auto-tags by default", () => {
      expect(new OseDataModelContainer().autoTags).toEqual([]);
    });

    it("resolves a known tag value to its display metadata", () => {
      const container = new OseDataModelContainer({ tags: [{ value: CONFIG.OSE.tags.blunt }] });

      expect(container.autoTags).toEqual([CONFIG.OSE.auto_tags.blunt]);
    });

    it("passes unknown tags through as manual tags", () => {
      const container = new OseDataModelContainer({ tags: [{ value: "homebrew" }] });

      expect(container.autoTags).toEqual([{ title: undefined, value: "homebrew", label: "homebrew" }]);
    });
  });
});
