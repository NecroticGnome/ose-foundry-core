import { afterEach, describe, expect, it, vi } from "vitest";
import EncumbranceItemBased from "../data-model-character-encumbrance-item-based";

const slots = (quantity: number, equipped: boolean) =>
  ({ type: "item", system: { isCoinsOrGems: false, equipped, itemslots: 1, quantity: { value: quantity } } }) as Item;

const items = [slots(7, false), slots(2, true)];

describe("Item-based encumbrance", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([9, 16, 1600, undefined])("treats stored max %s as the default caps", (max) => {
    const enc = new EncumbranceItemBased(max, items);

    expect(enc.packedLabel).toBe("7/16");
    expect(enc.equippedLabel).toBe("2/9");
  });

  it("applies a custom max to both caps", () => {
    const enc = new EncumbranceItemBased(12, items);

    expect(enc.packedLabel).toBe("7/12");
    expect(enc.equippedLabel).toBe("2/12");
  });

  it("adds the STR mod to the packed cap only", () => {
    vi.spyOn(game.settings, "get").mockReturnValue(true);

    const enc = new EncumbranceItemBased(9, items, { scores: { str: { mod: 1 } } });

    expect(enc.packedLabel).toBe("7/17");
    expect(enc.equippedLabel).toBe("2/9");
  });
});
