import { describe, expect, it } from "vitest";
import { resizeLevels, rollsStartingHp, xpForLevel } from "../levels";

const saves = { death: 12, wand: 13, paralysis: 14, breath: 15, spell: 16 };
const row = (xp: number) => ({ xp, hd: "1d8", hdcon: true, thac0: 19, bba: 0, saves, spellSlots: {} });
const blank = () => row(0);
const levels = [row(0), row(2000), row(4000)];
const tables = [
  { key: "skills", label: "Skills", columns: [{ key: "hs" }], rows: [{ hs: 10 }, { hs: 15 }, { hs: 20 }] },
];

describe("resizeLevels", () => {
  it("keeps everything when the size is unchanged", () => {
    const out = resizeLevels({ levels, tables }, undefined, 3, blank);
    expect(out.levels).toEqual(levels);
    expect(out.tables).toEqual(tables);
    expect(out.stash).toEqual({ levels: [], tables: [] });
  });

  it("sets removed rows aside when shrinking", () => {
    const out = resizeLevels({ levels, tables }, undefined, 1, blank);
    expect(out.levels).toEqual([row(0)]);
    expect(out.tables[0]?.rows).toEqual([{ hs: 10 }]);
    expect(out.stash).toEqual({
      levels: [row(2000), row(4000)],
      tables: [{ key: "skills", rows: [{ hs: 15 }, { hs: 20 }] }],
    });
  });

  it("restores set-aside rows before adding new ones", () => {
    const small = resizeLevels({ levels, tables }, undefined, 1, blank);
    const back = resizeLevels({ levels: small.levels, tables: small.tables }, small.stash, 4, blank);
    expect(back.levels.map((l) => l.xp)).toEqual([0, 2000, 4000, 8000]);
    expect(back.tables[0]?.rows).toEqual([{ hs: 10 }, { hs: 15 }, { hs: 20 }, { hs: 20 }]);
    expect(back.stash).toEqual({ levels: [], tables: [] });
  });

  it("builds a first level from the blank row", () => {
    const out = resizeLevels({ levels: [], tables: [] }, undefined, 2, blank);
    expect(out.levels.map((l) => l.xp)).toEqual([0, 2000]);
  });

  it("treats a missing or invalid size as no levels, setting all rows aside", () => {
    const out = resizeLevels({ levels, tables }, undefined, Number.NaN, blank);
    expect(out.levels).toEqual([]);
    expect(out.stash.levels).toHaveLength(3);
  });
});

describe("xpForLevel", () => {
  const levels = [{ xp: 0 }, { xp: 2000 }, { xp: 4000 }];
  it.each([
    [2, 0, 2000], // below the level's minimum
    [1, 2500, 0], // already past the next level
    [3, 9000, null], // top level, any XP at or above fits
    [2, 2000, null], // fits
    [2, 3999, null],
    [5, 0, null], // no row for the level
  ])("level %i with %i XP → %o", (level, xp, expected) => expect(xpForLevel(levels, level, xp)).toBe(expected));
});

describe("rollsStartingHp", () => {
  it("rolls for new characters, added classes and level 0 characters", () => {
    expect(rollsStartingHp({ isNew: true, hasClass: false, level: 1 })).toBe(true);
    expect(rollsStartingHp({ isNew: false, hasClass: true, level: 1 })).toBe(true);
    expect(rollsStartingHp({ isNew: false, hasClass: false, level: 0 })).toBe(true);
  });

  it("keeps an existing classless character's hit points", () => {
    expect(rollsStartingHp({ isNew: false, hasClass: false, level: 3 })).toBe(false);
  });
});
