import { describe, expect, it } from "vitest";
import { statChanges } from "../changes";

const stats = (over = {}) => ({
  hp: 8,
  thac0: 19,
  saves: { death: 11, wand: 12, paralysis: 14, breath: 16, spell: 15 },
  spells: { 1: 1 },
  ...over,
});

describe("statChanges", () => {
  it("lists nothing when nothing changed", () => {
    expect(statChanges(stats(), stats())).toEqual([]);
  });
  it("lists each changed stat with its old and new value", () => {
    const after = stats({
      hp: 7,
      saves: { death: 11, wand: 12, paralysis: 13, breath: 16, spell: 15 },
      spells: { 1: 3 },
    });
    expect(statChanges(stats(), after)).toEqual([
      { key: "hp", from: 8, to: 7 },
      { key: "saves.paralysis", from: 14, to: 13 },
      { key: "spells.1", from: 1, to: 3 },
    ]);
  });
  it("lists a hit point change that is only a fraction", () => {
    expect(statChanges(stats({ hp: 9 }), stats({ hp: 9.5 }))).toEqual([{ key: "hp", from: 9, to: 9.5 }]);
  });
  it("treats a missing spell level as no slots", () => {
    expect(statChanges(stats({ spells: {} }), stats({ spells: { 2: 1 } }))).toEqual([
      { key: "spells.2", from: 0, to: 1 },
    ]);
  });
});
