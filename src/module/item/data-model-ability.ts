/**
 * @file The data model for Items of type Ability
 */
import type { RollType, Save } from "../config";
import OseTags from "../helpers-tags";
import type { AbilityItemData, DisplayTag, ItemTag } from "./item-types";

// fvtt-types cannot resolve this system's data models, so a precise Parent forces
// casts here and full Item stubs in tests. Revisit if they are ever registered.
// biome-ignore lint/suspicious/noExplicitAny: see above
export default class OseDataModelAbility extends foundry.abstract.TypeDataModel<any, any> implements AbilityItemData {
  declare save: Save | "";
  declare pattern: string;
  declare requirements: string;
  declare roll: string;
  declare rollType: RollType | "";
  declare rollTarget: number | null;
  declare blindroll: boolean;
  declare description: string;
  declare tags: ItemTag[];

  static defineSchema() {
    const { StringField, NumberField, BooleanField, ArrayField, ObjectField } = foundry.data.fields;
    return {
      save: new StringField(),
      pattern: new StringField(),
      requirements: new StringField(),
      roll: new StringField(),
      rollType: new StringField(),
      rollTarget: new NumberField(),
      blindroll: new BooleanField(),
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

    const rollTarget = OseTags.rollTagTarget({
      rollType: this.rollType,
      rollTarget: this.rollTarget,
    });

    return {
      label: `${rollLabel} ${rollFormula}${rollTarget}`,
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
      ...(this.requirements?.split(",").map((req) => ({ label: req.trim() })) || []),
      this.#rollTag,
      this.#saveTag,
    ].filter((t) => !!t);
  }
}
