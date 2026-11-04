import { describe, expect, it } from "vitest";
import OseDataModelRace from "../data-model-race";

describe("OseDataModelRace", () => {
  it("keeps languages as a list, reading older comma-separated text", () => {
    expect(new OseDataModelRace({ languages: "Common, Gnomish" }).languages).toEqual(["Common", "Gnomish"]);
  });

  it("defaults to no limits, no infravision and no save bonuses", () => {
    const r = new OseDataModelRace();
    expect(r.classLimits).toEqual([]);
    expect(r.abilities).toEqual([]);
    expect(r.infravision).toBeNull();
    expect(r.saveBonuses).toEqual([]);
  });
  it("opens every class without limit when none are listed", () => {
    expect(new OseDataModelRace().classAccess("thief")).toEqual({ allowed: true, maxLevel: null, npcOnly: false });
  });
  it("limits listed classes and refuses unlisted ones", () => {
    const r = new OseDataModelRace({
      classLimits: [
        { classKey: "fighter", maxLevel: 9, npcOnly: false },
        { classKey: "cleric", maxLevel: 7, npcOnly: true },
      ],
    });
    expect(r.classAccess("fighter")).toEqual({ allowed: true, maxLevel: 9, npcOnly: false });
    expect(r.classAccess("cleric")).toEqual({ allowed: true, maxLevel: 7, npcOnly: true });
    expect(r.classAccess("thief")).toEqual({ allowed: false });
  });
});
