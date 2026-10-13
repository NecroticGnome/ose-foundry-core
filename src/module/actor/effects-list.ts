/**
 * @file Groups an actor's Active Effects for the Effects tab.
 */

export interface EffectRow {
  uuid: string;
  name: string;
  img: string;
  disabled: boolean;
  temporary: boolean;
  // The granting item's name; null for the actor's own effects.
  source: string | null;
  duration: string;
  // Shown for information; changed through its source, not here.
  fixed?: boolean;
}

// Group into the same sections as Foundry VTT's effects list.
export const groupEffects = (rows: EffectRow[]) => {
  const byName = (a: EffectRow, b: EffectRow) => a.name.localeCompare(b.name);
  const pick = (test: (r: EffectRow) => boolean) => rows.filter(test).sort(byName);
  return [
    { key: "temporary", effects: pick((r) => !r.disabled && r.temporary) },
    { key: "passive", effects: pick((r) => !r.disabled && !r.temporary) },
    { key: "inactive", effects: pick((r) => r.disabled) },
  ];
};

interface Duration {
  value?: number | null;
  units?: string;
  rounds?: number | null;
  turns?: number | null;
  remaining?: number | null;
  label?: string;
}

const UNIT_KEYS: Record<string, string> = { rounds: "COMBAT.Rounds", turns: "COMBAT.Turns" };
const amount = (n: number | null | undefined): n is number => Number.isFinite(n) && Number(n) > 0;

// Only a running duration is labelled (v13 and v14), so fall back to the configured one; blank rather than "None".
export const durationText = (d: Duration, localize: (key: string) => string) => {
  if (Number.isFinite(d.remaining) && d.label) return d.label;
  const unit = (n: number, units: string) => `${n} ${localize(UNIT_KEYS[units] ?? `EFFECT.DURATION.UNITS.${units}`)}`;
  if (amount(d.value) && d.units && d.units !== "none") return unit(d.value, d.units);
  if (amount(d.rounds)) return unit(d.rounds, "rounds");
  if (amount(d.turns)) return unit(d.turns, "turns");
  return d.label && d.label !== localize("COMMON.None") ? d.label : "";
};
