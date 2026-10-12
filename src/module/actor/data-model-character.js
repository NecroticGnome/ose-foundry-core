/**
 * @file The data model for Actors of type Character.
 */
import { deriveTables } from "../classes/actor-tables";
import { deriveFromClasses, summariseClasses } from "../classes/derive";
import { clampRaceModifier, readChanges } from "../classes/effects";
import { primeReqBonus, scoreValues } from "../classes/progression";
import { buildSpellPools } from "../classes/spells";
import { computeWarnings, contextKey } from "../classes/warnings";
import OseDataModelCharacterAC from "./data-model-classes/data-model-character-ac";
import OseDataModelCharacterMove from "./data-model-classes/data-model-character-move";
import OseDataModelCharacterScores from "./data-model-classes/data-model-character-scores";
import OseDataModelCharacterSpells from "./data-model-classes/data-model-character-spells";
import { raiseFromAbilities } from "./exploration-skills";

const getItemsOfActorOfType = (actor, filterType, filterFn = null) =>
  actor.items.filter(({ type }) => type === filterType).filter(filterFn || (() => true));

export default class OseDataModelCharacter extends foundry.abstract.TypeDataModel {
  prepareBaseData() {
    this.derivedFromClasses = false;
    const { classes } = this;
    const summary = summariseClasses(classes);
    if (summary) {
      this.details = {
        ...this.details,
        level: summary.level,
        class: summary.className,
        title:
          this.details.title ||
          classes
            .map((c) => c.system.title)
            .filter(Boolean)
            .join(" / "),
        xp: { ...this.details.xp, value: summary.xp, next: summary.xpNext ?? summary.xp },
      };
    }
    const derived = deriveFromClasses(classes);
    if (!derived) return;
    this.derivedFromClasses = true;
    for (const [key, value] of Object.entries(derived.saves)) this.saves[key].value = value;
    this.thac0 = { ...this.thac0, value: derived.thac0, bba: derived.bba };
    for (const lvl of ["1", "2", "3", "4", "5", "6"]) {
      this.spells[lvl] = { ...(this.spells[lvl] ?? {}), max: derived.spellSlots[lvl] ?? 0 };
    }
    if (Object.values(derived.spellSlots).some((n) => n > 0)) this.spells.enabled = true;
    this.hp.hd = derived.hd;
  }

  // Class tables and the exploration skills abilities raise. Runs before Active Effects.
  prepareTables() {
    const { tables, from, shared } = deriveTables(
      this.classes.map((c) => ({ id: c.id, name: c.name, level: c.system.level, tables: c.system.tables ?? [] })),
    );
    this.tables = tables;
    this.tablesFrom = from;
    this.tablesBase = Object.fromEntries(
      Object.keys(from).map((path) => [path, foundry.utils.getProperty(tables, `${path}.current`)]),
    );
    this.sharedColumns = shared;
    this.explorationFrom = raiseFromAbilities(this.exploration, this.parent.items);
  }

  // Where a table column's current value comes from, e.g. "Thief 20, Cloak of Elvenkind +10".
  tableSources(path) {
    const from = this.tablesFrom?.[path];
    const effects = (this.parent.appliedEffects ?? []).flatMap((e) =>
      readChanges(e)
        .filter((c) => c.key === `system.tables.${path}.current`)
        .map((c) => `${e.name} ${c.type === "add" && Number(c.value) >= 0 ? "+" : ""}${c.value}`),
    );
    return [from && `${from.cls} ${this.tablesBase[path]}`, ...effects].filter(Boolean).join(", ");
  }

