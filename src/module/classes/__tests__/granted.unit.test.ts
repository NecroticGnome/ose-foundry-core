import { describe, expect, it } from "vitest";
import { abilitiesGrantedBy, type OwnedGrant } from "../granted";

const thief = {
  type: "class",
  system: { key: "thief" },
  links: [
    { uuid: "Compendium.x.abilities.Item.bs", name: "Back-stab", requirements: "thief" },
    { uuid: "Compendium.x.abilities.Item.tc", name: "Combat", requirements: "thief" },
  ],
};

const owned: OwnedGrant[] = [
  { id: "a", name: "Back-stab", requirements: "thief", source: "", grantedBy: { type: "class", key: "thief" } },
  { id: "b", name: "Hide in Shadows", requirements: "thief", source: "Compendium.x.abilities.Item.hs" },
  { id: "c", name: "Combat", requirements: "thief", source: "" },
  { id: "d", name: "Combat", requirements: "fighter", source: "", grantedBy: { type: "class", key: "fighter" } },
  { id: "e", name: "Sneaky", requirements: "", source: "Compendium.x.abilities.Item.bs" },
  { id: "f", name: "Infravision", requirements: "", source: "" },
];

describe("abilitiesGrantedBy", () => {
  it("finds tagged, source-matched and name-matched abilities of that class only", () => {
    expect(abilitiesGrantedBy(thief, owned)).toEqual(["a", "c", "e"]);
  });
  it("ignores abilities tagged by another class even if the name matches", () => {
    const fighterCombat = owned.filter((o) => o.id === "d");
    expect(abilitiesGrantedBy(thief, fighterCombat)).toEqual([]);
  });
  it("matches by type as well as key", () => {
    const race = { type: "race", system: { key: "thief" }, links: [] };
    expect(abilitiesGrantedBy(race, owned)).toEqual([]);
  });
  it("returns nothing for no matches", () => expect(abilitiesGrantedBy(thief, [])).toEqual([]));
});
