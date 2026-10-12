/**
 * @file The system-level sheet for items of any type.
 */

import { insertByLevel, sortByLevel } from "../classes/abilities";
import { buildEffectData, readChanges } from "../classes/effects";
import { resizeLevels, xpForLevel } from "../classes/levels";
import { toKey } from "../classes/matching";
import {
  defaultPrimeReqs,
  primeReqBonus,
  primeReqDisplayOrder,
  SAVE_KEYS,
  scoreValues,
  standardPrimeReq,
} from "../classes/progression";
import {
  cellHint,
  columnHeader,
  findTargetClass,
  isFormulaKey,
  legendSuggestions,
  renameColumnKeys,
} from "../classes/tables";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;
const TextEditor = foundry.applications.ux.TextEditor.implementation;

// Suggestions for edit-mode inputs, gathered once per session from the world and compendiums.
let suggestions;
const loadSuggestions = async () => {
  const docs = [...(game.items ?? [])].map((i) => ({
    type: i.type,
    name: i.name,
    key: i.system?.key,
    tables: i.system?.tables,
  }));
  for (const pack of game.packs.filter((p) => p.documentName === "Item")) {
    const index = await pack.getIndex({ fields: ["type", "system.key", "system.tables"] });
    // Magic items are weapons too; leave them out of weapon suggestions.
    const magic = /magic|treasure/i.test(pack.collection);
    for (const e of index)
      docs.push({ type: e.type, name: e.name, key: e.system?.key, tables: e.system?.tables, magic });
  }
  const unique = (values) => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const classes = docs.filter((d) => d.type === "class");
  // Every class table column, e.g. skills.cs → "Climb sheer surfaces (Acrobat, Thief)".
  const columns = new Map();
  for (const cls of classes) {
    for (const t of cls.tables ?? []) {
      for (const c of t.columns ?? []) {
        const value = `${t.key}.${c.key}`;
        const entry = columns.get(value) ?? { value, name: c.name || columnHeader(c.key), classes: [] };
        entry.classes.push(cls.name);
        columns.set(value, entry);
      }
    }
  }
  return {
    classKeys: unique(classes.map((c) => c.key)),
    tableColumns: [...columns.values()]
      .map((c) => ({ value: c.value, label: `${c.name} (${unique(c.classes).join(", ")})` }))
      .sort((a, b) => a.value.localeCompare(b.value)),
    weapons: unique([
      ...Object.values(CONFIG.OSE.tags).map((t) => game.i18n.localize(t).toLowerCase()),
      // Base weapons only; magic variants like "Sword +1" match by name anyway.
      ...docs.filter((d) => d.type === "weapon" && !d.magic && !/[+-]\d/.test(d.name)).map((d) => d.name),
    ]),
  };
};

// Locale-aware number for display; the raw value if the locale or value can't be formatted.
const formatNumber = (value) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return value ?? "";
  try {
    return new Intl.NumberFormat(game.i18n.lang).format(value);
  } catch {
    return String(value);
  }
};

