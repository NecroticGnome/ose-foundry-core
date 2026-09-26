/**
 * @file Contains helpers for tag generation
 */

import type { RollType } from "./config";

const OseTags = {
  /**
   * Returns the formula used for dice roll calculations
   * @param actor - The actor object which owns the item with roll data
   * @param data.roll - The string used to generate a formula
   * @returns tagFormula - The constructed roll formula
   */
  rollTagFormula({ actor = {}, data = { roll: "" } }: { actor?: unknown; data?: { roll?: string } } = {}) {
    const formulaData = {
      actor,
      data,
    };

    const tagFormula = new Roll(data.roll ?? "", formulaData).formula;
    return tagFormula;
  },

  /**
   * Returns the roll type and target value of rolls
   * @param rollType - Type of roll target used
   * @returns tagTarget - The constructed type and target value
   */
  rollTagTarget({ rollType = "", rollTarget = null }: { rollType?: RollType | ""; rollTarget?: number | null } = {}) {
    // Indexing with "" yields undefined, which the original relies on; preserved.
    const tagTarget = rollTarget === null ? "" : ` ${CONFIG.OSE.roll_type[rollType as RollType]}${rollTarget}`;

    return tagTarget;
  },
};

export default OseTags;
