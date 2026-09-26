import { describe, expect, it } from "vitest";
import OseDataModelArmor from "../data-model-armor";

describe("OseDataModelArmor", () => {
  describe("ArmorTypes", () => {
    it("exposes exactly the four armor types", () => {
      expect(OseDataModelArmor.ArmorTypes).toEqual({
        unarmored: "OSE.armor.unarmored",
        light: "OSE.armor.light",
        heavy: "OSE.armor.heavy",
        shield: "OSE.armor.shield",
      });
    });
  });

  describe("schema defaults", () => {
    it("initializes fields from defineSchema", () => {
      const armor = new OseDataModelArmor();

      expect(armor.type).toBe("light");
      expect(armor.ac).toEqual({ value: 9 });
      expect(armor.aac).toEqual({ value: 10 });
      expect(armor.tags).toEqual([]);
      expect(armor.equipped).toBe(false);
      expect(armor.description).toBe("");
      expect(armor.containerId).toBe("");
      expect(armor.cost).toBe(0);
      expect(armor.weight).toBe(0);
      expect(armor.itemslots).toBe(1);
      expect(armor.quantity).toEqual({ value: 0, max: 0 });
    });
  });

  describe("manualTags", () => {
    it("returns an empty array by default", () => {
      expect(new OseDataModelArmor().manualTags).toEqual([]);
    });

    it("echoes a stored tag back with label set to its value", () => {
      const armor = new OseDataModelArmor({
        tags: [{ title: "title", value: "value" }],
      });

      expect(armor.manualTags).toEqual([{ title: "title", value: "value", label: "value" }]);
    });

    it("leaves the stored tag itself untouched", () => {
      const armor = new OseDataModelArmor({
        tags: [{ title: "title", value: "value" }],
      });

      expect(armor.tags).toEqual([{ title: "title", value: "value" }]);
    });

    it("omits tags whose value matches a known auto-tag", () => {
      const armor = new OseDataModelArmor({
        tags: [{ value: CONFIG.OSE.tags.blunt }],
      });

      expect(armor.manualTags).toEqual([]);
    });

    it("returns null when tags is absent entirely", () => {
      const armor = new OseDataModelArmor();
      armor.tags = undefined as never;

      expect(armor.manualTags).toBeNull();
    });
  });

  describe("autoTags", () => {
    it("always leads with the armor type and a tshirt icon", () => {
      const armor = new OseDataModelArmor();

      expect(armor.autoTags).toEqual([{ label: "OSE.armor.light", icon: "fa-tshirt" }]);
    });

    it("reflects a non-default armor type", () => {
      const armor = new OseDataModelArmor({ type: "shield" });

      expect(armor.autoTags[0]).toEqual({
        label: "OSE.armor.shield",
        icon: "fa-tshirt",
      });
    });

    it("resolves a known tag value to its display metadata", () => {
      const armor = new OseDataModelArmor({
        tags: [{ value: CONFIG.OSE.tags.blunt }],
      });

      expect(armor.autoTags).toHaveLength(2);
      expect(armor.autoTags[1]).toMatchObject({
        label: CONFIG.OSE.tags.blunt,
        icon: "fa-hammer-crash",
        image: `${CONFIG.OSE.assetsPath}/blunt.png`,
      });
    });

    it("appends unknown tags after the armor type", () => {
      const armor = new OseDataModelArmor({ tags: [{ value: "homebrew" }] });

      expect(armor.autoTags).toEqual([
        { label: "OSE.armor.light", icon: "fa-tshirt" },
        { title: undefined, value: "homebrew", label: "homebrew" },
      ]);
    });
  });
});
