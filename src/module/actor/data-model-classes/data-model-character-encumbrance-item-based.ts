/**
 * @file A class representing the "Item-based" encumbrance scheme from Carcass Crawler Issue Two
 */
import OseDataModelCharacterEncumbrance, {
  CharacterEncumbrance,
} from "./data-model-character-encumbrance";

/**
 * @todo Add template path for encumbrance bar
 * @todo Add template path for inventory item row
 */
export default class OseDataModelCharacterEncumbranceItemBased
  extends OseDataModelCharacterEncumbrance
  implements CharacterEncumbrance
{
  static packedEncumbranceSteps = {
    fiveEighths: 62.5, // 10/16
    threeQuarters: 75, // 12/16
    sevenEighths: 87.5, // 14/16
  };

  static equippedEncumbranceSteps = {
    oneThird: 33.33, // 3/9
    fiveNinths: 55.55, // 5/9
    sevenNinths: 77.77, // 7/9
  };

  #equippedMax;

  #packedMax;

  #max;

  #atFiveEighths;
  #atThreeQuarters;
  #atSevenEights;

  #atOneThird;
  #atFiveNinths;
  #atSevenNinths;

  static templateEncumbranceBar = "";

  static templateInventoryRow = "";

  /**
   * The machine-readable label for this encumbrance scheme
   */
  static type = "itembased";

  /**
   * The human-readable label for this encumbrance scheme
   */
  static localizedLabel = "OSE.Setting.EncumbranceItemBased";

  #weight;

  #equippedWeight;

  #packedWeight;

  #weightMod;

  // eslint-disable-next-line sonarjs/cognitive-complexity, @typescript-eslint/no-unused-vars
  constructor(max = 16, items: OseItem[] = [], options = {}) {
    super(OseDataModelCharacterEncumbranceItemBased.type, max);
    if (game.settings.get(game.system.id, "encumbranceItemStrengthMod")) {
      this.#weightMod =
        options.scores?.str?.mod > 0 ? options.scores.str.mod : 0;
    } else {
      this.#weightMod = 0;
    }
    this.#packedMax = 16;
    this.#equippedMax = 9;
    this.#packedWeight =
      Math.ceil(
        items.reduce((acc, item: OseItem) => {
          if (item.type === "item" && item.system.isCoinsOrGems) {
            // Coins and gems are handled below
            return acc;
          }
          if (item.type === "item" && !item.equipped) {
            return (
              acc +
              Math.ceil(item.system.quantity.value * item.system.itemslots)
            );
          }
          if (item.type === "container") {
            // Containers only count when they are not in use, i.e. are empty
            return item.system.itemIds?.length
              ? acc
              : acc + item.system.itemslots;
          }
          if (
            ["weapon", "armor"].includes(item.type) &&
            !item.system.equipped
          ) {
            return acc + item.system.itemslots;
          }

          return acc;
        }, 0)
      ) +
      Math.ceil(
        items.reduce((acc, item: OseItem) => {
          if (item.type === "item" && item.system.isCoinsOrGems) {
            // Up to 100 coins or gems count as 1 item.
            return acc + item.system.quantity.value / 100;
          }

          return acc;
        }, 0)
      );
    this.#equippedWeight = Math.ceil(
      items.reduce(
        (acc, { type, system: { quantity, itemslots, equipped } }: Item) => {
          if (type === "item" && equipped)
            return acc + Math.ceil(quantity.value * itemslots);
          if (["weapon", "armor"].includes(type) && equipped)
            return acc + itemslots;
          return acc;
        },
        0
      )
    );
    this.#weight = this.usingEquippedEncumbrance
      ? this.#equippedWeight
      : this.#packedWeight;

    this.#max = this.usingEquippedEncumbrance
      ? this.#equippedMax
      : this.#packedMax;

    // Use raw values rather than percentages due to floating point precision issues.
    this.#atFiveEighths = this.#weight - this.#weightMod > 10;
    this.#atThreeQuarters = this.#weight - this.#weightMod > 12;
    this.#atSevenEights = this.#weight - this.#weightMod > 14;

    this.#atOneThird = this.#weight > 3;
    this.#atFiveNinths = this.#weight > 5;
    this.#atSevenNinths = this.#weight > 7;
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
      max: new NumberField({ integer: false }),
      atFirstBreakpoint: new BooleanField({ initial: false }),
      atSecondBreakpoint: new BooleanField({ initial: false }),
      atThirdBreakpoint: new BooleanField({ initial: false }),
      equippedSteps: new ArrayField(new NumberField()),
      packedSteps: new ArrayField(new NumberField()),
      equippedPct: new NumberField({ integer: false, min: 0, max: 100 }),
      packedPct: new NumberField({ integer: false, min: 0, max: 100 }),
      equippedValue: new NumberField({ integer: false }),
      packedValue: new NumberField({ integer: false }),
      equippedLabel: new StringField({ initial: "0/0" }),
      packedLabel: new StringField({ initial: "0/0" }),
      usingEquippedEncumbrance: new BooleanField({ initial: true }),
      weightMod: new NumberField({ integer: true, initial: 0 }),
    });
  }

  get steps() {
    return this.usingEquippedEncumbrance
      ? Object.values(
          OseDataModelCharacterEncumbranceItemBased.equippedEncumbranceSteps
        )
      : Object.values(
          OseDataModelCharacterEncumbranceItemBased.packedEncumbranceSteps
        );
  }

  get usingEquippedEncumbrance() {
    const equippedValues = Object.values(
      OseDataModelCharacterEncumbranceItemBased.equippedEncumbranceSteps
    );
    const packedValues = Object.values(
      OseDataModelCharacterEncumbranceItemBased.packedEncumbranceSteps
    );
    let equippedIndex = equippedValues.findIndex(
      (step) => step > (this.#equippedWeight / this.#equippedMax) * 100
    );
    equippedIndex = equippedIndex === -1 ? 4 : equippedIndex;

    let packedIndex = packedValues.findIndex(
      (step) =>
        step >
        ((this.#packedWeight - this.#weightMod) /
          (this.#packedMax + this.#weightMod)) *
          100
    );
    packedIndex = packedIndex === -1 ? 4 : packedIndex;
    if (equippedIndex === 0 && packedIndex === 0) {
      // both are under the first breakpoint, use weight comparison
      return this.#equippedWeight >= this.#packedWeight - this.#weightMod;
    }

    return equippedIndex >= packedIndex;
  }

  get value(): number {
    return this.#weight;
  }

  get max(): number {
    return this.#max;
  }

  get atFirstBreakpoint(): boolean {
    return this.usingEquippedEncumbrance
      ? this.#atOneThird
      : this.#atFiveEighths;
  }

  get atSecondBreakpoint(): boolean {
    return this.usingEquippedEncumbrance
      ? this.#atFiveNinths
      : this.#atThreeQuarters;
  }

  get atThirdBreakpoint(): boolean {
    return this.usingEquippedEncumbrance
      ? this.#atSevenNinths
      : this.#atSevenEights;
  }

  get encumbered() {
    return this.value > this.max + this.#weightMod;
  }

  // eslint-disable-next-line class-methods-use-this
  get equippedSteps() {
    return Object.values(
      OseDataModelCharacterEncumbranceItemBased.equippedEncumbranceSteps
    );
  }

  // eslint-disable-next-line class-methods-use-this
  get packedSteps() {
    return Object.values(
      OseDataModelCharacterEncumbranceItemBased.packedEncumbranceSteps
    );
  }

  get equippedPct() {
    return Math.clamp((100 * this.#equippedWeight) / this.#equippedMax, 0, 100);
  }

  get packedPct() {
    return Math.clamp(
      (100 * (this.#packedWeight - this.#weightMod)) / this.#packedMax,
      0,
      100
    );
  }

  get equippedValue(): number {
    return this.#equippedWeight;
  }

  get packedValue(): number {
    return this.#packedWeight;
  }

  get equippedLabel(): string {
    return `${this.#equippedWeight}/${this.#equippedMax}`;
  }

  get packedLabel(): string {
    return `${this.#packedWeight}/${this.#packedMax + this.#weightMod}`;
  }
}
