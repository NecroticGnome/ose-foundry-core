/**
 * @file The base class for all encumbrance schemes. Feel free to extend this to make your own schemes!
 */
export interface CharacterEncumbrance {
  variant: string;
  enabled: boolean;
  pct: number;
  encumbered: boolean;
  steps: number[];
  value: number;
  max: number;
  atFirstBreakpoint: boolean | null;
  atSecondBreakpoint: boolean | null;
  atThirdBreakpoint: boolean | null;
}

/**
 * A class to handle character encumbrance.
 */
export default class OseDataModelCharacterEncumbrance
  implements CharacterEncumbrance
{
  static baseEncumbranceCap = 1600;

  // Default encumbrance steps used by the 'complete' and 'detailed' encumbrance variants
  static encumbranceSteps = {
    quarter: (1 / 4) * 100,
    threeEighths: (3 / 8) * 100,
    half: (1 / 2) * 100,
  };

  #encumbranceVariant;

  #max;

  #weight = 0;

  /**
   * The constructor
   *
   * @param {string} variant - The name of this encumbrance variant.
   * @param {number} max - The max weight this character can carry
   * @param {Item[]} items - The items this character is carrying. Note: we're not using this in the base class.
   */
  constructor(
    variant = "disabled",
    max = OseDataModelCharacterEncumbrance.baseEncumbranceCap
  ) {
    this.#encumbranceVariant = variant;
    this.#max = max;
  }

  static defineSchema() {
    const { ArrayField, BooleanField, NumberField, SchemaField, StringField } =
      foundry.data.fields;

    return new SchemaField({
      variant: new StringField({ initial: "disabled" }),
      enabled: new BooleanField({ initial: true }),
      encumbered: new BooleanField({ initial: false }),
      pct: new NumberField({ integer: false, initial: 0, min: 0, max: 100 }),
      steps: new ArrayField(new NumberField()),
      value: new NumberField({ integer: false }),
      max: new NumberField({
        integer: false,
        initial: OseDataModelCharacterEncumbrance.baseEncumbranceCap,
      }),
      atFirstBreakpoint: new BooleanField({ initial: false }),
      atSecondBreakpoint: new BooleanField({ initial: false }),
      atThirdBreakpoint: new BooleanField({ initial: false }),
    });
  }

  get variant() {
    return this.#encumbranceVariant;
  }

  get enabled() {
    return this.#encumbranceVariant !== "disabled";
  }

  get pct() {
    return Math.clamp((this.value / this.max) * 100, 0, 100);
  }

  get encumbered() {
    return this.value > this.max;
  }

  // eslint-disable-next-line class-methods-use-this
  get steps(): number[] {
    return [];
  }

  get value(): number {
    return this.#weight;
  }

  get max() {
    return this.#max;
  }

  set max(value) {
    this.#max = value;
  }

  get #delta() {
    return this.max - OseDataModelCharacterEncumbrance.baseEncumbranceCap;
  }

  get atThirdBreakpoint() {
    return this.pct > OseDataModelCharacterEncumbrance.encumbranceSteps.half;
  }

  get atSecondBreakpoint() {
    return (
      this.pct > OseDataModelCharacterEncumbrance.encumbranceSteps.threeEighths
    );
  }

  get atFirstBreakpoint() {
    return this.pct > OseDataModelCharacterEncumbrance.encumbranceSteps.quarter;
  }

  // eslint-disable-next-line class-methods-use-this
  get defaultMax() {
    return (this.constructor as typeof OseDataModelCharacterEncumbrance)
      .baseEncumbranceCap;
  }

  get alternateMax() {
    return this.defaultMax;
  }
}
