/**
 * @file Rule warnings for class and race restrictions. Warnings never block anything.
 */
import { toKey } from "./matching";
export interface ClassInput {
  id: string;
  name: string;
  key: string;
  hasTable: boolean;
  level: number;
  tableLength: number;
  armour: string[];
  weapons: string[];
  stealthSkills: string[];
  requirements?: string;
  demihuman?: boolean;
}

export interface RaceInput {
  id: string;
  name: string;
  key?: string;
  limits: Record<string, number | null>;
  allowedKeys: string[];
  requirements?: ScoreRequirements;
}

export type ScoreRequirements = Record<string, { min: number | null; max: number | null }>;

export interface ArmourInput {
  id: string;
  name: string;
  type: string;
  ac: number;
}

export interface WarningInput {
  classes: ClassInput[];
  race: RaceInput | null;
  equippedArmour: ArmourInput[];
  equippedWeapons: { id: string; name: string; tags: string[] }[];
  scores: Record<string, number>;
  unallocatedSpells: { id: string; name: string }[];
  abilities: { id: string; name: string; requirements: string }[];
}

export interface Warning {
  key: string;
  itemId: string;
  message: string;
  data: Record<string, string | number>;
}

export const MAX_CLASSES = 3;

// Disallowed class combinations (Player's Tome p15): classes of similar function.
export const CLASS_GROUPS: Record<string, string[]> = {
  arcane: ["illusionist", "magic-user"],
  divine: ["bard", "cleric", "druid", "paladin", "ranger"],
  stealth: ["acrobat", "assassin", "thief"],
  warrior: ["barbarian", "fighter", "knight", "paladin", "ranger"],
};

export const contextKey = (input: WarningInput) =>
  [...input.classes.map((c) => c.id).sort(), input.race?.id ?? ""].join(",");

// Maps an armour item onto the class armour vocabulary; null when unknown.
export const armourCategory = ({ name, type, ac }: Omit<ArmourInput, "id">) => {
  if (type === "shield") return "shield";
  if (type !== "light" && type !== "heavy") return null;
  const n = (name ?? "").toLowerCase();
  if (/leather/.test(n)) return "leather";
  if (/chain/.test(n)) return "chain";
  if (/plate|banded|splint/.test(n)) return "plate";
  if (type === "light") return "leather";
  return ac <= 3 ? "plate" : "chain";
};

const allowsArmour = (cls: ClassInput, category: string) => !cls.armour.length || cls.armour.includes(category);

