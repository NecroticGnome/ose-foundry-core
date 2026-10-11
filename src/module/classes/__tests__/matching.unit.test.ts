import { describe, expect, it } from "vitest";
import { isCombinedClassText, normaliseName, toKey } from "../matching";

describe("normaliseName", () => {
  it("ignores case, spaces and punctuation", () => {
    expect(normaliseName("Magic User")).toBe(normaliseName("magic-user"));
  });
  it("keeps accented letters", () => expect(normaliseName("Élfo")).toBe("élfo"));
  it("trims", () => expect(normaliseName("  Fighter ")).toBe("fighter"));
  it("handles empty input", () => expect(normaliseName(undefined as never)).toBe(""));
});

describe("toKey", () => {
  it("slugs names", () => expect(toKey("Magic User")).toBe("magic-user"));
  it("collapses punctuation", () => expect(toKey("Half-Elf  (Advanced)")).toBe("half-elf-advanced"));
});

describe("isCombinedClassText", () => {
  it.each(["Fighter/Thief", "Fighter / Magic-User", "Fighter & Thief", "Cleric, Thief"])("%s is combined", (t) =>
    expect(isCombinedClassText(t)).toBe(true));
  it.each(["Fighter", "Magic-User", "Magic User"])("%s is single", (t) => expect(isCombinedClassText(t)).toBe(false));
});
