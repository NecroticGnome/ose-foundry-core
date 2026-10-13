import { movementAllowance } from "./movement-rates";

export default class TokenRulerOSE extends foundry.canvas.placeables.tokens.TokenRuler {
  static STYLES = {
    stay: { color: 0x00_00_ff },
    move: { color: 0x00_ff_00 },
    exceed: { color: 0x99_00_00 },
  };

  /** @override */
  _getGridHighlightStyle(waypoint, offset) {
    const style = super._getGridHighlightStyle(waypoint, offset);
    const actor = this.token?.actor;
    if (!actor || !style?.color) return style;

    const allowance = movementAllowance(
      actor.system?.details?.movement ?? "",
      actor.system?.movement?.base ?? 120,
      waypoint.action,
      actor.inCombat,
    );
    if (waypoint.measurement.spaces === 0) return foundry.utils.mergeObject(style, this.constructor.STYLES.stay);
    if (waypoint.measurement.cost > allowance) return foundry.utils.mergeObject(style, this.constructor.STYLES.exceed);
    return foundry.utils.mergeObject(style, this.constructor.STYLES.move);
  }
}
