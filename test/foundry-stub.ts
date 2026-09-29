/**
 * @file Minimal Foundry globals for running data-model logic under Vitest.
 *
 * Mirrors only what the item data models touch: the `TypeDataModel` base, the
 * schema field classes used by `defineSchema()`, `CONFIG.OSE`, and
 * `game.i18n.localize`. Anything beyond that is deliberately absent — a test
 * that needs more Foundry than this belongs in the Quench suite.
 */
import { OSE } from "../src/module/config";

interface FieldOptions {
  initial?: unknown;
}

class DataField {
  options: FieldOptions;

  constructor(options: FieldOptions = {}) {
    this.options = options ?? {};
  }

  getInitialValue(): unknown {
    return this.options.initial;
  }
}

class StringField extends DataField {
  getInitialValue() {
    return this.options.initial ?? "";
  }
}

class NumberField extends DataField {
  getInitialValue() {
    return this.options.initial ?? null;
  }
}

class BooleanField extends DataField {
  getInitialValue() {
    return this.options.initial ?? false;
  }
}

class ArrayField extends DataField {
  constructor(
    readonly element: DataField,
    options: FieldOptions = {},
  ) {
    super(options);
  }

  getInitialValue() {
    return this.options.initial ?? [];
  }
}

class ObjectField extends DataField {
  getInitialValue() {
    return this.options.initial ?? {};
  }
}

class SchemaField extends DataField {
  constructor(
    readonly fields: Record<string, DataField>,
    options: FieldOptions = {},
  ) {
    super(options);
  }

  getInitialValue() {
    return Object.fromEntries(Object.entries(this.fields).map(([key, field]) => [key, field.getInitialValue()]));
  }
}

/**
 * Stands in for `foundry.abstract.TypeDataModel`. Foundry runs `migrateData`
 * over the source before initializing fields, so this does too — otherwise
 * migration logic would be untestable here.
 */
class TypeDataModel {
  parent: unknown;

  /** The cleaned source, as Foundry exposes it. Tag helpers read roll data off this. */
  _source: Record<string, unknown> = {};

  constructor(source: Record<string, unknown> = {}, options: { parent?: unknown } = {}) {
    const ctor = new.target as unknown as {
      defineSchema(): Record<string, DataField>;
      migrateData?(source: Record<string, unknown>): Record<string, unknown>;
    };

    this.parent = options.parent;

    const migrated = ctor.migrateData ? ctor.migrateData({ ...source }) : source;
    const schema = ctor.defineSchema();

    for (const [key, field] of Object.entries(schema)) {
      const provided = migrated[key];
      const value = provided === undefined ? field.getInitialValue() : provided;
      this._source[key] = value;
      Object.defineProperty(this, key, {
        value,
        writable: true,
        enumerable: true,
        configurable: true,
      });
    }
  }

  /** Merges changes into the source and the initialized fields, as Foundry does. */
  updateSource(changes: Record<string, unknown> = {}) {
    for (const [key, value] of Object.entries(changes)) {
      this._source[key] = value;
      (this as Record<string, unknown>)[key] = value;
    }
    return changes;
  }
}

/**
 * Stands in for Foundry's Roll. Only `formula` is used by the tag helpers, and
 * this returns the expression verbatim — Foundry normalizes spacing, so tests
 * here assert the raw string where Quench asserts the normalized one.
 */
class Roll {
  formula: string;

  constructor(formula = "", _data: unknown = {}) {
    this.formula = formula;
  }
}

Object.assign(globalThis, {
  Roll,
  foundry: {
    abstract: { TypeDataModel },
    data: {
      fields: { DataField, StringField, NumberField, BooleanField, ArrayField, ObjectField, SchemaField },
    },
  },
  CONFIG: { OSE },
  game: {
    system: { id: "ose" },
    i18n: {
      localize: (key: string) => key,
    },
  },
});
