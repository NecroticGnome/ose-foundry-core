import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { effectKeys } from "../effect-keys";

const en = JSON.parse(fs.readFileSync("src/lang/en.json", "utf8"));
const keys = (type: "character" | "monster") => effectKeys(type).map((k) => k.key);

describe("effectKeys", () => {
  it("offers characters their score, AC modifier, exploration and XP inputs", () => {
    expect(keys("character")).toEqual(
      expect.arrayContaining([
        "system.scores.str.value",
        "system.ac.mod",
        "system.exploration.od",
        "system.details.xp.bonus",
        "system.encumbrance.max",
        "system.spells.1.max",
      ]),
    );
  });

  it("offers monsters their stored AC and none of the character-only inputs", () => {
    const monster = keys("monster");
    expect(monster).toEqual(expect.arrayContaining(["system.ac.value", "system.details.morale", "system.hp.max"]));
    expect(monster.some((k) => /scores|exploration|ac\.mod|details\.xp\.bonus/.test(k))).toBe(false);
  });

  it("never offers derived fields an effect can't change", () => {
    for (const type of ["character", "monster"] as const) {
      expect(keys(type).some((k) => /\.mod$/.test(k) && k.includes("scores"))).toBe(false);
      expect(keys(type)).not.toContain("system.movement.encounter");
    }
  });

  it("lists each key once, with a label in en.json", () => {
    for (const type of ["character", "monster"] as const) {
      const list = effectKeys(type);
      expect(new Set(list.map((k) => k.key)).size).toBe(list.length);
      for (const { label } of list) expect(en, label).toHaveProperty([label]);
    }
  });
});
