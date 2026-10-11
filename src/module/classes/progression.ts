/**
 * @file Pure class progression rules: level rows, best-of, XP and HP arithmetic.
 */
import OSE, { type Save } from "../config";

export type SaveKey = Save;

export const SAVE_KEYS = Object.keys(OSE.saves_long) as SaveKey[];

const SCORE_KEYS = Object.keys(OSE.scores);

// Prepared scores expose each score as a getter, so read them by name.
// biome-ignore lint/suspicious/noExplicitAny: raw or prepared scores
export const scoreValues = (scores: any): Record<string, number | undefined> =>
  Object.fromEntries(SCORE_KEYS.map((k) => [k, scores?.[k]?.value]));

export interface ClassLevelRow {
  xp: number;
  hd: string;
  hdcon: boolean;
  thac0: number;
  bba: number;
  saves: Record<SaveKey, number>;
  spellSlots: Record<string, number>;
}

export interface PrimeReq {
  ability: string;
  minScore: number;
  percentage: number;
  concatLogic: "and" | "or";
  // Entries sharing a group are met together.
  group?: string;
}

export const levelRow = (levels: ClassLevelRow[], level: number): ClassLevelRow | null => {
  if (!levels?.length) return null;
  const index = Math.min(Math.max(Math.trunc(level) || 1, 1), levels.length) - 1;
  return levels[index] ?? null;
};

// Best saves and attack values. Spell slots are totalled (each class has its own pool).
export const bestOf = (rows: ClassLevelRow[]) => {
  if (!rows.length) return null;
  const saves = Object.fromEntries(SAVE_KEYS.map((key) => [key, Math.min(...rows.map((r) => r.saves[key]))])) as Record<
    SaveKey,
    number
  >;
  const spellSlots: Record<string, number> = {};
  for (const r of rows) {
    for (const [lvl, count] of Object.entries(r.spellSlots ?? {})) {
      spellSlots[lvl] = (spellSlots[lvl] ?? 0) + (count || 0);
    }
  }
  return {
    saves,
    thac0: Math.min(...rows.map((r) => r.thac0)),
    bba: Math.max(...rows.map((r) => r.bba)),
    spellSlots,
  };
};

export const splitXp = (award: number, count: number): number[] => {
  const n = Math.max(1, count);
  const share = Math.floor(award / n);
  return Array.from({ length: n }, (_, i) => (i === 0 ? award - share * (n - 1) : share));
};

export const applyXpBonus = (amount: number, percentage: number) =>
  Math.floor(amount + (amount * (percentage || 0)) / 100);

// Highest percentage whose requirements are met wins.
export const primeReqBonus = (primeReqs: PrimeReq[], scores: Record<string, number | null | undefined>) => {
  const groups = new Map<number, Map<string, PrimeReq[]>>();
  for (const req of primeReqs ?? []) {
    const byGroup = groups.get(req.percentage) ?? new Map<string, PrimeReq[]>();
    byGroup.set(req.group ?? "", [...(byGroup.get(req.group ?? "") ?? []), req]);
    groups.set(req.percentage, byGroup);
  }
  const meets = (req: PrimeReq) => (scores[req.ability] ?? 0) >= req.minScore;
  const satisfied = (reqs: PrimeReq[]) =>
    reqs.some((r) => r.concatLogic === "or") ? reqs.some(meets) : reqs.every(meets);
  for (const percentage of [...groups.keys()].sort((a, b) => b - a)) {
    if ([...(groups.get(percentage)?.values() ?? [])].some(satisfied)) return percentage;
  }
  return 0;
};

const SINGLE_TABLE: [number, number][] = [
  [3, -20],
  [6, -10],
  [9, 0],
  [13, 5],
  [16, 10],
];

export const defaultPrimeReqs = (abilities: string[]): PrimeReq[] => {
  if (abilities.length === 1) {
    const ability = abilities[0] ?? "";
    return SINGLE_TABLE.map(([minScore, percentage]) => ({ ability, minScore, percentage, concatLogic: "and" }));
  }
  return [13, 16].flatMap((minScore, i) =>
    abilities.map((ability) => ({ ability, minScore, percentage: (i + 1) * 5, concatLogic: "and" as const })),
  );
};

// The ability, if the rows are exactly the standard single prime requisite table.
export const standardPrimeReq = (rows: PrimeReq[]): string | null => {
  const ability = rows[0]?.ability;
  if (!ability) return null;
  const standard = defaultPrimeReqs([ability]);
  const same = (r: PrimeReq, s: PrimeReq) =>
    r.ability === s.ability &&
    r.minScore === s.minScore &&
    r.percentage === s.percentage &&
    r.concatLogic === s.concatLogic &&
    !r.group;
  return rows.length === standard.length && rows.every((r, i) => same(r, standard[i] as PrimeReq)) ? ability : null;
};

// Highest minimum score first, as the rulebook lists them.
export const primeReqDisplayOrder = (rows: PrimeReq[]) =>
  rows.map((row, index) => ({ ...row, index })).sort((a, b) => b.minScore - a.minScore || a.index - b.index);

export const divideHp = (gain: number, count: number, fraction: number) => {
  const total = (fraction || 0) + gain / Math.max(1, count);
  // Fractions are thirds or halves, stored to 3dp. Absorb the rounding.
  const whole = Math.floor(total + 0.005);
  const rest = Math.round((total - whole) * 1000) / 1000;
  return { whole, fraction: rest < 0.005 ? 0 : rest };
};

// Multi-class starting HP: earlier classes' share plus the new roll, divided again.
export const splitStartingHp = (prev: { max: number; fraction: number }, prevCount: number, gain: number) =>
  divideHp(((prev.max || 0) + (prev.fraction || 0)) * prevCount + gain, prevCount + 1, 0);

export const hdFlatBonus = (hd: string) => Number(/\+\s*(\d+)\s*$/.exec(hd ?? "")?.[1] ?? 0);

// Multi-class HD reads "2d8 / 1d4"; rolls use the first class.
export const rollableHd = (hd: string) => (hd ?? "").split("/")[0]?.trim() ?? "";

const FRACTIONS: [number, string][] = [
  [0.5, "½"],
  [1 / 3, "⅓"],
  [2 / 3, "⅔"],
];

export const formatFraction = (n: number) =>
  FRACTIONS.find(([v]) => Math.abs(v - n) < 0.005)?.[1] ?? String(Math.round(n * 100) / 100);

// Hit points with their carried fraction, e.g. 9½.
export const formatHp = (n: number) => {
  const whole = Math.floor(n + 0.005);
  const rest = n - whole;
  return `${whole || rest < 0.005 ? whole : ""}${rest < 0.005 ? "" : formatFraction(rest)}`;
};

// Level and XP for a class added part-way up its table.
export const startingProgress = (levels: ClassLevelRow[], level: number) => {
  const lvl = Math.max(1, Math.trunc(level) || 1);
  return { level: lvl, xp: levelRow(levels, lvl)?.xp ?? 0 };
};
