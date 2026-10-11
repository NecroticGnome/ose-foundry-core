/**
 * @file Tweaks modifiers, each kept as its own Active Effect.
 */

export interface TweakField {
  id: string;
  path: string;
  label: string;
  // Stored alongside path and kept equal to it.
  twin?: string;
}

const TWEAKS: (TweakField & { monster?: boolean })[] = [
  { id: "initiative", path: "system.initiative.mod", label: "OSE.InitiativeBonus", monster: true },
  { id: "melee", path: "system.thac0.mod.melee", label: "OSE.MeleeBonus" },
  { id: "missile", path: "system.thac0.mod.missile", label: "OSE.MissileBonus" },
  { id: "ac", path: "system.ac.mod", label: "OSE.ArmorClassBonus", twin: "system.aac.mod" },
  { id: "magic", path: "system.details.magic.bonus", label: "OSE.details.magic.bonus" },
  { id: "xp", path: "system.details.xp.bonus", label: "OSE.details.experience.bonus" },
];

export const tweakFields = (type: string): TweakField[] =>
  TWEAKS.filter((t) => type === "character" || t.monster).map(({ monster, ...t }) => t);

const classText = (source: unknown) =>
  String((source as { details?: { class?: unknown } })?.details?.class ?? "").trim() !== "";

const read = (source: unknown, path: string) =>
  Number(
    path
      .split(".")
      .slice(1)
      .reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], source),
  ) || 0;

export interface TweakActor {
  type: string;
  hasClasses: boolean;
  source: unknown;
  // Ids of tweaks that already have an effect.
  tweakEffects: string[];
}

// Moves each non-zero modifier into its own effect and zeroes the stored field.
export const planTweakMigration = ({ type, hasClasses, source, tweakEffects }: TweakActor) => {
  const effects: { id: string; path: string; value: number }[] = [];
  const update: Record<string, number> = {};
  for (const t of tweakFields(type)) {
    // With a class (item or free text), the XP bonus is its prime requisite, which class items own.
    if (t.id === "xp" && (hasClasses || classText(source))) continue;
    const value = read(source, t.path);
    if (!value || tweakEffects.includes(t.id)) continue;
    effects.push({ id: t.id, path: t.path, value });
    update[t.path] = 0;
    if (t.twin) update[t.twin] = 0;
  }
  return { effects, update };
};
