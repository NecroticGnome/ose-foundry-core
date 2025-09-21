/**
 * @file A class representing the "Disabled" encumbrance scheme;
 *       we aren't tracking carry weight here.
 */
import OseDataModelCharacterEncumbrance, {
  CharacterEncumbrance,
} from "./data-model-character-encumbrance";

// import { OSE } from '../../config';

/**
 * @todo Add template path for encumbrance bar
 * @todo Add template path for inventory item row
 */
export default class OseDataModelCharacterEncumbranceDisabled
  extends OseDataModelCharacterEncumbrance
  implements CharacterEncumbrance
{
  static templateEncumbranceBar = "";

  static templateInventoryRow = "";

  /**
   * The machine-readable label for this encumbrance scheme
   */
  static type = "disabled";

  /**
   * The human-readable label for this encumbrance scheme
   */
  static localizedLabel = "OSE.Setting.EncumbranceDisabled";

  constructor() {
    super(OseDataModelCharacterEncumbranceDisabled.type);
  }

  static defineSchema() {
    const { ArrayField, BooleanField, NumberField, SchemaField, StringField } =
      foundry.data.fields;

    return new SchemaField({
      variant: new StringField({
        initial: OseDataModelCharacterEncumbranceDisabled.type,
      }),
      enabled: new BooleanField({ initial: true }),
      encumbered: new BooleanField({ initial: false }),
      pct: new NumberField({ integer: false, initial: 0, min: 0, max: 100 }),
      steps: new ArrayField(new NumberField()),
      value: new NumberField({ integer: false }),
      max: new NumberField({ integer: false }),
      atFirstBreakpoint: new BooleanField({ initial: false }),
      atSecondBreakpoint: new BooleanField({ initial: false }),
      atThirdBreakpoint: new BooleanField({ initial: false }),
    });
  }

  // eslint-disable-next-line class-methods-use-this
  get value(): number {
    return 0;
  }
}
