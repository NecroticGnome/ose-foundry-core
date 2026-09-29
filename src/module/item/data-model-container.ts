/**
 * @file The data model for Items of type Container
 */
import type { CarriedItem, ContainerItemData, DisplayTag, ItemTag } from "./item-types";

export default class OseDataModelContainer
  // system's data models, so a precise Parent forces casts here and full Item
  // stubs in tests. Revisit if the models are registered with fvtt-types.
  // biome-ignore lint/suspicious/noExplicitAny: fvtt-types cannot resolve this
  extends foundry.abstract.TypeDataModel<any, any>
  implements ContainerItemData
{
  declare itemIds: string[];
  declare description: string;
  declare tags: ItemTag[];
  declare equipped: boolean;
  declare cost: number;
  declare containerId: string;
  declare quantity: { value: number | null; max: number | null };
  declare weight: number | null;
  declare itemslots: number;

  static defineSchema() {
    const { SchemaField, StringField, NumberField, ArrayField, ObjectField, BooleanField } = foundry.data.fields;
    return {
      itemIds: new ArrayField(new StringField()),
      description: new StringField(),
      tags: new ArrayField(new ObjectField()),
      equipped: new BooleanField(),
      cost: new NumberField({ min: 0, initial: 0 }),
      containerId: new StringField(),
      quantity: new SchemaField({
        value: new NumberField({ min: 0, initial: 0 }),
        max: new NumberField({ min: 0, initial: 0 }),
      }),
      weight: new NumberField({ min: 0, initial: 0 }),
      itemslots: new NumberField({ min: 0, initial: 1 }),
    };
  }

  get contents(): ContainerItemData["contents"] {
    if (!this.itemIds) return null;
    if (!this?.parent?.parent?.items) return null;
    const { id } = this.parent;
    return this.parent.parent.items.filter(({ system: { containerId } }: CarriedItem) => id === containerId);
  }

  get totalWeight(): number {
    if (!this.contents) return 0;

    return this.contents.reduce(
      (acc, { system: { weight, quantity } }) => acc + Number(weight) * (quantity?.value || 1),
      0,
    );
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
}
