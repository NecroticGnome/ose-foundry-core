import { describe, expect, it } from "vitest";
import { packRank, resolveClass } from "../class-index";

const e = (name: string, source: string, key = "") => ({ name, key, source, load: async () => ({}) });
const entries = [e("Fighter", "world"), e("Magic-User", "tome", "magic-user"), e("Fighter", "classic")];

describe("resolveClass", () => {
  it("matches ignoring case and punctuation", () => expect(resolveClass("magic user", entries)?.source).toBe("tome"));
  it("prefers the first source", () => expect(resolveClass("FIGHTER", entries)?.source).toBe("world"));
  it("matches by key when names differ", () =>
    expect(resolveClass("Magic-User", [e("Mago", "es", "magic-user")])?.source).toBe("es"));
  it("returns null for unknown or combined text", () => {
    expect(resolveClass("Fighter/Thief", entries)).toBeNull();
    expect(resolveClass("Elf Fighter", entries)).toBeNull();
    expect(resolveClass("", entries)).toBeNull();
    expect(resolveClass("   ", entries)).toBeNull();
  });
});

describe("packRank", () => {
  it("prefers Premium Game, then the old tome, then Classic", () => {
    expect(packRank("ose-premiumgame.classes")).toBe(0);
    expect(packRank("ose-advancedfantasytome.classes")).toBe(1);
    expect(packRank("classicfantasycompendium.classes")).toBe(2);
    expect(packRank("other.classes")).toBe(3);
  });
});
