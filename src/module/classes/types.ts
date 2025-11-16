/**
 * @file OSE Class Type Definitions used in the system character class definitions.
 */
export const ATTRIBUTES = ["str", "dex", "con", "int", "wis", "cha"] as const;

export type Attribute = typeof ATTRIBUTES[number];

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
  abilitiesPack?: string;
  levels: {
    xp: number;
    hd: string;
    thac0: number;
    saves: number[];
    spells?: number[];
  }[];
  skillChecks?: Record<string, number>[];
};