  prepareDerivedData() {
    // Keep THAC0 and attack bonus in step after Active Effects.
    if (this.derivedFromClasses) {
      if (this.usesAscendingAC) this.thac0.value = 19 - this.thac0.bba;
      else this.thac0.bba = 19 - this.thac0.value;
    }
    this.#clampRaceModifiers();
    this.scores = new OseDataModelCharacterScores(this.scores);

    // eslint-disable-next-line new-cap
    this.encumbrance = new CONFIG.OSE.encumbrance(
      this.encumbrance.max,
      [...this.parent.items],
      {
        significantTreasure: game.settings.get(game.system.id, "significantTreasure"),
        scores: this.scores,
      },
      this.scores.str.mod,
    );

    this.movement = new OseDataModelCharacterMove(this.encumbrance, this.config.movementAuto, this.movement.base);

    const sourceMod = this.parent._source.system.ac?.mod ?? 0;
    const acMod = (this.ac.mod ?? 0) + ((this.aac.mod ?? 0) - (this.parent._source.system.aac?.mod ?? sourceMod));

    // @todo Once we create the new character sheet,
    //       we shouldn't need to list both AC schemes
    this.ac = new OseDataModelCharacterAC(
      false,
      getItemsOfActorOfType(this.parent, "armor", (a) => a.system.equipped),
      this.scores.dex.mod,
      acMod,
    );

    this.aac = new OseDataModelCharacterAC(
      true,
      getItemsOfActorOfType(this.parent, "armor", (a) => a.system.equipped),
      this.scores.dex.mod,
      acMod,
    );

    this.spells = new OseDataModelCharacterSpells(this.spells, this.#spellList);

    this.#prepareSpellPools();
    this.#prepareWarnings();
  }

  // Race ability modifiers stay within 3-18.
  #clampRaceModifiers() {
    const scope = game.system.id;
    const effect = this.parent.appliedEffects?.find((e) => e.getFlag(scope, "raceModifiers"));
    for (const { key, type, value } of effect ? readChanges(effect) : []) {
      const score = /^system\.scores\.(\w+)\.value$/.exec(key)?.[1];
      if (type !== "add" || !this.scores[score]) continue;
      this.scores[score].value = clampRaceModifier(this.scores[score].value, Number(value) || 0);
    }
  }

