/**
 * @file The data model for Items of type Race
 */
import { SAVE_KEYS } from "../classes/progression";
import type { RaceSaveBonus } from "../classes/race-saves";
import type { ScoreRequirements } from "../classes/requirements";
import OSE from "../config";
import type { ClassAccess, ClassLimit, RaceItemData } from "./item-types";

const SCORES = Object.keys(OSE.scores);

// fvtt-types cannot resolve this system's data models; see data-model-ability.ts.
// biome-ignore lint/suspicious/noExplicitAny: see above
export default class OseDataModelRace extends foundry.abstract.TypeDataModel<any, any> implements RaceItemData {
  declare key: string;
  declare description: string;
  declare requirements: ScoreRequirements;
  declare languages: string[];
  declare classLimits: ClassLimit[];
  declare infravision: number | null;
  declare saveBonuses: RaceSaveBonus[];
  declare abilities: { uuid: string; level: number }[];

  // Languages were comma-separated text before 3.1.0.
  static migrateData(source: Record<string, unknown>) {
    if (typeof source.languages === "string") {
      source.languages = source.languages
        .split(",")
        .map((l) => l.trim())
        .filter(Boolean);
    }
    return source;
  }

  static defineSchema() {
    const { ArrayField, BooleanField, HTMLField, NumberField, SchemaField, StringField } = foundry.data.fields;
    const bound = () => new NumberField({ integer: true, nullable: true, initial: null });
    const int = (initial: number) => new NumberField({ integer: true, initial });
    return {
      key: new StringField(),
      description: new HTMLField(),
      requirements: new SchemaField(
        Object.fromEntries(SCORES.map((s) => [s, new SchemaField({ min: bound(), max: bound() })])),
      ),
      languages: new ArrayField(new StringField()),
      classLimits: new ArrayField(
        new SchemaField({ classKey: new StringField(), maxLevel: int(1), npcOnly: new BooleanField() }),
      ),
      infravision: new NumberField({ integer: true, nullable: true, initial: null, min: 0 }),
      saveBonuses: new ArrayField(
        new SchemaField({
          saves: new ArrayField(new StringField({ choices: SAVE_KEYS })),
          bonus: bound(),
          against: new StringField(),
        }),
      ),
      abilities: new ArrayField(new SchemaField({ uuid: new StringField(), level: int(1) })),
    };
  }

  classAccess(classKey: string): ClassAccess {
    if (!this.classLimits.length) return { allowed: true, maxLevel: null, npcOnly: false };
    const limit = this.classLimits.find((l) => l.classKey === classKey);
    return limit ? { allowed: true, maxLevel: limit.maxLevel, npcOnly: limit.npcOnly } : { allowed: false };
  }
}
