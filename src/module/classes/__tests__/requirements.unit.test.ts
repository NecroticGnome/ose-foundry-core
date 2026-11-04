import { describe, expect, it } from "vitest";
import { boundLabels, parseScoreRequirements, splitScoreRequirements } from "../requirements";

describe("parseScoreRequirements", () => {
  it.each([
    ["Minimum CON 9, minimum DEX 9", { con: { min: 9, max: null }, dex: { min: 9, max: null } }],
    ["Minimum CHA 9", { cha: { min: 9, max: null } }],
    ["Maximum INT 6; minimum str 13", { int: { min: null, max: 6 }, str: { min: 13, max: null } }],
    ["None", {}],
    ["", {}],
  ])("parses %o", (text, expected) => expect(parseScoreRequirements(text)).toEqual(expected));
});

describe("splitScoreRequirements", () => {
  it("drops text fully expressed by the parsed scores", () => {
    expect(splitScoreRequirements("Minimum CON 9, minimum DEX 9")).toEqual({
      scores: { con: { min: 9, max: null }, dex: { min: 9, max: null } },
      text: "",
    });
    expect(splitScoreRequirements("None")).toEqual({ scores: {}, text: "" });
  });
  it("keeps the whole text when part of it is not a score", () => {
    expect(splitScoreRequirements("Minimum CHA 9, must be Lawful")).toEqual({
      scores: { cha: { min: 9, max: null } },
      text: "Minimum CHA 9, must be Lawful",
    });
  });
});

describe("boundLabels", () => {
  const reqs = { str: { min: 9, max: null }, dex: { min: null, max: 17 }, con: { min: 9, max: null } };
  it("labels the scores with the given bound in the given order", () => {
    expect(boundLabels(reqs, "min", ["str", "int", "wis", "dex", "con", "cha"])).toEqual(["STR 9", "CON 9"]);
    expect(boundLabels(reqs, "max", ["str", "int", "wis", "dex", "con", "cha"])).toEqual(["DEX 17"]);
  });
});
