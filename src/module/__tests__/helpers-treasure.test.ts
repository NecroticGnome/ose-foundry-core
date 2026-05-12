/**
 * @file Contains tests for treasure helpers
 */
// eslint-disable-next-line prettier/prettier, import/no-cycle
import type { QuenchMethods } from "../../e2e";
import { rollSpecificNumber, trashChat, waitForInput } from "../../e2e/testUtils";
import { functionsForTesting } from "../helpers-treasure";

const { drawTreasure, rollTreasure } = functionsForTesting;

export const key = "ose.helpers.treasure";
export const options = {
  displayName: "OSE: Helpers: Treasure",
};

const createMockTable = async () =>
  RollTable.create({
    name: `Mock Table ${key}`,
  });

const createMockTreasureTable = async () => {
  const table: RollTable = (await createMockTable()) as RollTable;
  await table.update({ name: `Mock Treasure Table ${key}` });
  await table.setFlag(game.system.id, "treasure", true);
  return table;
};

const cleanUpTables = async () => {
  const tables = game.tables?.filter((t) => t.name === `Mock Table ${key}` || t.name === `Mock Treasure Table ${key}`);
  for (const t of tables ?? []) {
    await t.delete();
  }
};

export default ({ describe, it, expect, after }: QuenchMethods) => {
  // @todo: how to test?
  describe("augmentTable(table, html)", () => {});

  describe("drawTreasure(table, data)", () => {
    it("Can create table", async () => {
      const table = await createMockTreasureTable();
      await table.createEmbeddedDocuments("TableResult", [
        {
          text: "50% Chance",
          range: [1, 1],
          weight: 50,
        },
      ]);
      expect(table.results.size).equal(1);
      await table.delete();
    });

    it("Draws successfully from a treasure table", async () => {
      const table = await createMockTreasureTable();
      await table.createEmbeddedDocuments("TableResult", [
        {
          text: "100% Chance",
          range: [1, 1],
          weight: 100,
        },
      ]);
      const data = await drawTreasure(table, {});
      await waitForInput();
      expect(data.treasure).is.not.undefined;
      const resultKey = Object.keys(data.treasure)[0];
      expect(data.treasure[resultKey].text).to.include("100% Chance");
    });

    it("Draws unsuccessfully from a treasure table", async () => {
      // Ensure the dice roll is greater than 1
      const existingRandomFunction = CONFIG.Dice.randomUniform;
      CONFIG.Dice.randomUniform = () => rollSpecificNumber(2, 100);

      const table = await createMockTreasureTable();
      await table.createEmbeddedDocuments("TableResult", [
        {
          text: "1% Chance",
          range: [1, 1],
          weight: 1,
        },
      ]);
      const data = await drawTreasure(table, {});
      expect(Object.keys(data.treasure).length).equal(0);

      // Restore the original random function
      CONFIG.Dice.randomUniform = existingRandomFunction;
    });

    it("Just draws from a non-treasure table", async () => {
      const table = await createMockTable();
      table?.update({ formula: "1d100" });
      await table?.createEmbeddedDocuments("TableResult", [
        {
          text: "100% Chance",
          range: [1, 100],
        },
      ]);
      const data = await drawTreasure(table, {});
      await waitForInput();
      expect(data.treasure).is.not.undefined;
      const resultKey = Object.keys(data.treasure)[0];
      expect(data.treasure[resultKey].text).to.include("100% Chance");
    });
  });

  describe("rollTreasure(table, options)", () => {
    it("Rolling on treasure table produces a chat message", async () => {
      trashChat();
      const table = await createMockTreasureTable();
      await table.createEmbeddedDocuments("TableResult", [
        {
          text: "100% Chance",
          range: [1, 1],
          weight: 100,
        },
      ]);
      await rollTreasure(table);
      await waitForInput();
      expect(game.messages?.size).equal(1);
      expect(game.messages?.contents[0].content).contains("100% Chance");
    });
  });

  after(() => {
    cleanUpTables();
    trashChat();
  });
};
