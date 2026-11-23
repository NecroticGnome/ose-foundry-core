import { describe, expect, it } from "vitest";
import { deriveFromClasses } from "../derive";
import { applyAdvancedHd } from "../hit-dice";
import type { ClassLevelRow } from "../progression";

describe("applyAdvancedHd", () => {
  it("swaps the die size when the rule is on", () => {
    expect(applyAdvancedHd("1d8", "1d10", true)).toBe("1d10");
    expect(applyAdvancedHd("3d8", "1d10", true)).toBe("3d10");
    expect(applyAdvancedHd("9d8+3", "1d10", true)).toBe("9d10+3");
  });
  it("keeps the default die when the rule is off", () => {
    expect(applyAdvancedHd("3d8", "1d10", false)).toBe("3d8");
  });
  it("keeps the default die when the class has no advanced die", () => {
    expect(applyAdvancedHd("3d8", "", true)).toBe("3d8");
    expect(applyAdvancedHd("3d8", undefined, true)).toBe("3d8");
  });
});

describe("deriveFromClasses with advanced hit dice", () => {
  const row = (hd: string): ClassLevelRow => ({
    xp: 0,
    hd,
    hdcon: true,
    thac0: 19,
    bba: 0,
    saves: { death: 12, wand: 13, paralysis: 14, breath: 15, spell: 16 },
    spellSlots: {},
  });
  const fighter = {
    name: "Fighter",
    system: { levels: [row("1d8"), row("2d8")], level: 2, xp: 0, hitDie: "1d8", advancedHitDie: "1d10" },
  };
  const custom = { name: "Custom", system: { levels: [row("1d6"), row("2d6")], level: 2, xp: 0, hitDie: "1d6" } };
  it("uses the advanced die per class only when on", () => {
    expect(deriveFromClasses([fighter, custom])?.hd).toBe("2d8 / 2d6");
    expect(deriveFromClasses([fighter, custom], true)?.hd).toBe("2d10 / 2d6");
  });
});
