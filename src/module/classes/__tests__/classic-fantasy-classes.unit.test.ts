import { describe, expect, it } from "vitest";
import { CLASSIC_FANTASY_CLASSES } from "../classic-fantasy-classes";

// Values from the Fighter Level Progression table (OSE Player's Tome p51).
describe("Classic Fantasy Fighter table", () => {
  const { levels } = CLASSIC_FANTASY_CLASSES.Fighter;
  it("improves THAC0 every three levels", () => {
    expect(levels.map((l) => l.thac0)).toEqual([19, 19, 19, 17, 17, 17, 14, 14, 14, 12, 12, 12, 10, 10]);
  });
  it("has the best saves at levels 13-14", () => {
    expect(levels[12]?.saves).toEqual([4, 5, 6, 5, 8]);
    expect(levels[13]?.saves).toEqual([4, 5, 6, 5, 8]);
  });
});

// Cleric Level Progression (OSE Player's Tome p37).
describe("Classic Fantasy Cleric table", () => {
  it("has two 1st-level slots and no 2nd-level slots at level 3", () => {
    expect(CLASSIC_FANTASY_CLASSES.Cleric.levels[2]?.spells).toEqual([2, 0, 0, 0, 0]);
  });
});
