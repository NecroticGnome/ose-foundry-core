/**
 * @file Ability score requirements shared by class and race items.
 */
export interface ScoreBounds {
  min: number | null;
  max: number | null;
}

export type ScoreRequirements = Record<string, ScoreBounds>;

const CLAUSE = /\b(min|max)(?:imum)?\s+(str|int|wis|dex|con|cha)\s+(\d+)/gi;

// "Minimum CON 9, minimum DEX 9" → { con: { min: 9, max: null }, dex: ... }; other text is ignored.
export const parseScoreRequirements = (text: string): ScoreRequirements => {
  const out: ScoreRequirements = {};
  for (const [, bound = "", score = "", value = ""] of (text ?? "").matchAll(CLAUSE)) {
    const key = score.toLowerCase();
    out[key] = { min: null, max: null, ...out[key], [bound.toLowerCase()]: Number(value) };
  }
  return out;
};

export const splitScoreRequirements = (text: string): { scores: ScoreRequirements; text: string } => {
  const scores = parseScoreRequirements(text);
  const rest = (text ?? "")
    .replace(CLAUSE, "")
    .replace(/\bnone\b/gi, "")
    .replace(/[\s,;.]+/g, "");
  return { scores, text: rest ? text.trim() : "" };
};
