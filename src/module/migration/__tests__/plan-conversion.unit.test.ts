import { describe, expect, it } from "vitest";
import { CLASSIC_FANTASY_CLASSES } from "../../classes/classic-fantasy-classes";
import { CLASSIC_PRIME_REQS, classicClassToItemData } from "../../classes/classic-to-item";
import { adjustmentRows, planConversion, readSource } from "../plan-conversion";

const fighter = () => classicClassToItemData(CLASSIC_FANTASY_CLASSES.Fighter, CLASSIC_PRIME_REQS.Fighter);

// A level 4 Fighter exactly as the table has it.
const source = (over: Record<string, unknown> = {}) => ({
  details: { class: "Fighter", level: 4, xp: { value: 9000, bonus: 0, next: 16000 } },
  scores: {
    str: { value: 10 },
    int: { value: 10 },
    wis: { value: 10 },
    dex: { value: 10 },
    con: { value: 10 },
    cha: { value: 10 },
  },
  saves: {
    death: { value: 10 },
    wand: { value: 11 },
    paralysis: { value: 12 },
    breath: { value: 13 },
    spell: { value: 14 },
  },
  thac0: { value: 17, bba: 2 },
  spells: { 0: { max: 0 }, 1: { max: 0 } },
  hp: { hd: "4d8", value: 20, max: 20 },
  ...over,
});

describe("readSource", () => {
  it("reads the typed class and progress", () => {
    expect(readSource(source())).toMatchObject({ text: "Fighter", level: 4, xp: 9000, bonus: 0 });
  });
  it("defaults blank data", () => {
    expect(readSource({})).toMatchObject({ text: "", level: 1, xp: 0, bonus: 0 });
  });
});

describe("planConversion", () => {
  it("does nothing without a class name", () => {
    expect(planConversion(readSource(source({ details: { class: "  " } })), null)).toEqual({ status: "none" });
  });

  it("embeds a matched class with no adjustments when values match the table", () => {
    const plan = planConversion(readSource(source()), fighter());
    expect(plan.status).toBe("matched");
    expect(plan.item?.system).toMatchObject({ level: 4, xp: 9000, xpBonusOverride: null });
    expect(plan.changes).toEqual([]);
  });

  it("ignores saves never filled in", () => {
    const zero = { value: 0 };
    const s = source({ saves: { death: zero, wand: zero, paralysis: zero, breath: zero, spell: zero } });
    expect(planConversion(readSource(s), fighter()).changes).toEqual([]);
  });

  it("ignores the default hit dice", () => {
    const s = source({ hp: { hd: "1d8" } });
    expect(planConversion(readSource(s), fighter()).changes).toEqual([]);
  });

  it("ignores spell slots while spells are disabled", () => {
    const cleric = classicClassToItemData(CLASSIC_FANTASY_CLASSES.Cleric, CLASSIC_PRIME_REQS.Cleric);
    const s = source({ details: { class: "Cleric", level: 2 }, saves: {}, thac0: {}, hp: {} });
    expect(planConversion(readSource(s), cleric).changes).toEqual([]);
    const enabled = source({ ...s, spells: { ...s.spells, enabled: true } });
    expect(planConversion(readSource(enabled), cleric).changes).toEqual([
      { key: "system.spells.1.max", type: "add", value: -1 },
    ]);
  });

  it("records differences from the table as changes", () => {
    const s = source({ saves: { ...source().saves, death: { value: 8 } }, hp: { hd: "4d8+1" } });
    expect(planConversion(readSource(s), fighter()).changes).toEqual([
      { key: "system.saves.death.value", type: "add", value: -2 },
      { key: "system.hp.hd", type: "override", value: "4d8+1" },
    ]);
  });

  it("leaves the class to work out its XP bonus and returns any difference from the typed one", () => {
    const strong = { ...source().scores, str: { value: 16 } };
    const same = planConversion(
      readSource(source({ scores: strong, details: { class: "Fighter", level: 4, xp: { value: 0, bonus: 10 } } })),
      fighter(),
    );
    expect([same.item?.system.xpBonusOverride, same.xpBonus]).toEqual([null, 0]);
    const differs = planConversion(
      readSource(source({ scores: strong, details: { class: "Fighter", level: 4, xp: { value: 0, bonus: 5 } } })),
      fighter(),
    );
    expect([differs.item?.system.xpBonusOverride, differs.xpBonus]).toEqual([null, -5]);
  });

  it("flags levels beyond the table for review", () => {
    const plan = planConversion(
      readSource(source({ details: { class: "Fighter", level: 20, xp: { value: 0 } } })),
      fighter(),
    );
    expect(plan.status).toBe("review");
    expect(plan.note).toBe("levelBeyondTable");
  });

  it("creates a custom class for unmatched text", () => {
    const plan = planConversion(
      readSource(source({ details: { class: "Knight", level: 3, xp: { value: 5, bonus: 5 } } })),
      null,
    );
    expect(plan.status).toBe("custom");
    expect(plan.item).toEqual({ name: "Knight", type: "class", system: { level: 3, xp: 5, xpBonusOverride: null } });
    expect(plan.xpBonus).toBe(5);
    expect(plan.changes).toEqual([]);
  });

  it("reviews combined or multi-word text", () => {
    expect(planConversion(readSource(source({ details: { class: "Fighter/Thief" } })), null).status).toBe("review");
    expect(planConversion(readSource(source({ details: { class: "Elf Fighter" } })), null).status).toBe("review");
  });
});

describe("adjustmentRows", () => {
  it("lists kept differences with signed values, skipping the attack bonus mirror of THAC0", () => {
    expect(
      adjustmentRows([
        { key: "system.saves.death.value", type: "add", value: 1 },
        { key: "system.thac0.value", type: "add", value: -2 },
        { key: "system.thac0.bba", type: "add", value: 2 },
        { key: "system.spells.1.max", type: "add", value: 1 },
        { key: "system.hp.hd", type: "override", value: "1d6" },
      ]),
    ).toEqual([
      { key: "saves.death", value: "+1" },
      { key: "thac0", value: "-2" },
      { key: "spells.1", value: "+1" },
      { key: "hd", value: "1d6" },
    ]);
  });
});