const allowsWeapon = (cls: ClassInput, weapon: { name: string; tags: string[] }) => {
  if (!cls.weapons.length) return true;
  const name = weapon.name.toLowerCase();
  const tags = weapon.tags.map((t) => t.toLowerCase());
  return cls.weapons.some((w) => {
    const entry = w.toLowerCase();
    return (
      tags.includes(entry) ||
      name === entry ||
      new RegExp(`\\b${entry.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(name)
    );
  });
};

const warn = (key: string, itemId: string, data: Record<string, string | number> = {}): Warning => ({
  key,
  itemId,
  message: `OSE.warnings.${key}`,
  data,
});

// "Minimum CON 9, minimum DEX 9" → { con: { min: 9, max: null }, dex: ... }; other text is ignored.
export const parseScoreRequirements = (text: string): ScoreRequirements => {
  const out: ScoreRequirements = {};
  for (const [, bound, score, value] of (text ?? "").matchAll(
    /\b(min|max)(?:imum)?\s+(str|int|wis|dex|con|cha)\s+(\d+)/gi,
  )) {
    const key = score.toLowerCase();
    out[key] = { min: null, max: null, ...out[key], [bound.toLowerCase()]: Number(value) };
  }
  return out;
};

// One warning per score outside its requirement, keyed so each can be dismissed.
const scoreWarnings = (
  prefix: string,
  item: { id: string; name: string },
  reqs: ScoreRequirements,
  scores: Record<string, number>,
) =>
  Object.entries(reqs).flatMap(([score, { min, max }]) => {
    const value = scores[score] ?? 0;
    const limit = min != null && value < min ? min : max != null && value > max ? max : null;
    if (limit == null) return [];
    const data = { name: item.name, score: score.toUpperCase(), value, limit };
    return [{ ...warn(limit === min ? "scoreMin" : "scoreMax", item.id, data), key: `${prefix}.${score}` }];
  });

// An ability's requirements as free text, e.g. "thief", "Thief, Level 4", "Elf". Entries that name a
// class or race (one word) must match one the character has. "Level N" applies to the matched class.
// Anything else is description and ignored. Returns the text when unmet, else null.
export const unmetRequirement = (
  requirements: string,
  who: { classes: { key: string; name: string; level: number }[]; race: { key?: string; name: string } | null },
): string | null => {
  const entries = (requirements ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
  const level = Number(entries.map((e) => /^level\s+(\d+)$/i.exec(e)?.[1]).find(Boolean) ?? 0);
  const named = entries.filter((e) => !/\s/.test(e) && !/\d/.test(e)).map(toKey);
  if (!named.length) return null;
  const has = (item: { key?: string; name: string }) =>
    named.includes(item.key ?? "") || named.includes(toKey(item.name));
  const cls = who.classes.find(has);
  if (cls) return cls.level >= level ? null : requirements;
  return who.race && has(who.race) ? null : requirements;
};

export const computeWarnings = (input: WarningInput): Warning[] => {
  const { classes } = input;
  const out: Warning[] = [];
  const restricted = classes.length > 0;

  for (const armour of restricted ? input.equippedArmour : []) {
    const category = armourCategory(armour);
    if (category && !classes.some((c) => allowsArmour(c, category))) {
      out.push(warn("armour", armour.id, { item: armour.name }));
    }
  }
  for (const cls of classes) {
    if (!cls.stealthSkills.length) continue;
    const blocking = input.equippedArmour.find((a) => {
      const category = armourCategory(a);
      return category && !allowsArmour(cls, category);
    });
    if (blocking) out.push(warn("stealth", cls.id, { cls: cls.name, item: blocking.name }));
  }
  for (const weapon of restricted ? input.equippedWeapons : []) {
    if (!classes.some((c) => allowsWeapon(c, weapon))) out.push(warn("weapon", weapon.id, { item: weapon.name }));
  }
  classes.forEach((cls, i) => {
    const clash = classes
      .slice(0, i)
      .find((earlier) => Object.values(CLASS_GROUPS).some((g) => g.includes(earlier.key) && g.includes(cls.key)));
    if (clash) out.push(warn("classCombination", cls.id, { cls: cls.name, other: clash.name }));
  });
  classes.slice(MAX_CLASSES).forEach((c) => {
    out.push(warn("classCount", c.id, { cls: c.name, max: MAX_CLASSES }));
  });
  for (const cls of classes) {
    out.push(...scoreWarnings("classScore", cls, parseScoreRequirements(cls.requirements ?? ""), input.scores));
  }
  for (const cls of classes) {
    if (cls.hasTable && cls.level > cls.tableLength) {
      out.push(warn("levelBeyondTable", cls.id, { cls: cls.name, level: cls.level, max: cls.tableLength }));
    }
  }
  const { race } = input;
  if (race) {
    // A demihuman class already includes its race (Player's Tome p18).
    for (const cls of classes.filter((c) => c.demihuman)) {
      out.push(warn("demihumanRace", cls.id, { cls: cls.name, race: race.name }));
    }
    for (const cls of classes) {
      if (race.allowedKeys.length && !race.allowedKeys.includes(cls.key)) {
        out.push(warn("raceClass", race.id, { race: race.name, cls: cls.name }));
        continue;
      }
      const max = race.limits[cls.key];
      if (max != null && cls.level > max) {
        out.push(warn("raceLevel", race.id, { race: race.name, cls: cls.name, level: cls.level, max }));
      }
    }
    out.push(...scoreWarnings("raceScore", race, race.requirements ?? {}, input.scores));
    for (const [score, value] of Object.entries(input.scores)) {
      if (value && (value < 3 || value > 18)) {
        out.push({ ...warn("scoreRange", race.id, { score: score.toUpperCase(), value }), key: `scoreRange.${score}` });
      }
    }
  }
  for (const spell of input.unallocatedSpells ?? []) {
    out.push(warn("spellUnallocated", spell.id, { item: spell.name }));
  }
  if (classes.some((c) => c.hasTable)) {
    for (const cls of classes.filter((c) => !c.hasTable)) out.push(warn("customMix", cls.id, { cls: cls.name }));
  }
  const who = { classes: classes.map((c) => ({ key: c.key, name: c.name, level: c.level })), race: input.race };
  for (const ability of input.abilities ?? []) {
    const unmet = unmetRequirement(ability.requirements, who);
    if (unmet) out.push(warn("abilityRequirement", ability.id, { item: ability.name, requirement: unmet }));
  }
  return out;
};
