import { describe, expect, it } from "vitest";
import { addTreasureTable, removeTreasureTable } from "../treasure-links";

const a = "@UUID[Compendium.x.tables.RollTable.A]{Type A}";
const b = "@UUID[RollTable.B]";

describe("treasure table links", () => {
  it("adds a table after any already linked", () => {
    expect(addTreasureTable("", a)).toBe(a);
    expect(addTreasureTable(a, b)).toBe(`${a} ${b}`);
  });

  it("doesn't link the same table twice", () => {
    expect(addTreasureTable(a, "@UUID[Compendium.x.tables.RollTable.A]{Renamed}")).toBe(a);
  });

  it("removes one table by uuid, keeping the rest", () => {
    expect(removeTreasureTable(`${a} ${b}`, "Compendium.x.tables.RollTable.A")).toBe(b);
    expect(removeTreasureTable(`${a} ${b}`, "RollTable.B")).toBe(a);
    expect(removeTreasureTable(b, "RollTable.B")).toBe("");
  });

  it("treats a missing value as empty", () => {
    expect(addTreasureTable(null, b)).toBe(b);
    expect(removeTreasureTable(undefined, "RollTable.B")).toBe("");
  });
});
