import { describe, expect, it } from "vitest";
import {
  armourCategory,
  type ClassInput,
  computeWarnings,
  contextKey,
  parseScoreRequirements,
  unmetRequirement,
  type WarningInput,
} from "../warnings";

// Unique keys by default, so fixtures don't trip the combination rule.
const cls = (over: Partial<ClassInput> = {}): ClassInput => ({
  id: "c1",
  name: "Fighter",
  key: over.id ? `key-${over.id}` : "fighter",
  hasTable: true,
  level: 1,
  tableLength: 14,
  armour: [],
  weapons: [],
  stealthSkills: [],
  ...over,
});
const input = (over: Partial<WarningInput> = {}): WarningInput => ({
  classes: [cls()],
  race: null,
  equippedArmour: [],
  equippedWeapons: [],
  scores: { str: 10, int: 10, wis: 10, dex: 10, con: 10, cha: 10 },
  unallocatedSpells: [],
  abilities: [],
  ...over,
});
const keys = (i: WarningInput) => computeWarnings(i).map((w) => `${w.key}:${w.itemId}`);

const thief = cls({ id: "t", name: "Thief", key: "thief", armour: ["leather"], stealthSkills: ["Hide in Shadows"] });
const mage = cls({ id: "m", name: "Magic-User", key: "magic-user", armour: ["none"] });
const plate = { id: "p", name: "Plate mail", type: "heavy", ac: 3 };
const chain = { id: "ch", name: "Chainmail", type: "heavy", ac: 5 };

describe("armourCategory", () => {
  it.each([
    [{ name: "Leather armour", type: "light", ac: 7 }, "leather"],
    [{ name: "Chainmail +1", type: "heavy", ac: 4 }, "chain"],
    [{ name: "Banded mail", type: "heavy", ac: 4 }, "plate"],
    [{ name: "Elven mesh", type: "heavy", ac: 3 }, "plate"],
    [{ name: "Dragon hide", type: "heavy", ac: 5 }, "chain"],
    [{ name: "Buckler", type: "shield", ac: 0 }, "shield"],
    [{ name: "Robes", type: "unarmored", ac: 9 }, null],
    [{ name: "Odd", type: "custom", ac: 9 }, null],
  ])("%o → %s", (a, expected) => expect(armourCategory(a)).toBe(expected));
});

describe("computeWarnings", () => {
  it("is empty for an unrestricted single class", () => {
    expect(computeWarnings(input({ equippedArmour: [plate] }))).toEqual([]);
  });

  it("allows armour any class permits", () => {
    expect(keys(input({ classes: [thief, cls()], equippedArmour: [plate] }))).toEqual(["stealth:t"]);
  });

  it("warns about armour no class permits, on the armour", () => {
    expect(keys(input({ classes: [thief, mage], equippedArmour: [plate] }))).toEqual(["armour:p", "stealth:t"]);
  });

  it("warns about stealth skills in disallowed armour, on the class", () => {
    expect(keys(input({ classes: [thief], equippedArmour: [chain] }))).toEqual(["armour:ch", "stealth:t"]);
  });

  it("ignores unknown armour types", () => {
    expect(keys(input({ classes: [mage], equippedArmour: [{ id: "x", name: "Odd", type: "custom", ac: 9 }] }))).toEqual(
      [],
    );
  });

  it("warns about weapons outside every allow-list", () => {
    const cleric = cls({ id: "cl", name: "Cleric", weapons: ["mace", "club", "sling", "staff", "war hammer"] });
    const sword = { id: "s", name: "Sword", tags: ["Melee"] };
    const hammer = { id: "h", name: "War hammer +1", tags: [] };
    expect(keys(input({ classes: [cleric], equippedWeapons: [sword, hammer] }))).toEqual(["weapon:s"]);
    expect(keys(input({ classes: [cleric, cls()], equippedWeapons: [sword] }))).toEqual([]);
  });

  it("matches weapons by tag", () => {
    const druid = cls({ weapons: ["blunt"] });
    expect(keys(input({ classes: [druid], equippedWeapons: [{ id: "c", name: "Cudgel", tags: ["Blunt"] }] }))).toEqual(
      [],
    );
  });

  it("warns about more than three classes, on the extras", () => {
    const four = ["a", "b", "c", "d"].map((id) => cls({ id }));
    expect(keys(input({ classes: four }))).toEqual(["classCount:d"]);
  });

  it("warns about levels beyond the table", () => {
    expect(keys(input({ classes: [cls({ level: 16 })] }))).toEqual(["levelBeyondTable:c1"]);
  });

  it("warns about a custom class mixed with a tabled one", () => {
    expect(keys(input({ classes: [cls(), cls({ id: "k", hasTable: false, tableLength: 0 })] }))).toEqual([
      "customMix:k",
    ]);
  });

  it("carries format data for messages", () => {
    const [w] = computeWarnings(input({ classes: [mage], equippedArmour: [plate] }));
    expect(w).toMatchObject({ message: "OSE.warnings.armour", data: { item: "Plate mail" } });
  });
});

