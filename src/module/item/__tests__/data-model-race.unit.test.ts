import { describe, expect, it } from "vitest";
import OseDataModelRace from "../data-model-race";

describe("OseDataModelRace", () => {
  it("keeps languages as a list, reading older comma-separated text", () => {
    expect(new OseDataModelRace({ languages: "Common, Gnomish" }).languages).toEqual(["Common", "Gnomish"]);
  });

  it("defaults to no limits", () => {
    const r = new OseDataModelRace();
    expect(r.classLimits).toEqual([]);
    expect(r.abilities).toEqual([]);
  });
  it("looks up a class limit by key", () => {
    const r = new OseDataModelRace({ classLimits: [{ classKey: "fighter", maxLevel: 9 }] });
    expect(r.limitFor("fighter")).toBe(9);
    expect(r.limitFor("thief")).toBeNull();
  });
});
