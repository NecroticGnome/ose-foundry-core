/**
 * @file Attribute keys suggested in the Active Effect editor, per actor type.
 */
import OSE from "../config";

export interface EffectKey {
  key: string;
  label: string;
  data?: Record<string, string | number>;
}

const shared = (): EffectKey[] => [
  { key: "system.hp.max", label: "OSE.HealthMax" },
  { key: "system.hp.value", label: "OSE.Health" },
  { key: "system.hp.hd", label: "OSE.HitDice" },
  { key: "system.thac0.value", label: "OSE.Thac0" },
  { key: "system.thac0.bba", label: "OSE.AB" },
  { key: "system.thac0.mod.melee", label: "OSE.MeleeBonus" },
  { key: "system.thac0.mod.missile", label: "OSE.MissileBonus" },
  ...Object.entries(OSE.saves_long).map(([s, label]) => ({ key: `system.saves.${s}.value`, label })),
  { key: "system.initiative.mod", label: "OSE.InitiativeBonus" },
  { key: "system.movement.base", label: "OSE.movement.base" },
  ...[1, 2, 3, 4, 5, 6].map((level) => ({
    key: `system.spells.${level}.max`,
    label: "OSE.classes.changes.SpellSlots",
    data: { level },
  })),
];

export const effectKeys = (type: "character" | "monster"): EffectKey[] =>
  type === "monster"
    ? [
        ...shared(),
        { key: "system.ac.value", label: "OSE.ArmorClass" },
        { key: "system.aac.value", label: "OSE.effects.keys.aac" },
        { key: "system.details.morale", label: "OSE.details.morale" },
        { key: "system.details.xp", label: "OSE.details.experience.award" },
      ]
    : [
        ...Object.entries(OSE.scores).map(([s, label]) => ({ key: `system.scores.${s}.value`, label })),
        ...shared(),
        { key: "system.ac.mod", label: "OSE.ArmorClassBonus" },
        ...Object.entries(OSE.exploration_skills).map(([e, label]) => ({ key: `system.exploration.${e}`, label })),
        { key: "system.details.xp.bonus", label: "OSE.details.experience.bonus" },
        { key: "system.details.xp.share", label: "OSE.details.experience.share" },
        { key: "system.details.magic.bonus", label: "OSE.details.magic.bonus" },
        { key: "system.encumbrance.max", label: "OSE.effects.keys.encumbranceMax" },
        { key: "system.retainer.loyalty", label: "OSE.Loyalty" },
      ];
