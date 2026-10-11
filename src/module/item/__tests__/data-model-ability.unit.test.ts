import { describe, expect, it } from "vitest";
import OseDataModelAbility from "../data-model-ability";

describe("OseDataModelAbility", () => {
  describe("schema defaults", () => {
    it("initializes fields from defineSchema", () => {
      const ability = new OseDataModelAbility();

      expect(ability.save).toBe("");
      expect(ability.pattern).toBe("");
      expect(ability.requirements).toBe("");
      expect(ability.roll).toBe("");
      expect(ability.rollType).toBe("");
      expect(ability.rollTarget).toBeNull();
      expect(ability.blindroll).toBe(false);
      expect(ability.description).toBe("");
      expect(ability.tags).toEqual([]);
    });
  });

  describe("manualTags", () => {
    it("returns stored tags unchanged, with no label added", () => {
      const ability = new OseDataModelAbility({ tags: [{ title: "title", value: "value" }] });

      expect(ability.manualTags).toEqual([{ title: "title", value: "value" }]);
    });

    it("returns an empty array by default", () => {
      expect(new OseDataModelAbility().manualTags).toEqual([]);
    });

    it("returns an empty array rather than null when tags is absent", () => {
      const ability = new OseDataModelAbility();
      ability.tags = undefined as never;

      expect(ability.manualTags).toEqual([]);
    });
  });

  describe("autoTags", () => {
    it("still yields one empty tag by default, since ''.split(',') is ['']", () => {
      expect(new OseDataModelAbility().autoTags).toEqual([{ label: "" }]);
    });

    it("splits requirements on commas into one tag each", () => {
      const ability = new OseDataModelAbility({ requirements: "magic-user,slow" });

      expect(ability.autoTags).toEqual([{ label: "magic-user" }, { label: "slow" }]);
    });

    it("trims whitespace around each requirement", () => {
      const ability = new OseDataModelAbility({ requirements: " magic-user , slow " });

      expect(ability.autoTags).toEqual([{ label: "magic-user" }, { label: "slow" }]);
    });

    it("appends a save tag with a skull icon", () => {
      const ability = new OseDataModelAbility({ save: "death" });

      expect(ability.autoTags).toEqual([{ label: "" }, { label: CONFIG.OSE.saves_long.death, icon: "fa-skull" }]);
    });

    it("appends a roll tag carrying the formula and the roll target", () => {
      const ability = new OseDataModelAbility({ roll: "1d20+1", rollType: "result", rollTarget: 15 });

      expect(ability.autoTags).toEqual([{ label: "" }, { label: "OSE.items.Roll 1d20+1 =15" }]);
    });

    it("orders requirements, then roll, then save", () => {
      const ability = new OseDataModelAbility({ requirements: "cleric", roll: "1d6", save: "death" });

      expect(ability.autoTags).toHaveLength(3);
      expect(ability.autoTags[0]).toEqual({ label: "cleric" });
      expect(ability.autoTags[1]?.label).toContain("1d6");
      expect(ability.autoTags[2]).toEqual({ label: CONFIG.OSE.saves_long.death, icon: "fa-skull" });
    });
  });
});

describe("roll target from a class table", () => {
  const thief = {
    type: "class",
    system: {
      key: "thief",
      level: 2,
      tables: [
        { key: "skills", label: "Skills", columns: [{ key: "hs", label: "HS" }], rows: [{ hs: 10 }, { hs: 15 }] },
      ],
    },
  };
  const parentWith = (flag: unknown, items: unknown[] = [thief]) => ({
    getFlag: () => flag,
    actor: { items },
  });

  it("uses the linked cell for the class's level", () => {
    const ability = new OseDataModelAbility(
      { rollTarget: 3 },
      { parent: parentWith({ classKey: "thief", target: "skills.hs" }) },
    );
    ability.prepareDerivedData();
    expect(ability.rollTarget).toBe(15);
    expect(ability.rollTargetFromClass).toBe(true);
  });

  it("keeps its own target without a link, class or numeric cell", () => {
    for (const parent of [
      parentWith(undefined),
      parentWith({ classKey: "thief", target: "skills.hs" }, []),
      parentWith({ classKey: "thief", target: "skills.zz" }),
    ]) {
      const ability = new OseDataModelAbility({ rollTarget: 3 }, { parent });
      ability.prepareDerivedData();
      expect(ability.rollTarget).toBe(3);
      expect(ability.rollTargetFromClass).toBe(false);
    }
  });

  it("follows its own table link on a character whose class has the column", () => {
    const ability = new OseDataModelAbility(
      { rollTarget: 3, targetFrom: "skills.hs" },
      { parent: parentWith(undefined) },
    );
    ability.prepareDerivedData();
    expect(ability.rollTarget).toBe(15);
    expect(ability.rollTargetFromClass).toBe(true);
  });

  it("prefers the class's own link over the ability's", () => {
    const tables = [
      {
        key: "skills",
        label: "Skills",
        columns: [{ key: "hs" }, { key: "ms" }],
        rows: [
          { hs: 10, ms: 30 },
          { hs: 15, ms: 35 },
        ],
      },
    ];
    const cls = { type: "class", system: { key: "thief", level: 2, tables } };
    const ability = new OseDataModelAbility(
      { rollTarget: 3, targetFrom: "skills.hs" },
      { parent: parentWith({ classKey: "thief", target: "skills.ms" }, [cls]) },
    );
    ability.prepareDerivedData();
    expect(ability.rollTarget).toBe(35);
  });
});
