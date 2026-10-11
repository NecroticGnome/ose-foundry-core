/**
 * @file The data model for Items of type Race
 */
import OSE from "../config";
import type { RaceItemData } from "./item-types";

const SCORES = Object.keys(OSE.scores);

// fvtt-types cannot resolve this system's data models; see data-model-ability.ts.
// biome-ignore lint/suspicious/noExplicitAny: see above
export default class OseDataModelRace extends foundry.abstract.TypeDataModel<any, any> implements RaceItemData {
  declare key: string;
  declare description: string;
  declare requirements: Record<string, { min: number | null; max: number | null }>;
  declare languages: string[];
  declare classLimits: { classKey: string; maxLevel: number }[];
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
    const { ArrayField, HTMLField, NumberField, SchemaField, StringField } = foundry.data.fields;
    const bound = () => new NumberField({ integer: true, nullable: true, initial: null });
    const int = (initial: number) => new NumberField({ integer: true, initial });
    return {
      key: new StringField(),
      description: new HTMLField(),
      requirements: new SchemaField(
        Object.fromEntries(SCORES.map((s) => [s, new SchemaField({ min: bound(), max: bound() })])),
      ),
      languages: new ArrayField(new StringField()),
      classLimits: new ArrayField(new SchemaField({ classKey: new StringField(), maxLevel: int(1) })),
      abilities: new ArrayField(new SchemaField({ uuid: new StringField(), level: int(1) })),
    };
  }

  limitFor(classKey: string) {
    return this.classLimits.find((l) => l.classKey === classKey)?.maxLevel ?? null;
  }
}