describe("contextKey", () => {
  it("is stable regardless of class order", () => {
    const a = input({ classes: [cls({ id: "a" }), cls({ id: "b" })] });
    const b = input({ classes: [cls({ id: "b" }), cls({ id: "a" })] });
    expect(contextKey(a)).toBe(contextKey(b));
  });
  it("changes with the race", () => {
    expect(contextKey(input())).not.toBe(
      contextKey(input({ race: { id: "r", name: "Elf", limits: {}, allowedKeys: [] } })),
    );
  });
});

describe("race warnings", () => {
  const dwarf = { id: "r", name: "Dwarf", limits: { fighter: 12, thief: 11 }, allowedKeys: ["fighter", "thief"] };
  it("warns when a class is above the race limit", () => {
    expect(keys(input({ race: dwarf, classes: [cls({ level: 13 })] }))).toEqual(["raceLevel:r"]);
    expect(keys(input({ race: dwarf, classes: [cls({ level: 12 })] }))).toEqual([]);
  });
  it("warns when the race can't take the class", () => {
    expect(keys(input({ race: dwarf, classes: [cls({ key: "magic-user", name: "Magic-User" })] }))).toEqual([
      "raceClass:r",
    ]);
  });
  it("treats an empty class list as unrestricted", () => {
    const human = { id: "h", name: "Human", limits: {}, allowedKeys: [] };
    expect(keys(input({ race: human, classes: [cls({ key: "anything", level: 20, tableLength: 20 })] }))).toEqual([]);
  });
  it("warns about scores outside 3-18 only with a race", () => {
    const scores = { str: 19, int: 10, wis: 10, dex: 2, con: 10, cha: 10 };
    expect(keys(input({ scores }))).toEqual([]);
    expect(keys(input({ scores, race: dwarf }))).toEqual(["scoreRange.str:r", "scoreRange.dex:r"]);
  });
  it("keys score warnings per score so each can be dismissed", () => {
    const scores = { str: 19, int: 10, wis: 10, dex: 10, con: 10, cha: 10 };
    expect(computeWarnings(input({ scores, race: dwarf }))[0]?.key).toBe("scoreRange.str");
  });
  it("ignores unrolled scores", () => {
    const scores = { str: 0, int: 0, wis: 0, dex: 0, con: 0, cha: 0 };
    expect(keys(input({ scores, race: dwarf }))).toEqual([]);
  });
  it("warns per score when outside the race's minimum or maximum", () => {
    const halfling = {
      ...dwarf,
      requirements: { dex: { min: 9, max: null }, con: { min: 9, max: null }, cha: { min: null, max: 17 } },
    };
    const scores = { str: 10, int: 10, wis: 10, dex: 1, con: 0, cha: 18 };
    const warnings = computeWarnings(input({ scores, race: halfling }));
    expect(warnings.filter((w) => w.key.startsWith("raceScore")).map((w) => [w.key, w.data])).toEqual([
      ["raceScore.dex", { name: "Dwarf", score: "DEX", value: 1, limit: 9 }],
      ["raceScore.con", { name: "Dwarf", score: "CON", value: 0, limit: 9 }],
      ["raceScore.cha", { name: "Dwarf", score: "CHA", value: 18, limit: 17 }],
    ]);
    expect(warnings.find((w) => w.key === "raceScore.cha")?.message).toBe("OSE.warnings.scoreMax");
  });
  it("is quiet when scores meet the race's requirements", () => {
    const halfling = { ...dwarf, requirements: { dex: { min: 9, max: null } } };
    expect(keys(input({ race: halfling }))).toEqual([]);
  });
  it("runs without a class", () => {
    const halfling = { ...dwarf, requirements: { dex: { min: 9, max: null } } };
    const scores = { str: 10, int: 10, wis: 10, dex: 5, con: 10, cha: 10 };
    expect(keys(input({ classes: [], scores, race: halfling, equippedArmour: [plate] }))).toEqual(["raceScore.dex:r"]);
  });
});

