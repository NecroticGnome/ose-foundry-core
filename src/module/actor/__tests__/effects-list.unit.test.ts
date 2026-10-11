import { describe, expect, it } from "vitest";
import { durationText, type EffectRow, groupEffects } from "../effects-list";

const row = (over: Partial<EffectRow>): EffectRow => ({
  uuid: "u",
  name: "Effect",
  img: "",
  disabled: false,
  temporary: false,
  source: null,
  duration: "",
  ...over,
});

describe("groupEffects", () => {
  it("splits into temporary, passive and inactive, keeping every group", () => {
    const groups = groupEffects([
      row({ uuid: "t", temporary: true }),
      row({ uuid: "p" }),
      row({ uuid: "d", disabled: true, temporary: true }),
    ]);
    expect(groups.map((g) => [g.key, g.effects.map((e) => e.uuid)])).toEqual([
      ["temporary", ["t"]],
      ["passive", ["p"]],
      ["inactive", ["d"]],
    ]);
    expect(groupEffects([]).map((g) => g.effects.length)).toEqual([0, 0, 0]);
  });

  it("sorts by name within a group", () => {
    const [, passive] = groupEffects([row({ name: "Zeal" }), row({ name: "Aura" })]);
    expect(passive.effects.map((e) => e.name)).toEqual(["Aura", "Zeal"]);
  });
});

describe("durationText", () => {
  const t = (k: string) =>
    ({
      "COMBAT.Rounds": "Rounds",
      "COMBAT.Turns": "Turns",
      "EFFECT.DURATION.UNITS.minutes": "Minutes",
      "COMMON.None": "None",
    })[k] ?? k;
  it.each([
    [{ remaining: 2, label: "2 Rounds" }, "2 Rounds"], // running in combat
    [{ value: 3, units: "rounds", remaining: null, label: "None" }, "3 Rounds"], // v14 out of combat
    [{ value: 3, units: "rounds", remaining: Number.NaN, label: "None" }, "3 Rounds"], // v14 sets NaN
    [{ rounds: 3, label: "3 Rounds" }, "3 Rounds"], // v13
    [{ rounds: 3, type: "turns" }, "3 Rounds"], // v13 out of combat: no label
    [{ turns: 2, type: "turns" }, "2 Turns"],
    [{ value: 10, units: "minutes", remaining: Number.NaN, label: "None" }, "10 Minutes"],
    [{ value: Number.POSITIVE_INFINITY, units: "seconds", remaining: Number.NaN, label: "None" }, ""], // permanent
    [{ label: "None" }, ""],
    [{}, ""],
  ])("%o → %o", (duration, expected) => expect(durationText(duration, t)).toBe(expected));
});
