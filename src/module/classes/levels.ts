/**
 * @file Keeps a class's per-level rows (progression and tables) in step with its maximum level.
 */
import type { ClassLevelRow } from "./progression";
import type { Cell, ClassTable } from "./tables";

type TableRow = Record<string, Cell>;

/** Rows set aside by lowering the maximum level, restored if it's raised again. */
export interface LevelStash {
  levels: ClassLevelRow[];
  tables: { key: string; rows: TableRow[] }[];
}

// A new level copies the one before it, doubling its XP.
const nextLevel = (last: ClassLevelRow | undefined, blank: () => ClassLevelRow): ClassLevelRow =>
  last ? { ...structuredClone(last), xp: last.xp ? last.xp * 2 : 2000 } : blank();

const resize = <T>(rows: T[], aside: T[], size: number, make: (last: T | undefined) => T) => {
  if (rows.length >= size) return { rows: rows.slice(0, size), aside: [...rows.slice(size), ...aside] };
  const restored = aside.slice(0, size - rows.length);
  const out = [...rows, ...restored];
  while (out.length < size) out.push(make(out.at(-1)));
  return { rows: out, aside: aside.slice(restored.length) };
};

export const resizeLevels = (
  current: { levels: ClassLevelRow[]; tables: ClassTable[] },
  stash: LevelStash | undefined,
  max: number,
  blank: () => ClassLevelRow,
): { levels: ClassLevelRow[]; tables: ClassTable[]; stash: LevelStash } => {
  const size = Number.isFinite(max) && max > 0 ? Math.trunc(max) : 0;
  const levels = resize(current.levels, stash?.levels ?? [], size, (last) => nextLevel(last, blank));
  const asideTables: LevelStash["tables"] = [];
  const tables = current.tables.map((table) => {
    const aside = stash?.tables.find((t) => t.key === table.key)?.rows ?? [];
    const rows = resize(table.rows, aside, size, (last) => ({ ...(last ?? {}) }));
    if (rows.aside.length) asideTables.push({ key: table.key, rows: rows.aside });
    return { ...table, rows: rows.rows };
  });
  return { levels: levels.rows, tables, stash: { levels: levels.aside, tables: asideTables } };
};

// The minimum XP for a level when the current XP belongs to a different level, else null.
export const xpForLevel = (levels: { xp: number }[], level: number, xp: number) => {
  const min = levels[level - 1]?.xp;
  const next = levels[level]?.xp;
  if (min == null || (xp >= min && (next == null || xp < next))) return null;
  return min;
};

// An existing classless character above level 0 keeps its hit points.
export const rollsStartingHp = ({ isNew, hasClass, level }: { isNew: boolean; hasClass: boolean; level: number }) =>
  isNew || hasClass || level === 0;
