/**
 * @file The data model for Items of type Weapon
 */
import type { Save } from "../config";
import type { DisplayTag, ItemTag, WeaponItemData } from "./item-types";

// fvtt-types cannot resolve this system's data models, so a precise Parent forces
// casts here and full Item stubs in tests. Revisit if they are ever registered.
// biome-ignore lint/suspicious/noExplicitAny: see above
export default class OseDataModelWeapon extends foundry.abstract.TypeDataModel<any, any> implements WeaponItemData {
  declare damage: string;
  declare save: Save | "";
  declare range: { short: number; medium: number; long: number };
  declare bonus: number | null;
  declare pattern: string;
  declare missile: boolean;
  declare melee: boolean;
  declare slow: boolean;
  declare counter: { value: number; max: number };
  declare description: string;
  declare tags: ItemTag[];
  declare equipped: boolean;
  declare cost: number;
  declare containerId: string;
  declare quantity: { value: number | null; max: number | null };
  declare weight: number | null;
  declare itemslots: number;

  static defineSchema() {
    const { SchemaField, StringField, NumberField, BooleanField, ArrayField, ObjectField } = foundry.data.fields;
    return {
      damage: new StringField(),
      description: new StringField(),
      tags: new ArrayField(new ObjectField()),
      equipped: new BooleanField(),
      save: new StringField(),
      range: new SchemaField({
        short: new NumberField({ integer: true, min: 0, initial: 0 }),
        medium: new NumberField({ integer: true, min: 0, initial: 0 }),
        long: new NumberField({ integer: true, min: 0, initial: 0 }),
      }),
      bonus: new NumberField({}),
      pattern: new StringField(),
      missile: new BooleanField(),
      melee: new BooleanField({ initial: true }),
      slow: new BooleanField(),
      counter: new SchemaField({
        value: new NumberField({ integer: true, min: 0, initial: 0 }),
        max: new NumberField({ integer: true, min: 0, initial: 0 }),
      }),
      cost: new NumberField({ min: 0, initial: 0 }),
      containerId: new StringField(),
      quantity: new SchemaField({
        value: new NumberField({ min: 0 }),
        max: new NumberField({ min: 0 }),
      }),
      weight: new NumberField({ min: 0 }),
      itemslots: new NumberField({ min: 0, initial: 1 }),
    };
  }

  get #missileTag(): DisplayTag[] | null {
    if (!this.missile) return null;
    return [
      CONFIG.OSE.auto_tags.missile,
      {
        label: `${this.range.short}/${this.range.medium}/${this.range.long}`,
        icon: "fa-bullseye",
      },
    ];
  }

  get #meleeTag(): DisplayTag | null {
    if (!this.melee) return null;
    return CONFIG.OSE.auto_tags.melee;
  }

  get #slowTag(): DisplayTag | null {
    if (!this.slow) return null;
    return CONFIG.OSE.auto_tags.slow;
  }

  get #saveTag(): DisplayTag | null {
    if (!this.save) return null;

    return {
      label: CONFIG.OSE.saves_long[this.save],
      icon: "fa-skull",
    };
  }

  get manualTags(): ItemTag[] | null {
    if (!this.tags) return null;

    const tagNames = new Set<string>(Object.values(CONFIG.OSE.auto_tags).map(({ label }) => label));
    return this.tags.filter(({ value }) => !tagNames.has(value));
  }

  /**
   * Icons that display in the inventory grid's weapon row, under "Qualities"
   *
   * @returns {Array} - An array of qualities that display in the "Qualities" column on an Actor's Inventory sheet
   */
  get qualities(): DisplayTag[] {
    return [
      ...this.autoTags
        .filter((t) => !!t.image)
        .map((t) => ({
          ...t,
          title: t.label,
        })),
      ...(this.manualTags ?? []),
    ];
  }

  get autoTags(): DisplayTag[] {
    const tagNames = Object.values(CONFIG.OSE.auto_tags);

    const autoTags = this.tags.map(({ value }) => tagNames.find(({ label }) => value === label));

    return [
      { label: this.damage ?? "", icon: "fa-tint" },
      this.#meleeTag,
      this.#missileTag,
      this.#slowTag,
      ...autoTags,
      this.#saveTag,
    ]
      .flat()
      .filter((t) => !!t);
  }
}
