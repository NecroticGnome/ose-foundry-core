/**
 * @file OSE Class Type Definitions used in the system character class definitions.
 */
import type { Attribute } from "../config";

export type ClassicClassName =
  | "Cleric"
  | "Dwarf"
  | "Elf"
  | "Fighter"
  | "Halfling"
  | "Magic-User"
  | "Thief";

export type OseClass = {
  name: string;
  abilitiesPack: string;
  spellsPack?: string;
  requirements: Partial<Record<Attribute, number>>;
  levels: {
    xp: number;
    hd: string;
    thac0: number;
    saves: number[];
    spells?: number[];
  }[];
  skillChecks?: Record<string, number>[];
  source: string;
};
