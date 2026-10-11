/**
 * @file Contains tests for the Item Sheet.
 */
// eslint-disable-next-line prettier/prettier, import/no-cycle
import type { QuenchMethods } from "../../../e2e";
import { cleanUpWorldItems, createWorldTestItem, waitFor } from "../../../e2e/testUtils";
import OseItemSheet from "../item-sheet";

export const key = "ose.item.sheet";
export const options = { displayName: "OSE: Item: Sheet" };

export default ({ describe, it, expect, after, assert }: QuenchMethods) => {
  after(async () => {
    await cleanUpWorldItems();
  });

  describe("DEFAULT_OPTIONS", () => {
    it("Has correctly set defaults", () => {
      const opts = OseItemSheet.DEFAULT_OPTIONS;
      expect(opts.classes).contain("ose");
      expect(opts.classes).contain("sheet");
      expect(opts.classes).contain("item");
      expect(opts.position.width).equal(560);
      expect(opts.position.height).equal(480);
      assert(opts.window.resizable);
      assert(opts.form.submitOnChange);
      assert(!opts.form.closeOnSubmit);
    });
  });

  describe("PARTS", () => {
    it("Falls back to item-sheet template path", () => {
      expect(OseItemSheet.PARTS.main.template).contain("/templates/items/item-sheet.html");
    });
  });

  describe("_configureRenderParts(options)", () => {
    it("Resolves per-type template path", async () => {
      const item = await createWorldTestItem("spell");
      const sheet = item?.sheet;
      const parts = sheet?._configureRenderParts({});
      expect(parts.main.template).contain("/templates/items/spell-sheet.html");
      await item?.delete();
    });
  });

  describe("_prepareContext()", () => {
    it("Returns enriched + config + system data", async () => {
      const item = await createWorldTestItem("item");
      const sheet = item?.sheet;
      const data = await sheet?._prepareContext({});
      const keys = Object.keys(data);
      expect(keys).contain("name");
      expect(keys).contain("img");
      expect(keys).contain("system");
      expect(keys).contain("config");
      expect(keys).contain("enriched");
      expect(data.enriched).is.not.undefined;
      expect(data.config.encumbrance).is.not.undefined;
      await item?.delete();
    });
  });

  describe("class level", () => {
    const levels = [0, 2000, 4000].map((xp) => ({ xp, hd: "1d8", thac0: 19, bba: 0 }));
    const changeLevel = async (choice: "yes" | "no") => {
      const actor = await Actor.create({ name: "Level XP test", type: "character" });
      const [cls] = (await actor?.createEmbeddedDocuments("Item", [
        { name: "Test Fighter", type: "class", system: { key: "test-fighter", levels, level: 1, xp: 0 } },
      ])) as Item[];
      await cls.sheet?.render(true);
      await waitFor(() => !!cls.sheet?.element?.querySelector('select[name="system.level"]'));
      const select = cls.sheet?.element.querySelector<HTMLSelectElement>('select[name="system.level"]');
      if (!select) throw new Error("no level select");
      select.value = "2";
      select.dispatchEvent(new Event("change", { bubbles: true }));
      const dialog = () =>
        [...foundry.applications.instances.values()].find((a) => a.element?.textContent?.includes("Current XP: 0"));
      await waitFor(() => !!dialog());
      dialog()?.element.querySelector<HTMLButtonElement>(`button[data-action="${choice}"]`)?.click();
      await waitFor(() => cls.system.level === 2);
      await new Promise((r) => setTimeout(r, 300));
      const result = { level: cls.system.level, xp: cls.system.xp };
      await cls.sheet?.close();
      await actor?.delete();
      return result;
    };

    it("offers to set XP to the new level's minimum", async () => {
      expect(await changeLevel("yes")).deep.equal({ level: 2, xp: 2000 });
    });

    it("keeps XP when the offer is declined", async () => {
      expect(await changeLevel("no")).deep.equal({ level: 2, xp: 0 });
    });
  });

  describe("table legend", () => {
    it("adds, saves, shows and deletes legend entries", async () => {
      const item = (await Item.create({
        name: "Legend test",
        type: "class",
        system: {
          levels: [{ xp: 0 }, { xp: 2000 }],
          tables: [
            { key: "turning", label: "Turning", columns: [{ key: "1", name: "" }], rows: [{ 1: "T" }, { 1: 7 }] },
          ],
        },
      })) as Item;
      const sheet = item.sheet as foundry.applications.api.ApplicationV2;
      await sheet.render(true);
      const el = () => sheet.element as HTMLElement;
      await waitFor(() => !!el()?.querySelector('[data-action="addLegendRow"]'));
      el().querySelector<HTMLElement>('[data-action="addLegendRow"]')?.click();
      await waitFor(() => !!el().querySelector('input[name="system.tables.0.legend.0.value"]'));

      const datalist = [...el().querySelectorAll<HTMLOptionElement>('datalist[id^="ose-legend-"] option')].map(
        (o) => o.value,
      );
      expect(datalist).deep.equal(["T", "#"]);

      const set = (name: string, value: string) => {
        const input = el().querySelector<HTMLInputElement>(`input[name="${name}"]`);
        if (!input) throw new Error(name);
        input.value = value;
        input.dispatchEvent(new Event("change", { bubbles: true }));
      };
      set("system.tables.0.legend.0.value", "T");
      await waitFor(() => item.system.tables[0].legend?.[0]?.value === "T");
      set("system.tables.0.legend.0.text", "Turned");
      await waitFor(() => item.system.tables[0].legend?.[0]?.text === "Turned");
      expect(item.system.tables[0].legend).deep.equal([{ value: "T", text: "Turned" }]);

      el().querySelector<HTMLElement>('[data-action="toggleMode"]')?.click();
      await waitFor(() => !el().querySelector('[data-action="addLegendRow"]'));
      const cells = [...el().querySelectorAll<HTMLElement>('.tab[data-tab="tables"] tbody td[data-tooltip]')];
      expect(cells.map((c) => c.dataset.tooltip)).contain("Turned");

      el().querySelector<HTMLElement>('[data-action="toggleMode"]')?.click();
      await waitFor(() => !!el().querySelector('[data-action="removeLegendRow"]'));
      el().querySelector<HTMLElement>('[data-action="removeLegendRow"]')?.click();
      const confirm = () =>
        [...foundry.applications.instances.values()].find((a) => a.element?.querySelector('button[data-action="yes"]'));
      await waitFor(() => !!confirm());
      confirm()?.element.querySelector<HTMLButtonElement>('button[data-action="yes"]')?.click();
      await waitFor(() => (item.system.tables[0].legend ?? []).length === 0);
      expect(item.system.tables[0].legend).deep.equal([]);
      await sheet.close();
      await item.delete();
    });
  });
};
