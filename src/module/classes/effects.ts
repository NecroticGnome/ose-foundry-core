/**
 * @file Active Effect helpers for class-table adjustments, across v13 and v14 shapes.
 */
import type { Derived } from "./derive";
import { SAVE_KEYS, type SaveKey } from "./progression";

export interface Change {
  key: string;
  type: "add" | "override";
  value: number | string;
}

export interface StoredValues {
  saves: Partial<Record<SaveKey, number | null | undefined>>;
  thac0: number | null | undefined;
  spells?: Record<string, number | null | undefined>;
  hd: string;
}

const num = (v: unknown) => {
  const n = typeof v === "string" && v.trim() !== "" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
};

export const tableDiffChanges = (stored: StoredValues, derived: Derived): Change[] => {
  const changes: Change[] = [];
  const add = (key: string, have: unknown, base: number) => {
    const v = num(have);
    if (v === null || v === base) return null;
    changes.push({ key, type: "add", value: v - base });
    return v - base;
  };
  for (const s of SAVE_KEYS) add(`system.saves.${s}.value`, stored.saves?.[s], derived.saves[s]);
  const thac0Delta = add("system.thac0.value", stored.thac0, derived.thac0);
  if (thac0Delta !== null) changes.push({ key: "system.thac0.bba", type: "add", value: -thac0Delta });
  const levels = new Set([...Object.keys(stored.spells ?? {}), ...Object.keys(derived.spellSlots)]);
  for (const lvl of stored.spells ? [...levels].sort() : []) {
    if (lvl === "0") continue;
    add(`system.spells.${lvl}.max`, num(stored.spells?.[lvl]) ?? 0, derived.spellSlots[lvl] ?? 0);
  }
  if (stored.hd && stored.hd !== derived.hd) changes.push({ key: "system.hp.hd", type: "override", value: stored.hd });
  return changes;
};

const MODES = { add: 2, override: 5 } as const;
const TYPES: Record<number, Change["type"]> = { 2: "add", 5: "override" };

export const buildEffectData = (
  name: string,
  changes: Change[],
  generation: number,
  extra: Record<string, unknown> = {},
) => {
  const img = "icons/svg/upgrade.svg";
  if (generation >= 14) return { name, img, system: { changes }, ...extra };
  return {
    name,
    img,
    changes: changes.map((c) => ({ key: c.key, mode: MODES[c.type], value: String(c.value) })),
    ...extra,
  };
};

type RawChange = { key: string; mode?: number; type?: string; value: unknown };

export const readChanges = (effect: { changes?: RawChange[]; system?: { changes?: RawChange[] } }): Change[] =>
  (effect.system?.changes ?? effect.changes ?? []).map((c) => ({
    key: c.key,
    type: (c.type as Change["type"]) ?? TYPES[c.mode ?? 2] ?? "add",
    value: c.value as number | string,
  }));

// Race modifiers can't take a score above 18 or below 3 (Player's Tome p18).
export const clampRaceModifier = (value: number, modifier: number) => {
  const before = value - modifier;
  return Math.min(Math.max(value, Math.min(3, before)), Math.max(18, before));
};
