import { describe, expect, it } from "vitest";
import { chanceInSix, raiseFromAbilities } from "../exploration-skills";

const ability = (name: string, exploration: string, rollTarget: number | null, roll = "1d6", rollType = "below") => ({
  name,
  type: "ability",
  system: { exploration, rollTarget, roll, rollType },
});

describe("chanceInSix", () => {
  it("is the target of a 1d6 roll at or under", () => {
    expect(chanceInSix({ roll: "1d6", rollType: "below", rollTarget: 2 })).toBe(2);
  });

  it("is null for other dice, other directions or no target", () => {
    expect(chanceInSix({ roll: "1d6", rollType: "above", rollTarget: 5 })).toBeNull();
    expect(chanceInSix({ roll: "1d100", rollType: "below", rollTarget: 30 })).toBeNull();
    expect(chanceInSix({ roll: "1d20", rollType: "above", rollTarget: 15 })).toBeNull();
    expect(chanceInSix({ roll: "1d6", rollType: "result", rollTarget: 1 })).toBeNull();
    expect(chanceInSix({ roll: "1d6", rollType: "below", rollTarget: null })).toBeNull();
  });
});

describe("raiseFromAbilities", () => {
  it("raises a skill to a flagged ability's target", () => {
    const exploration = { ld: 1, sd: 1 };
    const from = raiseFromAbilities(exploration, [ability("Listening at Doors", "ld", 2)]);
    expect(exploration).toEqual({ ld: 2, sd: 1 });
    expect(from).toEqual({ ld: "Listening at Doors" });
  });

  it("keeps a higher stored value", () => {
    const exploration = { ld: 3 };
    expect(raiseFromAbilities(exploration, [ability("Listening at Doors", "ld", 2)])).toEqual({});
    expect(exploration.ld).toBe(3);
  });

  it("takes the highest of several abilities", () => {
    const exploration = { ld: 1 };
    const from = raiseFromAbilities(exploration, [
      ability("Listening at Doors", "ld", 2),
      ability("Hear Noise", "ld", 3),
    ]);
    expect(exploration.ld).toBe(3);
    expect(from).toEqual({ ld: "Hear Noise" });
  });

  it("ignores abilities that don't roll 1d6 at or under", () => {
    const exploration = { ld: 1 };
    raiseFromAbilities(exploration, [
      ability("Keen Ears", "ld", 4, "1d6", "above"),
      ability("Hear Noise", "ld", 30, "1d100"),
    ]);
    expect(exploration.ld).toBe(1);
  });

  it("ignores unflagged abilities, other items and unknown skills", () => {
    const exploration = { ld: 1 };
    raiseFromAbilities(exploration, [
      ability("Infravision", "", 5),
      ability("Odd", "xx", 5),
      { name: "Rope", type: "item", system: { exploration: "ld", rollTarget: 5 } },
    ]);
    expect(exploration.ld).toBe(1);
  });
});
