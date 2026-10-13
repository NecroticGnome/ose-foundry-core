import { describe, expect, it } from "vitest";
import { deriveTables } from "../actor-tables";
import type { ClassTable } from "../tables";

const table = (key: string, columns: [string, string][], rows: Record<string, number | string>[]) =>
  ({ key, label: key, columns: columns.map(([k, name]) => ({ key: k, name })), rows }) as ClassTable;

const thief = {
  id: "t",
  name: "Thief",
  level: 3,
  tables: [
    table(
      "skills",
      [
        ["hs", "Hide in shadows"],
        ["hn", "Hear noise"],
      ],
      [
        { hs: 10, hn: "1-2" },
        { hs: 15, hn: "1-2" },
        { hs: 20, hn: "1-3" },
      ],
    ),
  ],
};

describe("deriveTables", () => {
  it("lists each column with its current value (ranges as their top) and every level", () => {
    const { tables, from } = deriveTables([thief]);
    expect(tables.skills.hs).toEqual({ current: 20, levels: [10, 15, 20] });
    expect(tables.skills.hn).toEqual({ current: 3, levels: ["1-2", "1-2", "1-3"] });
    expect(from["skills.hs"]).toEqual({ cls: "Thief", name: "Hide in shadows", level: 3 });
  });

  it("includes every table, keeping cells that aren't numbers as they are", () => {
    const cleric = {
      id: "c",
      name: "Cleric",
      level: 2,
      tables: [table("turning", [["1", "1 HD"]], [{ 1: 7 }, { 1: "T" }])],
    };
    expect(deriveTables([cleric]).tables).toEqual({ turning: { 1: { current: "T", levels: [7, "T"] } } });
  });

  it("is empty without classes", () => {
    expect(deriveTables([]).tables).toEqual({});
  });

  it("uses the higher-level class for a shared column, and reports the share", () => {
    const assassin = {
      id: "a",
      name: "Assassin",
      level: 5,
      tables: [table("skills", [["hs", "Hide in shadows"]], [{ hs: 1 }, { hs: 2 }, { hs: 3 }, { hs: 4 }, { hs: 5 }])],
    };
    const { tables, from, shared } = deriveTables([thief, assassin]);
    expect(tables.skills.hs.current).toBe(5);
    expect(from["skills.hs"].cls).toBe("Assassin");
    expect(shared).toEqual([{ id: "a", key: "skills.hs", cls: "Assassin", other: "Thief", used: "Assassin" }]);
  });
});
