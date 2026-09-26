import { describe, expect, it } from "vitest";
import OseDataModelAbility from "../data-model-ability";

describe("OseDataModelAbility", () => {
  describe("schema defaults", () => {
    it("initializes fields from defineSchema", () => {
      const ability = new OseDataModelAbility();

      expect(ability.save).toBe("");
      expect(ability.pattern).toBe("");
      expect(ability.requirements).toBe("");
      expect(ability.roll).toBe("");
      expect(ability.rollType).toBe("");
      expect(ability.rollTarget).toBeNull();
      expect(ability.blindroll).toBe(false);
      expect(ability.description).toBe("");
      expect(ability.tags).toEqual([]);
    });
  });

  describe("manualTags", () => {
    it("returns stored tags unchanged, with no label added", () => {
      const ability = new OseDataModelAbility({ tags: [{ title: "title", value: "value" }] });

      expect(ability.manualTags).toEqual([{ title: "title", value: "value" }]);
    });

    it("returns an empty array by default", () => {
      expect(new OseDataModelAbility().manualTags).toEqual([]);
    });

    it("returns an empty array rather than null when tags is absent", () => {
      const ability = new OseDataModelAbility();
      ability.tags = undefined as never;

      expect(ability.manualTags).toEqual([]);
    });
  });

  describe("autoTags", () => {
    it("still yields one empty tag by default, since ''.split(',') is ['']", () => {
      expect(new OseDataModelAbility().autoTags).toEqual([{ label: "" }]);
    });

    it("splits requirements on commas into one tag each", () => {
      const ability = new OseDataModelAbility({ requirements: "magic-user,slow" });

      expect(ability.autoTags).toEqual([{ label: "magic-user" }, { label: "slow" }]);
    });

    it("trims whitespace around each requirement", () => {
      const ability = new OseDataModelAbility({ requirements: " magic-user , slow " });

      expect(ability.autoTags).toEqual([{ label: "magic-user" }, { label: "slow" }]);
    });

    it("appends a save tag with a skull icon", () => {
      const ability = new OseDataModelAbility({ save: "death" });

      expect(ability.autoTags).toEqual([{ label: "" }, { label: CONFIG.OSE.saves_long.death, icon: "fa-skull" }]);
    });

    it("appends a roll tag carrying the formula and the roll target", () => {
      const ability = new OseDataModelAbility({ roll: "1d20+1", rollType: "result", rollTarget: 15 });

      expect(ability.autoTags).toEqual([{ label: "" }, { label: "OSE.items.Roll 1d20+1 =15" }]);
    });

    it("orders requirements, then roll, then save", () => {
      const ability = new OseDataModelAbility({ requirements: "cleric", roll: "1d6", save: "death" });

      expect(ability.autoTags).toHaveLength(3);
      expect(ability.autoTags[0]).toEqual({ label: "cleric" });
      expect(ability.autoTags[1]?.label).toContain("1d6");
      expect(ability.autoTags[2]).toEqual({ label: CONFIG.OSE.saves_long.death, icon: "fa-skull" });
    });
  });
});
