import { describe, expect, it } from "vitest";
import { insertByLevel, sortByLevel } from "../abilities";

const link = (uuid: string, level: number) => ({ uuid, level });

describe("sortByLevel", () => {
  it("orders by level, keeping the existing order within a level", () => {
    expect(sortByLevel([link("c", 9), link("a", 1), link("d", 4), link("b", 1)]).map((l) => l.uuid)).toEqual([
      "a",
      "b",
      "d",
      "c",
    ]);
  });
});

describe("insertByLevel", () => {
  it("adds after the last link at or below its level", () => {
    const links = [link("a", 1), link("b", 4), link("c", 9)];
    expect(insertByLevel(links, link("x", 4)).map((l) => l.uuid)).toEqual(["a", "b", "x", "c"]);
    expect(insertByLevel(links, link("y", 1)).map((l) => l.uuid)).toEqual(["a", "y", "b", "c"]);
    expect(insertByLevel([], link("z", 2)).map((l) => l.uuid)).toEqual(["z"]);
  });
});
