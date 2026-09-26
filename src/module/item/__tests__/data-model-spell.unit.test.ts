import { describe, expect, it } from "vitest";
import OseDataModelSpell from "../data-model-spell";

describe("OseDataModelSpell", () => {
  describe("schema defaults", () => {
    it("initializes fields from defineSchema", () => {
      const spell = new OseDataModelSpell();

      expect(spell.save).toBe("");
      expect(spell.lvl).toBeNull();
      expect(spell.class).toBe("");
      expect(spell.duration).toBe("");
      expect(spell.range).toBe("");
      expect(spell.roll).toBe("");
      expect(spell.memorized).toBeNull();
      expect(spell.cast).toBeNull();
      expect(spell.description).toBe("");
      expect(spell.tags).toEqual([]);
    });
  });

  describe("manualTags", () => {
    it("returns stored tags unchanged, with no label added", () => {
      const spell = new OseDataModelSpell({ tags: [{ title: "title", value: "value" }] });

      expect(spell.manualTags).toEqual([{ title: "title", value: "value" }]);
    });

    it("returns an empty array by default", () => {
      expect(new OseDataModelSpell().manualTags).toEqual([]);
    });

    it("returns an empty array rather than null when tags is absent", () => {
      const spell = new OseDataModelSpell();
      spell.tags = undefined as never;

      expect(spell.manualTags).toEqual([]);
    });
  });

  describe("autoTags", () => {
    it("always leads with class, range and duration, empty by default", () => {
      expect(new OseDataModelSpell().autoTags).toEqual([{ label: "" }, { label: "" }, { label: "" }]);
    });

    it("surfaces class, range and duration in that order", () => {
      const spell = new OseDataModelSpell({ class: "Magic-User", range: "60'", duration: "1 turn" });

      expect(spell.autoTags).toEqual([{ label: "Magic-User" }, { label: "60'" }, { label: "1 turn" }]);
    });

    it("appends a save tag with a skull icon", () => {
      const spell = new OseDataModelSpell({ save: "death" });

      expect(spell.autoTags).toHaveLength(4);
      expect(spell.autoTags[3]).toEqual({ label: CONFIG.OSE.saves_long.death, icon: "fa-skull" });
    });

    it("appends a roll tag with no roll target, unlike ability", () => {
      const spell = new OseDataModelSpell({ roll: "1d20+1" });

      expect(spell.autoTags).toHaveLength(4);
      expect(spell.autoTags[3]).toEqual({ label: "OSE.items.Roll 1d20+1" });
    });

    it("orders the roll tag before the save tag", () => {
      const spell = new OseDataModelSpell({ roll: "1d6", save: "death" });

      expect(spell.autoTags).toHaveLength(5);
      expect(spell.autoTags[3]?.label).toContain("1d6");
      expect(spell.autoTags[4]).toEqual({ label: CONFIG.OSE.saves_long.death, icon: "fa-skull" });
    });
  });
});
