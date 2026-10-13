/**
 * @file Plans converting a character's typed class into a class item.
 */
import { deriveFromClasses } from "../classes/derive";
import { type Change, type StoredValues, tableDiffChanges } from "../classes/effects";
import { isCombinedClassText } from "../classes/matching";
import { type ClassLevelRow, type PrimeReq, primeReqBonus, SAVE_KEYS } from "../classes/progression";

export type ReportStatus = "matched" | "custom" | "review" | "none" | "error";

export interface SourceSummary {
  text: string;
  level: number;
  xp: number;
  bonus: number;
  scores: Record<string, number | undefined>;
  stored: StoredValues;
}

export interface ClassData {
  name: string;
  system: { levels?: ClassLevelRow[]; primeReqs?: PrimeReq[]; hitDie?: string; [k: string]: unknown };
  [k: string]: unknown;
}

export interface ConversionPlan {
  status: ReportStatus;
  item?: { name: string; type: "class"; system: Record<string, unknown>; [k: string]: unknown };
  changes?: Change[];
  note?: string;
  // Typed XP bonus minus the class's own; kept as a Bonus Experience effect.
  xpBonus?: number;
}

// biome-ignore lint/suspicious/noExplicitAny: raw actor source data
export const readSource = (system: any): SourceSummary => {
  const s = system ?? {};
  return {
    text: String(s.details?.class ?? "").trim(),
    level: Number(s.details?.level) || 1,
    xp: Number(s.details?.xp?.value) || 0,
    bonus: Number(s.details?.xp?.bonus) || 0,
    scores: Object.fromEntries(Object.entries(s.scores ?? {}).map(([k, v]) => [k, (v as { value?: number })?.value])),
    stored: {
      // 0 is the blank default.
      saves: Object.fromEntries(SAVE_KEYS.map((k) => [k, s.saves?.[k]?.value || undefined])),
      thac0: s.thac0?.value,
      spells: s.spells?.enabled
        ? Object.fromEntries(
            Object.entries(s.spells)
              .filter(([k]) => /^\d+$/.test(k))
              .map(([k, v]) => [k, (v as { max?: number })?.max]),
          )
        : undefined,
      // template.json default.
      hd: s.hp?.hd === "1d8" ? "" : String(s.hp?.hd ?? ""),
    },
  };
};

export const planConversion = (src: SourceSummary, match: ClassData | null): ConversionPlan => {
  if (!src.text) return { status: "none" };
  const progress = { level: src.level, xp: src.xp };
  if (!match) {
    return {
      status: isCombinedClassText(src.text) || /\s/.test(src.text) ? "review" : "custom",
      item: { name: src.text, type: "class", system: { ...progress, xpBonusOverride: null } },
      changes: [],
      xpBonus: src.bonus,
    };
  }
  const levels = match.system.levels ?? [];
  const computed = primeReqBonus(match.system.primeReqs ?? [], src.scores);
  const system = { ...match.system, ...progress, xpBonusOverride: null };
  const derived = deriveFromClasses([
    { name: match.name, system: { levels, level: src.level, xp: src.xp, hitDie: "" } },
  ]);
  const beyond = levels.length > 0 && src.level > levels.length;
  return {
    status: beyond ? "review" : "matched",
    item: { ...match, name: match.name, type: "class", system },
    changes: derived ? tableDiffChanges(src.stored, derived) : [],
    note: beyond ? "levelBeyondTable" : undefined,
    xpBonus: src.bonus - computed,
  };
};

// The kept differences as readable rows, e.g. { key: "saves.death", value: "+1" }; bba mirrors THAC0.
export const adjustmentRows = (changes: Change[]) =>
  changes
    .filter((c) => c.key !== "system.thac0.bba")
    .map((c) => ({
      key: c.key
        .replace(/^system\./, "")
        .replace(/\.(value|max)$/, "")
        .replace(/^hp\.hd$/, "hd"),
      value: c.type === "add" && Number(c.value) > 0 ? `+${c.value}` : String(c.value),
    }));
