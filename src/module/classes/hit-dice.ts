/**
 * @file Advanced Hit Dice optional rule (Player's Book).
 */

// Swaps in the class's advanced die size, keeping the dice count and any bonus.
export const applyAdvancedHd = (hd: string, advancedHitDie: string | undefined, on: boolean) => {
  const size = on ? /d\d+/.exec(advancedHitDie ?? "")?.[0] : undefined;
  return size ? hd.replace(/d\d+/, size) : hd;
};

export const advancedHitDiceOn = () => !!game.settings.get(game.system.id, "advancedHitDice");
