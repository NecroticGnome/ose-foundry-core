/**
 * @file The actor values Foundry offers as Token resources.
 *
 * Foundry infers trackable attributes from typed schema fields only (so no ObjectFields)
 * Foundry allows a way to circumvent having to change all fields to be non-objects: configuring the map below
 * So long as this map exists, Foundry is happy and won't go looking through actor attributes for viable candidates
 *
 * This is necessary as a previous update around the era of v10 changed how Foundry finds these attributes,
 * making the old tride and true method of letting Foundry worry about the details no longer viable, so now we gotta do extra legwork.
 *
 * So, if you're adding new fields to any sort of Actor sheet, it may be a good idea to update this map, too.
 *
 * @see https://foundryvtt.com/article/system-data-models/
 */

type TrackableAttributes = { bar: string[]; value: string[] };

const armorClass = ["ac.value", "ac.mod", "aac.value", "aac.mod"];

const thac0 = ["thac0.value", "thac0.bba", "thac0.mod.melee", "thac0.mod.missile"];

const movement = ["movement.base", "movement.encounter", "movement.overland"];

const initiative = ["initiative.value", "initiative.mod"];

const saves = [
  "saves.breath.value",
  "saves.death.value",
  "saves.paralysis.value",
  "saves.spell.value",
  "saves.wand.value",
];

const scores = [
  "scores.str.value",
  "scores.str.mod",
  "scores.int.value",
  "scores.int.mod",
  "scores.wis.value",
  "scores.wis.mod",
  "scores.dex.value",
  "scores.dex.mod",
  "scores.con.value",
  "scores.con.mod",
  "scores.cha.value",
  "scores.cha.mod",
];

const exploration = [
  "exploration.ft",
  "exploration.ld",
  "exploration.od",
  "exploration.sd",
  "exploration.fg",
  "exploration.hn",
];

const trackableAttributes: Record<"character" | "monster", TrackableAttributes> = {
  character: {
    bar: ["hp", "encumbrance"],
    value: [
      ...armorClass,
      ...thac0,
      ...scores,
      ...movement,
      ...initiative,
      ...saves,
      ...exploration,
      "details.level",
      "details.xp.value",
      "details.xp.next",
      "retainer.loyalty",
    ],
  },
  monster: {
    bar: ["hp", "encumbrance"],
    value: [
      ...armorClass,
      ...thac0,
      ...movement,
      ...initiative,
      ...saves,
      "details.xp",
      "details.morale",
      "retainer.loyalty",
    ],
  },
};

export default trackableAttributes;
