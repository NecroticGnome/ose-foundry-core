/**
 * @file The data model for Items of type Spell
 */
import type { Save } from "../config";
import OseTags from "../helpers-tags";
import type { DisplayTag, ItemTag, SpellItemData } from "./item-types";

// fvtt-types cannot resolve this system's data models, so a precise Parent forces
// casts here and full Item stubs in tests. Revisit if they are ever registered.
// biome-ignore lint/suspicious/noExplicitAny: see above
export default class OseDataModelSpell extends foundry.abstract.TypeDataModel<any, any> implements SpellItemData {
  declare save: Save | "";
  declare lvl: number | null;
  declare class: string;
  declare duration: string;
  declare range: string;
  declare roll: string;
  declare memorized: number | null;
  declare cast: number | null;
  declare description: string;
  declare tags: ItemTag[];

  static defineSchema() {
    const { StringField, NumberField, ArrayField, ObjectField } = foundry.data.fields;
    return {
      save: new StringField(),
      lvl: new NumberField({ integer: true, min: 0 }),
      class: new StringField(),
      duration: new StringField(),
      range: new StringField(),
      roll: new StringField(),
      memorized: new NumberField({ min: 0 }),
      cast: new NumberField({ min: 0 }),
      description: new StringField(),
      tags: new ArrayField(new ObjectField()),
    };
  }

  get #rollTag(): DisplayTag | null {
    if (!this.roll) return null;

    const rollLabel = game.i18n.localize("OSE.items.Roll");

    const rollFormula = OseTags.rollTagFormula({
      actor: this.parent?.actor,
      data: this._source,
    });

    return {
      label: `${rollLabel} ${rollFormula}`,
    };
  }

  get #saveTag(): DisplayTag | null {
    if (!this.save) return null;

    return {
      label: CONFIG.OSE.saves_long[this.save],
      icon: "fa-skull",
    };
  }

  get manualTags(): ItemTag[] {
    return this.tags || [];
  }

  get autoTags(): DisplayTag[] {
    return [
      { label: this.class ?? "" },
      { label: this.range ?? "" },
      { label: this.duration ?? "" },
      this.#rollTag,
      this.#saveTag,
    ].filter((t) => !!t);
  }
}
