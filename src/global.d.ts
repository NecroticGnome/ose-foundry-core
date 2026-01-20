import { OseCombat } from "./module/combat";
import type { OseConfig } from "./module/config";

declare global {
  interface LenientGlobalVariableTypes {
    // Allowing game to be accessible as a typescript type regardless of whether or not the object has been initialized.
    // See documentation for LenientGlobalVariableTypes at https://github.com/League-of-Foundry-Developers/foundry-vtt-types/wiki/FAQ
    game: never;
    canvas: never;
  }

  interface CONFIG {
    OSE: OseConfig;
  }

  interface Game {
    ose: {
      rollItemMacro: (itemName: string) => Promise<void>;
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