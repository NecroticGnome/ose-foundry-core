import { describe, expect, it } from "vitest";
import { isAbilityOwned } from "../abilities";

const owned = [
  { name: "Combat", requirements: "fighter", source: "" },
  { name: "Back-stab", requirements: "thief", source: "Compendium.x.abilities.Item.bs" },
];

describe("isAbilityOwned", () => {
  it("treats same-named abilities of different classes as different", () => {
    expect(
      isAbilityOwned(owned, { name: "Combat", requirements: "thief", uuid: "Compendium.x.abilities.Item.tc" }),
    ).toBe(false);
  });
  it("matches name and requirements ignoring case", () => {
    expect(isAbilityOwned(owned, { name: "combat", requirements: "Fighter", uuid: "u" })).toBe(true);
  });
  it("matches the compendium source even if renamed", () => {
    expect(isAbilityOwned(owned, { name: "Backstab", requirements: "", uuid: "Compendium.x.abilities.Item.bs" })).toBe(
      true,
    );
  });
});
