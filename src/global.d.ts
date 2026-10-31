/// <reference types="@league-of-foundry-developers/foundry-vtt-types" />

import type { describeDerivation } from "./module/classes/derive";
import type { rollsStartingHp } from "./module/classes/levels";
import type { startingProgress } from "./module/classes/progression";
import { OseCombat } from "./module/combat";
import type { OseConfig } from "./module/config";
import type { convertSingleActor } from "./module/migration/convert-actor";

declare global {
  // Configure foundry-vtt-types for lenient typing
  // Assume all initialization hooks have run for full Game type coverage
  interface AssumeHookRan {
    init: never;
    i18nInit: never;
    setup: never;
    ready: never;
  }

  interface CONFIG {
    OSE: OseConfig;
  }

  // Foundry extends Math with clamp() (see foundry client primitives/math),
  // but the League v13 types don't re-export it via the main entry.
  interface Math {
    clamp(value: number, min: number, max: number): number;
  }

  interface Game {
    ose: {
      rollItemMacro: (itemName: string) => Promise<void>;
      rollTableMacro: (tableUuid: string) => Promise<void>;
      describeDerivation: typeof describeDerivation;
      startingProgress: typeof startingProgress;
      rollsStartingHp: typeof rollsStartingHp;
      convertSingleActor: typeof convertSingleActor;
      oseCombat: OseCombat;
    };
  }
  
  namespace Game {
    interface SystemData<T> {
      /**
       * Defining game.system.id as a const
       */
      id: "ose";
    }
  }
}

declare module "@league-of-foundry-developers/foundry-vtt-types/configuration" {
  namespace Hooks {
    interface HookConfig {
      "ose.preSpendSpell": (item: Item.Implementation, config: { consume: boolean }) => boolean | void;
      "ose.preApplyStartingHp": (actor: Actor.Implementation, classItem: Item.Implementation, update: Record<string, number>) => void;
    }
  }
}

type Override<Type, NewType extends { [key in keyof Type]?: NewType[key] }> = Omit<Type, keyof NewType> & NewType;

type OseContextMenuEntry = Override<ContextMenuEntry, {
  /**
   * The function to call when the menu item is clicked. Receives the HTML element of the SidebarTab entry that this context menu is for.
   */
  callback: (target: HTMLElement) => void;

  /**
   * A function to call to determine if this item appears in the menu. Receives the HTML element of the SidebarTab entry that this context menu is for.
   */
  condition?: boolean | ((target: HTMLElement) => boolean);
}>