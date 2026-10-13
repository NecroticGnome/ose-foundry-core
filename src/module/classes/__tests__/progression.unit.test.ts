import { describe, expect, it } from "vitest";
import {
  applyXpBonus,
  bestOf,
  type ClassLevelRow,
  defaultPrimeReqs,
  divideHp,
  formatFraction,
  formatHp,
  hdFlatBonus,
  levelRow,
  primeReqBonus,
  primeReqDisplayOrder,
  rollableHd,
  scoreValues,
  splitStartingHp,
  splitXp,
  standardPrimeReq,
  startingProgress,
} from "../progression";

const row = (over: Partial<ClassLevelRow> = {}): ClassLevelRow => ({
  xp: 0,
  hd: "1d8",
  hdcon: true,
  thac0: 19,
  bba: 0,
  saves: { death: 12, wand: 13, paralysis: 14, breath: 15, spell: 16 },
  spellSlots: {},
  ...over,
});

describe("levelRow", () => {
  const levels = [row({ xp: 0 }), row({ xp: 2000 }), row({ xp: 4000 })];
  it("returns the row for the level", () => expect(levelRow(levels, 2)?.xp).toBe(2000));
  it("clamps below 1", () => expect(levelRow(levels, 0)?.xp).toBe(0));
  it("clamps negative levels", () => expect(levelRow(levels, -3)?.xp).toBe(0));
  it("clamps beyond the table", () => expect(levelRow(levels, 9)?.xp).toBe(4000));
  it("returns null for an empty table", () => expect(levelRow([], 1)).toBeNull());
});

describe("bestOf", () => {
  it("takes the lowest saves and THAC0, highest BBA, and totals slots", () => {
    const a = row({
      thac0: 17,
      bba: 2,
      saves: { death: 10, wand: 13, paralysis: 12, breath: 15, spell: 16 },
      spellSlots: { 1: 2 },
    });
    const b = row({
      thac0: 19,
      bba: 0,
      saves: { death: 13, wand: 11, paralysis: 14, breath: 13, spell: 12 },
      spellSlots: { 1: 3, 2: 1 },
    });
    expect(bestOf([a, b])).toEqual({
      saves: { death: 10, wand: 11, paralysis: 12, breath: 13, spell: 12 },
      thac0: 17,
      bba: 2,
      spellSlots: { 1: 5, 2: 1 },
    });
  });
  it("treats missing spell slots as none", () => {
    expect(bestOf([row({ spellSlots: undefined as never }), row({ spellSlots: { 3: 1 } })])?.spellSlots).toEqual({
      3: 1,
    });
  });
  it("returns null with no rows", () => expect(bestOf([])).toBeNull());
});

describe("splitXp", () => {
  it("splits evenly, remainder to the first", () => expect(splitXp(1001, 2)).toEqual([501, 500]));
  it("handles awards smaller than the class count", () => expect(splitXp(1, 3)).toEqual([1, 0, 0]));
  it("gives everything to a single class", () => expect(splitXp(1234, 1)).toEqual([1234]));
});

describe("applyXpBonus", () => {
  it("adds a percentage, rounding down", () => expect(applyXpBonus(105, 10)).toBe(115));
  it("applies penalties", () => expect(applyXpBonus(100, -20)).toBe(80));
});

describe("primeReqBonus", () => {
  const single = defaultPrimeReqs(["str"]);
  it.each([
    [3, -20],
    [5, -20],
    [6, -10],
    [9, 0],
    [13, 5],
    [16, 10],
    [18, 10],
  ])("STR %i gives %i%%", (str, expected) => expect(primeReqBonus(single, { str })).toBe(expected));
  it("returns 0 for blank scores", () => expect(primeReqBonus(single, { str: null })).toBe(0));
  it("returns 0 with no prime requisites", () => expect(primeReqBonus([], { str: 18 })).toBe(0));

  const dual = defaultPrimeReqs(["str", "dex"]);
  it("needs every 'and' requirement", () => {
    expect(primeReqBonus(dual, { str: 13, dex: 12 })).toBe(0);
    expect(primeReqBonus(dual, { str: 13, dex: 13 })).toBe(5);
    expect(primeReqBonus(dual, { str: 16, dex: 16 })).toBe(10);
    expect(primeReqBonus(dual, { str: 16, dex: 13 })).toBe(5);
  });
  it("needs any 'or' requirement", () => {
    const either = [
      { ability: "str", minScore: 13, percentage: 5, concatLogic: "or" as const },
      { ability: "dex", minScore: 13, percentage: 5, concatLogic: "or" as const },
    ];
    expect(primeReqBonus(either, { str: 9, dex: 14 })).toBe(5);
  });
});

describe("divideHp", () => {
  it("keeps whole HP for a single class", () => expect(divideHp(5, 1, 0)).toEqual({ whole: 5, fraction: 0 }));
  it("carries fractions between level-ups", () => {
    const first = divideHp(3, 2, 0);
    expect(first).toEqual({ whole: 1, fraction: 0.5 });
    expect(divideHp(5, 2, first.fraction)).toEqual({ whole: 3, fraction: 0 });
  });
  it("accumulates thirds to a whole point", () => {
    let fraction = 0;
    let total = 0;
    for (let i = 0; i < 3; i++) {
      const r = divideHp(1, 3, fraction);
      fraction = r.fraction;
      total += r.whole;
    }
    expect(total).toBe(1);
    expect(fraction).toBe(0);
  });
});

