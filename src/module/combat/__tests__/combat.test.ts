/**
 * @file Combat tests for OSE module
 */
// eslint-disable-next-line import/no-cycle

import type { QuenchMethods } from "../../../e2e";
import {
  cleanUpActorsByKey,
  cleanUpScenes,
  createMockActorKey,
  createMockScene,
  trashChat,
  waitForInput,
} from "../../../e2e/testUtils";
import type OseActor from "../../actor/entity";
import { OSECombat } from "../combat";

export const key = "ose.combat";
export const options = {
  displayName: "OSE: Combat",
};

export default ({ describe, it, expect, after, afterEach, before }: QuenchMethods) => {
  const oseCombat = new OSECombat();
  let pc1: OseActor | Document | null = null;
  let pc2: OseActor | Document | null = null;
  let friendlyCharacter1: OseActor | Document | null = null;
  let friendlyCharacter2: OseActor | Document | null = null;
  let neutralCharacter1: OseActor | Document | null = null;
  let neutralCharacter2: OseActor | Document | null = null;
  let hostileCharacter1: OseActor | Document | null = null;
  let hostileCharacter2: OseActor | Document | null = null;
  let friendlyMonster1: OseActor | Document | null = null;
  let friendlyMonster2: OseActor | Document | null = null;
  let neutralMonster1: OseActor | Document | null = null;
  let neutralMonster2: OseActor | Document | null = null;
  let hostileMonster1: OseActor | Document | null = null;
  let hostileMonster2: OseActor | Document | null = null;
  let friendlyRetainer1: OseActor | Document | null = null;
  let friendlyRetainer2: OseActor | Document | null = null;
  let neutralRetainer1: OseActor | Document | null = null;
  let neutralRetainer2: OseActor | Document | null = null;
  let hostileRetainer1: OseActor | Document | null = null;
  let hostileRetainer2: OseActor | Document | null = null;

  const createCombatant = async (actor: OseActor) => {
    const token = await actor.getTokenDocument();
    await token.constructor.create(token, { parent: canvas.scene });
  };

  const controlAllTokens = () => {
    const tokens = game.canvas?.scene?.tokens?.contents || [];
    if (tokens.length === 0) return;
    tokens[0].object.control({ releaseOthers: true });
    tokens.slice(1).forEach((t) => {
      t.object.control({ releaseOthers: false });
    });
  };

  const addAllTokensToCombat = async () => {
    controlAllTokens();
    const tokens = canvas.tokens.controlled.map((t) => t.document);
    await TokenDocument.implementation.createCombatants(tokens);
  };

  const getCombatTrackerElement = () => document.querySelector("#combat ol.combat-tracker");

  const getCombatantElements = () => getCombatTrackerElement()?.querySelectorAll("li.combatant");

  const cleanupCombat = async () => {
    await game.combat?.delete();
    await waitForInput();
  };

  before(async () => {
    await trashChat();
    await cleanupCombat();
    const scene = await createMockScene();
    await scene?.activate();
    await waitForInput();

    const nonGMUser = game.users?.find((u) => !u.isGM);

    // Create mock actors for testing
    pc1 = await createMockActorKey(
      "character",
      {
        ...(nonGMUser?.id && {
          ownership: {
            [nonGMUser.id]: foundry.CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER,
          },
        }),
      },
      key,
    );
    pc2 = await createMockActorKey(
      "character",
      {
        ...(nonGMUser?.id && {
          ownership: {
            [nonGMUser.id]: foundry.CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER,
          },
        }),
      },
      key,
    );
    friendlyCharacter1 = await createMockActorKey(
      "character",
      {
        prototypeToken: {
          disposition: foundry.CONST.TOKEN_DISPOSITIONS.FRIENDLY,
        },
      },
      key,
    );
    friendlyCharacter2 = await createMockActorKey(
      "character",
      {
        prototypeToken: {
          disposition: foundry.CONST.TOKEN_DISPOSITIONS.FRIENDLY,
        },
      },
      key,
    );
    neutralCharacter1 = await createMockActorKey(
      "character",
      {
        prototypeToken: {
          disposition: foundry.CONST.TOKEN_DISPOSITIONS.NEUTRAL,
        },
      },
      key,
    );
    neutralCharacter2 = await createMockActorKey(
      "character",
      {
        prototypeToken: {
          disposition: foundry.CONST.TOKEN_DISPOSITIONS.NEUTRAL,
        },
      },
      key,
    );
    hostileCharacter1 = await createMockActorKey(
      "character",
      {
        prototypeToken: {
          disposition: foundry.CONST.TOKEN_DISPOSITIONS.HOSTILE,
        },
      },
      key,
    );
    hostileCharacter2 = await createMockActorKey(
      "character",
      {
        prototypeToken: {
          disposition: foundry.CONST.TOKEN_DISPOSITIONS.HOSTILE,
        },
      },
      key,
    );
    friendlyMonster1 = await createMockActorKey(
      "monster",
      {
        prototypeToken: {
          disposition: foundry.CONST.TOKEN_DISPOSITIONS.FRIENDLY,
        },
      },
      key,
    );
    friendlyMonster2 = await createMockActorKey(
      "monster",
      {
        prototypeToken: {
          disposition: foundry.CONST.TOKEN_DISPOSITIONS.FRIENDLY,
        },
      },
      key,
    );
    neutralMonster1 = await createMockActorKey(
      "monster",
      {
        prototypeToken: {
          disposition: foundry.CONST.TOKEN_DISPOSITIONS.NEUTRAL,
        },
      },
      key,
    );
    neutralMonster2 = await createMockActorKey(
      "monster",
      {
        prototypeToken: {
          disposition: foundry.CONST.TOKEN_DISPOSITIONS.NEUTRAL,
        },
      },
      key,
    );
    hostileMonster1 = await createMockActorKey(
      "monster",
      {
        prototypeToken: {
          disposition: foundry.CONST.TOKEN_DISPOSITIONS.HOSTILE,
        },
      },
      key,
    );
    hostileMonster2 = await createMockActorKey(
      "monster",
      {
        prototypeToken: {
          disposition: foundry.CONST.TOKEN_DISPOSITIONS.HOSTILE,
        },
      },
      key,
    );
    friendlyRetainer1 = await createMockActorKey(
      "character",
      {
        prototypeToken: {
          disposition: foundry.CONST.TOKEN_DISPOSITIONS.FRIENDLY,
        },
        system: {
          retainer: { enabled: true },
        },
      },
      key,
    );
    friendlyRetainer2 = await createMockActorKey(
      "character",
      {
        prototypeToken: {
          disposition: foundry.CONST.TOKEN_DISPOSITIONS.FRIENDLY,
        },
        system: {
          retainer: { enabled: true },
        },
      },
      key,
    );
    neutralRetainer1 = await createMockActorKey(
      "character",
      {
        prototypeToken: {
          disposition: foundry.CONST.TOKEN_DISPOSITIONS.NEUTRAL,
        },
        system: {
          retainer: { enabled: true },
        },
      },
      key,
    );
    neutralRetainer2 = await createMockActorKey(
      "character",
      {
        prototypeToken: {
          disposition: foundry.CONST.TOKEN_DISPOSITIONS.NEUTRAL,
        },
        system: {
          retainer: { enabled: true },
        },
      },
      key,
    );
    hostileRetainer1 = await createMockActorKey(
      "character",
      {
        prototypeToken: {
          disposition: foundry.CONST.TOKEN_DISPOSITIONS.HOSTILE,
        },
        system: {
          retainer: { enabled: true },
        },
      },
      key,
    );
    hostileRetainer2 = await createMockActorKey(
      "character",
      {
        prototypeToken: {
          disposition: foundry.CONST.TOKEN_DISPOSITIONS.HOSTILE,
        },
        system: {
          retainer: { enabled: true },
        },
      },
      key,
    );

    await waitForInput();
  });

  after(async () => {
    await cleanupCombat();
    await cleanUpActorsByKey(key);
    await cleanUpScenes();
  });

  describe("Static properties", () => {
    it("should have the correct initiative formula", () => {
      expect(OSECombat.FORMULA).to.equal("1d6 + @init");
      expect(OSECombat.GROUP_FORMULA).to.equal("1d6");
    });

    it("GROUPS should combine OSE colors with action groups", () => {
      expect(OSECombat.GROUPS).to.eql({
        green: game.i18n.localize("OSE.colors.green"),
        red: game.i18n.localize("OSE.colors.red"),
        yellow: game.i18n.localize("OSE.colors.yellow"),
        purple: game.i18n.localize("OSE.colors.purple"),
        blue: game.i18n.localize("OSE.colors.blue"),
        orange: game.i18n.localize("OSE.colors.orange"),
        white: game.i18n.localize("OSE.colors.white"),
        slow: game.i18n.localize("OSE.items.Slow"),
        cast: game.i18n.localize("OSE.spells.Cast"),
      });
    });
  });

  describe("isGroupInitiative", () => {
    let previousInitiativeSetting: string;

    before(async () => {
      previousInitiativeSetting = game.settings.get(game.system.id, "initiative");
      await game.settings.set(game.system.id, "initiative", "group");
    });

    after(async () => {
      await game.settings.set(game.system.id, "initiative", previousInitiativeSetting);
    });

    it('should return true when initiative setting is "group"', () => {
      expect(game.settings.get(game.system.id, "initiative")).to.equal("group");
      expect(oseCombat.isGroupInitiative).to.be.true;
    });

    it('should return false when initiative setting is not "group"', async () => {
      await game.settings.set(game.system.id, "initiative", "individual");
      expect(game.settings.get(game.system.id, "initiative")).to.equal("individual");
      expect(oseCombat.isGroupInitiative).to.be.false;
    });
  });

  describe("mockActors", async () => {
    it("should have created valid actors", async () => {
      expect(pc1?.type).to.equal("character");
      expect(pc1?.hasPlayerOwner, "test can only pass if a non-GM user exists on this world").to.be.true;
      expect(pc2?.type).to.equal("character");
      expect(pc2?.hasPlayerOwner, "test can only pass if a non-GM user exists on this world").to.be.true;
      expect(friendlyCharacter1?.type).to.equal("character");
      expect(friendlyCharacter1?.prototypeToken?.disposition).to.equal(
        foundry.CONST.TOKEN_DISPOSITIONS.FRIENDLY,
        "Friendly Character 1 should have friendly disposition",
      );
      expect(friendlyCharacter1?.hasPlayerOwner).to.be.false;
      expect(friendlyCharacter2?.type).to.equal("character");
      expect(friendlyCharacter2?.prototypeToken?.disposition).to.equal(
        foundry.CONST.TOKEN_DISPOSITIONS.FRIENDLY,
        "Friendly Character 2 should have friendly disposition",
      );
      expect(friendlyCharacter2?.hasPlayerOwner).to.be.false;
      expect(neutralCharacter1?.type).to.equal("character");
      expect(neutralCharacter1?.prototypeToken?.disposition).to.equal(
        foundry.CONST.TOKEN_DISPOSITIONS.NEUTRAL,
        "Neutral Character 1 should have neutral disposition",
      );
      expect(neutralCharacter1?.hasPlayerOwner).to.be.false;
      expect(neutralCharacter2?.type).to.equal("character");
      expect(neutralCharacter2?.prototypeToken?.disposition).to.equal(
        foundry.CONST.TOKEN_DISPOSITIONS.NEUTRAL,
        "Neutral Character 2 should have neutral disposition",
      );
      expect(neutralCharacter2?.hasPlayerOwner).to.be.false;
      expect(hostileCharacter1?.type).to.equal("character");
      expect(hostileCharacter1?.prototypeToken?.disposition).to.equal(
        foundry.CONST.TOKEN_DISPOSITIONS.HOSTILE,
        "Hostile Character 1 should have hostile disposition",
      );
      expect(hostileCharacter1?.hasPlayerOwner).to.be.false;
      expect(hostileCharacter2?.type).to.equal("character");
      expect(hostileCharacter2?.prototypeToken?.disposition).to.equal(
        foundry.CONST.TOKEN_DISPOSITIONS.HOSTILE,
        "Hostile Character 2 should have hostile disposition",
      );
      expect(hostileCharacter2?.hasPlayerOwner).to.be.false;
      expect(friendlyMonster1?.type).to.equal("monster");
      expect(friendlyMonster1?.prototypeToken?.disposition).to.equal(
        foundry.CONST.TOKEN_DISPOSITIONS.FRIENDLY,
        "Friendly Monster 1 should have friendly disposition",
      );
      expect(friendlyMonster1?.hasPlayerOwner).to.be.false;
      expect(friendlyMonster2?.type).to.equal("monster");
      expect(friendlyMonster2?.prototypeToken?.disposition).to.equal(
        foundry.CONST.TOKEN_DISPOSITIONS.FRIENDLY,
        "Friendly Monster 2 should have friendly disposition",
      );
      expect(friendlyMonster2?.hasPlayerOwner).to.be.false;
      expect(neutralMonster1?.type).to.equal("monster");
      expect(neutralMonster1?.prototypeToken?.disposition).to.equal(
        foundry.CONST.TOKEN_DISPOSITIONS.NEUTRAL,
        "Neutral Monster 1 should have neutral disposition",
      );
      expect(neutralMonster1?.hasPlayerOwner).to.be.false;
      expect(neutralMonster2?.type).to.equal("monster");
      expect(neutralMonster2?.prototypeToken?.disposition).to.equal(
        foundry.CONST.TOKEN_DISPOSITIONS.NEUTRAL,
        "Neutral Monster 2 should have neutral disposition",
      );
      expect(neutralMonster2?.hasPlayerOwner).to.be.false;
      expect(hostileMonster1?.type).to.equal("monster");
      expect(hostileMonster1?.prototypeToken?.disposition).to.equal(
        foundry.CONST.TOKEN_DISPOSITIONS.HOSTILE,
        "Hostile Monster 1 should have hostile disposition",
      );
      expect(hostileMonster1?.hasPlayerOwner).to.be.false;
      expect(hostileMonster2?.type).to.equal("monster");
      expect(hostileMonster2?.prototypeToken?.disposition).to.equal(
        foundry.CONST.TOKEN_DISPOSITIONS.HOSTILE,
        "Hostile Monster 2 should have hostile disposition",
      );
      expect(hostileMonster2?.hasPlayerOwner).to.be.false;
      expect(friendlyRetainer1?.type).to.equal("character");
      expect(friendlyRetainer1?.prototypeToken?.disposition).to.equal(
        foundry.CONST.TOKEN_DISPOSITIONS.FRIENDLY,
        "Friendly Retainer 1 should have friendly disposition",
      );
      expect(friendlyRetainer1?.hasPlayerOwner).to.be.false;
      expect(friendlyRetainer2?.type).to.equal("character");
      expect(friendlyRetainer2?.prototypeToken?.disposition).to.equal(
        foundry.CONST.TOKEN_DISPOSITIONS.FRIENDLY,
        "Friendly Retainer 2 should have friendly disposition",
      );
      expect(friendlyRetainer2?.hasPlayerOwner).to.be.false;
      expect(neutralRetainer1?.type).to.equal("character");
      expect(neutralRetainer1?.prototypeToken?.disposition).to.equal(
        foundry.CONST.TOKEN_DISPOSITIONS.NEUTRAL,
        "Neutral Retainer 1 should have neutral disposition",
      );
      expect(neutralRetainer1?.hasPlayerOwner).to.be.false;
      expect(neutralRetainer2?.type).to.equal("character");
      expect(neutralRetainer2?.prototypeToken?.disposition).to.equal(
        foundry.CONST.TOKEN_DISPOSITIONS.NEUTRAL,
        "Neutral Retainer 2 should have neutral disposition",
      );
      expect(neutralRetainer2?.hasPlayerOwner).to.be.false;
      expect(hostileRetainer1?.type).to.equal("character");
      expect(hostileRetainer1?.prototypeToken?.disposition).to.equal(
        foundry.CONST.TOKEN_DISPOSITIONS.HOSTILE,
        "Hostile Retainer 1 should have hostile disposition",
      );
      expect(hostileRetainer1?.hasPlayerOwner).to.be.false;
      expect(hostileRetainer2?.type).to.equal("character");
      expect(hostileRetainer2?.prototypeToken?.disposition).to.equal(
        foundry.CONST.TOKEN_DISPOSITIONS.HOSTILE,
        "Hostile Retainer 2 should have hostile disposition",
      );
      expect(hostileRetainer2?.hasPlayerOwner).to.be.false;

      await createCombatant(pc1 as OseActor);
      await createCombatant(pc2 as OseActor);
      await createCombatant(friendlyCharacter1 as OseActor);
      await createCombatant(friendlyCharacter2 as OseActor);
      await createCombatant(neutralCharacter1 as OseActor);
      await createCombatant(neutralCharacter2 as OseActor);
      await createCombatant(hostileCharacter1 as OseActor);
      await createCombatant(hostileCharacter2 as OseActor);
      await createCombatant(friendlyMonster1 as OseActor);
      await createCombatant(friendlyMonster2 as OseActor);
      await createCombatant(neutralMonster1 as OseActor);
      await createCombatant(neutralMonster2 as OseActor);
      await createCombatant(hostileMonster1 as OseActor);
      await createCombatant(hostileMonster2 as OseActor);
      await createCombatant(friendlyRetainer1 as OseActor);
      await createCombatant(friendlyRetainer2 as OseActor);
      await createCombatant(neutralRetainer1 as OseActor);
      await createCombatant(neutralRetainer2 as OseActor);
      await createCombatant(hostileRetainer1 as OseActor);
      await createCombatant(hostileRetainer2 as OseActor);
      await waitForInput();
    });
  });

  describe("groupCombat(reroll)", async () => {
    let previousInitiativeSetting: string;
    let previousCombatRerollBehavior: string;

    before(async () => {
      previousInitiativeSetting = game.settings.get(game.system.id, "initiative");
      await game.settings.set(game.system.id, "initiative", "group");

      previousCombatRerollBehavior = game.settings.get(game.system.id, "rerollInitiative");
      await game.settings.set(game.system.id, "rerollInitiative", "reroll");

      await trashChat();
    });

    after(async () => {
      await cleanupCombat();
      await game.settings.set(game.system.id, "initiative", previousInitiativeSetting);
      await game.settings.set(game.system.id, "rerollInitiative", previousCombatRerollBehavior);
      await cleanUpActorsByKey(key);
      await waitForInput();
    });

    afterEach(async () => {
      await trashChat();
    });

    it("should render groups", async () => {
      await addAllTokensToCombat();
      await waitForInput();

      expect(game.combat).to.not.be.null;
      expect(game.combat?.combatants?.size).to.equal(20);
      expect(game.combat?.groups?.size).to.equal(3);

      const combatTracker = getCombatTrackerElement();
      expect(combatTracker).to.not.be.null;
      expect(combatTracker?.children?.length).to.equal(3);
      for (const group of game.combat.groups.contents) {
        const groupHeader = combatTracker?.querySelector(`li[data-group-key="${group.name}"]`);
        expect(groupHeader).to.not.be.null;
        expect(groupHeader?.querySelector("ol.group-children")).to.not.be.null;
        expect(groupHeader?.querySelector("ol.group-children")?.children?.length).to.equal(group.members?.size);
      }
    });

    it("should roll initiative for all groups", async () => {
      expect(game.messages.size).to.equal(0);
      const smartRerollInitiativeButton = document.querySelector(
        ".combat-tracker-header .combat-control[data-action='smartRerollInitiative']",
      );
      expect(smartRerollInitiativeButton).to.not.be.null;
      smartRerollInitiativeButton?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      await waitForInput();
      expect(game.messages.size).to.equal(3);
      for (const group of game.combat.groups.contents.map((g) => g.name)) {
        expect(
          game.messages.contents.some((cm) => cm.flavor.includes(game.i18n.format("OSE.roll.initiative", { group }))),
        ).to.be.true;
      }
      expect(game.combat?.groups?.some((g) => g.initiative === null)).to.be.false;

      const combatTracker = getCombatTrackerElement();
      const greenHeader = combatTracker?.querySelector("li[data-group-key='green']");
      expect(greenHeader).to.not.be.null;
      expect(greenHeader?.dataset?.initiative).to.not.be.undefined;
      expect(greenHeader?.querySelector(".group-header .create-button")?.textContent).to.equal(
        greenHeader?.dataset?.initiative,
      );
      const purpleHeader = combatTracker?.querySelector("li[data-group-key='purple']");
      expect(purpleHeader).to.not.be.null;
      expect(purpleHeader?.dataset?.initiative).to.not.be.undefined;
      expect(purpleHeader?.querySelector(".group-header .create-button")?.textContent).to.equal(
        purpleHeader?.dataset?.initiative,
      );
      const redHeader = combatTracker?.querySelector("li[data-group-key='red']");
      expect(redHeader).to.not.be.null;
      expect(redHeader?.dataset?.initiative).to.not.be.undefined;
      expect(redHeader?.querySelector(".group-header .create-button")?.textContent).to.equal(
        redHeader?.dataset?.initiative,
      );
    });

    it("should not reroll initiative for rolled groups on combat start", async () => {
      const groupInitiatives: Map<string, number> = new Map();
      for (const group of game.combat?.groups) {
        groupInitiatives.set(group.name, group.initiative);
      }
      await game.combat.startCombat();
      await waitForInput();
      expect(game.combat?.started).to.be.true;
      expect(game.combat?.round).to.equal(1);
      expect(game.combat?.turn).to.equal(0);
      expect(game.combat?.groups?.size).to.equal(3);
      expect(game.combat?.combatants?.size).to.equal(20);
      expect(game.messages.size).to.equal(0);
      expect(game.combat?.groups?.some((g) => g.initiative !== groupInitiatives.get(g.name))).to.be.false;
    });

    it("should roll initiative for unrolled groups on combat start", async () => {
      await cleanupCombat();
      await waitForInput();
      await addAllTokensToCombat();
      await waitForInput();

      expect(game.messages.size).to.equal(0);
      expect(game.combat?.groups?.some((g) => g.initiative === null)).to.be.true;
      await game.combat.startCombat();
      await waitForInput();
      expect(game.combat?.started).to.be.true;
      expect(game.combat?.round).to.equal(1);
      expect(game.combat?.turn).to.equal(0);
      expect(game.combat?.groups?.size).to.equal(3);
      expect(game.combat?.combatants?.size).to.equal(20);
      expect(game.messages.size).to.equal(3);
      for (const group of game.combat.groups.contents.map((g) => g.name)) {
        expect(
          game.messages.contents.some((cm) => cm.flavor.includes(game.i18n.format("OSE.roll.initiative", { group }))),
        ).to.be.true;
      }
      expect(game.combat?.groups?.some((g) => g.initiative === null)).to.be.false;

      const combatTracker = getCombatTrackerElement();
      const greenHeader = combatTracker?.querySelector("li[data-group-key='green']");
      expect(greenHeader).to.not.be.null;
      expect(greenHeader?.dataset?.initiative).to.not.be.undefined;
      expect(greenHeader?.querySelector(".group-header .create-button")?.textContent).to.equal(
        greenHeader?.dataset?.initiative,
      );
      const purpleHeader = combatTracker?.querySelector("li[data-group-key='purple']");
      expect(purpleHeader).to.not.be.null;
      expect(purpleHeader?.dataset?.initiative).to.not.be.undefined;
      expect(purpleHeader?.querySelector(".group-header .create-button")?.textContent).to.equal(
        purpleHeader?.dataset?.initiative,
      );
      const redHeader = combatTracker?.querySelector("li[data-group-key='red']");
      expect(redHeader).to.not.be.null;
      expect(redHeader?.dataset?.initiative).to.not.be.undefined;
      expect(redHeader?.querySelector(".group-header .create-button")?.textContent).to.equal(
        redHeader?.dataset?.initiative,
      );
    });

    it("should mark combatants as active", async () => {
      let combatants = getCombatantElements();
      expect(combatants).to.not.be.null;
      expect(combatants?.length).to.equal(20);
      expect(combatants?.[0]?.classList.contains("active")).to.be.true;

      await game.combat?.nextTurn();
      await waitForInput();
      expect(game.combat?.turn).to.equal(1);
      combatants = getCombatantElements();
      expect(combatants?.[0]?.classList.contains("active")).to.be.false;
      expect(combatants?.[1]?.classList.contains("active")).to.be.true;
    });

    it("should reroll initiative for all groups on new round", async () => {
      await game?.combat?.nextRound();
      await waitForInput();
      expect(game.combat?.started).to.be.true;
      expect(game.combat?.round).to.equal(2);
      expect(game.combat?.turn).to.equal(0);
      expect(game.combat?.groups?.size).to.equal(3);
      expect(game.combat?.combatants?.size).to.equal(20);
      expect(game.messages.size).to.equal(3);
      expect(getCombatantElements()?.[0]?.classList.contains("active")).to.be.true;
    });
  });

  describe("groupCombat(reset)", async () => {
    let previousInitiativeSetting: string;
    let previousCombatRerollBehavior: string;

    before(async () => {
      previousInitiativeSetting = game.settings.get(game.system.id, "initiative");
      await game.settings.set(game.system.id, "initiative", "group");

      previousCombatRerollBehavior = game.settings.get(game.system.id, "rerollInitiative");
      await game.settings.set(game.system.id, "rerollInitiative", "reset");

      await trashChat();
    });

    after(async () => {
      await cleanupCombat();
      await game.settings.set(game.system.id, "initiative", previousInitiativeSetting);
      await game.settings.set(game.system.id, "rerollInitiative", previousCombatRerollBehavior);
      await cleanUpActorsByKey(key);
      await waitForInput();
    });

    afterEach(async () => {
      await trashChat();
    });

    it("should not roll initiative for groups on combat start", async () => {
      await addAllTokensToCombat();
      await waitForInput();

      await game.combat.startCombat();
      await waitForInput();
      expect(game.combat?.started).to.be.true;
      expect(game.combat?.round).to.equal(1);
      expect(game.combat?.turn).to.equal(0);
      expect(game.combat?.groups?.size).to.equal(3);
      expect(game.combat?.combatants?.size).to.equal(20);
      expect(game.messages.size).to.equal(0);
      expect(game.combat?.groups?.some((g) => g.initiative !== null)).to.be.false;
    });

    it("should mark combatants as active", async () => {
      let combatants = getCombatantElements();
      expect(combatants).to.not.be.null;
      expect(combatants?.length).to.equal(20);
      expect(combatants?.[0]?.classList.contains("active")).to.be.true;

      await game.combat?.nextTurn();
      await waitForInput();
      expect(game.combat?.turn).to.equal(1);
      combatants = getCombatantElements();
      expect(combatants?.[0]?.classList.contains("active")).to.be.false;
      expect(combatants?.[1]?.classList.contains("active")).to.be.true;
    });

    it("should reset initiative for all groups on new round", async () => {
      await game?.combat?.smartRerollInitiative();
      await waitForInput();
      expect(game.messages.size).to.equal(3);
      expect(game.combat?.groups?.some((g) => g.initiative === null)).to.be.false;

      await game?.combat?.nextRound();
      await waitForInput();
      expect(game.combat?.started).to.be.true;
      expect(game.combat?.round).to.equal(2);
      expect(game.combat?.turn).to.equal(0);
      expect(game.combat?.groups?.size).to.equal(3);
      expect(game.combat?.combatants?.size).to.equal(20);
      expect(game.messages.size).to.equal(3);
      expect(game.combat?.groups?.some((g) => g.initiative !== null)).to.be.false;
      expect(getCombatantElements()?.[0]?.classList.contains("active")).to.be.true;
    });
  });

  describe("groupCombat(keep)", async () => {
    let previousInitiativeSetting: string;
    let previousCombatRerollBehavior: string;

    before(async () => {
      previousInitiativeSetting = game.settings.get(game.system.id, "initiative");
      await game.settings.set(game.system.id, "initiative", "group");

      previousCombatRerollBehavior = game.settings.get(game.system.id, "rerollInitiative");
      await game.settings.set(game.system.id, "rerollInitiative", "keep");

      await trashChat();
    });

    after(async () => {
      await cleanupCombat();
      await game.settings.set(game.system.id, "initiative", previousInitiativeSetting);
      await game.settings.set(game.system.id, "rerollInitiative", previousCombatRerollBehavior);
      await cleanUpActorsByKey(key);
      await waitForInput();
    });

    afterEach(async () => {
      await trashChat();
    });

    it("should roll initiative for all groups on combat start", async () => {
      await addAllTokensToCombat();
      await waitForInput();

      await game.combat.startCombat();
      await waitForInput();
      expect(game.combat?.started).to.be.true;
      expect(game.combat?.round).to.equal(1);
      expect(game.combat?.turn).to.equal(0);
      expect(game.combat?.groups?.size).to.equal(3);
      expect(game.combat?.combatants?.size).to.equal(20);
      expect(game.messages.size).to.equal(3);
      expect(game.combat?.groups?.some((g) => g.initiative === null)).to.be.false;
    });

    it("should mark combatants as active", async () => {
      let combatants = getCombatantElements();
      expect(combatants).to.not.be.null;
      expect(combatants?.length).to.equal(20);
      expect(combatants?.[0]?.classList.contains("active")).to.be.true;

      await game.combat?.nextTurn();
      await waitForInput();
      expect(game.combat?.turn).to.equal(1);
      combatants = getCombatantElements();
      expect(combatants?.[0]?.classList.contains("active")).to.be.false;
      expect(combatants?.[1]?.classList.contains("active")).to.be.true;
    });

    it("should keep initiative for all groups on new round", async () => {
      expect(game.combat?.groups?.some((g) => g.initiative === null)).to.be.false;
      const groupInitiatives: Map<string, number> = new Map();
      for (const group of game.combat?.groups) {
        groupInitiatives.set(group.name, group.initiative);
      }

      await game?.combat?.nextRound();
      await waitForInput();
      expect(game.combat?.started).to.be.true;
      expect(game.combat?.round).to.equal(2);
      expect(game.combat?.turn).to.equal(0);
      expect(game.combat?.groups?.size).to.equal(3);
      expect(game.combat?.combatants?.size).to.equal(20);
      expect(game.messages.size).to.equal(0);
      expect(game.combat?.groups?.some((g) => g.initiative !== groupInitiatives.get(g.name))).to.be.false;
      expect(getCombatantElements()?.[0]?.classList.contains("active")).to.be.true;
    });
  });

  describe("individualCombat(reroll)", async () => {
    let previousInitiativeSetting: string;
    let previousCombatRerollBehavior: string;

    before(async () => {
      previousInitiativeSetting = game.settings.get(game.system.id, "initiative");
      await game.settings.set(game.system.id, "initiative", "individual");

      previousCombatRerollBehavior = game.settings.get(game.system.id, "rerollInitiative");
      await game.settings.set(game.system.id, "rerollInitiative", "reroll");

      await trashChat();
    });

    after(async () => {
      await cleanupCombat();
      await game.settings.set(game.system.id, "initiative", previousInitiativeSetting);
      await game.settings.set(game.system.id, "rerollInitiative", previousCombatRerollBehavior);
      await cleanUpActorsByKey(key);
      await waitForInput();
    });

    afterEach(async () => {
      await trashChat();
    });

    it("should not render groups", async () => {
      await addAllTokensToCombat();
      await waitForInput();

      expect(game.combat).to.not.be.null;
      expect(game.combat?.combatants?.size).to.equal(20);
      expect(game.combat?.groups?.size).to.equal(0);

      const combatTracker = getCombatTrackerElement();
      expect(combatTracker).to.not.be.null;
      expect(combatTracker?.children?.length).to.equal(20);
    });

    it("should roll initiative for all combatants", async () => {
      expect(game.messages.size).to.equal(0);
      const rollAllButton = document.querySelector(".combat-tracker-header .combat-control[data-action='rollAll']");
      expect(rollAllButton).to.not.be.null;
      rollAllButton?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      await waitForInput();
      expect(game.messages.size).to.equal(20);
      for (const combatant of game.combat.combatants.contents.map((g) => g.name)) {
        expect(
          game.messages.contents.some((cm) =>
            cm.flavor.includes(
              game.i18n.format("OSE.roll.individualInit", {
                name: combatant,
              }),
            ),
          ),
        ).to.be.true;
      }
      expect(game.combat?.combatants?.some((c) => c.initiative === null)).to.be.false;
    });

    it("should not reroll initiative for all combatants on combat start", async () => {
      const individualInitiatives: Map<string, number> = new Map();
      for (const combatant of game.combat?.combatants) {
        individualInitiatives.set(combatant.id, combatant.initiative);
      }
      await game.combat.startCombat();
      await waitForInput();
      expect(game.combat?.started).to.be.true;
      expect(game.combat?.round).to.equal(1);
      expect(game.combat?.turn).to.equal(0);
      expect(game.combat?.groups?.size).to.equal(0);
      expect(game.combat?.combatants?.size).to.equal(20);
      expect(game.messages.size).to.equal(0);
      expect(game.combat?.combatants?.some((c) => c.initiative !== individualInitiatives.get(c.id))).to.be.false;
    });

    it("should mark combatants as active", async () => {
      let combatants = getCombatantElements();
      expect(combatants).to.not.be.null;
      expect(combatants?.length).to.equal(20);
      expect(combatants?.[0]?.classList.contains("active")).to.be.true;

      await game.combat?.nextTurn();
      await waitForInput();
      expect(game.combat?.turn).to.equal(1);
      combatants = getCombatantElements();
      expect(combatants?.[0]?.classList.contains("active")).to.be.false;
      expect(combatants?.[1]?.classList.contains("active")).to.be.true;
    });

    it("should reroll initiative for all combatants on new round", async () => {
      await game?.combat?.nextRound();
      await waitForInput();
      expect(game.combat?.started).to.be.true;
      expect(game.combat?.round).to.equal(2);
      expect(game.combat?.turn).to.equal(0);
      expect(game.combat?.groups?.size).to.equal(0);
      expect(game.combat?.combatants?.size).to.equal(20);
      expect(game.messages.size).to.equal(20);
      expect(getCombatantElements()?.[0]?.classList.contains("active")).to.be.true;
    });
  });

  describe("individualCombat(reset)", async () => {
    let previousInitiativeSetting: string;
    let previousCombatRerollBehavior: string;

    before(async () => {
      previousInitiativeSetting = game.settings.get(game.system.id, "initiative");
      await game.settings.set(game.system.id, "initiative", "individual");

      previousCombatRerollBehavior = game.settings.get(game.system.id, "rerollInitiative");
      await game.settings.set(game.system.id, "rerollInitiative", "reset");

      await trashChat();
    });

    after(async () => {
      await cleanupCombat();
      await game.settings.set(game.system.id, "initiative", previousInitiativeSetting);
      await game.settings.set(game.system.id, "rerollInitiative", previousCombatRerollBehavior);
      await cleanUpActorsByKey(key);
      await waitForInput();
    });

    afterEach(async () => {
      await trashChat();
    });

    it("should not roll initiative for all combatants on combat start", async () => {
      await addAllTokensToCombat();
      await waitForInput();

      await game.combat.startCombat();
      await waitForInput();
      expect(game.combat?.started).to.be.true;
      expect(game.combat?.round).to.equal(1);
      expect(game.combat?.turn).to.equal(0);
      expect(game.combat?.groups?.size).to.equal(0);
      expect(game.combat?.combatants?.size).to.equal(20);
      expect(game.messages.size).to.equal(0);
      expect(game.combat?.combatants?.some((c) => c.initiative !== null)).to.be.false;
    });

    it("should mark combatants as active", async () => {
      let combatants = getCombatantElements();
      expect(combatants).to.not.be.null;
      expect(combatants?.length).to.equal(20);
      expect(combatants?.[0]?.classList.contains("active")).to.be.true;

      await game.combat?.nextTurn();
      await waitForInput();
      expect(game.combat?.turn).to.equal(1);
      combatants = getCombatantElements();
      expect(combatants?.[0]?.classList.contains("active")).to.be.false;
      expect(combatants?.[1]?.classList.contains("active")).to.be.true;
    });

    it("should reset initiative for all combatants on new round", async () => {
      await game?.combat?.smartRerollInitiative();
      await waitForInput();
      expect(game.messages.size).to.equal(20);
      for (const group of game.combat?.groups) {
        expect(group?.initiative).to.not.be.null;
      }

      await game?.combat?.nextRound();
      await waitForInput();
      expect(game.combat?.started).to.be.true;
      expect(game.combat?.round).to.equal(2);
      expect(game.combat?.turn).to.equal(0);
      expect(game.combat?.groups?.size).to.equal(0);
      expect(game.combat?.combatants?.size).to.equal(20);
      expect(game.messages.size).to.equal(20);
      expect(game.combat?.combatants?.some((c) => c.initiative !== null)).to.be.false;
      expect(getCombatantElements()?.[0]?.classList.contains("active")).to.be.true;
    });
  });

  describe("individualCombat(keep)", async () => {
    let previousInitiativeSetting: string;
    let previousCombatRerollBehavior: string;

    before(async () => {
      previousInitiativeSetting = game.settings.get(game.system.id, "initiative");
      await game.settings.set(game.system.id, "initiative", "individual");

      previousCombatRerollBehavior = game.settings.get(game.system.id, "rerollInitiative");
      await game.settings.set(game.system.id, "rerollInitiative", "keep");

      await trashChat();
    });

    after(async () => {
      await cleanupCombat();
      await game.settings.set(game.system.id, "initiative", previousInitiativeSetting);
      await game.settings.set(game.system.id, "rerollInitiative", previousCombatRerollBehavior);
      await cleanUpActorsByKey(key);
      await waitForInput();
    });

    afterEach(async () => {
      await trashChat();
    });

    it("should roll initiative for all combatants on combat start", async () => {
      await addAllTokensToCombat();
      await waitForInput();

      await game.combat.startCombat();
      await waitForInput();
      expect(game.combat?.started).to.be.true;
      expect(game.combat?.round).to.equal(1);
      expect(game.combat?.turn).to.equal(0);
      expect(game.combat?.groups?.size).to.equal(0);
      expect(game.combat?.combatants?.size).to.equal(20);
      expect(game.messages.size).to.equal(20);
      expect(game.combat?.combatants?.some((c) => c.initiative === null)).to.be.false;
    });

    it("should mark combatants as active", async () => {
      let combatants = getCombatantElements();
      expect(combatants).to.not.be.null;
      expect(combatants?.length).to.equal(20);
      expect(combatants?.[0]?.classList.contains("active")).to.be.true;

      await game.combat?.nextTurn();
      await waitForInput();
      expect(game.combat?.turn).to.equal(1);
      combatants = getCombatantElements();
      expect(combatants?.[0]?.classList.contains("active")).to.be.false;
      expect(combatants?.[1]?.classList.contains("active")).to.be.true;
    });

    it("should keep initiative for all groups on new round", async () => {
      expect(game.combat?.combatants?.some((c) => c.initiative === null)).to.be.false;
      const individualInitiatives: Map<string, number> = new Map();
      for (const combatant of game.combat?.combatants) {
        individualInitiatives.set(combatant.id, combatant.initiative);
      }

      await game?.combat?.nextRound();
      await waitForInput();
      expect(game.combat?.started).to.be.true;
      expect(game.combat?.round).to.equal(2);
      expect(game.combat?.turn).to.equal(0);
      expect(game.combat?.groups?.size).to.equal(0);
      expect(game.combat?.combatants?.size).to.equal(20);
      expect(game.messages.size).to.equal(0);
      expect(game.combat?.combatants?.some((c) => c.initiative !== individualInitiatives.get(c.id))).to.be.false;
      expect(getCombatantElements()?.[0]?.classList.contains("active")).to.be.true;
    });
  });
};