describe("demihuman classes", () => {
  const elf = cls({ id: "e", name: "Elf", key: "elf", demihuman: true });
  const human = { id: "r", name: "Human", limits: {}, allowedKeys: [] };
  it("warns on the class when a race item is also present", () => {
    const warnings = computeWarnings(input({ classes: [elf], race: human }));
    expect(warnings.map((w) => [w.key, w.itemId, w.data])).toEqual([
      ["demihumanRace", "e", { cls: "Elf", race: "Human" }],
    ]);
  });
  it("is quiet without a race", () => {
    expect(keys(input({ classes: [elf] }))).toEqual([]);
  });
});

describe("class score requirements", () => {
  it.each([
    ["Minimum CON 9, minimum DEX 9", { con: { min: 9, max: null }, dex: { min: 9, max: null } }],
    ["Minimum CHA 9", { cha: { min: 9, max: null } }],
    ["Maximum INT 6; minimum str 13", { int: { min: null, max: 6 }, str: { min: 13, max: null } }],
    ["None", {}],
    ["", {}],
  ])("parses %o", (text, expected) => expect(parseScoreRequirements(text)).toEqual(expected));

  it("warns per score on the class", () => {
    const bard = cls({ id: "b", name: "Bard", key: "bard", requirements: "Minimum CON 9, minimum DEX 9" });
    const scores = { str: 10, int: 10, wis: 10, dex: 12, con: 4, cha: 10 };
    const warnings = computeWarnings(input({ classes: [bard], scores }));
    expect(warnings.map((w) => [w.key, w.itemId, w.message, w.data])).toEqual([
      ["classScore.con", "b", "OSE.warnings.scoreMin", { name: "Bard", score: "CON", value: 4, limit: 9 }],
    ]);
  });
});

describe("spell warnings", () => {
  it("warns about spells not allocated to a class, on the spell", () => {
    expect(keys(input({ unallocatedSpells: [{ id: "s", name: "Sleep" }] }))).toEqual(["spellUnallocated:s"]);
  });
});

describe("class combination warnings", () => {
  const c = (id: string, key: string) => cls({ id, key, name: key });
  it("warns about classes of similar function, on the later class", () => {
    expect(keys(input({ classes: [c("a", "fighter"), c("b", "paladin")] }))).toEqual(["classCombination:b"]);
    expect(keys(input({ classes: [c("a", "cleric"), c("b", "druid")] }))).toEqual(["classCombination:b"]);
    expect(keys(input({ classes: [c("a", "magic-user"), c("b", "illusionist")] }))).toEqual(["classCombination:b"]);
    expect(keys(input({ classes: [c("a", "thief"), c("b", "assassin")] }))).toEqual(["classCombination:b"]);
  });
  it("allows classes from different groups", () => {
    expect(keys(input({ classes: [c("a", "fighter"), c("b", "magic-user"), c("t", "thief")] }))).toEqual([]);
  });
});

describe("unmetRequirement", () => {
  const who = {
    classes: [{ key: "thief", name: "Thief", level: 3 }],
    race: { key: "half-elf", name: "Half-Elf" },
  };
  it.each([
    ["", null],
    ["thief", null],
    ["Thief", null],
    ["half-elf", null],
    ["Half-Elf", null],
    ["acrobat, thief", null],
    ["acrobat", "acrobat"],
    ["Magic-User", "Magic-User"],
    ["Thief, Level 4", "Thief, Level 4"],
    ["Thief, Level 3", null],
    ["Level 2", null],
    ["Infravision 60'", null],
  ])("%s → %s", (requirements, expected) => expect(unmetRequirement(requirements, who)).toBe(expected));
});

describe("ability requirement warnings", () => {
  it("warns on abilities whose class or race requirement isn't met", () => {
    const abilities = [
      { id: "a1", name: "Back-stab", requirements: "thief" },
      { id: "a2", name: "Combat", requirements: "fighter" },
      { id: "a3", name: "Notes", requirements: "" },
    ];
    expect(keys(input({ classes: [cls({ id: "t", name: "Thief", key: "thief" })], abilities }))).toEqual([
      "abilityRequirement:a2",
    ]);
  });
});
