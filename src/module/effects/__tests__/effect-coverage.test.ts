/**
 * @file Checks that Active Effects on each suggested attribute reach the values that use it.
 */
// eslint-disable-next-line import/no-cycle
import type { QuenchMethods } from "../../../e2e";
import { cleanUpActorsByKey, closeSheets, createMockActorKey, waitFor } from "../../../e2e/testUtils";
import { buildEffectData, type Change } from "../../classes/effects";
import { defaultPrimeReqs } from "../../classes/progression";
import { effectKeys } from "../effect-keys";

export const key = "ose.effects.coverage";
export const options = { displayName: "OSE: Effects: Coverage" };

// biome-ignore lint/suspicious/noExplicitAny: Foundry documents
type Any = any;

const scores = (n: number) =>
  Object.fromEntries(["str", "int", "wis", "dex", "con", "cha"].map((s) => [s, { value: n }]));
const level = (xp: number) => ({
  xp,
  hd: "1d8",
  hdcon: true,
  thac0: 19,
  bba: 0,
  saves: { death: 12, wand: 13, paralysis: 14, breath: 15, spell: 16 },
  spellSlots: {},
});
const fighter = (primeReq = "str") => ({
  name: "Coverage Fighter",
  type: "class",
  system: {
    key: "coverage-fighter",
    levels: [level(0), level(2000)],
    primeReqs: defaultPrimeReqs([primeReq]),
    level: 1,
  },
});

const withEffect = async (actor: Any, changes: Change[]) => {
  await actor.createEmbeddedDocuments("ActiveEffect", [buildEffectData("Coverage", changes, game.release.generation)]);
  return actor;
};
const add = (k: string, value: number | string): Change => ({ key: k, type: "add", value });
const set = (k: string, value: number | string): Change => ({ key: k, type: "override", value });

