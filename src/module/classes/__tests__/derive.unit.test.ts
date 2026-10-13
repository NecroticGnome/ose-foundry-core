import { describe, expect, it } from "vitest";
import { deriveFromClasses, describeDerivation, summariseClasses } from "../derive";
import type { ClassLevelRow } from "../progression";

const r = (thac0: number, death: number, xp = 0, spellSlots: Record<string, number> = {}): ClassLevelRow => ({
  xp,
  hd: "1d8",
  hdcon: true,
  thac0,
  bba: 19 - thac0,
  saves: { death, wand: 13, paralysis: 14, breath: 15, spell: 16 },
  spellSlots,
});
const cls = (name: string, levels: ClassLevelRow[], level = 1, xp = 0) => ({
  name,
  system: { levels, level, xp, hitDie: "1d8" },
});

describe("deriveFromClasses", () => {
  it("returns null without tabled classes", () => {
    expect(deriveFromClasses([])).toBeNull();
    expect(deriveFromClasses([cls("Custom", [])])).toBeNull();
  });
  it("uses the class row for a single class", () => {
    const d = deriveFromClasses([cls("Fighter", [r(19, 12), r(19, 12, 2000)], 1, 500)]);
    expect(d).toMatchObject({ thac0: 19, bba: 0, level: 1, className: "Fighter", xp: 500, xpNext: 2000, hd: "1d8" });
    expect(d?.saves.death).toBe(12);
  });
  it("takes the best of several classes", () => {
    const d = deriveFromClasses([cls("Fighter", [r(17, 12)]), cls("Magic-User", [r(19, 13, 0, { 1: 1 })], 3)]);
    expect(d).toMatchObject({ thac0: 17, bba: 2, level: 3, className: "Fighter / Magic-User", spellSlots: { 1: 1 } });
    expect(d?.hd).toBe("1d8 / 1d8");
  });
  it("ignores untabled classes but keeps their names", () => {
    const d = deriveFromClasses([cls("Fighter", [r(19, 12)]), cls("Homebrew", [])]);
    expect(d?.className).toBe("Fighter / Homebrew");
    expect(d?.hd).toBe("1d8");
  });
  it("reports no next threshold at max level", () => {
    expect(deriveFromClasses([cls("Fighter", [r(19, 12)], 1)])?.xpNext).toBeNull();
  });
  it("clamps levels beyond the table", () => {
    expect(deriveFromClasses([cls("Fighter", [r(19, 12), r(17, 10)], 20)])?.thac0).toBe(17);
  });
});

describe("describeDerivation", () => {
  const classes = [cls("Fighter", [r(19, 12), r(17, 10)], 2), cls("Thief", [r(19, 13)], 1)];
  const finals = {
    saves: { death: 9, wand: 13, paralysis: 14, breath: 15, spell: 16 },
    thac0: 17,
    bba: 2,
    hd: "2d8 / 1d8",
  };
  it("lists each class value and the best", () => {
    expect(describeDerivation(classes, finals).thac0).toBe("Fighter 2: 17 · Thief 1: 19 → 17");
  });
  it("adds the effect adjustment when the final value differs", () => {
    expect(describeDerivation(classes, finals)["saves.death"]).toBe("Fighter 2: 10 · Thief 1: 13 → 10 · −1 → 9");
  });
  it("describes attack bonus as highest", () => {
    expect(describeDerivation(classes, finals).bba).toBe("Fighter 2: 2 · Thief 1: 0 → 2");
  });
  it("skips untabled classes", () => {
    const d = describeDerivation([cls("Homebrew", []), cls("Thief", [r(19, 13)])], { ...finals, thac0: 19 });
    expect(d.thac0).toBe("Thief 1: 19 → 19");
  });
});

describe("summariseClasses", () => {
  it("summarises custom classes without tables", () => {
    expect(summariseClasses([cls("Fighter/Thief", [], 3, 5000)])).toEqual({
      level: 3,
      className: "Fighter/Thief",
      xp: 5000,
      xpNext: null,
    });
  });
  it("returns null without classes", () => expect(summariseClasses([])).toBeNull());
});