  // Each casting class has its own slots. Spells get allocated separately.
  #prepareSpellPools() {
    this.spellPools = [];
    this.unallocatedSpells = [];
    const { classes } = this;
    if (!classes.length) return;
    const spells = this.spellList;
    const { pools, assignment, other } = buildSpellPools(
      classes.map((c) => ({
        id: c.id,
        name: c.name,
        key: c.system.key,
        spellList: c.system.spellList,
        level: c.system.level,
        levels: c.system.levels,
      })),
      spells.map((s) => ({
        id: s.id,
        lvl: s.system.lvl,
        class: s.system.class,
        castAs: s.system.castAs,
        cast: s.system.cast,
      })),
    );
    const byLevel = (list, slots = {}) => {
      const levels = new Set([...Object.keys(slots), ...list.map((s) => String(s.system.lvl))]);
      return [...levels]
        .sort((a, b) => Number(a) - Number(b))
        .map((lvl) => ({
          lvl,
          slots:
            lvl === "0"
              ? { used: 0, ...slots[lvl], max: this.spells.slots[0]?.max ?? 0 }
              : (slots[lvl] ?? { max: 0, used: 0 }),
          spells: list.filter((s) => String(s.system.lvl) === lvl).sort((a, b) => a.name.localeCompare(b.name)),
        }));
    };
    this.spellPools = pools.map((p) => ({
      ...p,
      levels: byLevel(
        spells.filter((s) => assignment[s.id] === p.key),
        p.slots,
      ),
    }));
    this.unallocatedSpells = spells.filter((s) => other.includes(s.id));
    this.otherSpellLevels = byLevel(this.unallocatedSpells);
  }

  #prepareWarnings() {
    this.warnings = [];
    this.warningContext = "";
    const { classes } = this;
    const race = this.race;
    if (!classes.length && !race) return;
    const input = {
      classes: classes.map((c) => ({
        id: c.id,
        name: c.name,
        key: c.system.key,
        hasTable: c.system.hasTable,
        level: c.system.level,
        tableLength: c.system.levels.length,
        armour: c.system.armour,
        weapons: c.system.weapons,
        stealthSkills: c.system.stealthSkills,
        demihuman: c.system.demihuman,
        requirements: c.system.requirements,
      })),
      race: race
        ? {
            id: race.id,
            name: race.name,
            key: race.system.key,
            limits: Object.fromEntries(race.system.classLimits.map((l) => [l.classKey, l.maxLevel])),
            allowedKeys: race.system.classLimits.map((l) => l.classKey),
            requirements: race.system.requirements,
          }
        : null,
      equippedArmour: getItemsOfActorOfType(this.parent, "armor", (a) => a.system.equipped).map((a) => ({
        id: a.id,
        name: a.name,
        type: a.system.type,
        ac: a.system.ac?.value ?? 9,
      })),
      equippedWeapons: getItemsOfActorOfType(this.parent, "weapon", (w) => w.system.equipped).map((w) => ({
        id: w.id,
        name: w.name,
        tags: (w.system.tags ?? []).map((t) => t.value),
      })),
      // Requirements are checked against the rolled scores, before race or class adjustments.
      scores: Object.fromEntries(
        Object.entries(this.parent._source.system.scores ?? {}).map(([k, v]) => [k, v?.value]),
      ),
      unallocatedSpells: (this.unallocatedSpells ?? []).map((s) => ({ id: s.id, name: s.name })),
      abilities: getItemsOfActorOfType(this.parent, "ability").map((a) => ({
        id: a.id,
        name: a.name,
        requirements: a.system.requirements ?? "",
      })),
      sharedColumns: this.sharedColumns ?? [],
    };
    this.warningContext = contextKey(input);
    this.warnings = computeWarnings(input).filter(
      (w) =>
        this.parent.items.get(w.itemId)?.getFlag(game.system.id, "dismissedWarnings")?.[w.key] !== this.warningContext,
    );
  }

  // @todo define schema options; stuff like min/max values and so on.
  static defineSchema() {
    const { BooleanField, NumberField, ObjectField, SchemaField, StringField } = foundry.data.fields;

    return {
      spells: new ObjectField(),
      scores: new ObjectField(),
      details: new ObjectField(),
      ac: new ObjectField(),
      aac: new ObjectField(),
      encumbrance: CONFIG.OSE.encumbrance.defineSchema(),
      movement: new ObjectField(),
      config: new ObjectField(),
      initiative: new SchemaField({
        value: new NumberField({ integer: false, initial: 0 }),
        mod: new NumberField({ integer: false, initial: 0 }),
      }),
      hp: new SchemaField({
        hd: new StringField(),
        value: new NumberField({ integer: true }),
        max: new NumberField({ integer: true }),
        fraction: new NumberField({ initial: 0 }),
      }),
      thac0: new ObjectField(),
      languages: new ObjectField(),
      saves: new SchemaField({
        breath: new SchemaField({ value: new NumberField({ integer: true }) }),
        death: new SchemaField({ value: new NumberField({ integer: true }) }),
        paralysis: new SchemaField({
          value: new NumberField({ integer: true }),
        }),
        spell: new SchemaField({ value: new NumberField({ integer: true }) }),
        wand: new SchemaField({ value: new NumberField({ integer: true }) }),
      }),
      exploration: new SchemaField({
        ft: new NumberField({ integer: true, positive: true, initial: 1 }),
        ld: new NumberField({ integer: true, positive: true, initial: 1 }),
        od: new NumberField({ integer: true, positive: true, initial: 2 }),
        sd: new NumberField({ integer: true, positive: true, initial: 1 }),
        fg: new NumberField({ integer: true, positive: true, initial: 1 }),
        hn: new NumberField({ integer: true, positive: true, initial: 1 }),
      }),
      retainer: new SchemaField({
        enabled: new BooleanField(),
        loyalty: new NumberField({ integer: true }),
        wage: new StringField(),
      }),
    };
  }

  /**
   * @inheritdoc
   */
  static migrateData(source) {
    OseDataModelCharacter.#migrateCantrips(source);

    // Add magic resist bonus field for characters, defaulting to 0
    if (source?.details && source?.details?.magic?.bonus === undefined) {
      source.details.magic = {
        bonus: 0,
      };
    }

    return super.migrateData(source);
  }

  /**
   * Ensure cantrips (level 0 spells) exist in the spells object.
   * @param {OseDataModelCharacter} source - Source data to migrate
   */
  static #migrateCantrips(source) {
    const spells = source.spells ?? {};

    // If there are spells but no cantrips (level 0 spells),
    // add an empty cantrip entry.
    if (spells && !spells["0"]) {
      spells["0"] = { max: 0, value: 0 };
    }
  }

  // @todo This only needs to be public until
  //       we can ditch sharing out AC/AAC.
  // eslint-disable-next-line class-methods-use-this
  get usesAscendingAC() {
    return game.settings.get(game.system.id, "ascendingAC");
  }

  classXpBonus(cls) {
    return cls.system.xpBonusOverride ?? primeReqBonus(cls.system.primeReqs, scoreValues(this.scores));
  }

  // XP bonus effects add to each class's adjustment.
  get xpBonusFromEffects() {
    return (this.details.xp.bonus || 0) - (this.parent._source.system.details?.xp?.bonus || 0);
  }

  get meleeMod() {
    const ascendingAcMod = this.usesAscendingAC ? this.thac0.bba || 0 : 0;
    return (this.scores.str?.mod || 0) + (this.thac0?.mod?.melee || 0) + ascendingAcMod;
  }

  get rangedMod() {
    const ascendingAcMod = this.usesAscendingAC ? this.thac0.bba || 0 : 0;
    return (this.scores.dex?.mod || 0) + (this.thac0?.mod?.missile || 0) + ascendingAcMod;
  }

  get isNew() {
    const { str, int, wis, dex, con, cha } = this.scores;
    return ![str, int, wis, dex, con, cha].reduce((acc, el) => acc + el.value, 0);
  }

  get containers() {
    return getItemsOfActorOfType(this.parent, "container", ({ system: { containerId } }) => !containerId);
  }

  get treasures() {
    return getItemsOfActorOfType(
      this.parent,
      "item",
      ({ system: { treasure, containerId } }) => treasure && !containerId,
    );
  }

  get carriedTreasure() {
    const total = this.treasures.reduce((acc, { system: { quantity, cost } }) => acc + quantity.value * cost, 0);
    return Math.round(total * 100) / 100;
  }

  get items() {
    return getItemsOfActorOfType(
      this.parent,
      "item",
      ({ system: { treasure, containerId } }) => !treasure && !containerId,
    );
  }

  get weapons() {
    return getItemsOfActorOfType(this.parent, "weapon", ({ system: { containerId } }) => !containerId);
  }

  get armor() {
    return getItemsOfActorOfType(this.parent, "armor", ({ system: { containerId } }) => !containerId);
  }

  get abilities() {
    return getItemsOfActorOfType(this.parent, "ability", ({ system: { containerId } }) => !containerId).sort(
      (a, b) => (a.sort || 0) - (b.sort || 0),
    );
  }

  get classes() {
    if (!this.parent?.items) return [];
    return getItemsOfActorOfType(this.parent, "class").sort((a, b) => (a.sort || 0) - (b.sort || 0));
  }

  get race() {
    if (!this.parent?.items) return null;
    return getItemsOfActorOfType(this.parent, "race")[0] ?? null;
  }

  get spellList() {
    return getItemsOfActorOfType(this.parent, "spell", ({ system: { containerId } }) => !containerId);
  }

  get #spellList() {
    // Maintain backwards compatibility
    return this.spellList;
  }

  get isSlow() {
    return this.weapons.length === 0
      ? false
      : this.weapons.some((item) => !(item.type !== "weapon" || !item.system.slow || !item.system.equipped));
  }

  get init() {
    const group = game.settings.get(game.system.id, "initiative") !== "group";

    return group ? (this.initiative.value || 0) + (this.initiative.mod || 0) + this.scores.dex.init : 0;
  }
}
