import { describe, expect, it } from "vitest";
import OseDataModelItem from "../data-model-item";

describe("OseDataModelItem", () => {
  describe("schema defaults", () => {
    it("initializes fields from defineSchema", () => {
      const item = new OseDataModelItem();

      expect(item.tags).toEqual([]);
      expect(item.treasure).toBe(false);
      expect(item.equipped).toBe(false);
      expect(item.description).toBe("");
      expect(item.containerId).toBe("");
      expect(item.cost).toBe(0);
      expect(item.weight).toBe(0);
      expect(item.itemslots).toBe(0);
      expect(item.quantity).toEqual({ value: 1, max: 0 });
    });
  });

  describe("manualTags", () => {
    it("returns an empty array by default", () => {
      expect(new OseDataModelItem().manualTags).toEqual([]);
    });

    it("echoes a stored tag back with label set to its value", () => {
      const item = new OseDataModelItem({ tags: [{ title: "title", value: "value" }] });

      expect(item.manualTags).toEqual([{ title: "title", value: "value", label: "value" }]);
    });

    it("omits tags whose value matches a known auto-tag", () => {
      const item = new OseDataModelItem({ tags: [{ value: CONFIG.OSE.tags.blunt }] });

      expect(item.manualTags).toEqual([]);
    });

    it("returns null when tags is absent entirely", () => {
      const item = new OseDataModelItem();
      item.tags = undefined as never;

      expect(item.manualTags).toBeNull();
    });
  });

  describe("autoTags", () => {
    it("returns no auto-tags by default", () => {
      expect(new OseDataModelItem().autoTags).toEqual([]);
    });

    it("resolves a known tag value to its display metadata", () => {
      const item = new OseDataModelItem({ tags: [{ value: CONFIG.OSE.tags.blunt }] });

      expect(item.autoTags).toHaveLength(1);
      expect(item.autoTags[0]).toMatchObject({
        label: CONFIG.OSE.tags.blunt,
        icon: "fa-hammer-crash",
        image: `${CONFIG.OSE.assetsPath}/blunt.png`,
      });
    });

    it("passes unknown tags through as manual tags", () => {
      const item = new OseDataModelItem({ tags: [{ value: "homebrew" }] });

      expect(item.autoTags).toEqual([{ title: undefined, value: "homebrew", label: "homebrew" }]);
    });
  });

  describe("cumulative getters", () => {
    it("multiplies weight, cost, and itemslots by quantity", () => {
      const item = new OseDataModelItem({
        weight: 5,
        cost: 12,
        itemslots: 0.5,
        quantity: { value: 3, max: 0 },
      });

      expect(item.cumulativeWeight).toBe(15);
      expect(item.cumulativeCost).toBe(36);
      expect(item.cumulativeItemslots).toBe(2);
    });
  });

  describe("migrateData", () => {
    it("promotes a legacy details.description onto description", () => {
      const item = new OseDataModelItem({ details: { description: "legacy" } });

      expect(item.description).toBe("legacy");
    });

    it("leaves an existing description untouched", () => {
      const item = new OseDataModelItem({ description: "current", details: { description: "legacy" } });

      expect(item.description).toBe("current");
    });
  });

  describe("isCoinsOrGems", () => {
    it("is false when the item is not treasure", () => {
      const item = new OseDataModelItem({ treasure: false, tags: [{ value: "gems" }] });

      expect(item.isCoinsOrGems).toBe(false);
    });

    it("is true for treasure tagged as coins or gems", () => {
      const item = new OseDataModelItem({ treasure: true, tags: [{ value: "gems" }] });

      expect(item.isCoinsOrGems).toBe(true);
    });

    it("is true for treasure whose name ends in ' coins'", () => {
      const item = new OseDataModelItem({ treasure: true }, { parent: { name: "Gold Coins" } });

      expect(item.isCoinsOrGems).toBe(true);
    });

    it("is true for a treasure item named after a coin denomination", () => {
      const item = new OseDataModelItem({ treasure: true }, { parent: { name: "GP" } });

      expect(item.isCoinsOrGems).toBe(true);
    });

    it("is false for treasure with an unrelated name", () => {
      const item = new OseDataModelItem({ treasure: true }, { parent: { name: "Ruby Idol" } });

      expect(item.isCoinsOrGems).toBe(false);
    });
  });
});
