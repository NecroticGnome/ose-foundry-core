/**
 * @file The data model for Items of type Ability
 */
import { chanceInSix } from "../actor/exploration-skills";
import { toKey } from "../classes/matching";
import { type ClassTable, cellTarget, findTargetClass, tableValue } from "../classes/tables";
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
  declare targetFrom: string;
  declare exploration: string;
  declare blindroll: boolean;
  declare description: string;
  declare tags: ItemTag[];

  /** True when `rollTarget` comes from a class table (see `classTarget` flag). */
  rollTargetFromClass = false;

  /** The linked class table column ("table.column") whose current value on a character it rolls against. */
  tablePath = "";

  static defineSchema() {
    const { StringField, NumberField, BooleanField, ArrayField, ObjectField } = foundry.data.fields;
    return {
      save: new StringField(),
      pattern: new StringField(),
      requirements: new StringField(),
      roll: new StringField(),
      rollType: new StringField(),
      rollTarget: new NumberField(),
      // table.column of a class table the target follows on a character, e.g. skills.cs.
      targetFrom: new StringField(),
      // An exploration skill the roll target raises on a character e.g. ld.
      exploration: new StringField(),
      blindroll: new BooleanField(),
      description: new StringField(),
      tags: new ArrayField(new ObjectField()),
    };
  }

  // Abilities linked to a class table cell follow the class's level: the granting class's link first,
  // then the ability's own targetFrom on whichever of the character's classes has that column.
  prepareDerivedData() {
    this.rollTargetFromClass = false;
    this.tablePath = "";
    const link = this.parent?.getFlag?.(game.system.id, "classTarget") as
      | { classKey: string; target: string }
      | undefined;
    const items = (this.parent?.actor?.items ?? []) as {
      type: string;
      system: { key: string; level: number; tables?: ClassTable[] };
    }[];
    const classes = [...items].filter((i) => i.type === "class").map((i) => ({ ...i.system, key: i.system.key }));
    const prefer = (this.requirements ?? "").split(",").map((r) => toKey(r));
    const target = link?.target || this.targetFrom;
    const cls = link
      ? classes.find((c) => c.key === link.classKey)
      : this.targetFrom
        ? findTargetClass(classes, this.targetFrom, prefer)
        : undefined;
    if (!cls || !target) return;
    const value = cellTarget(tableValue(cls.tables ?? [], cls.level, target));
    if (value === null) return;
    this.rollTarget = value;
    this.rollTargetFromClass = true;
    this.tablePath = target;
  }

  /** On a character: its table column's current value, or the exploration skill a 1d6 ≤ ability raises. */
  get effectiveTarget(): number | null {
    const system = this.parent?.actor?.system;
    const [table = "", column = ""] = this.tablePath.split(".");
    const current = system?.tables?.[table]?.[column]?.current;
    if (typeof current === "number") return current;
    const explored = this.exploration && chanceInSix(this) !== null && system?.exploration?.[this.exploration];
    return explored || this.rollTarget;
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
      rollTarget: this.effectiveTarget,
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
