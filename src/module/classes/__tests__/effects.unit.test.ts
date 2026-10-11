import { describe, expect, it } from "vitest";
import { buildEffectData, clampRaceModifier, readChanges, tableDiffChanges } from "../effects";

const derived = {
  saves: { death: 12, wand: 13, paralysis: 14, breath: 15, spell: 16 },
  thac0: 19,
  bba: 0,
  spellSlots: { 1: 1 },
  level: 1,
  className: "Elf",
  xp: 0,
  xpNext: 4000,
  hd: "1d6",
};
const same = {
  saves: { death: 12, wand: 13, paralysis: 14, breath: 15, spell: 16 },
  thac0: 19,
  spells: { 0: 0, 1: 1 },
  hd: "1d6",
};

describe("tableDiffChanges", () => {
  it("is empty when nothing differs", () => expect(tableDiffChanges(same, derived)).toEqual([]));
  it("adds the difference for saves", () => {
    expect(tableDiffChanges({ ...same, saves: { ...same.saves, death: 10 } }, derived)).toEqual([
      { key: "system.saves.death.value", type: "add", value: -2 },
    ]);
  });
  it("adjusts THAC0 and its attack bonus together", () => {
    expect(tableDiffChanges({ ...same, thac0: 18 }, derived)).toEqual([
      { key: "system.thac0.value", type: "add", value: -1 },
      { key: "system.thac0.bba", type: "add", value: 1 },
    ]);
  });
  it("compares spell slots, missing as zero, ignoring cantrips", () => {
    expect(tableDiffChanges({ ...same, spells: { 0: 3, 1: 1, 2: 1 } }, derived)).toEqual([
      { key: "system.spells.2.max", type: "add", value: 1 },
    ]);
    expect(tableDiffChanges({ ...same, spells: {} }, derived)).toEqual([
      { key: "system.spells.1.max", type: "add", value: -1 },
    ]);
  });
  it("overrides a different HD string", () => {
    expect(tableDiffChanges({ ...same, hd: "1d6+1" }, derived)).toEqual([
      { key: "system.hp.hd", type: "override", value: "1d6+1" },
    ]);
  });
  it("skips blank stored values", () => {
    expect(
      tableDiffChanges({ ...same, thac0: null, hd: "", saves: { ...same.saves, wand: undefined } }, derived),
    ).toEqual([]);
  });
  it("reads numeric strings from legacy data", () => {
    expect(tableDiffChanges({ ...same, thac0: "18" as never }, derived)[0]).toEqual({
      key: "system.thac0.value",
      type: "add",
      value: -1,
    });
  });
});

describe("buildEffectData", () => {
  const changes = [{ key: "system.thac0.value", type: "add" as const, value: -1 }];
  it("uses top-level changes and modes on v13", () => {
    expect(buildEffectData("X", changes, 13, { flags: { a: 1 } })).toEqual({
      name: "X",
      img: "icons/svg/upgrade.svg",
      changes: [{ key: "system.thac0.value", mode: 2, value: "-1" }],
      flags: { a: 1 },
    });
  });
  it("uses system.changes and types on v14", () => {
    expect(buildEffectData("X", changes, 14)).toEqual({
      name: "X",
      img: "icons/svg/upgrade.svg",
      system: { changes: [{ key: "system.thac0.value", type: "add", value: -1 }] },
    });
  });
});

describe("readChanges", () => {
  it("reads v13 effects", () => {
    expect(readChanges({ changes: [{ key: "k", mode: 5, value: "x" }] })).toEqual([
      { key: "k", type: "override", value: "x" },
    ]);
  });
  it("reads v14 effects", () => {
    expect(readChanges({ system: { changes: [{ key: "k", type: "add", value: 2 }] } })).toEqual([
      { key: "k", type: "add", value: 2 },
    ]);
  });
  it("reads an effect without changes", () => expect(readChanges({})).toEqual([]));
});

describe("clampRaceModifier", () => {
  it.each([
    [19, 1, 18], // 18 + 1 stays 18
    [2, -1, 3], // 3 - 1 stays 3
    [19, 2, 18], // 17 + 2 caps at 18
    [10, -1, 10],
    [-1, -1, 0], // unrolled 0 isn't raised to 3
    [20, 1, 19], // already above 18 from elsewhere: the modifier can't push it further
  ])("score %i after a %i modifier → %i", (value, modifier, expected) =>
    expect(clampRaceModifier(value, modifier)).toBe(expected));
});
