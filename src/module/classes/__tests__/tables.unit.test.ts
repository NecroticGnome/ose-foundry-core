import { describe, expect, it } from "vitest";
import {
  type ClassTable,
  cellHint,
  cellTarget,
  columnHeader,
  currentRows,
  findTargetClass,
  isFormulaKey,
  legendSuggestions,
  renameColumnKeys,
  tableRowValues,
  tableValue,
} from "../tables";

const skills: ClassTable = {
  key: "skills",
  label: "Thief Skills",
  columns: [{ key: "hs", name: "Hide in shadows" }, { key: "ms" }],
  rows: [
    { hs: 10, ms: 20 },
    { hs: 15, ms: 25 },
  ],
};
const turning: ClassTable = {
  key: "turning",
  label: "Turning",
  columns: [{ key: "1", name: "1 HD" }],
  rows: [{ 1: "–" }, { 1: 7 }, { 1: "T" }],
};

describe("tableValue", () => {
  it("reads the cell for the level", () => expect(tableValue([skills], 2, "skills.hs")).toBe(15));
  it("clamps levels beyond the table", () => expect(tableValue([skills], 9, "skills.ms")).toBe(25));
  it("returns text cells as they are", () => expect(tableValue([turning], 3, "turning.1")).toBe("T"));
  it("returns null for unknown tables, columns or blank targets", () => {
    expect(tableValue([skills], 1, "skills.pp")).toBeNull();
    expect(tableValue([skills], 1, "nope.hs")).toBeNull();
    expect(tableValue([skills], 1, "")).toBeNull();
    expect(tableValue([], 1, "skills.hs")).toBeNull();
  });
});

describe("currentRows", () => {
  it("gives each table's row for the level", () => {
    expect(currentRows([skills, turning], 2)).toEqual([
      {
        key: "skills",
        label: "Thief Skills",
        cells: [
          { key: "hs", label: "HS", name: "Hide in shadows", value: 15 },
          { key: "ms", label: "MS", name: "MS", value: 25 },
        ],
      },
      { key: "turning", label: "Turning", cells: [{ key: "1", label: "1", name: "1 HD", value: 7 }] },
    ]);
  });
  it("skips tables without rows", () => {
    expect(currentRows([{ ...skills, rows: [] }], 1)).toEqual([]);
  });
});

describe("tableRowValues", () => {
  it("maps each table to its current row", () => {
    expect(tableRowValues([skills, turning], 1)).toEqual({ skills: { hs: 10, ms: 20 }, turning: { 1: "–" } });
  });
});

describe("cellTarget", () => {
  it.each([
    [20, 20],
    ["35", 35],
    ["1–3", 3],
    ["1-2", 2],
    ["—", null],
    [null, null],
  ])("%s → %s", (cell, expected) => expect(cellTarget(cell)).toBe(expected));
});

describe("renameColumnKeys", () => {
  const before = [
    {
      key: "skills",
      label: "Skills",
      columns: [{ key: "cs" }, { key: "hs" }],
      rows: [
        { cs: 87, hs: 10 },
        { cs: 88, hs: 15 },
      ],
    },
  ];
  const submit = (cs: string, hs = "hs") => [
    {
      ...before[0],
      columns: [{ key: cs }, { key: hs }],
      rows: before[0].rows.map((r) => ({ ...r })),
    },
  ];

  it("moves a column's values to its new key", () => {
    const [t] = renameColumnKeys(before, submit("climb"));
    expect(t?.columns.map((c) => c.key)).toEqual(["climb", "hs"]);
    expect(t?.rows).toEqual([
      { climb: 87, hs: 10 },
      { climb: 88, hs: 15 },
    ]);
  });

  it("keeps the old key when the new one is blank or taken", () => {
    expect(renameColumnKeys(before, submit("  "))[0]?.rows[0]).toEqual({ cs: 87, hs: 10 });
    expect(renameColumnKeys(before, submit("  "))[0]?.columns[0]?.key).toBe("cs");
    const [t] = renameColumnKeys(before, submit("hs"));
    expect(t?.columns.map((c) => c.key)).toEqual(["cs", "hs"]);
    expect(t?.rows[0]).toEqual({ cs: 87, hs: 10 });
  });

  it("leaves unchanged tables alone", () => {
    expect(renameColumnKeys(before, submit("cs"))).toEqual(submit("cs"));
  });
});

describe("currentRows names", () => {
  it("heads each column with its key in capitals, and passes the readable name through", () => {
    const [row] = currentRows([skills], 1);
    expect(row?.cells[0]).toMatchObject({ label: "HS", name: "Hide in shadows" });
    expect(row?.cells[1]).toMatchObject({ label: "MS", name: "MS" });
  });
});

describe("cellHint", () => {
  const legend = [
    { value: "-", text: "The turning fails." },
    { value: "#", text: "Roll this or higher on 2d6." },
    { value: "T", text: "Turned." },
  ];
  it.each([
    ["-", "The turning fails."],
    ["T", "Turned."],
    [7, "Roll this or higher on 2d6."],
    ["11", "Roll this or higher on 2d6."],
    ["D", ""],
    ["", ""],
  ])("%s → %s", (cell, expected) => expect(cellHint(legend, cell)).toBe(expected));
  it("handles a table without a legend", () => expect(cellHint(undefined, "T")).toBe(""));
});

describe("isFormulaKey", () => {
  it.each([
    ["hs", true],
    ["7-9", true],
    ["2*", false],
    ["", false],
  ])("%s → %s", (key, expected) => expect(isFormulaKey(key)).toBe(expected));
});

describe("columnHeader", () => {
  it.each([
    ["hs", "HS"],
    ["2s", "2*"],
    ["7-9", "7-9"],
    ["s", "S"],
    ["skills", "SKILLS"],
  ])("%s → %s", (key, expected) => expect(columnHeader(key)).toBe(expected));
});

describe("findTargetClass", () => {
  const thief = { key: "thief", tables: [skills] };
  const fighter = { key: "fighter", tables: [] };
  const acrobat = { key: "acrobat", tables: [skills] };
  it("picks a class whose table has the column", () => {
    expect(findTargetClass([fighter, thief], "skills.hs")?.key).toBe("thief");
  });
  it("prefers a class the requirements name", () => {
    expect(findTargetClass([thief, acrobat], "skills.hs", ["acrobat"])?.key).toBe("acrobat");
  });
  it("finds nothing without a matching column", () => {
    expect(findTargetClass([fighter, thief], "skills.zz")).toBeUndefined();
    expect(findTargetClass([thief], "")).toBeUndefined();
  });
});

describe("legendSuggestions", () => {
  it("suggests the table's non-numeric cell values once each, then # if any cell is a number", () => {
    const table = {
      key: "turning",
      columns: [
        { key: "1", name: "" },
        { key: "2", name: "" },
      ],
      rows: [
        { 1: 7, 2: "T" },
        { 1: "T", 2: "D" },
        { 1: "D+", 2: "-" },
      ],
    };
    expect(legendSuggestions(table)).toEqual(["T", "D", "D+", "-", "#"]);
  });
  it("leaves out empty cells and has no # without numbers", () => {
    expect(legendSuggestions({ key: "k", columns: [{ key: "a", name: "" }], rows: [{ a: "" }, { a: "x" }] })).toEqual([
      "x",
    ]);
  });
});
