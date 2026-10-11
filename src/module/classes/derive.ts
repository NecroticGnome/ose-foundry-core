/**
 * @file Derives a character's base values from its class items.
 */
import { bestOf, type ClassLevelRow, levelRow, type SaveKey } from "./progression";

export interface ClassLike {
  name: string;
  system: { levels: ClassLevelRow[]; level: number; xp: number; hitDie: string };
}

export interface Derived {
  saves: Record<SaveKey, number>;
  thac0: number;
  bba: number;
  spellSlots: Record<string, number>;
  level: number;
  className: string;
  xp: number;
  xpNext: number | null;
  hd: string;
}

// Level, name and XP for the compatibility fields, tables or not.
export const summariseClasses = (classes: ClassLike[]) => {
  const first = classes[0];
  if (!first) return null;
  return {
    level: Math.max(...classes.map((c) => c.system.level || 1)),
    className: classes.map((c) => c.name).join(" / "),
    xp: first.system.xp,
    xpNext: first.system.levels[first.system.level]?.xp ?? null,
  };
};

export const deriveFromClasses = (classes: ClassLike[]): Derived | null => {
  const rows = classes.flatMap((c) => levelRow(c.system.levels, c.system.level) ?? []);
  const best = bestOf(rows);
  const summary = summariseClasses(classes);
  if (!best || !summary) return null;
  return { ...best, ...summary, hd: rows.map((row) => row.hd).join(" / ") };
};

export interface Finals {
  saves: Record<SaveKey, number>;
  thac0: number;
  bba: number;
}

// Tooltip text explaining each derived value, keyed like "saves.death".
export const describeDerivation = (classes: ClassLike[], finals: Finals): Record<string, string> => {
  const tabled = classes.flatMap((c) => {
    const row = levelRow(c.system.levels, c.system.level);
    return row ? [{ label: `${c.name} ${c.system.level}`, row }] : [];
  });
  const describe = (pick: (row: ClassLevelRow) => number, best: (...n: number[]) => number, final: number) => {
    const values = tabled.map((t) => pick(t.row));
    const base = best(...values);
    const parts = tabled.map((t, i) => `${t.label}: ${values[i]}`).join(" · ");
    const delta = final - base;
    const effects = delta ? ` · ${delta > 0 ? "+" : "−"}${Math.abs(delta)} → ${final}` : "";
    return `${parts} → ${base}${effects}`;
  };
  const out: Record<string, string> = {
    thac0: describe((r) => r.thac0, Math.min, finals.thac0),
    bba: describe((r) => r.bba, Math.max, finals.bba),
  };
  for (const s of Object.keys(finals.saves) as SaveKey[]) {
    out[`saves.${s}`] = describe((r) => r.saves[s], Math.min, finals.saves[s]);
  }
  return out;
};