export default class OseItemSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["ose", "sheet", "item"],
    tag: "form",
    form: { submitOnChange: true, closeOnSubmit: false },
    position: { width: 560, height: 480 },
    window: { resizable: true },
    actions: {
      tagDelete: OseItemSheet._onTagDelete,
      meleeToggle: OseItemSheet._onMeleeToggle,
      missileToggle: OseItemSheet._onMissileToggle,
      addLevel: OseItemSheet._onAddLevel,
      removeLevel: OseItemSheet._onRemoveLevel,
      addPrimeReq: OseItemSheet._onAddPrimeReq,
      removeRow: OseItemSheet._onRemoveRow,
      openUuid: OseItemSheet._onOpenUuid,
      addClassLimit: OseItemSheet._onAddClassLimit,
      addTable: OseItemSheet._onAddTable,
      removeTable: OseItemSheet._onRemoveTable,
      addTableColumn: OseItemSheet._onAddTableColumn,
      addLegendRow: OseItemSheet._onAddLegendRow,
      removeLegendRow: OseItemSheet._onRemoveLegendRow,
      removeTableColumn: OseItemSheet._onRemoveTableColumn,
      toggleMode: OseItemSheet._onToggleMode,
      addListValue: OseItemSheet._onAddListValue,
      removeListValue: OseItemSheet._onRemoveListValue,
      sortAbilities: OseItemSheet._onSortAbilities,
      openRules: OseItemSheet._onOpenRules,
      togglePrimeReqCustom: OseItemSheet._onTogglePrimeReqCustom,
      copyFormula: OseItemSheet._onCopyFormula,
    },
  };

  static TABS = {
    primary: {
      tabs: [
        { id: "details", label: "OSE.classes.TabDetails" },
        { id: "progression", label: "OSE.classes.TabProgression" },
        { id: "tables", label: "OSE.classes.TabTables" },
        { id: "abilities", label: "OSE.category.abilities" },
        { id: "restrictions", label: "OSE.classes.TabRestrictions" },
        { id: "limits", label: "OSE.race.TabLimits" },
        { id: "modifiers", label: "OSE.race.TabModifiers" },
      ],
      initial: "details",
    },
  };

  static #TAB_IDS = {
    class: ["details", "progression", "tables", "abilities", "restrictions"],
    race: ["details", "limits", "abilities", "modifiers"],
  };

  _initializeApplicationOptions(options) {
    const opts = super._initializeApplicationOptions(options);
    if (options.document?.type === "class") opts.position = { ...opts.position, width: 760, height: 560 };
    return opts;
  }

  _getTabsConfig(group) {
    const ids = OseItemSheet.#TAB_IDS[this.item.type];
    const config = super._getTabsConfig(group);
    if (!ids || !config) return null;
    return { ...config, tabs: config.tabs.filter((t) => ids.includes(t.id)) };
  }

  // Class and race sheets open read-only unless the item is new.
  #editing = null;

  // Classes with the standard prime requisite table edit just its ability.
  #primeReqCustom = null;

  get primeReqCustom() {
    const rows = this.item.system?.primeReqs ?? [];
    this.#primeReqCustom ??= rows.length > 0 && !standardPrimeReq(rows);
    return this.#primeReqCustom;
  }

  get editing() {
    this.#editing ??= !this.item.system?.key;
    return this.isEditable && this.#editing;
  }

  static PARTS = {
    main: { template: "systems/__SYSTEM_ID__/dist/templates/items/item-sheet.html" },
  };

  _configureRenderParts(options) {
    const parts = super._configureRenderParts(options);
    parts.main = {
      ...parts.main,
      template: `systems/__SYSTEM_ID__/dist/templates/items/${this.item.type}-sheet.html`,
    };
    return parts;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const item = this.item;
    return Object.assign(context, {
      cssClass: this.options.classes.join(" "),
      name: item.name,
      img: item.img,
      type: item.type,
      system: item.system,
      owner: item.isOwner,
      config: {
        ...CONFIG.OSE,
        encumbrance: game.settings.get(game.system.id, "encumbranceOption"),
      },
      enriched: {
        description: await TextEditor.enrichHTML(item.system?.description ?? "", {
          relativeTo: item,
          secrets: game.user.isGM,
        }),
      },
      ...(["class", "race"].includes(item.type) ? await this.#prepareClassContext() : {}),
      castAsOptions: this.#castAsOptions(),
      ...(item.type === "ability" ? await this.#prepareAbilityContext() : {}),
    });
  }

  async #prepareAbilityContext() {
    suggestions ??= this.isEditable ? loadSuggestions() : null;
    return { targetFromChoices: (await suggestions)?.tableColumns ?? [], ownedTarget: this.#ownedTarget() };
  }

  // On a character, the final skill or exploration value the ability rolls against.
  #ownedTarget() {
    const { actor, system } = this.item;
    if (actor?.type !== "character") return null;
    const [table, column] = system.tablePath.split(".");
    if (typeof actor.system.tables?.[table]?.[column]?.current === "number") {
      return { value: system.effectiveTarget, tooltip: actor.system.tableSources(system.tablePath) };
    }
    if (system.effectiveTarget === system.rollTarget) return null;
    const skill = game.i18n.localize(CONFIG.OSE.exploration_skills[system.exploration]);
    return {
      value: system.effectiveTarget,
      tooltip: game.i18n.format("OSE.abilities.TargetFromExploration", { skill }),
    };
  }

  // Which class's slots an embedded spell uses, when there's a choice.
  #castAsOptions() {
    const pools = this.item.type === "spell" ? this.item.parent?.system?.spellPools : null;
    if (!pools?.length) return null;
    return {
      "": game.i18n.localize("OSE.spells.CastAsAuto"),
      ...Object.fromEntries(pools.map((p) => [p.key, p.name])),
      none: game.i18n.localize("OSE.spells.Other"),
    };
  }

  async #prepareClassContext() {
    const { system } = this.item;
    const abilityLinks = await Promise.all(
      (system.abilities ?? []).map(async (a) => {
        const doc = a.uuid ? await fromUuid(a.uuid) : null;
        const [tableKey, column] = (a.target ?? "").split(".");
        const col = system.tables?.find((t) => t.key === tableKey)?.columns.find((c) => c.key === column);
        return {
          ...a,
          name: doc?.name ?? a.uuid,
          missing: !doc,
          targetName: col?.name || col?.key || "",
          defaultTarget: doc?.system?.targetFrom ?? "",
        };
      }),
    );
    suggestions ??= this.isEditable ? loadSuggestions() : null;
    const known = (await suggestions) ?? { classKeys: [], weapons: [], tableColumns: [] };
    const list = (values) => new Intl.ListFormat(game.i18n.lang, { type: "conjunction" }).format(values);
    const context = {
      abilityLinks,
      embedded: !!this.item.parent,
      isClass: this.item.type === "class",
      editing: this.editing,
      languagesText: system.languages.join(", "),
      languageChoices: ["Alignment", ...CONFIG.OSE.languages],
      spellListChoices: CONFIG.OSE.spellLists ?? [],
      classKeyChoices: known.classKeys,
    };
    if (this.item.type === "race") {
      const changes = readChanges(this.#modifierEffect() ?? {});
      const scoreKeys = Object.keys(CONFIG.OSE.scores);
      const modifier = (k) => changes.find((c) => c.key === `system.scores.${k}.value`)?.value ?? "";
      const signed = (v) => (Number(v) > 0 ? `+${v}` : `${v}`);
      const scoreLabel = (k) => k.toUpperCase();
      const mods = scoreKeys.filter((k) => modifier(k) !== "").map((k) => `${signed(modifier(k))} ${scoreLabel(k)}`);
      const mins = scoreKeys
        .filter((k) => system.requirements[k]?.min)
        .map((k) => `${scoreLabel(k)} ${system.requirements[k].min}`);
      const maxes = scoreKeys
        .filter((k) => system.requirements[k]?.max)
        .map((k) => `${scoreLabel(k)} ${system.requirements[k].max}`);
      return {
        ...context,
        scoreKeys,
        modifiersText: mods.length ? mods.join(", ") : game.i18n.localize("OSE.race.NoModifiers"),
        requirementsText: [
          mins.length ? game.i18n.format("OSE.race.MinimumText", { scores: list(mins) }) : "",
          maxes.length ? game.i18n.format("OSE.race.MaximumText", { scores: list(maxes) }) : "",
        ]
          .filter(Boolean)
          .join("; "),
        modifiers: Object.fromEntries(
          scoreKeys.map((k) => [k, this.editing ? modifier(k) : modifier(k) === "" ? "" : signed(modifier(k))]),
        ),
        requirementRows: ["min", "max"].map((bound) => ({
          bound,
          label: bound === "min" ? "OSE.race.Minimum" : "OSE.race.Maximum",
          values: scoreKeys.map((score) => ({ score, value: system.requirements[score]?.[bound] ?? "" })),
        })),
      };
    }
    if (this.item.type !== "class") return context;
    const actor = this.item.parent;
    const scores = actor ? scoreValues(actor.system.scores) : {};
    const armour = new Set(system.armour);
    const armourLabel = (value) => game.i18n.localize(`OSE.classes.armour.${value}`);
    // Titles beyond the maximum level are kept, just not shown.
    const titleCount = system.levels.length;
    return {
      ...context,
      saveKeys: SAVE_KEYS,
      // Viewing shows only spell levels the class ever gets slots for.
      spellLevels: ["1", "2", "3", "4", "5", "6"].filter(
        (lvl) => this.editing || system.levels.some((row) => row.spellSlots?.[lvl] > 0),
      ),
      scoreOptions: Object.fromEntries(Object.keys(CONFIG.OSE.scores).map((k) => [k, k.toUpperCase()])),
      logicOptions: { and: game.i18n.localize("OSE.classes.LogicAnd"), or: game.i18n.localize("OSE.classes.LogicOr") },
      armourOptions: ["none", "leather", "chain", "plate", "shield"].map((value) => ({
        value,
        label: armourLabel(value),
        selected: armour.has(value),
      })),
      armourAllowed: system.armour.map(armourLabel).join(", "),
      // Viewing lists only levels that have a title while editing shows every level.
      titleRows: Array.from({ length: titleCount }, (_, i) => ({
        index: i,
        level: i + 1,
        title: system.titles[i] ?? "",
      })).filter((row) => this.editing || row.title),
      showTitles: this.editing || system.titles.some(Boolean),
      primeReqRows: primeReqDisplayOrder(system.primeReqs).map((r) => ({
        ...r,
        percentText: `${r.percentage > 0 ? "+" : ""}${r.percentage}%`,
      })),
      primeReqText: list([...new Set(system.primeReqs.map((r) => r.ability.toUpperCase()))]),
      rules: CONFIG.OSE.rulesReferences ?? {},
      primeReqStandard: standardPrimeReq(system.primeReqs) ?? "",
      primeReqCustom: this.primeReqCustom,
      primeReqEditable: this.editing && this.primeReqCustom,
      weaponsList: system.weapons.join(", "),
      stealthList: system.stealthSkills.join(", "),
      xpText: system.levels.map((row) => formatNumber(row.xp)),
      // A character's level in this class, up to the class's maximum.
      levelOptions: system.levels.length
        ? Object.fromEntries(
            system.levels.map((_, i) => [i + 1, system.titles[i] ? `${i + 1} (${system.titles[i]})` : `${i + 1}`]),
          )
        : null,
      legendChoices: system.tables.map((t) => legendSuggestions(t)),
      cellHints: system.tables.map((t) =>
        t.rows.map((row) => Object.fromEntries(t.columns.map((c) => [c.key, cellHint(t.legend, row[c.key])]))),
      ),
      columnHeaders: system.tables.map((t) => Object.fromEntries(t.columns.map((c) => [c.key, columnHeader(c.key)]))),
      formulaKeys: system.tables.map((t) => Object.fromEntries(t.columns.map((c) => [c.key, isFormulaKey(c.key)]))),
      hitDieChoices: ["1d4", "1d6", "1d8", "1d10", "1d12"],
      weaponChoices: known.weapons,
      stealthChoices: [...new Set(abilityLinks.map((l) => l.name.replace(/\s*\([A-Z]+\)$/, "")))],
      targetChoices: system.tables.flatMap((t) =>
        t.columns.map((c) => ({ value: `${t.key}.${c.key}`, label: `${c.name || columnHeader(c.key)} (${t.label})` })),
      ),
      computedBonus: actor ? primeReqBonus(system.primeReqs, scores) : "",
    };
  }

  _processFormData(event, form, formData) {
    const data = super._processFormData(event, form, formData);
    data.system ??= {};
    const ordered = (o) =>
      Array.isArray(o)
        ? o
        : Object.keys(o ?? {})
            .sort((a, b) => a - b)
            .map((k) => o[k]);
    if (data.system.titles) {
      // Only titles up to the maximum level are on the form, keep the rest.
      const submitted = ordered(data.system.titles);
      const titles = [...submitted, ...this.item.system.titles.slice(submitted.length)].map((t) =>
        String(t ?? "").trim(),
      );
      while (titles.length && !titles.at(-1)) titles.pop();
      data.system.titles = titles;
    }
    if (data.system.tables) {
      // Cells are text inputs keeping numbers as numbers.
      const cell = (v) => (typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v.trim()) ? Number(v) : v);
      const submitted = ordered(data.system.tables).map((t) => ({
        ...t,
        columns: ordered(t.columns),
        rows: ordered(t.rows).map((row) => Object.fromEntries(Object.entries(row ?? {}).map(([k, v]) => [k, cell(v)]))),
      }));
      const stored = this.item.system.toObject().tables;
      data.system.tables = renameColumnKeys(stored, submitted).map((t, i) => ({
        ...t,
        legend: submitted[i]?.legend
          ? ordered(submitted[i].legend).map((l) => ({ value: String(l.value ?? "").trim(), text: l.text ?? "" }))
          : (stored[i]?.legend ?? []),
      }));
    }
    if (data.system.levels) {
      // Empty spell slot inputs mean no slots, not a slot count of null.
      data.system.levels = ordered(data.system.levels).map((row) => ({
        ...row,
        spellSlots: Object.fromEntries(Object.entries(row.spellSlots ?? {}).filter(([, n]) => n !== null && n !== "")),
      }));
    }
    if ("maxLevel" in data.system && this.item.type === "class") Object.assign(data, this.#resized(data));
    if (data.primeReqAbility && data.primeReqAbility !== standardPrimeReq(this.item.system.primeReqs)) {
      data.system.primeReqs = defaultPrimeReqs([data.primeReqAbility]);
    }
    delete data.primeReqAbility;
    return data;
  }

  _onChangeForm(formConfig, event) {
    super._onChangeForm(formConfig, event);
    if (event.target?.name === "system.level" && this.item.type === "class" && this.item.parent) {
      this.#offerXpForLevel(Number(event.target.value));
    }
  }

  async #offerXpForLevel(level) {
    const { levels, xp } = this.item.system;
    const target = xpForLevel(levels, level, xp);
    if (target === null) return;
    const ok = await foundry.applications.api.DialogV2.confirm({
      window: { title: this.item.name },
      content: `<p>${game.i18n.format("OSE.classes.SetXpForLevel", {
        level,
        current: formatNumber(xp),
        xp: formatNumber(target),
      })}</p>`,
      rejectClose: false,
    });
    if (ok) await this.item.update({ "system.xp": target });
  }

  _onRender(context, options) {
    super._onRender(context, options);
    for (const input of this.element.querySelectorAll("[data-modifier]")) {
      input.addEventListener("change", (ev) => this.#setModifier(ev.target.dataset.modifier, ev.target.value));
    }
    // Dropping a class or race onto an ability's requirements adds its key.
    const requirements = this.element.querySelector("[data-drop-requirements]");
    if (requirements && this.isEditable) {
      requirements.addEventListener("dragover", (ev) => ev.preventDefault());
      requirements.addEventListener("drop", (ev) => this.#onDropRequirement(ev));
    }
    const dropZone = this.element.querySelector('[data-drop="abilities"]');
    if (dropZone && this.isEditable) {
      dropZone.addEventListener("dragover", (ev) => ev.preventDefault());
      dropZone.addEventListener("drop", (ev) => this.#onDropAbility(ev));
    }
    for (const input of this.element.querySelectorAll("[data-list-input]")) {
      input.addEventListener("keydown", (ev) => {
        if (ev.key !== "Enter") return;
        ev.preventDefault();
        this.#addListValue(input.dataset.listInput, input.value);
      });
    }
    // Ability links reorder by dragging their rows.
    for (const row of this.element.querySelectorAll("tr[data-link-index]")) {
      row.addEventListener("dragstart", (ev) => {
        ev.dataTransfer.setData("text/plain", JSON.stringify({ type: "OseAbilityLink", index: row.dataset.linkIndex }));
      });
    }
    const tagInput = this.element.querySelector('input[data-action="addTag"]');
    if (!tagInput) return;
    tagInput.addEventListener("keydown", (ev) => {
      if (ev.key !== "Enter") return;
      ev.preventDefault();
      const value = ev.currentTarget.value;
      if (!value) return;
      this.item.pushManualTag(value.split(","));
      ev.currentTarget.value = "";
    });
  }

  static _onTagDelete(_event, target) {
    return this.item.popManualTag(target.closest("[data-tag]")?.dataset.tag);
  }

  static _onMeleeToggle() {
    return this.item.update({ "system.melee": !this.item.system.melee });
  }

  static _onMissileToggle() {
    return this.item.update({ "system.missile": !this.item.system.missile });
  }

  #modifierEffect() {
    return this.item.effects.find((e) => e.getFlag(game.system.id, "raceModifiers"));
  }

  // Race ability modifiers live in one transferred Active Effect.
  async #setModifier(score, value) {
    const key = `system.scores.${score}.value`;
    const effect = this.#modifierEffect();
    const changes = readChanges(effect ?? {}).filter((c) => c.key !== key);
    const n = Number(value);
    if (n) changes.push({ key, type: "add", value: n });
    const data = buildEffectData(this.item.name, changes, game.release.generation, {
      transfer: true,
      flags: { [game.system.id]: { raceModifiers: true } },
    });
    if (effect) return effect.update(data);
    return this.item.createEmbeddedDocuments("ActiveEffect", [data]);
  }

  async #onDropRequirement(event) {
    event.preventDefault();
    const data = TextEditor.getDragEventData(event);
    if (data?.type !== "Item") return;
    const doc = await fromUuid(data.uuid);
    if (!["class", "race"].includes(doc?.type)) return;
    const key = doc.system.key || toKey(doc.name);
    const current = (this.item.system.requirements ?? "")
      .split(",")
      .map((r) => r.trim())
      .filter(Boolean);
    if (current.some((r) => toKey(r) === key)) return;
    return this.item.update({ "system.requirements": [...current, key].join(", ") });
  }

  async #onDropAbility(event) {
    event.preventDefault();
    const data = TextEditor.getDragEventData(event);
    const abilities = this.item.system.toObject().abilities;
    if (data?.type === "OseAbilityLink") {
      if (!this.editing) return;
      const from = Number(data.index);
      const to = Number(event.target.closest("tr[data-link-index]")?.dataset.linkIndex ?? abilities.length - 1);
      if (from === to) return;
      const [moved] = abilities.splice(from, 1);
      abilities.splice(to, 0, moved);
      return this.item.update({ "system.abilities": abilities });
    }
    if (data?.type !== "Item") return;
    const doc = await fromUuid(data.uuid);
    if (doc?.type !== "ability") return;
    if (abilities.some((a) => a.uuid === doc.uuid)) return;
    return this.item.update({
      "system.abilities": insertByLevel(abilities, { uuid: doc.uuid, level: 1, target: this.#defaultTarget(doc) }),
    });
  }

  // Progression and table rows follow the maximum level; rows above it are set aside, not deleted.
  #resized(data) {
    const scope = game.system.id;
    const source = this.item.system.toObject();
    const saves = Object.fromEntries(SAVE_KEYS.map((k) => [k, 15]));
    const blank = () => ({ xp: 0, hd: this.item.system.hitDie, hdcon: true, thac0: 19, bba: 0, saves, spellSlots: {} });
    const out = resizeLevels(
      { levels: data.system.levels ?? source.levels, tables: data.system.tables ?? source.tables },
      this.item.getFlag(scope, "levelStash"),
      Number(data.system.maxLevel),
      blank,
    );
    return {
      system: { ...data.system, maxLevel: out.levels.length || null, levels: out.levels, tables: out.tables },
      flags: foundry.utils.mergeObject(data.flags ?? {}, { [scope]: { levelStash: out.stash } }),
    };
  }

  static _onAddLevel() {
    return this.item.update(this.#resized({ system: { maxLevel: this.item.system.levels.length + 1 } }));
  }

  static _onRemoveLevel() {
    return this.item.update(this.#resized({ system: { maxLevel: this.item.system.levels.length - 1 } }));
  }

  static _onAddPrimeReq() {
    const primeReqs = this.item.system.toObject().primeReqs;
    primeReqs.push({ ability: "str", minScore: 13, percentage: 5, concatLogic: "and" });
    return this.item.update({ "system.primeReqs": primeReqs });
  }

  static async _onRemoveRow(_event, target) {
    const { field, index, name } = target.dataset;
    if (!(await OseItemSheet.#confirmDelete(name || game.i18n.localize("OSE.classes.ThisRow")))) return;
    const rows = this.item.system.toObject()[field];
    rows.splice(Number(index), 1);
    return this.item.update({ [`system.${field}`]: rows });
  }

  static _onAddClassLimit() {
    const classLimits = this.item.system.toObject().classLimits;
    classLimits.push({ classKey: "", maxLevel: 1 });
    return this.item.update({ "system.classLimits": classLimits });
  }

  // Class tables: nested arrays edited as whole copies.
  #editTables(fn) {
    const tables = this.item.system.toObject().tables;
    fn(tables);
    return this.item.update({ "system.tables": tables });
  }

  static _onAddTable() {
    const n = this.item.system.tables.length + 1;
    const rows = Array.from({ length: this.item.system.levels.length || 1 }, () => ({}));
    return this.#editTables((t) =>
      t.push({ key: `table${n}`, label: `Table ${n}`, columns: [{ key: "a", label: "A" }], rows }),
    );
  }

  static async _onRemoveTable(_event, target) {
    const index = Number(target.dataset.table);
    if (!(await OseItemSheet.#confirmDelete(this.item.system.tables[index]?.label))) return;
    return this.#editTables((t) => t.splice(index, 1));
  }

  static _onAddTableColumn(_event, target) {
    return this.#editTables((t) => {
      const table = t[Number(target.dataset.table)];
      const n = table.columns.length + 1;
      table.columns.push({ key: `c${n}`, name: "" });
    });
  }

  static _onAddLegendRow(_event, target) {
    return this.#editTables((t) => {
      const table = t[Number(target.dataset.table)];
      table.legend = [...(table.legend ?? []), { value: "", text: "" }];
    });
  }

  static async _onRemoveLegendRow(_event, target) {
    const [t, i] = [Number(target.dataset.table), Number(target.dataset.index)];
    const row = this.item.system.tables[t]?.legend?.[i];
    if (!(await OseItemSheet.#confirmDelete(row?.value || game.i18n.localize("OSE.classes.ThisRow")))) return;
    return this.#editTables((tables) => tables[t].legend.splice(i, 1));
  }

  static async _onRemoveTableColumn(_event, target) {
    const [t, c] = [Number(target.dataset.table), Number(target.dataset.column)];
    const column = this.item.system.tables[t]?.columns[c];
    if (!(await OseItemSheet.#confirmDelete(column?.name || columnHeader(column?.key ?? "")))) return;
    return this.#editTables((tables) => {
      const [column] = tables[t].columns.splice(c, 1);
      for (const row of tables[t].rows) delete row[column.key];
    });
  }

  static #confirmDelete(name) {
    return foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize("OSE.Delete") },
      content: `<p>${game.i18n.format("OSE.classes.ConfirmDelete", { name: foundry.utils.escapeHTML(name ?? "") })}</p>`,
      rejectClose: false,
    });
  }

  // Leaving custom mode replaces the rows with the standard table, so confirm if they differ.
  static async _onTogglePrimeReqCustom() {
    if (!this.primeReqCustom) {
      this.#primeReqCustom = true;
      return this.render();
    }
    const rows = this.item.system.primeReqs;
    const ability = rows[0]?.ability || "str";
    if (rows.length && !standardPrimeReq(rows)) {
      const ok = await foundry.applications.api.DialogV2.confirm({
        window: { title: game.i18n.localize("OSE.classes.PrimeRequisite") },
        content: `<p>${game.i18n.format("OSE.classes.PrimeRequisiteReplace", { ability: ability.toUpperCase() })}</p>`,
        rejectClose: false,
      });
      if (!ok) return this.render();
    }
    this.#primeReqCustom = false;
    return this.item.update({ "system.primeReqs": defaultPrimeReqs([ability]) });
  }

  static async _onCopyFormula(_event, target) {
    const { formula } = target.dataset;
    await game.clipboard.copyPlainText(formula);
    ui.notifications.info(game.i18n.format("OSE.classes.CopiedFormula", { formula }));
  }

  static _onToggleMode() {
    this.#editing = !this.editing;
    return this.render();
  }

  // String-array fields edited as tag lists: languages, weapons, stealthSkills.
  #addListValue(field, value) {
    const entry = String(value ?? "").trim();
    const values = this.item.system[field];
    if (!entry || values.includes(entry)) return;
    return this.item.update({ [`system.${field}`]: [...values, entry] });
  }

  static _onAddListValue(_event, target) {
    const { field } = target.dataset;
    return this.#addListValue(field, this.element.querySelector(`[data-list-input="${field}"]`)?.value);
  }

  static _onRemoveListValue(_event, target) {
    const { field, index } = target.dataset;
    const values = [...this.item.system[field]];
    values.splice(Number(index), 1);
    return this.item.update({ [`system.${field}`]: values });
  }

  // A dropped ability's roll target: its own table link if this class has that column, else a column
  // matching the abbreviation in its name, e.g. "Climb sheer surfaces (CS)" → skills.cs.
  #defaultTarget(doc) {
    const tables = this.item.system.tables ?? [];
    if (doc.system?.targetFrom && findTargetClass([{ key: "", tables }], doc.system.targetFrom)) {
      return doc.system.targetFrom;
    }
    const abbr = /\(([A-Za-z]{2,3})\)\s*$/.exec(doc.name)?.[1]?.toLowerCase();
    const table = abbr && tables.find((t) => t.columns.some((c) => c.key === abbr));
    return table ? `${table.key}.${abbr}` : "";
  }

  static _onSortAbilities() {
    return this.item.update({ "system.abilities": sortByLevel(this.item.system.toObject().abilities) });
  }

  // Rules pages are registered by content modules as a UUID with an optional #heading anchor.
  static async _onOpenRules(_event, target) {
    const [uuid, anchor] = (CONFIG.OSE.rulesReferences?.[target.dataset.rule] ?? "").split("#");
    const doc = await fromUuid(uuid);
    if (doc?.documentName === "JournalEntryPage") return doc.parent.sheet.render(true, { pageId: doc.id, anchor });
    return doc?.sheet?.render(true);
  }

  static async _onOpenUuid(_event, target) {
    const doc = await fromUuid(target.dataset.uuid);
    doc?.sheet?.render(true);
  }
}
