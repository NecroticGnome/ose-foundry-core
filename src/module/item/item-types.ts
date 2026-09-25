/**
 * @file The public type surface for Item data models.
 *
 * Kept apart from the data model classes themselves: a class module carries
 * inference obligations (notably `defineSchema`'s return type, which cannot be
 * named portably) that break the declaration build behind
 * `@ose-foundry-core/types`. Interfaces here have none.
 */
import type { InventoryItemTagValue, RollType, Save } from "../config";

/**
 * A tag as stored on an Item's `tags` schema field.
 *
 * `pushManualTag` (item/entity.js) writes all three, deriving `title` from a
 * trailing `(parenthetical)` and defaulting it to the value otherwise. `title`
 * and `label` stay optional because tags predating that writer, and those built
 * directly in tests, carry only a value.
 */
export interface ItemTag {
  title?: string;
  value: InventoryItemTagValue | (string & {});
  label?: string;
}

/**
 * A tag ready for rendering, from CONFIG.OSE.auto_tags or echoed from a stored
 * tag. `label` is optional because the rendering partial guards on it
 * (`{{#if tag.label}}` in item-auto-tags-partial.html).
 */
export interface DisplayTag {
  label?: string;
  value?: InventoryItemTagValue | (string & {});
  title?: string;
  icon?: string;
  image?: string;
}

/**
 * The fields every inventory item carries, regardless of type. Ability and
 * spell items deliberately sit outside this: they have no physical presence,
 * and their `manualTags` returns stored tags unchanged rather than the
 * filtered, labelled tags below.
 */
export interface PhysicalItemData {
  description: string;
  tags: ItemTag[];
  equipped: boolean;
  cost: number;
  containerId: string;
  quantity: { value: number | null; max: number | null };
  weight: number | null;
  itemslots: number;

  readonly manualTags: ItemTag[] | null;
  readonly autoTags: DisplayTag[];
}

export interface MiscItemData extends PhysicalItemData {
  treasure: boolean;

  readonly cumulativeWeight: number;
  readonly cumulativeCost: number;
  readonly cumulativeItemslots: number;
  readonly isCoinsOrGems: boolean;
}

/** The armour categories an armor Item can belong to, as localization keys. */
export const ARMOR_TYPES = {
  unarmored: "OSE.armor.unarmored",
  light: "OSE.armor.light",
  heavy: "OSE.armor.heavy",
  shield: "OSE.armor.shield",
} as const;

/** Which armour category an item falls into. */
export type ArmorType = keyof typeof ARMOR_TYPES;

/** The type and AC/AAC value of an armor item */
export interface ArmorItemData extends PhysicalItemData {
  type: ArmorType;
  ac: { value: number };
  aac: { value: number };
}

export interface WeaponItemData extends PhysicalItemData {
  damage: string;
  save: Save | "";
  range: { short: number; medium: number; long: number };
  bonus: number | null;
  pattern: string;
  missile: boolean;
  melee: boolean;
  slow: boolean;
  counter: { value: number; max: number };

  /** Auto-tags carrying an image, plus manual tags — the inventory grid's "Qualities" column. */
  readonly qualities: DisplayTag[];
}

/** The subset of an Item a container reads off its Actor's inventory. */
export interface CarriedItem {
  system: {
    containerId: string;
    weight: number | null;
    quantity?: { value: number | null };
  };
}

export interface ContainerItemData extends PhysicalItemData {
  itemIds: string[];

  /** Items on the containing Actor whose `containerId` points at this container. */
  readonly contents: CarriedItem[] | null;
  readonly totalWeight: number;
}

/** An item's raw source during migration, before the schema has cleaned it. */
export type LegacyItemSource = Record<string, unknown> & {
  description?: string;
  details?: { description?: string };
};

/**
 * Fields common to Items with no physical presence — abilities and spells.
 * These sit outside {@link PhysicalItemData}: they are never equipped, carried
 * or counted against encumbrance, and their `manualTags` returns stored tags
 * unchanged rather than the filtered, labelled set physical items produce.
 */
export interface NonPhysicalItemData {
  description: string;
  tags: ItemTag[];
  save: Save | "";
  roll: string;

  readonly manualTags: ItemTag[];
  readonly autoTags: DisplayTag[];
}

export interface AbilityItemData extends NonPhysicalItemData {
  pattern: string;
  requirements: string;
  rollType: RollType | "";
  rollTarget: number | null;
  blindroll: boolean;
}

export interface SpellItemData extends NonPhysicalItemData {
  lvl: number | null;
  class: string;
  duration: string;
  range: string;
  memorized: number | null;
  cast: number | null;
}
