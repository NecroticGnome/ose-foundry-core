/**
 * @file The Item data models this system registers, and their declaration to
 * fvtt-types.
 *
 * `ose.js` assigns `CONFIG.Item.dataModels` from this object, and the
 * `DataModelConfig` merge below derives from the same value — so an item type
 * cannot be registered at runtime without also being typed, or vice versa.
 *
 * Without this, `item.system` resolves to `UnknownSystem` everywhere.
 */
import OseDataModelAbility from "./data-model-ability";
import OseDataModelArmor from "./data-model-armor";
import OseDataModelClass from "./data-model-class";
import OseDataModelContainer from "./data-model-container";
import OseDataModelItem from "./data-model-item";
import OseDataModelRace from "./data-model-race";
import OseDataModelSpell from "./data-model-spell";
import OseDataModelWeapon from "./data-model-weapon";

export const ITEM_DATA_MODELS = {
  ability: OseDataModelAbility,
  armor: OseDataModelArmor,
  class: OseDataModelClass,
  container: OseDataModelContainer,
  item: OseDataModelItem,
  race: OseDataModelRace,
  spell: OseDataModelSpell,
  weapon: OseDataModelWeapon,
} as const;

declare global {
  interface DataModelConfig {
    Item: typeof ITEM_DATA_MODELS;
  }
}
