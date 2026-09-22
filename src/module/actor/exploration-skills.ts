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
};

export const explorationSkillKeys = (): ExplorationSkill[] =>
  Object.keys(CONFIG.OSE.exploration_skills) as ExplorationSkill[];

export const prepareExplorationSkills = (exploration: ExplorationSkills = {}): ExplorationSkillEntry[] =>
  explorationSkillKeys().map((key) => ({
    key,
    value: exploration[key],
    long: game.i18n.localize(CONFIG.OSE.exploration_skills[key]),
    short: game.i18n.localize(`OSE.exploration.${key}.short`),
    abbreviation: game.i18n.localize(CONFIG.OSE.exploration_skills_short[key]),
  }));
