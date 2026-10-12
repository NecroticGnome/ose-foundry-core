/**
 * @file Contains tests for Entity Tweaks sheet.
 */
import type { QuenchMethods } from "../../../e2e";
import { cleanUpActorsByKey, createMockActorKey, openV2AppsByClass, waitForElement } from "../../../e2e/testUtils";
import { migrateActorTweaks } from "../../effects/tweak-effects";
import { buildClassIndex } from "../../migration/class-index";
import { convertActor } from "../../migration/convert-actor";
import OseEntityTweaks from "../entity-tweaks";

export const key = "ose.actor.sheet.dialog.entity-tweaks";
export const options = {
  displayName: "OSE: Actor: Dialog Sheet: Entity Tweaks",
};

const createMockActor = async (type: string, data: object = {}) => createMockActorKey(type, data, key);

export default ({ describe, it, expect, assert, after }: QuenchMethods) => {
  describe("DEFAULT_OPTIONS", () => {
    it("Has correctly set defaults", () => {
      const opts = OseEntityTweaks.DEFAULT_OPTIONS;
      expect(opts.classes).contain("sheet-tweaks");
      expect(OseEntityTweaks.PARTS.main.template).contain("/templates/actors/dialogs/tweaks-dialog.html");
      expect(opts.position.width).equal(440);
    });
  });

  describe("title()", () => {
    it("Creates string in dialog window title", async () => {
      const actor = await createMockActor("character");
      const sheet = new OseEntityTweaks(actor);
      await sheet.render({ force: true });
      await waitForElement(`#${sheet.id} .window-title`);
      expect(typeof sheet.title).equal("string");
      const dialogs = openV2AppsByClass("sheet-tweaks");
      expect(dialogs.length).equal(1);
      await dialogs[0].close();
      expect(openV2AppsByClass("sheet-tweaks").length).equal(0);
    });
  });

  describe("_prepareContext()", () => {
    it("Returns proper data for character", async () => {
      const actor = await createMockActor("character");
      const sheet = new OseEntityTweaks(actor);
      const data = await sheet._prepareContext();
      const keys = Object.keys(data);
      assert(keys.length >= 2);
      expect(keys).contain("config");
      expect(keys).contain("user");
      assert(data.isCharacter);
    });
  });

  describe("_submit(data)", () => {
    // biome-ignore lint/suspicious/noExplicitAny: Foundry documents
    const tweak = (actor: any, id: string) => actor.effects.find((e: any) => e.getFlag(game.system.id, "tweak") === id);

    it("saves modifiers as their own effects", async () => {
      // biome-ignore lint/suspicious/noExplicitAny: Foundry documents
      const actor: any = await createMockActor("character");
      await new OseEntityTweaks(actor)._submit({ "tweaks.initiative": 2, "tweaks.melee": 1, "tweaks.ac": 0 });
      expect(tweak(actor, "initiative")?.name).equal(game.i18n.localize("OSE.InitiativeBonus"));
      expect(tweak(actor, "ac")).undefined;
      expect([actor.system.initiative.mod, actor._source.system.initiative.mod]).deep.equal([2, 0]);
      expect(actor.system.thac0.mod.melee).equal(1);
    });

    it("removes a modifier's effect when set to 0", async () => {
      // biome-ignore lint/suspicious/noExplicitAny: Foundry documents
      const actor: any = await createMockActor("character");
      const sheet = new OseEntityTweaks(actor);
      await sheet._submit({ "tweaks.magic": 2 });
      expect(actor.system.details.magic.bonus).equal(2);
      await sheet._submit({ "tweaks.magic": 0 });
      expect(tweak(actor, "magic")).undefined;
      expect(actor.system.details.magic.bonus).equal(0);
    });

    it("shows stored values and effects together", async () => {
      // biome-ignore lint/suspicious/noExplicitAny: Foundry documents
      const actor: any = await createMockActor("monster", { system: { initiative: { mod: 1 } } });
      const data = await new OseEntityTweaks(actor)._prepareContext();
      expect(data.tweaks).deep.equal({ initiative: 1 });
    });
  });

  describe("migrateActorTweaks", () => {
    it("moves stored modifiers into effects once, keeping the values", async () => {
      // biome-ignore lint/suspicious/noExplicitAny: Foundry documents
      const actor: any = await createMockActor("character", {
        system: { initiative: { mod: 1 }, thac0: { mod: { missile: 2 } }, ac: { mod: 1 }, aac: { mod: 1 } },
      });
      const before = [actor.system.init, actor.system.rangedMod, actor.system.ac.value];
      expect(await migrateActorTweaks(actor)).equal(true);
      expect(actor.effects.size).equal(3);
      expect([
        actor._source.system.initiative.mod,
        actor._source.system.ac.mod,
        actor._source.system.aac.mod,
      ]).deep.equal([0, 0, 0]);
      expect([actor.system.init, actor.system.rangedMod, actor.system.ac.value]).deep.equal(before);
      expect(await migrateActorTweaks(actor)).equal(false);
      expect(actor.effects.size).equal(3);
    });

    it("leaves a free-text class's XP bonus as its prime requisite", async () => {
      // biome-ignore lint/suspicious/noExplicitAny: Foundry documents
      const actor: any = await createMockActor("character", {
        system: { details: { class: "Fighter", xp: { bonus: 10 } } },
      });
      expect(await migrateActorTweaks(actor)).equal(false);
      expect(actor._source.system.details.xp.bonus).equal(10);
    });

    for (const [bonus, difference] of [
      [10, null],
      [5, -5],
    ] as const) {
      it(`class conversion keeps a ${bonus}% Bonus Experience as the class bonus plus any difference`, async () => {
        // biome-ignore lint/suspicious/noExplicitAny: Foundry documents
        const actor: any = await createMockActor("character", {
          system: {
            details: { class: "Fighter" },
            scores: {
              str: { value: 16 },
              int: { value: 10 },
              wis: { value: 10 },
              dex: { value: 10 },
              con: { value: 10 },
              cha: { value: 10 },
            },
          },
        });
        await new OseEntityTweaks(actor)._submit({ "tweaks.xp": bonus });
        await convertActor(actor, await buildClassIndex());
        const cls = actor.items.find((i: { type: string }) => i.type === "class");
        expect(cls?.system.xpBonusOverride).equal(null);
        expect(actor.system.classXpBonus(cls)).equal(10);
        const effect = actor.effects.find(
          (e: { getFlag: (s: string, k: string) => unknown }) => e.getFlag(game.system.id, "tweak") === "xp",
        );
        expect(effect ? actor.system.xpBonusFromEffects : null).equal(difference);
        expect(actor.system.classXpBonus(cls) + actor.system.xpBonusFromEffects).equal(bonus);
      });
    }

    it("leaves a classed character's XP bonus to its class", async () => {
      // biome-ignore lint/suspicious/noExplicitAny: Foundry documents
      const actor: any = await createMockActor("character", { system: { details: { xp: { bonus: 10 } } } });
      await actor.createEmbeddedDocuments("Item", [{ name: "Class", type: "class", system: { key: "class" } }]);
      expect(await migrateActorTweaks(actor)).equal(false);
    });
  });

  after(async () => {
    await cleanUpActorsByKey(key);
  });
};
