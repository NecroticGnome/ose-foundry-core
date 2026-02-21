import { createOseMacro } from "../macros";

export const key = "ose.macro";
export const options = { displayName: "Macro" };

const createMockMacro = () =>
  Macro.create({
    name: `Mock Macro ${foundry.utils.randomID()}`,
    type: "script",
    command: "console.log('Testing Macro');",
  });

const cleanUpMacros = async () => {
  const mockMacros = game.macros.filter((o) => o.name.indexOf("Mock Macro") >= 0);
  for (const o of mockMacros) {
    await o.delete();
  }
};

export default ({ describe, it, expect }) => {
  afterEach(() => cleanUpMacros());

  describe("Macro", () => {
    it("Can create macro", async () => {
      const macro = await createMockMacro();
      expect(game.macros.contents.find((m) => m.uuid === macro.uuid)).not.equal(undefined);
    });
    it("Can drag macro to hotbar", async () => {
      const macro = await createMockMacro();
      // Mock data that is used when drag'n'dropping
      const data = { type: "Macro", uuid: macro.uuid };
      const macroSlot = 9;

      await createOseMacro(data, macroSlot);
      const hotbar = game.user.getHotbarMacros(1);

      expect(hotbar[macroSlot - 1].macro).equal(macro);
    });
  });
};
