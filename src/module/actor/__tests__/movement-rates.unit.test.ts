import { describe, expect, it } from "vitest";
import { movementAllowance, parseMovement } from "../movement-rates";

describe("parseMovement", () => {
  it("reads walking and flying rates (Homunculus)", () => {
    expect(parseMovement("60’ (20’) / 180’ (60’) flying")).toEqual({
      walk: { turn: 60, round: 20 },
      fly: { turn: 180, round: 60 },
    });
  });

  it("reads a single rate (Ettin)", () => {
    expect(parseMovement("120' (40')")).toEqual({ walk: { turn: 120, round: 40 } });
  });

  it("reads a swimming-only rate (Eye of the Abyss)", () => {
    expect(parseMovement("150' (50') swimming")).toEqual({ swim: { turn: 150, round: 50 } });
  });

  it("reads a rate without a combat value, the mode first, or feet spelled out", () => {
    expect(parseMovement("90'")).toEqual({ walk: { turn: 90, round: null } });
    expect(parseMovement("Fly 180 ft (60 ft)")).toEqual({ fly: { turn: 180, round: 60 } });
    expect(parseMovement("120 feet / 30 feet burrowing")).toEqual({
      walk: { turn: 120, round: null },
      burrow: { turn: 30, round: null },
    });
  });

  it("is empty for missing or unreadable text", () => {
    expect(parseMovement("")).toEqual({});
    expect(parseMovement(undefined as unknown as string)).toEqual({});
    expect(parseMovement("see below")).toEqual({});
  });
});

describe("movementAllowance", () => {
  const homunculus = "60’ (20’) / 180’ (60’) flying";

  it("uses the rate for the token's movement action", () => {
    expect(movementAllowance(homunculus, 60, "walk")).toBe(60);
    expect(movementAllowance(homunculus, 60, "fly")).toBe(180);
  });

  it("uses the bracketed rate in combat", () => {
    expect(movementAllowance(homunculus, 60, "walk", true)).toBe(20);
    expect(movementAllowance(homunculus, 60, "fly", true)).toBe(60);
  });

  it("falls back to a third of the rate in combat when none is given", () => {
    expect(movementAllowance("90'", 90, "walk", true)).toBe(30);
  });

  it("falls back to walking for an action the text doesn't list", () => {
    expect(movementAllowance("120' (40')", 120, "swim")).toBe(120);
  });

  it("falls back to the base rate without a walking rate or any text", () => {
    expect(movementAllowance("150' (50') swimming", 30, "walk")).toBe(30);
    expect(movementAllowance("", 120, "walk")).toBe(120);
    expect(movementAllowance("", 120, "walk", true)).toBe(40);
  });
});