export default ({ describe, it, expect, after, afterEach, before }: QuenchMethods) => {
  const settings = ["ascendingAC", "initiative"] as const;
  const original = Object.fromEntries(settings.map((s) => [s, game.settings.get(game.system.id, s)]));

  before(async () => {
    await game.settings.set(game.system.id, "ascendingAC", false);
  });
  afterEach(async () => {
    await closeSheets();
  });
  after(async () => {
    for (const s of settings) await game.settings.set(game.system.id, s, original[s] as never);
    await cleanUpActorsByKey(key);
  });

  const character = (data: object = {}) =>
    createMockActorKey(
      "character",
      foundry.utils.mergeObject({ system: { scores: scores(10) } }, data),
      key,
    ) as Promise<Any>;
  const monster = (data: object = {}) => createMockActorKey("monster", data, key) as Promise<Any>;

  describe("character", () => {
    it("STR changes its modifier, melee bonus and open doors", async () => {
      const base = await character();
      const a = await withEffect(await character(), [add("system.scores.str.value", 6)]);
      expect(a.system.scores.str.value).equal(16);
      expect(a.system.scores.str.mod).equal(2);
      expect(a.system.meleeMod).equal(base.system.meleeMod + 2);
      expect(a.system.scores.str.od).not.equal(base.system.scores.str.od);
      expect(a.getRollData().scores.str.mod).equal(2);
    });

    it("DEX changes its modifier, missile bonus, AC and initiative", async () => {
      await game.settings.set(game.system.id, "initiative", "individual");
      const base = await character();
      const a = await withEffect(await character(), [add("system.scores.dex.value", 6)]);
      expect(a.system.scores.dex.mod).equal(2);
      expect(a.system.rangedMod).equal(base.system.rangedMod + 2);
      expect(a.system.ac.value).equal(base.system.ac.value - 2);
      expect(a.system.aac.value).equal(base.system.aac.value + 2);
      expect(a.system.init).equal(base.system.init + 1);
    });

    it("INT, WIS, CON and CHA change their derived values", async () => {
      const base = await character();
      const a = await withEffect(await character(), [
        add("system.scores.int.value", 6),
        add("system.scores.wis.value", 6),
        add("system.scores.con.value", 6),
        add("system.scores.cha.value", 6),
      ]);
      for (const s of ["int", "wis", "con", "cha"]) expect(a.system.scores[s].mod, s).equal(2);
      expect(a.system.scores.int.spoken).not.equal(base.system.scores.int.spoken);
      expect(a.system.scores.cha.retain).equal(base.system.scores.cha.retain + 2);
    });

    it("hit points and hit dice", async () => {
      const a = await withEffect(await character({ system: { hp: { value: 5, max: 5 } } }), [
        add("system.hp.max", 3),
        add("system.hp.value", 3),
        set("system.hp.hd", "3d8"),
      ]);
      expect([a.system.hp.value, a.system.hp.max, a.system.hp.hd]).deep.equal([8, 8, "3d8"]);
    });

    it("AC modifier changes AC and ascending AC", async () => {
      const base = await character();
      const a = await withEffect(await character(), [add("system.ac.mod", 2)]);
      expect(a.system.ac.value).equal(base.system.ac.value - 2);
      expect(a.system.aac.value).equal(base.system.aac.value + 2);
    });

    it("melee and missile bonuses change the attack modifiers", async () => {
      const base = await character();
      const a = await withEffect(await character(), [
        add("system.thac0.mod.melee", 1),
        add("system.thac0.mod.missile", 2),
      ]);
      expect(a.system.meleeMod).equal(base.system.meleeMod + 1);
      expect(a.system.rangedMod).equal(base.system.rangedMod + 2);
    });

    it("THAC0 and attack bonus stay in step on a classed character", async () => {
      const a = await character();
      await a.createEmbeddedDocuments("Item", [fighter()]);
      await withEffect(a, [add("system.thac0.value", -2)]);
      expect([a.system.thac0.value, a.system.thac0.bba]).deep.equal([17, 2]);
    });

    it("saves, including on a classed character", async () => {
      const plain = await withEffect(await character(), [add("system.saves.death.value", -2)]);
      expect(plain.system.saves.death.value).equal(-2);
      const classed = await character();
      await classed.createEmbeddedDocuments("Item", [fighter()]);
      await withEffect(classed, [add("system.saves.death.value", -2)]);
      expect(classed.system.saves.death.value).equal(10);
    });

    it("initiative modifier reaches initiative and roll data", async () => {
      await game.settings.set(game.system.id, "initiative", "individual");
      const base = await character();
      const a = await withEffect(await character(), [add("system.initiative.mod", 2)]);
      expect(a.system.init).equal(base.system.init + 2);
      expect(a.getRollData().init).equal(base.system.init + 2);
    });

    it("base movement changes the derived rates", async () => {
      const a = await withEffect(await character({ system: { config: { movementAuto: false } } }), [
        set("system.movement.base", 90),
      ]);
      expect(a.system.movement.base).equal(90);
      expect(a.system.movement.encounter).equal(30);
    });

    it("spell slots reach the spells tab", async () => {
      const a = await withEffect(await character({ system: { spells: { enabled: true } } }), [
        add("system.spells.1.max", 2),
      ]);
      expect(a.system.spells.slots[1]?.max).equal(2);
    });

    it("exploration skills", async () => {
      const base = await character();
      const a = await withEffect(await character(), [add("system.exploration.od", 1)]);
      expect(a.system.exploration.od).equal(base.system.exploration.od + 1);
    });

    it("XP bonus applies to awarded XP without class items", async () => {
      const a = await withEffect(await character(), [add("system.details.xp.bonus", 10)]);
      await a.getExperience(100);
      expect(a.system.details.xp.value).equal(110);
    });

    it("a raised prime requisite raises the class XP bonus", async () => {
      const a = await character();
      await a.createEmbeddedDocuments("Item", [fighter("str")]);
      await withEffect(a, [add("system.scores.str.value", 6)]);
      await a.getExperience(100);
      expect(a.system.classes[0].system.xp).equal(110);
    });

    it("an XP bonus effect adds to the class's prime requisite bonus", async () => {
      const a = await character({ system: { scores: { str: { value: 16 } } } });
      await a.createEmbeddedDocuments("Item", [fighter("str")]);
      await withEffect(a, [add("system.details.xp.bonus", 5)]);
      await a.getExperience(100);
      expect(a.system.classes[0].system.xp).equal(115);
    });

    it("shows each class's XP adjustment in the Effects tab", async () => {
      const shown = game.settings.get(game.system.id, "effectsTab");
      await game.settings.set(game.system.id, "effectsTab", true);
      const a = await character({ system: { scores: { str: { value: 16 } } } });
      await a.createEmbeddedDocuments("Item", [fighter("str")]);
      const context = await a.sheet._prepareContext({ parts: [] });
      await game.settings.set(game.system.id, "effectsTab", shown);
      const rows = context.effectGroups.flatMap((g: Any) => g.effects);
      expect(rows.find((r: Any) => r.fixed)?.name).contain("+10");
    });

    it("XP share, magic resist bonus, maximum encumbrance and loyalty", async () => {
      const a = await withEffect(await character({ system: { retainer: { enabled: true, loyalty: 7 } } }), [
        set("system.details.xp.share", 50),
        add("system.details.magic.bonus", 2),
        set("system.encumbrance.max", 2000),
        add("system.retainer.loyalty", 1),
      ]);
      expect(a.system.details.xp.share).equal(50);
      expect(a.system.details.magic.bonus).equal(2);
      expect(a.system.encumbrance.max).equal(2000);
      expect(a.system.retainer.loyalty).equal(8);
    });

    it("editing the sheet doesn't store effect-changed values", async () => {
      const a = await withEffect(await character(), [add("system.scores.str.value", 2)]);
      await a.sheet.render(true);
      await waitFor(() => !!a.sheet.element?.querySelector('input[name="system.details.title"]'));
      const input = a.sheet.element.querySelector('input[name="system.details.title"]') as HTMLInputElement;
      input.value = "Veteran";
      input.dispatchEvent(new Event("change", { bubbles: true }));
      await waitFor(() => a._source.system.details.title === "Veteran");
      expect(a._source.system.scores.str.value).equal(10);
      expect(a.system.scores.str.value).equal(12);
    });
  });

  describe("sheet edits", () => {
    it("locks effect-changed fields and offers to disable the effect", async () => {
      const a = await withEffect(await character(), [add("system.scores.str.value", 2)]);
      await a.sheet.render(true);
      const field = () => a.sheet.element?.querySelector('input[name="system.scores.str.value"]') as HTMLInputElement;
      await waitFor(() => !!field());
      expect([field().value, field().readOnly]).deep.equal(["12", true]);
      field().click();
      const dialog = () =>
        [...foundry.applications.instances.values()].find((d: Any) =>
          d.element?.querySelector('button[data-action="yes"]'),
        ) as Any;
      await waitFor(() => !!dialog());
      dialog().element.querySelector('button[data-action="yes"]').click();
      await waitFor(() => a.effects.contents[0]?.disabled === true);
      await waitFor(() => field()?.readOnly === false);
      expect([field().value, a._source.system.scores.str.value]).deep.equal(["10", 10]);
    });
  });

  describe("monster", () => {
    it("AC keeps ascending AC in step", async () => {
      const a = await withEffect(await monster({ system: { ac: { value: 7 }, aac: { value: 12 } } }), [
        add("system.ac.value", -2),
      ]);
      expect([a.system.ac.value, a.system.aac.value]).deep.equal([5, 14]);
    });

    it("hit points, THAC0, saves, morale and XP", async () => {
      const a = await withEffect(await monster({ system: { details: { morale: 7, xp: 10 } } }), [
        add("system.hp.max", 3),
        add("system.thac0.value", -1),
        add("system.saves.death.value", -2),
        add("system.details.morale", 1),
        add("system.details.xp", 5),
      ]);
      expect(a.system.hp.max).equal(23);
      expect(a.system.thac0.value).equal(18);
      expect(a.system.saves.death.value).equal(-2);
      expect(a.system.details.morale).equal(8);
      expect(a.system.details.xp).equal(15);
    });
  });

  describe("every suggested key applies", () => {
    for (const type of ["character", "monster"] as const) {
      it(`${type}: each key changes the prepared value`, async () => {
        const failed: string[] = [];
        for (const { key: path } of effectKeys(type)) {
          if (path === "system.hp.hd") continue;
          // Prepared spells expose slots per level.
          const read = path.replace(/^system\.spells\.(\d)\.max$/, "system.spells.slots.$1.max");
          const base = await createMockActorKey(
            type,
            type === "character" ? { system: { scores: scores(10) } } : {},
            key,
          );
          const before = Number(foundry.utils.getProperty(base, read)) || 0;
          const a = await withEffect(
            await createMockActorKey(type, type === "character" ? { system: { scores: scores(10) } } : {}, key),
            [add(path, 1)],
          );
          const now = Number(foundry.utils.getProperty(a, read)) || 0;
          if (now !== before + 1) failed.push(`${path}: ${before} -> ${now}`);
        }
        expect(failed).deep.equal([]);
      });
    }
  });
};
