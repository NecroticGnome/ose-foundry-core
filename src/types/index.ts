/**
 * @file Public type surface for `@ose-foundry-core/types`.
 *
 * This is the ONLY entrypoint shipped to consumers. It is a thin re-export
 * barrel — every type exported here comes directly from a real TypeScript
 * source file in the OSE system. No types are hand-authored, no shapes are
 * transcribed; nothing can drift from the system because everything IS the
 * system.
 *
 * Uses relative paths (not a tsconfig path alias) so rollup-plugin-dts
 * inlines the symbols at build time rather than leaving the alias as an
 * external import in the shipped declarations.
 *
 * The shipped surface grows automatically as the system's remaining `.js`
 * data models (items, character/monster data) are converted to TypeScript:
 * whatever the system explicitly `export`s becomes eligible for re-export
 * here.
 */

export type { CharacterAC } from "../module/actor/data-model-classes/data-model-character-ac";
export type { CharacterEncumbrance } from "../module/actor/data-model-classes/data-model-character-encumbrance";
export type { CharacterMove } from "../module/actor/data-model-classes/data-model-character-move";
export type { CharacterScores } from "../module/actor/data-model-classes/data-model-character-scores";
export type { CharacterSpells } from "../module/actor/data-model-classes/data-model-character-spells";
export type {
  ApplyDamageOption,
  Armor,
  Attribute,
  Color,
  EncumbranceOption,
  ExplorationSkill,
  InventoryItemTag,
  OseConfig,
  RollType,
  Save,
} from "../module/config";

export type { ClassicClassName, OseClass } from "./classes";
