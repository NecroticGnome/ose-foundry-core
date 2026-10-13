/**
 * @file Movement rates from a monster's movement text, e.g. "60’ (20’) / 180’ (60’) flying".
 */

/** Feet per exploration turn or per combat round. */
export type MovementRate = { turn: number; round: number | null };

// Named movement actions. Anything else counts as walking.
const ACTIONS: [string, RegExp][] = [
  ["fly", /\bfl(y|ying|ies)\b/i],
  ["swim", /\bswim(ming|s)?\b/i],
  ["burrow", /\bburrow(ing|s)?\b/i],
  ["climb", /\bclimb(ing|s)?\b/i],
];

export const parseMovement = (text: string): Record<string, MovementRate> => {
  const rates: Record<string, MovementRate> = {};
  for (const part of (text ?? "").split(/[/,;]/)) {
    const m = /(\d+)\s*(?:['’]|ft\.?|feet)?\s*(?:\(\s*(\d+)\s*(?:['’]|ft\.?|feet)?\s*\))?/i.exec(part);
    if (!m) continue;
    const action = ACTIONS.find(([, re]) => re.test(part))?.[0] ?? "walk";
    rates[action] ??= { turn: Number(m[1]), round: m[2] ? Number(m[2]) : null };
  }
  return rates;
};

/** How far a token may move for an action. */
export const movementAllowance = (text: string, base: number, action = "walk", inCombat = false) => {
  const rates = parseMovement(text);
  const rate = rates[action] ?? rates.walk ?? { turn: base, round: null };
  return inCombat ? (rate.round ?? Math.floor(rate.turn / 3)) : rate.turn;
};
