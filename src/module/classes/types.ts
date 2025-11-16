/**
 * @file OSE Class Type Definitions used in the system character class definitions.
 */
export type Attribute = "str" | "dex" | "con" | "int" | "wis" | "cha";

export type ClassSkillKey = "cs" | "tr" | "hn" | "hs" | "ms" | "ol" | "pp";

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
  skillChecks?: Record<ClassSkillKey, number>[];
};