describe("hdFlatBonus", () => {
  it.each([
    ["9d6", 0],
    ["9d6+2", 2],
    ["9d8 + 9", 9],
    ["", 0],
  ])("%s → %i", (hd, expected) => expect(hdFlatBonus(hd)).toBe(expected));
});

describe("rollableHd", () => {
  it.each([
    ["2d8", "2d8"],
    ["2d8 / 1d4", "2d8"],
    ["", ""],
  ])("%s → %s", (hd, expected) => expect(rollableHd(hd)).toBe(expected));
});

describe("formatFraction", () => {
  it.each([
    [0.5, "½"],
    [0.333, "⅓"],
    [0.667, "⅔"],
    [0.25, "0.25"],
  ])("%s → %s", (n, expected) => expect(formatFraction(n)).toBe(expected));
});

describe("formatHp", () => {
  it.each([
    [9, "9"],
    [9.5, "9½"],
    [7.333, "7⅓"],
    [0.5, "½"],
  ])("%s → %s", (n, expected) => expect(formatHp(n)).toBe(expected));
});

describe("primeReqBonus with alternative groups", () => {
  // Half-elf: 13+ in both for 5%; 16 in one and 13 in the other for 10%.
  const halfElf = [
    { ability: "int", minScore: 13, percentage: 5, concatLogic: "and" as const },
    { ability: "str", minScore: 13, percentage: 5, concatLogic: "and" as const },
    { ability: "int", minScore: 16, percentage: 10, concatLogic: "and" as const, group: "a" },
    { ability: "str", minScore: 13, percentage: 10, concatLogic: "and" as const, group: "a" },
    { ability: "str", minScore: 16, percentage: 10, concatLogic: "and" as const, group: "b" },
    { ability: "int", minScore: 13, percentage: 10, concatLogic: "and" as const, group: "b" },
  ];
  it.each([
    [13, 13, 5],
    [16, 13, 10],
    [13, 16, 10],
    [16, 12, 0],
  ])("INT %i STR %i gives %i%%", (int, str, expected) => expect(primeReqBonus(halfElf, { int, str })).toBe(expected));
});

describe("startingProgress", () => {
  const levels = [row({ xp: 0 }), row({ xp: 2000 }), row({ xp: 4000 })];
  it("starts level 1 at 0 XP", () => expect(startingProgress(levels, 1)).toEqual({ level: 1, xp: 0 }));
  it("uses the level's threshold", () => expect(startingProgress(levels, 3)).toEqual({ level: 3, xp: 4000 }));
  it("keeps a level beyond the table, with the last threshold", () =>
    expect(startingProgress(levels, 5)).toEqual({ level: 5, xp: 4000 }));
  it("gives custom classes 0 XP", () => expect(startingProgress([], 4)).toEqual({ level: 4, xp: 0 }));
  it("treats nonsense as level 1", () => expect(startingProgress(levels, 0)).toEqual({ level: 1, xp: 0 }));
});

describe("splitStartingHp", () => {
  it("uses the roll alone for the first class", () => {
    expect(splitStartingHp({ max: 20, fraction: 0 }, 0, 8)).toEqual({ whole: 8, fraction: 0 });
  });
  it("re-divides earlier hit points with the new class's roll", () => {
    // Cleric 8, then Magic-User rolls 7: (8 + 7) / 2
    expect(splitStartingHp({ max: 8, fraction: 0 }, 1, 7)).toEqual({ whole: 7, fraction: 0.5 });
  });
  it("carries an existing fraction into a third class", () => {
    // Two classes totalling 15 (7½ each), third rolls 3: (15 + 3) / 3
    expect(splitStartingHp({ max: 7, fraction: 0.5 }, 2, 3)).toEqual({ whole: 6, fraction: 0 });
  });
});

describe("standardPrimeReq", () => {
  it("returns the ability when the rows are the standard single table", () => {
    expect(standardPrimeReq(defaultPrimeReqs(["dex"]))).toBe("dex");
    expect(standardPrimeReq(defaultPrimeReqs(["str"]).map((r) => ({ ...r, group: "" })))).toBe("str");
  });
  it("returns null for custom or empty rows", () => {
    expect(standardPrimeReq([])).toBeNull();
    expect(standardPrimeReq(defaultPrimeReqs(["str", "int"]))).toBeNull();
    const changed = defaultPrimeReqs(["dex"]).map((r) => (r.minScore === 16 ? { ...r, percentage: 15 } : r));
    expect(standardPrimeReq(changed)).toBeNull();
    expect(standardPrimeReq(defaultPrimeReqs(["dex"]).slice(1))).toBeNull();
  });
});

describe("primeReqDisplayOrder", () => {
  it("lists rows from the highest minimum score down, keeping row indices", () => {
    const rows = defaultPrimeReqs(["str", "int"]);
    expect(primeReqDisplayOrder(rows).map((r) => [r.index, r.minScore])).toEqual([
      [2, 16],
      [3, 16],
      [0, 13],
      [1, 13],
    ]);
    expect(primeReqDisplayOrder(defaultPrimeReqs(["dex"])).map((r) => r.minScore)).toEqual([16, 13, 9, 6, 3]);
  });
});

describe("scoreValues", () => {
  it("reads each score's value, including from getters on a prepared scores object", () => {
    class Score {
      constructor(readonly v: number) {}
      get value() {
        return this.v;
      }
    }
    class Scores {
      #str = new Score(16);
      get str() {
        return this.#str;
      }
    }
    expect(scoreValues(new Scores())).toEqual({
      str: 16,
      int: undefined,
      wis: undefined,
      dex: undefined,
      con: undefined,
      cha: undefined,
    });
  });
});
