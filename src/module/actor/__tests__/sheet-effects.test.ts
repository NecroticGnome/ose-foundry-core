/**
 * @file Contains tests for the Active Effects tab on actor sheets.
 */
// eslint-disable-next-line import/no-cycle
import type { QuenchMethods } from "../../../e2e";
import { cleanUpActorsByKey, closeSheets, createMockActorKey, waitFor } from "../../../e2e/testUtils";

export const key = "ose.actor.sheet.effects";
export const options = { displayName: "OSE: Actor: Sheet: Effects Tab" };

// biome-ignore lint/suspicious/noExplicitAny: Foundry documents and sheets
type Any = any;

const tabIds = (sheet: Any) => sheet._getTabsConfig("primary").tabs.map((t: { id: string }) => t.id);

export default ({ describe, it, expect, after, afterEach }: QuenchMethods) => {
  const original = game.settings.get(game.system.id, "effectsTab");

  afterEach(async () => {
    await game.settings.set(game.system.id, "effectsTab", original);
    await closeSheets();
  });
  after(async () => {
    await cleanUpActorsByKey(key);
  });

  for (const type of ["character", "monster"]) {
    describe(`${type} sheet`, () => {
      it("hides the tab when the world setting is off", async () => {
        await game.settings.set(game.system.id, "effectsTab", false);
        const actor: Any = await createMockActorKey(type, {}, key);
        expect(tabIds(actor.sheet)).not.contain("effects");
      });

      it("shows the tab for every actor when the world setting is on", async () => {
        await game.settings.set(game.system.id, "effectsTab", true);
        const actor: Any = await createMockActorKey(type, {}, key);
        expect(tabIds(actor.sheet)).contain("effects");
      });
    });
  }

  it("shows the tab by default", () => {
    expect(game.settings.settings.get(`${game.system.id}.effectsTab`)?.default).equal(true);
  });

  describe("controls", () => {
    it("creates, toggles and deletes an actor effect", async () => {
      await game.settings.set(game.system.id, "effectsTab", true);
      const actor: Any = await createMockActorKey("character", {}, key);
      await actor.sheet.render(true);
      await waitFor(() => !!actor.sheet.element?.querySelector('[data-action="createEffect"]'));
      actor.sheet.element.querySelector('[data-action="createEffect"]').click();
      await waitFor(() => actor.effects.size === 1);
      const effect = actor.effects.contents[0];
      await effect.sheet.close();
      await waitFor(() => !!actor.sheet.element.querySelector(`[data-effect-uuid="${effect.uuid}"]`));

      actor.sheet.element.querySelector(`[data-effect-uuid="${effect.uuid}"] [data-action="toggleEffect"]`).click();
      await waitFor(() => effect.disabled === true);
      expect(effect.disabled).equal(true);

      // An inactive effect's controls stay clickable.
      const row = () => actor.sheet.element.querySelector(`[data-effect-uuid="${effect.uuid}"]`);
      await waitFor(() => !!row()?.querySelector(".fa-toggle-off"));
      for (const control of row().querySelectorAll(".item-control, [data-action]")) {
        expect(getComputedStyle(control).pointerEvents).not.equal("none");
      }
      row().querySelector('[data-action="toggleEffect"]').click();
      await waitFor(() => effect.disabled === false);

      await effect.delete();
      await waitFor(() => !actor.sheet.element.querySelector(`[data-effect-uuid="${effect.uuid}"]`));
      expect(actor.effects.size).equal(0);
    });

    it("lists item-granted effects with their item and no delete", async () => {
      await game.settings.set(game.system.id, "effectsTab", true);
      const actor: Any = await createMockActorKey("character", {}, key);
      const [item] = await actor.createEmbeddedDocuments("Item", [
        {
          name: "Effect Ring",
          type: "item",
          effects: [{ name: "Ring Glow", img: "icons/svg/aura.svg", transfer: true }],
        },
      ]);
      await actor.sheet.render(true);
      await waitFor(() => !!actor.sheet.element?.querySelector(".effect-entry .locked"));
      const row = [...actor.sheet.element.querySelectorAll(".effect-entry")].find((r: Any) =>
        r.textContent.includes("Ring Glow"),
      ) as Any;
      expect(row.textContent).contain(item.name);
      expect(row.querySelector('[data-action="deleteEffect"]')).equal(null);
      expect(row.querySelector('[data-action="toggleEffect"]')).not.equal(null);
    });
  });
};
