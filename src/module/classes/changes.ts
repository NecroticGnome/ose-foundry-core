/**
 * @file Before/after comparison of a character's class-driven stats.
 */
import { SAVE_KEYS, type SaveKey } from "./progression";

export interface ClassStats {
  hp: number;
  thac0: number;
  saves: Record<SaveKey, number>;
  spells: Record<string, number>;
}

export interface StatChange {
  key: string;
  from: number;
  to: number;
}

export const statChanges = (before: ClassStats, after: ClassStats): StatChange[] => {
  const out: StatChange[] = [];
  const diff = (key: string, from = 0, to = 0) => from !== to && out.push({ key, from, to });
  diff("hp", before.hp, after.hp);
  diff("thac0", before.thac0, after.thac0);
  for (const s of SAVE_KEYS) diff(`saves.${s}`, before.saves[s], after.saves[s]);
  const levels = new Set([...Object.keys(before.spells), ...Object.keys(after.spells)]);
  for (const l of [...levels].sort()) diff(`spells.${l}`, before.spells[l], after.spells[l]);
  return out;
};
