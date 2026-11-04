/**
 * @file Racial saving throw bonuses: fixed, or scaled by Constitution (Resilience).
 */
import type { SaveKey } from "./progression";

export interface RaceSaveBonus {
  saves: SaveKey[];
  bonus: number | null;
  against: string;
}

export const CON_SAVE_BONUS = [
  { min: 3, bonus: 0 },
  { min: 7, bonus: 2 },
  { min: 11, bonus: 3 },
  { min: 15, bonus: 4 },
  { min: 18, bonus: 5 },
];

export const conSaveBonus = (con: number) => CON_SAVE_BONUS.findLast(({ min }) => con >= min)?.bonus ?? 0;

export const raceSaveBonus = (entry: RaceSaveBonus, con: number | null | undefined) =>
  entry.bonus ?? conSaveBonus(con ?? 0);

export const appliesToSave = (entry: RaceSaveBonus, save: SaveKey) => !entry.saves.length || entry.saves.includes(save);

export const totalRaceSaveBonus = (bonuses: RaceSaveBonus[], save: SaveKey, con: number | null | undefined) => {
  const applicable = bonuses.filter((b) => !b.against && appliesToSave(b, save));
  return applicable.reduce((sum, b) => sum + raceSaveBonus(b, con), 0);
};
