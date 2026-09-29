import { describe, expect, it } from "vitest";
import OseDataModelWeapon from "../data-model-weapon";

const damageTag = { label: "", icon: "fa-tint" };

describe("OseDataModelWeapon", () => {
  describe("schema defaults", () => {
    it("initializes fields from defineSchema", () => {
      const weapon = new OseDataModelWeapon();

      expect(weapon.melee).toBe(true);
      expect(weapon.missile).toBe(false);
      expect(weapon.slow).toBe(false);
      expect(weapon.damage).toBe("");
      expect(weapon.save).toBe("");
      expect(weapon.pattern).toBe("");
      expect(weapon.range).toEqual({ short: 0, medium: 0, long: 0 });
      expect(weapon.counter).toEqual({ value: 0, max: 0 });
      expect(weapon.tags).toEqual([]);
      expect(weapon.equipped).toBe(false);
      expect(weapon.itemslots).toBe(1);
    });
  });

  describe("manualTags", () => {
    it("returns an empty array by default", () => {
      expect(new OseDataModelWeapon().manualTags).toEqual([]);
    });

    it("returns stored tags unchanged, without adding a label", () => {
      const weapon = new OseDataModelWeapon({
        tags: [{ title: "title", value: "value" }],
      });

      expect(weapon.manualTags).toEqual([{ title: "title", value: "value" }]);
    });

    it("omits tags whose value matches a known auto-tag", () => {
      const weapon = new OseDataModelWeapon({
        tags: [{ value: CONFIG.OSE.tags.blunt }],
      });

      expect(weapon.manualTags).toEqual([]);
    });

    it("returns null when tags is absent entirely", () => {
      const weapon = new OseDataModelWeapon();
      weapon.tags = undefined as never;

      expect(weapon.manualTags).toBeNull();
    });
  });

  describe("autoTags", () => {
    it("leads with the damage tag and includes melee by default", () => {
      const weapon = new OseDataModelWeapon();

      expect(weapon.autoTags).toEqual([damageTag, CONFIG.OSE.auto_tags.melee]);
    });

    it("puts the damage formula in the leading tag", () => {
      const weapon = new OseDataModelWeapon({ damage: "1d13" });

      expect(weapon.autoTags[0]).toEqual({ label: "1d13", icon: "fa-tint" });
    });

    it("appends a range tag after the missile tag", () => {
      const weapon = new OseDataModelWeapon({ melee: false, missile: true });

      expect(weapon.autoTags).toEqual([
        damageTag,
        CONFIG.OSE.auto_tags.missile,
        { label: "0/0/0", icon: "fa-bullseye" },
      ]);
    });

    it("renders configured ranges as short/medium/long", () => {
      const weapon = new OseDataModelWeapon({
        melee: false,
        missile: true,
        range: { short: 30, medium: 60, long: 90 },
      });

      expect(weapon.autoTags[2]).toEqual({
        label: "30/60/90",
        icon: "fa-bullseye",
      });
    });

    it("includes the slow tag after melee", () => {
      const weapon = new OseDataModelWeapon({ slow: true });

      expect(weapon.autoTags).toEqual([damageTag, CONFIG.OSE.auto_tags.melee, CONFIG.OSE.auto_tags.slow]);
    });

    it("appends a save tag last", () => {
      const weapon = new OseDataModelWeapon({ save: "death" });

      expect(weapon.autoTags[2]).toEqual({
        label: CONFIG.OSE.saves_long.death,
        icon: "fa-skull",
      });
    });
  });

  describe("qualities", () => {
    it("returns only auto-tags carrying an image, titled by their label", () => {
      const weapon = new OseDataModelWeapon();

      expect(weapon.qualities).toEqual([
        {
          ...CONFIG.OSE.auto_tags.melee,
          title: CONFIG.OSE.auto_tags.melee.label,
        },
      ]);
    });

    it("appends manual tags unchanged", () => {
      const weapon = new OseDataModelWeapon({
        tags: [{ value: "homebrew", label: "homebrew" }],
      });

      expect(weapon.qualities).toHaveLength(2);
      expect(weapon.qualities[1]).toEqual({
        value: "homebrew",
        label: "homebrew",
      });
    });

    it("includes an auto-tag that was set via a boolean flag", () => {
      const weapon = new OseDataModelWeapon({ slow: true });

      expect(weapon.qualities).toHaveLength(2);
      expect(weapon.qualities[1]).toEqual({
        ...CONFIG.OSE.auto_tags.slow,
        title: CONFIG.OSE.auto_tags.slow.label,
      });
    });
  });
});
