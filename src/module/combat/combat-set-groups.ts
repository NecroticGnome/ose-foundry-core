import { OSE } from "../config";
import type { OSECombatant } from "./combatant";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

export default class OSECombatGroupSelector extends HandlebarsApplicationMixin(ApplicationV2) {
  _highlighted;

  // ===========================================================================
  // APPLICATION SETUP
  // ===========================================================================
  static DEFAULT_OPTIONS = {
    id: "combat-set-groups-{id}",
    classes: ["combat-set-groups"],
    tag: "form",
    window: {
      frame: true,
      positioned: true,
      title: "OSE.combat.SetCombatantGroups",
      icon: "fa-solid fa-flag",
      controls: [],
      minimizable: false,
      resizable: true,
      contentTag: "section",
      contentClasses: [],
    },
    actions: {},
    form: {
      handler: undefined,
      submitOnChange: true,
    },
    position: {
      width: 600,
      height: "auto",
    },
  };

  static PARTS = {
    main: {
      template: "/systems/ose-dev/dist/templates/apps/combat-set-groups.hbs",
    },
  };

  // ===========================================================================
  // RENDER SETUP
  // ===========================================================================

  /** @inheritDoc */
  async _prepareContext(options) {
    return {
      groups: OSE.colors,
      combatants: game.combat?.combatants || [],
    };
  }

  /** @inheritDoc */
  _onRender(context, options) {
    super._onRender(context, options);
    for (const li of this.element.querySelectorAll("[data-combatant-id]")) {
      li.addEventListener("mouseover", this.#onCombatantHoverIn.bind(this));
      li.addEventListener("mouseout", this.#onCombatantHoverOut.bind(this));
    }
    this.element.addEventListener("change", this._updateObject);
  }

  // ===========================================================================
  // UPDATING
  // ===========================================================================

  /** @inheritDoc */
  protected async _updateObject(event: Event): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    const input = event.target as HTMLInputElement;
    if (!input?.name || !input?.value) return;
    const combatant = game.combat?.combatants.get(input.name) as OSECombatant;
    if (!combatant) return;
    await combatant.assignGroup(input.value);
  }

  // ===========================================================================
  // UI EVENTS
  // ===========================================================================

  #onCombatantHoverIn(event: PointerEvent) {
    event.preventDefault();
    if (!canvas.ready) return;
    const li = event.currentTarget as HTMLLIElement;
    const { combatantId } = li.dataset;
    if (!combatantId) return;
    const combatant = game.combat?.combatants.get(combatantId) as OSECombatant;
    const token = combatant.token?.object as Token;
    if (token?.isVisible) {
      if (!token.controlled) {
        token._onHoverIn(event, { hoverOutOthers: true });
      }
      this._highlighted = token;
    }
  }

  #onCombatantHoverOut(event: PointerEvent) {
    event.preventDefault();
    if (this._highlighted) {
      this._highlighted._onHoverOut(event);
    }
    this._highlighted = null;
  }
}
