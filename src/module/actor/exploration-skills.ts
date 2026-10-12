/**
 * @file Localized, sheet-ready views of a character's exploration skills.
 */
import type { ExplorationSkill } from "../config";

/** A character's exploration skill targets, as stored on `actor.system.exploration`. */
export type ExplorationSkills = Partial<Record<ExplorationSkill, number>>;

/** One exploration skill, localized and paired with the character's target number. */
export type ExplorationSkillEntry = {
  key: ExplorationSkill;
  value: number | undefined;
  long: string;
  short: string;
  abbreviation: string;
  from?: string;
};

export const explorationSkillKeys = (): ExplorationSkill[] =>
  Object.keys(CONFIG.OSE.exploration_skills) as ExplorationSkill[];

export const prepareExplorationSkills = (
  exploration: ExplorationSkills = {},
  from: Partial<Record<ExplorationSkill, string>> = {},
): ExplorationSkillEntry[] =>
  explorationSkillKeys().map((key) => ({
    key,
    value: exploration[key],
    long: game.i18n.localize(CONFIG.OSE.exploration_skills[key]),
    short: game.i18n.localize(`OSE.exploration.${key}.short`),
    abbreviation: game.i18n.localize(CONFIG.OSE.exploration_skills_short[key]),
    from: from[key] && game.i18n.format("OSE.exploration.FromAbility", { ability: from[key] }),
  }));

type SkillRoll = { roll?: string; rollType?: string; rollTarget?: number | null };

/** The x-in-6 chance of a 1d6 roll at or under its target, or null for any other roll. */
export const chanceInSix = ({ roll, rollType, rollTarget }: SkillRoll): number | null =>
  roll?.replace(/\s/g, "") === "1d6" && rollType === "below" && rollTarget ? rollTarget : null;

type FlaggedItem = { name: string; type: string; system: SkillRoll & { exploration?: string } };

/** Raises each skill to the best chance of the abilities flagged with it and returns the ability names. */
export const raiseFromAbilities = (exploration: ExplorationSkills, items: Iterable<FlaggedItem>) => {
  const from: Partial<Record<ExplorationSkill, string>> = {};
  for (const { name, type, system } of items) {
    const key = system.exploration as ExplorationSkill;
    const chance = chanceInSix(system) ?? 0;
    if (type !== "ability" || !key || !(key in exploration) || chance <= (exploration[key] ?? 0)) continue;
    exploration[key] = chance;
    from[key] = name;
  }
  return from;
};
