/**
 * @file Public type definitions for OSE character classes.
 *
 * Canonical home — the system's own `classic-fantasy-classes.ts` data file
 * imports these from here.
 */
import type { Attribute } from "../module/config";

/**
 * The seven core classes of classic-fantasy Old-School Essentials: the four
 * human classes (Cleric, Fighter, Magic-User, Thief) and the three demi-human
 * race-as-class options (Dwarf, Elf, Halfling).
 */
export type ClassicClassName = "Cleric" | "Dwarf" | "Elf" | "Fighter" | "Halfling" | "Magic-User" | "Thief";

/**
 * Definition shape for an OSE character class.
 *
 * Consumed by the system's `classic-fantasy-classes.ts` data file, which
 * declares each class as a fully-typed `OseClass`. Numeric tables follow
 * Old-School Essentials conventions.
 */
export type OseClass = {
  /** Display name of the class (e.g. `"Magic-User"`). */
  name: string;

  /**
   * Compendium pack ID (`<package>.<pack>`) holding the class's special-ability
   * items, e.g. `"classicfantasycompendium.abilities-cleric"`.
   */
  abilitiesPack: string;

  /**
   * Compendium pack ID for the class's spell list. Omitted for non-spellcasting
   * classes (e.g. Fighter, Thief).
   */
  spellsPack?: string;

  /**
   * Minimum ability scores required to take the class, keyed by ability
   * (`str`/`int`/`wis`/`dex`/`con`/`cha`). Abilities with no minimum are absent;
   * an empty `{}` means the class has no ability-score requirement.
   */
  requirements: Partial<Record<Attribute, number>>;

  /**
   * Per-level progression table, indexed by character level minus one
   * (`levels[0]` is level 1, `levels[1]` is level 2, …).
   */
  levels: {
    /** Cumulative experience points required to reach this level. */
    xp: number;

    /** Hit Dice gained by this level, as a dice formula string (e.g. `"2d6"`). */
    hd: string;

    /** THAC0 ("To Hit Armour Class 0") — the class's attack value at this level. */
    thac0: number;

    /**
     * Saving-throw target numbers for this level, in OSE's canonical order:
     * `[death, wand, paralysis, breath, spell]` — i.e. Death/Poison (D), Wands
     * (W), Paralysis/Petrification (P), Breath Attacks (B), Spells/Rods/Staves
     * (S). A roll meeting or exceeding the target succeeds.
     */
    saves: number[];

    /**
     * Spell slots available at this level, indexed by spell level minus one
     * (`spells[0]` is 1st-level slots). Omitted for non-spellcasting classes.
     */
    spells?: number[];
  }[];

  /**
   * Optional per-level skill-check table for skill-based classes (e.g. the
   * Thief). Each entry is one character level's success-chance percentages,
   * keyed by the class's skill abbreviations: `cs` Climb Sheer Surfaces, `tr`
   * Find/Remove Treasure Traps, `hn` Hear Noise, `hs` Hide in Shadows, `ms`
   * Move Silently, `ol` Open Locks, `pp` Pick Pockets.
   */
  skillChecks?: Record<string, number>[];

  /** Source / edition label the class definition comes from (e.g. `"Classic Fantasy"`). */
  source: string;
};
