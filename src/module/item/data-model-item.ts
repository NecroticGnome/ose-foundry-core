/**
 * @file The data model for Items of type Item (misc / treasure).
 */

import type { DisplayTag, ItemTag, LegacyItemSource, MiscItemData } from "./item-types";

// fvtt-types cannot resolve this system's data models, so a precise Parent forces
// casts here and full Item stubs in tests. Revisit if they are ever registered.
// biome-ignore lint/suspicious/noExplicitAny: see above
export default class OseDataModelItem extends foundry.abstract.TypeDataModel<any, any> implements MiscItemData {
  declare treasure: boolean;
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
      treasure: new BooleanField(),
      description: new StringField(),
      tags: new ArrayField(new ObjectField()),
      equipped: new BooleanField(),
      cost: new NumberField({ min: 0, initial: 0 }),
      containerId: new StringField(),
      quantity: new SchemaField({
        value: new NumberField({ min: 0, initial: 1 }),
        max: new NumberField({ min: 0, initial: 0 }),
      }),
      weight: new NumberField({ min: 0, initial: 0 }),
      itemslots: new NumberField({ min: 0, initial: 0 }),
    };
  }

  get cumulativeWeight() {
    return (this.weight ?? 0) * (this.quantity.value ?? 0);
  }

  get cumulativeCost() {
    return this.cost * (this.quantity.value ?? 0);
  }

  get cumulativeItemslots() {
    return Math.ceil(this.itemslots * (this.quantity.value ?? 0));
  }

  static migrateData(source: LegacyItemSource) {
    if (source.details?.description && !source.description) source.description = source.details.description;
    return source;
  }

  get manualTags(): ItemTag[] | null {
    if (!this.tags) return null;

    const tagNames = new Set<string>(Object.values(CONFIG.OSE.auto_tags).map(({ label }) => label));
    return this.tags
      .filter(({ value }) => !tagNames.has(value))
      .map(({ title, value }) => ({ title, value, label: value }));
  }

  get autoTags(): DisplayTag[] {
    const tagNames = Object.values(CONFIG.OSE.auto_tags);

    const autoTags = this.tags.map(({ value }) => tagNames.find(({ label }) => value === label));

    return [...autoTags, ...(this.manualTags ?? [])].flat().filter((t) => !!t);
  }

  get isCoinsOrGems() {
    if (!this.treasure) return false;

    if (this.tags?.some((t) => t.value === "gem" || t.value === "gems" || t.value === "coin" || t.value === "coins")) {
      return true;
    }

    if (!this.parent?.name) return false;

    const itemName = this.parent.name.toLowerCase();
    if (itemName.endsWith(" coins")) return true;

    const coins = [
      "cp",
      "sp",
      "ep",
      "gp",
      "pp",
      game.i18n.localize("OSE.items.gp.short").toLowerCase(),
      game.i18n.localize("OSE.items.gp.long").toLowerCase(),
      "[00.01] copper (cp)",
      "[00.10] silver (sp)",
      "[00.50] electrum (ep)",
      "[01.00] gold (gp)",
      "[10.00] platinum (pp)",
    ];

    return coins.includes(itemName);
  }
}
