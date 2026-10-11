/**
 * @file Converts bundled Classic Fantasy class tables into class item data.
 */
import type { ClassicClassName, OseClass } from "../../types/classes";
import type { ClassItemData } from "../item/item-types";
import { toKey } from "./matching";
import { type ClassLevelRow, defaultPrimeReqs, SAVE_KEYS, type SaveKey } from "./progression";

export const CLASSIC_PRIME_REQS: Record<ClassicClassName, string[]> = {
  Cleric: ["wis"],
  Dwarf: ["str"],
  Elf: ["int", "str"],
  Fighter: ["str"],
  Halfling: ["dex", "str"],
  "Magic-User": ["int"],
  Thief: ["dex"],
};

// Classes casting from another class's list.
const SPELL_LISTS: Record<string, string> = { Elf: "Magic-User" };

// Usually game.i18n.format; injectable for tests.
type Translate = (key: string, data?: Record<string, string>) => string;

export const classicClassToItemData = (cls: OseClass, primeReqAbilities: string[], t: Translate = (key) => key) => {
  const levels: ClassLevelRow[] = cls.levels.map((l) => ({
    xp: l.xp,
    hd: l.hd,
    hdcon: !/\+/.test(l.hd),
    thac0: l.thac0,
    bba: 19 - l.thac0,
    saves: Object.fromEntries(SAVE_KEYS.map((k, i) => [k, l.saves[i] ?? 0])) as Record<SaveKey, number>,
    spellSlots: Object.fromEntries(
      (l.spells ?? []).flatMap((n, i) => (n ? [[String(i + 1), n] as [string, number]] : [])),
    ),
  }));
  const system: Partial<ClassItemData> = {
    key: toKey(cls.name),
    requirements: Object.entries(cls.requirements)
      .map(([k, v], i) => `${i ? "minimum" : "Minimum"} ${k.toUpperCase()} ${v}`)
      .join(", "),
    demihuman: ["Dwarf", "Elf", "Halfling"].includes(cls.name),
    primeReqs: defaultPrimeReqs(primeReqAbilities),
    maxLevel: levels.length,
    spellList: SPELL_LISTS[cls.name] ?? "",
    tables: cls.skillChecks?.length
      ? [
          {
            key: "skills",
            label: t("OSE.classes.skills.Table", { cls: cls.name }),
            columns: Object.keys(cls.skillChecks[0] ?? {}).map((key) => ({
              key,
              name: t(`OSE.classes.skills.${key}Name`),
            })),
            rows: cls.skillChecks.map((r) => ({ ...r })),
          },
        ]
      : [],
    hitDie: `1${/d\d+/.exec(cls.levels[0]?.hd ?? "")?.[0] ?? "d6"}`,
    levels,
  };
  return { name: cls.name, type: "class" as const, system };
};
