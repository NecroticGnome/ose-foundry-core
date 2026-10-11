import { describe, expect, it } from "vitest";
import OseDataModelClass from "../data-model-class";

const saves = { death: 12, wand: 13, paralysis: 14, breath: 15, spell: 16 };
const levels = [
  { xp: 0, hd: "1d8", hdcon: true, thac0: 19, bba: 0, saves, spellSlots: {} },
  { xp: 2000, hd: "2d8", hdcon: true, thac0: 19, bba: 0, saves, spellSlots: {} },
];

describe("OseDataModelClass", () => {
  it("defaults to a level-1 custom class", () => {
    const c = new OseDataModelClass();
    expect(c.level).toBe(1);
    expect(c.xp).toBe(0);
    expect(c.levels).toEqual([]);
    expect(c.xpBonusOverride).toBeNull();
    expect(c.spellList).toBe("");
    expect(c.hasTable).toBe(false);
    expect(c.currentRow).toBeNull();
    expect(c.canLevelUp).toBe(false);
  });

  it("keeps languages as a list, reading older comma-separated text", () => {
    expect(new OseDataModelClass().languages).toEqual([]);
    expect(new OseDataModelClass({ languages: "Alignment, Common , Elvish" }).languages).toEqual([
      "Alignment",
      "Common",
      "Elvish",
    ]);
    expect(new OseDataModelClass({ languages: ["Common"] }).languages).toEqual(["Common"]);
  });

  it("reads the current and next rows", () => {
    const c = new OseDataModelClass({ levels, level: 1, xp: 1999 });
    expect(c.currentRow?.xp).toBe(0);
    expect(c.nextRow?.xp).toBe(2000);
    expect(c.canLevelUp).toBe(false);
    c.xp = 2000;
    expect(c.canLevelUp).toBe(true);
  });

  it("cannot level beyond the table", () => {
    const c = new OseDataModelClass({ levels, level: 2, xp: 999999 });
    expect(c.nextRow).toBeNull();
    expect(c.canLevelUp).toBe(false);
  });

  it("returns the title for the level", () => {
    expect(new OseDataModelClass({ titles: ["Veteran", "Warrior"], level: 2 }).title).toBe("Warrior");
    expect(new OseDataModelClass({ titles: ["Veteran"], level: 5 }).title).toBe("Veteran");
    expect(new OseDataModelClass().title).toBe("");
  });
});
