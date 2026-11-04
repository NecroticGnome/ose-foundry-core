import { describe, expect, it } from "vitest";
import { appliesToSave, raceSaveBonus, totalRaceSaveBonus } from "../race-saves";

const resilience = { saves: ["death", "wand", "spell"] as const, bonus: null, against: "" };
const illusions = { saves: [], bonus: 2, against: "illusions" };

describe("raceSaveBonus", () => {
  it.each([
    [3, 0],
    [6, 0],
    [7, 2],
    [10, 2],
    [11, 3],
    [14, 3],
    [15, 4],
    [17, 4],
    [18, 5],
  ])("scales Resilience by CON %i → +%i", (con, bonus) => {
    expect(raceSaveBonus({ ...resilience, saves: [...resilience.saves] }, con)).toBe(bonus);
  });
  it("gives no Resilience bonus without a Constitution score", () => {
    expect(raceSaveBonus({ ...resilience, saves: [...resilience.saves] }, null)).toBe(0);
  });
  it("uses a fixed bonus regardless of CON", () => {
    expect(raceSaveBonus(illusions, 3)).toBe(2);
  });
});

describe("appliesToSave", () => {
  it("applies to the listed saves, or every save when none are listed", () => {
    const entry = { ...resilience, saves: [...resilience.saves] };
    expect(appliesToSave(entry, "spell")).toBe(true);
    expect(appliesToSave(entry, "breath")).toBe(false);
    expect(appliesToSave(illusions, "breath")).toBe(true);
  });
});

describe("totalRaceSaveBonus", () => {
  const bonuses = [{ ...resilience, saves: [...resilience.saves] }, illusions];
  it("sums the unconditional bonuses that cover a save", () => {
    expect(totalRaceSaveBonus(bonuses, "death", 15)).toBe(4);
    expect(totalRaceSaveBonus(bonuses, "breath", 15)).toBe(0);
  });
});
