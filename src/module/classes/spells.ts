/**
 * @file Spell pools: each casting class has its own slots, and each spell is allocated to one.
 */
import { normaliseName } from "./matching";
import { type ClassLevelRow, levelRow } from "./progression";

export interface PoolClass {
  id: string;
  name: string;
  key: string;
  spellList: string;
  level: number;
  levels: ClassLevelRow[];
}

export interface PoolSpell {
  id: string;
  lvl: number;
  class: string;
  castAs: string;
  cast: number;
}

export interface SpellPool {
  key: string;
  classId: string;
  name: string;
  list: string;
  slots: Record<string, { max: number; used: number }>;
}

// Explicitly set aside: counts against no pool.
export const NO_POOL = "none";

const isCaster = (c: PoolClass) => c.levels.some((r) => Object.values(r.spellSlots ?? {}).some((n) => n > 0));

export const buildSpellPools = (classes: PoolClass[], spells: PoolSpell[]) => {
  const pools: SpellPool[] = classes.filter(isCaster).map((c) => {
    const row = levelRow(c.levels, c.level);
    const slots = Object.fromEntries(
      Object.entries(row?.spellSlots ?? {})
        .filter(([, n]) => n > 0)
        .map(([lvl, max]) => [lvl, { max, used: 0 }]),
    );
    return { key: c.key || c.id, classId: c.id, name: c.name, list: c.spellList || c.name, slots };
  });

  const byList = (s: PoolSpell) => pools.find((p) => normaliseName(p.list) === normaliseName(s.class));
  const place = (s: PoolSpell) => {
    if (s.castAs === NO_POOL) return null;
    const chosen = pools.find((p) => p.key === s.castAs);
    if (chosen) return chosen;
    return byList(s) ?? (pools.length === 1 ? pools[0] : null) ?? null;
  };

  const assignment: Record<string, string | null> = {};
  const other: string[] = [];
  // No tabled caster: slots stay hand-entered and nothing is "unallocated".
  if (!pools.length) return { pools, assignment, other };
  for (const s of spells) {
    const pool = place(s);
    assignment[s.id] = pool?.key ?? null;
    if (!pool) {
      other.push(s.id);
      continue;
    }
    const lvl = String(s.lvl);
    pool.slots[lvl] = pool.slots[lvl] ?? { max: 0, used: 0 };
    pool.slots[lvl].used += Number(s.cast) || 0;
  }
  return { pools, assignment, other };
};
