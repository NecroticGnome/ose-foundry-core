import { describe, expect, it } from "vitest";
import { planTweakMigration, tweakFields } from "../tweaks";

const character = (over: Record<string, unknown> = {}) => ({
  type: "character",
  hasClasses: false,
  source: {
    initiative: { mod: 0 },
    thac0: { mod: { melee: 0, missile: 0 } },
    ac: { mod: 0 },
    aac: { mod: 0 },
    details: { magic: { bonus: 0 }, xp: { bonus: 0 } },
    ...over,
  },
  tweakEffects: [] as string[],
});

describe("tweakFields", () => {
  it("gives monsters only the initiative bonus", () => {
    expect(tweakFields("monster").map((t) => t.id)).toEqual(["initiative"]);
    expect(tweakFields("character").map((t) => t.id)).toEqual(["initiative", "melee", "missile", "ac", "magic", "xp"]);
  });
});

describe("planTweakMigration", () => {
  it("moves non-zero modifiers into effects and zeroes the fields", () => {
    const plan = planTweakMigration(character({ initiative: { mod: 1 }, ac: { mod: 2 }, aac: { mod: 2 } }));
    expect(plan.effects).toEqual([
      { id: "initiative", path: "system.initiative.mod", value: 1 },
      { id: "ac", path: "system.ac.mod", value: 2 },
    ]);
    expect(plan.update).toEqual({ "system.initiative.mod": 0, "system.ac.mod": 0, "system.aac.mod": 0 });
  });

  it("does nothing when every modifier is 0", () => {
    expect(planTweakMigration(character())).toEqual({ effects: [], update: {} });
  });

  it("leaves the XP bonus to the class items when there are any", () => {
    const actor = { ...character({ details: { magic: { bonus: 0 }, xp: { bonus: 10 } } }), hasClasses: true };
    expect(planTweakMigration(actor)).toEqual({ effects: [], update: {} });
  });

  it("leaves the XP bonus as the prime requisite of a free-text class", () => {
    const actor = character({ details: { class: "Fighter", magic: { bonus: 0 }, xp: { bonus: 10 } } });
    expect(planTweakMigration(actor)).toEqual({ effects: [], update: {} });
  });

  it("moves the XP bonus of a character with no class", () => {
    const actor = character({ details: { class: "", magic: { bonus: 0 }, xp: { bonus: 5 } } });
    expect(planTweakMigration(actor).effects).toEqual([{ id: "xp", path: "system.details.xp.bonus", value: 5 }]);
  });

  it("skips a modifier that already has its effect", () => {
    const actor = { ...character({ initiative: { mod: 1 } }), tweakEffects: ["initiative"] };
    expect(planTweakMigration(actor)).toEqual({ effects: [], update: {} });
  });
});
