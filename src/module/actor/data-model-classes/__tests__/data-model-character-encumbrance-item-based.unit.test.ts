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

  it("applies a stored packed max to the packed cap only", () => {
    const enc = new EncumbranceItemBased(undefined, items, { packedMax: 20 });

    expect(enc.packedLabel).toBe("7/20");
    expect(enc.equippedLabel).toBe("2/9");
  });

  it("keeps the default packed cap when only the equipped max is custom", () => {
    const enc = new EncumbranceItemBased(12, items, { packedMax: 16 });

    expect(enc.packedLabel).toBe("7/16");
    expect(enc.equippedLabel).toBe("2/12");
  });

  it.each([
    [undefined, null, { equipped: 9, packed: 16 }],
    [16, null, { equipped: 9, packed: 16 }],
    [12, null, { equipped: 12, packed: 12 }],
    [12, 20, { equipped: 12, packed: 20 }],
  ])("reads stored max %s and packed max %s as caps %o", (max, packedMax, caps) => {
    expect(EncumbranceItemBased.caps(max, packedMax)).toEqual(caps);
  });

  it.each([undefined, 6])("keeps the breakpoint markers at fixed percentages with stored max %s", (max) => {
    const enc = new EncumbranceItemBased(max, items, { packedMax: max && 20 });

    expect(enc.equippedSteps).toEqual([(3 / 9) * 100, (5 / 9) * 100, (7 / 9) * 100]);
    expect(enc.packedSteps).toEqual([(10 / 16) * 100, (12 / 16) * 100, (14 / 16) * 100]);
  });

  it.each([
    [12, 0],
    [13, 1],
    [15, 1],
    [16, 2],
    [18, 3],
  ])("slows at a percentage of a custom packed cap: %s of 20 slots is breakpoint %s", (load, level) => {
    const enc = new EncumbranceItemBased(undefined, [slots(load, false)], { packedMax: 20 });

    expect([enc.atFirstBreakpoint, enc.atSecondBreakpoint, enc.atThirdBreakpoint].filter(Boolean).length).toBe(level);
  });

  it.each([
    [4, 0],
    [5, 1],
    [6, 1],
    [7, 2],
    [10, 3],
  ])("slows at a percentage of a custom equipped cap: %s of 12 slots is breakpoint %s", (load, level) => {
    const enc = new EncumbranceItemBased(12, [slots(load, true)], { packedMax: 16 });

    expect([enc.atFirstBreakpoint, enc.atSecondBreakpoint, enc.atThirdBreakpoint].filter(Boolean).length).toBe(level);
  });

  it("uses the slower of the equipped and packed rates", () => {
    const enc = new EncumbranceItemBased(12, [slots(5, true), slots(17, false)], { packedMax: 20 });

    expect(enc.usingEquippedEncumbrance).toBe(false);
    expect(enc.atSecondBreakpoint).toBe(true);
  });

  it("adds the STR mod to the packed cap only", () => {
    vi.spyOn(game.settings, "get").mockReturnValue(true);

    const enc = new EncumbranceItemBased(9, items, { scores: { str: { mod: 1 } } });

    expect(enc.packedLabel).toBe("7/17");
    expect(enc.equippedLabel).toBe("2/9");
  });

  it("shifts the packed breakpoints by the STR mod", () => {
    vi.spyOn(game.settings, "get").mockReturnValue(true);

    const enc = new EncumbranceItemBased(9, [slots(11, false)], { scores: { str: { mod: 1 } } });

    expect(enc.atFirstBreakpoint).toBe(false);
  });

  it("does not add the STR mod to the equipped limit", () => {
    vi.spyOn(game.settings, "get").mockReturnValue(true);

    const enc = new EncumbranceItemBased(9, [slots(10, true)], { scores: { str: { mod: 1 } } });

    expect(enc.encumbered).toBe(true);
  });

  it("is encumbered by an overloaded pack even when equipped drives movement", () => {
    vi.spyOn(game.settings, "get").mockReturnValue(true);

    const enc = new EncumbranceItemBased(9, [slots(8, true), slots(18, false)], { scores: { str: { mod: 1 } } });

    expect(enc.usingEquippedEncumbrance).toBe(true);
    expect(enc.encumbered).toBe(true);
  });
});
