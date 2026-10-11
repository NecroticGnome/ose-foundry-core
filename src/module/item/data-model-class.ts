/**
 * @file The data model for Items of type Class
 */
import { type ClassLevelRow, levelRow, type PrimeReq, SAVE_KEYS } from "../classes/progression";
import type { ClassTable } from "../classes/tables";
import type { ClassItemData } from "./item-types";

// fvtt-types cannot resolve this system's data models; see data-model-ability.ts.
// biome-ignore lint/suspicious/noExplicitAny: see above
export default class OseDataModelClass extends foundry.abstract.TypeDataModel<any, any> implements ClassItemData {
  declare key: string;
  declare description: string;
  declare requirements: string;
  declare primeReqs: PrimeReq[];
  declare maxLevel: number;
  declare hitDie: string;
  declare spellList: string;
  declare languages: string[];
  declare titles: string[];
  declare levels: ClassLevelRow[];
  declare tables: ClassTable[];
  declare abilities: { uuid: string; level: number }[];
  declare armour: string[];
  declare armourText: string;
  declare weapons: string[];
  declare weaponsText: string;
  declare stealthSkills: string[];
  declare demihuman: boolean;
  declare level: number;
  declare xp: number;
  declare xpBonusOverride: number | null;

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
    const { ArrayField, BooleanField, HTMLField, NumberField, ObjectField, SchemaField, StringField } =
      foundry.data.fields;
    const int = (initial = 0) => new NumberField({ integer: true, initial });
    return {
      key: new StringField(),
      description: new HTMLField(),
      requirements: new StringField(),
      primeReqs: new ArrayField(
        new SchemaField({
          ability: new StringField(),
          minScore: int(),
          percentage: int(),
          concatLogic: new StringField({ initial: "and" }),
          group: new StringField(),
        }),
      ),
      maxLevel: int(14),
      hitDie: new StringField({ initial: "1d6" }),
      spellList: new StringField(),
      languages: new ArrayField(new StringField()),
      titles: new ArrayField(new StringField()),
      levels: new ArrayField(
        new SchemaField({
          xp: int(),
          hd: new StringField(),
          hdcon: new BooleanField({ initial: true }),
          thac0: int(19),
          bba: int(0),
          saves: new SchemaField(Object.fromEntries(SAVE_KEYS.map((k) => [k, int(15)]))),
          spellSlots: new ObjectField(),
        }),
      ),
      tables: new ArrayField(
        new SchemaField({
          key: new StringField(),
          label: new StringField(),
          columns: new ArrayField(new SchemaField({ key: new StringField(), name: new StringField() })),
          legend: new ArrayField(new SchemaField({ value: new StringField(), text: new StringField() })),
          rows: new ArrayField(new ObjectField()),
        }),
      ),
      abilities: new ArrayField(new SchemaField({ uuid: new StringField(), level: int(1), target: new StringField() })),
      armour: new ArrayField(new StringField()),
      armourText: new StringField(),
      weapons: new ArrayField(new StringField()),
      weaponsText: new StringField(),
      stealthSkills: new ArrayField(new StringField()),
      // Race and class in one (e.g. Elf); a race item alongside it is warned about.
      demihuman: new BooleanField(),
      level: int(1),
      xp: int(0),
      xpBonusOverride: new NumberField({ integer: true, nullable: true, initial: null }),
    };
  }

  get hasTable() {
    return this.levels.length > 0;
  }

  get currentRow() {
    return levelRow(this.levels, this.level);
  }

  get nextRow() {
    return this.levels[this.level] ?? null;
  }

  get canLevelUp() {
    const next = this.nextRow;
    return !!next && this.xp >= next.xp;
  }

  get title() {
    if (!this.titles.length) return "";
    return this.titles[Math.min(Math.max(this.level, 1), this.titles.length) - 1] ?? "";
  }
}
