import { describe, expect, it } from "vitest";
import { CLASSIC_FANTASY_CLASSES } from "../classic-fantasy-classes";
import { CLASSIC_PRIME_REQS, classicClassToItemData } from "../classic-to-item";
import { parseScoreRequirements } from "../warnings";

describe("classicClassToItemData", () => {
  const fighter = classicClassToItemData(CLASSIC_FANTASY_CLASSES.Fighter, CLASSIC_PRIME_REQS.Fighter);
  const rows = fighter.system.levels ?? [];

  it("keys and names the class", () => {
    expect(fighter.name).toBe("Fighter");
    expect(fighter.type).toBe("class");
    expect(fighter.system.key).toBe("fighter");
  });
  it("maps the level table", () => {
    expect(rows[0]?.thac0).toBe(19);
    expect(rows[0]?.bba).toBe(0);
    expect(rows[3]?.bba).toBe(2);
    expect(rows[0]?.saves).toEqual({ death: 12, wand: 13, paralysis: 14, breath: 15, spell: 16 });
    expect(fighter.system.maxLevel).toBe(14);
    expect(fighter.system.hitDie).toBe("1d8");
  });
  it("maps spell slots by spell level, skipping empty levels", () => {
    const cleric = classicClassToItemData(CLASSIC_FANTASY_CLASSES.Cleric, CLASSIC_PRIME_REQS.Cleric);
    expect(cleric.system.levels?.[0]?.spellSlots).toEqual({});
    expect(cleric.system.levels?.[1]?.spellSlots).toEqual({ 1: 1 });
  });
  it("marks fixed-bonus levels as no CON", () => {
    expect(rows[8]?.hdcon).toBe(true);
    expect(rows[9]?.hdcon).toBe(false);
  });
  it("uses the standard single prime requisite table", () => {
    expect(fighter.system.primeReqs?.find((p) => p.percentage === 10)?.minScore).toBe(16);
  });
  it("writes requirements as text the warnings can read", () => {
    const halfling = classicClassToItemData(CLASSIC_FANTASY_CLASSES.Halfling, CLASSIC_PRIME_REQS.Halfling);
    expect(parseScoreRequirements(halfling.system.requirements ?? "")).toEqual({
      con: { min: 9, max: null },
      dex: { min: 9, max: null },
    });
  });
  it("marks the demihuman classes", () => {
    const names = Object.keys(CLASSIC_FANTASY_CLASSES) as (keyof typeof CLASSIC_FANTASY_CLASSES)[];
    const demihuman = names.filter(
      (name) => classicClassToItemData(CLASSIC_FANTASY_CLASSES[name], CLASSIC_PRIME_REQS[name]).system.demihuman,
    );
    expect(demihuman.sort()).toEqual(["Dwarf", "Elf", "Halfling"]);
  });
  it("covers every bundled class", () => {
    for (const name of Object.keys(CLASSIC_FANTASY_CLASSES)) expect(CLASSIC_PRIME_REQS).toHaveProperty(name);
  });
  it("casts elf spells from the magic-user list", () => {
    expect(classicClassToItemData(CLASSIC_FANTASY_CLASSES.Elf, CLASSIC_PRIME_REQS.Elf).system.spellList).toBe(
      "Magic-User",
    );
    expect(fighter.system.spellList).toBe("");
  });
  it("turns thief skill checks into a skills table with translated labels", () => {
    const t = (key: string, data?: Record<string, string>) => key + (data ? JSON.stringify(data) : "");
    const thief = classicClassToItemData(CLASSIC_FANTASY_CLASSES.Thief, CLASSIC_PRIME_REQS.Thief, t);
    const [skills] = thief.system.tables ?? [];
    expect(skills?.key).toBe("skills");
    expect(skills?.columns.map((c) => c.key)).toEqual(["cs", "tr", "hn", "hs", "ms", "ol", "pp"]);
    expect(skills?.rows[0]).toMatchObject({ hs: 10, ms: 20 });
    expect(skills?.label).toBe('OSE.classes.skills.Table{"cls":"Thief"}');
    expect(skills?.columns[0]).toEqual({ key: "cs", name: "OSE.classes.skills.csName" });
    expect(skills?.columns[0]?.name).toBe("OSE.classes.skills.csName");
    expect(fighter.system.tables).toEqual([]);
  });
});
