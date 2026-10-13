/**
 * @file The Actor data models this system registers, and their declaration to fvtt-types.
 *
 * As for items (see item/data-models.ts): without this, `actor.system` resolves to `UnknownSystem`.
 */
import OseDataModelCharacter from "./data-model-character";
import OseDataModelMonster from "./data-model-monster";

export const ACTOR_DATA_MODELS = {
  character: OseDataModelCharacter,
  monster: OseDataModelMonster,
} as const;

declare global {
  interface DataModelConfig {
    Actor: typeof ACTOR_DATA_MODELS;
  }
}
