import { describe, expect, it } from "vitest";
import type { ClassLevelRow } from "../progression";
import { buildSpellPools, type PoolClass, type PoolSpell } from "../spells";

const row = (spellSlots: Record<string, number>): ClassLevelRow => ({
  xp: 0,
  hd: "1d4",
  hdcon: true,
  thac0: 19,
  bba: 0,
  saves: { death: 13, wand: 14, paralysis: 13, breath: 16, spell: 15 },
  spellSlots,
});
const cls = (id: string, name: string, key: string, levels: ClassLevelRow[], level = 1, spellList = ""): PoolClass => ({
  id,
  name,
  key,
  spellList,
  level,
  levels,
});
const spell = (id: string, lvl: number, list: string, over: Partial<PoolSpell> = {}): PoolSpell => ({
  id,
  lvl,
  class: list,
  castAs: "",
  cast: 0,
  ...over,
});

const cleric = cls("c", "Cleric", "cleric", [row({}), row({ 1: 1 })], 2);
const mage = cls("m", "Magic-User", "magic-user", [row({ 1: 1 }), row({ 1: 2 })], 2);
const fighter = cls("f", "Fighter", "fighter", [row({}), row({})], 2);

describe("buildSpellPools", () => {
  it("gives each casting class its own slots", () => {
    const { pools } = buildSpellPools([cleric, mage, fighter], []);
    expect(pools.map((p) => [p.key, p.slots])).toEqual([
      ["cleric", { 1: { max: 1, used: 0 } }],
      ["magic-user", { 1: { max: 2, used: 0 } }],
    ]);
  });

  it("counts a caster with no slots yet", () => {
    const { pools } = buildSpellPools([cls("c", "Cleric", "cleric", [row({}), row({ 1: 1 })], 1)], []);
    expect(pools.map((p) => p.key)).toEqual(["cleric"]);
  });

  it("places spells by their list", () => {
    const { assignment } = buildSpellPools([cleric, mage], [spell("s1", 1, "Cleric"), spell("s2", 1, "magic user")]);
    expect(assignment).toEqual({ s1: "cleric", s2: "magic-user" });
  });

  it("uses a class's spell list setting", () => {
    const elf = cls("e", "Elf", "elf", [row({ 1: 1 })], 1, "Magic-User");
    expect(buildSpellPools([cleric, elf], [spell("s", 1, "Magic-User")]).assignment).toEqual({ s: "elf" });
  });

  it("puts everything in the only pool", () => {
    expect(buildSpellPools([mage], [spell("s", 1, "Druid")]).assignment).toEqual({ s: "magic-user" });
  });

  it("leaves unmatched spells unallocated with several pools", () => {
    const result = buildSpellPools([cleric, mage], [spell("s", 1, "Druid")]);
    expect(result.assignment).toEqual({ s: null });
    expect(result.other).toEqual(["s"]);
  });

  it("honours an explicit allocation over the list", () => {
    const result = buildSpellPools([cleric, mage], [spell("s", 1, "Cleric", { castAs: "magic-user" })]);
    expect(result.assignment).toEqual({ s: "magic-user" });
  });

  it("keeps spells deliberately set aside out of every pool", () => {
    expect(buildSpellPools([mage], [spell("s", 1, "Magic-User", { castAs: "none" })]).assignment).toEqual({ s: null });
  });

  it("falls back to the list when the allocated class is gone", () => {
    expect(buildSpellPools([cleric, mage], [spell("s", 1, "Cleric", { castAs: "druid" })]).assignment).toEqual({
      s: "cleric",
    });
  });

  it("counts cast spells against their own pool", () => {
    const { pools } = buildSpellPools(
      [cleric, mage],
      [spell("a", 1, "Cleric", { cast: 1 }), spell("b", 1, "Magic-User", { cast: 2 })],
    );
    expect(pools.map((p) => p.slots[1]?.used)).toEqual([1, 2]);
  });

  it("gives same-list classes separate pools, filling the first", () => {
    const paladin = cls("p", "Paladin", "paladin", [row({ 1: 1 })], 1, "Cleric");
    const result = buildSpellPools([cleric, paladin], [spell("s", 1, "Cleric")]);
    expect(result.pools.map((p) => p.key)).toEqual(["cleric", "paladin"]);
    expect(result.assignment).toEqual({ s: "cleric" });
  });

  it("leaves spells alone when no class has a spell table", () => {
    const witch = cls("w", "Witch", "witch", []);
    const result = buildSpellPools([witch, fighter], [spell("s", 1, "Witch")]);
    expect(result.pools).toEqual([]);
    expect(result.other).toEqual([]);
  });
});
