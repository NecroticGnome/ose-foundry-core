import { describe, expect, it } from "vitest";
import { mergeLanguages } from "../languages";

describe("mergeLanguages", () => {
  it("appends new languages after the known ones without duplicates", () => {
    expect(mergeLanguages(["Common", "Elvish"], ["Elvish", "Gnoll", "Gnoll"])).toEqual(["Common", "Elvish", "Gnoll"]);
  });
  it("resolves Alignment to the character's alignment when it has one", () => {
    expect(mergeLanguages(["Common"], ["Alignment"], "Lawful")).toEqual(["Common", "Lawful"]);
    expect(mergeLanguages(["Common"], ["Alignment"])).toEqual(["Common", "Alignment"]);
  });
  it("leaves the list alone when nothing is granted", () => {
    expect(mergeLanguages(["Common"], [])).toEqual(["Common"]);
  });
});
