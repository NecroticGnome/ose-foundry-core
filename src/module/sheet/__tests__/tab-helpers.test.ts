/**
 * @file Tests for the shared tab-context helper.
 */
import type { QuenchMethods } from "../../../e2e";
import { buildTabsContext } from "../tab-helpers";

export const key = "ose.sheet.tabHelpers";
export const options = {
  displayName: "OSE: Sheet: tabHelpers",
};

class FakeSheet {
  static TABS = {
    primary: {
      tabs: [
        { id: "attributes", icon: "fas fa-user", label: "OSE.tab.attributes" },
        { id: "abilities", icon: "fas fa-bolt", label: "OSE.tab.abilities" },
        { id: "spells", icon: "fas fa-magic", label: "OSE.tab.spells" },
      ],
      initial: "attributes",
    },
  };

  tabGroups = { primary: "abilities" };
}

export default ({ describe, it, expect }: QuenchMethods) => {
  describe("buildTabsContext(sheet)", () => {
    it("returns a record keyed by group, then by tab id", () => {
      const tabs = buildTabsContext(new FakeSheet());
      expect(tabs).to.have.property("primary");
      expect(tabs.primary).to.have.all.keys("attributes", "abilities", "spells");
    });

    it("marks the active tab as active and gives it the 'active' cssClass", () => {
      const tabs = buildTabsContext(new FakeSheet());
      expect(tabs.primary.abilities.active).to.equal(true);
      expect(tabs.primary.abilities.cssClass).to.equal("active");
      expect(tabs.primary.attributes.active).to.equal(false);
      expect(tabs.primary.attributes.cssClass).to.equal("");
    });

    it("localizes labels through game.i18n.localize", () => {
      const tabs = buildTabsContext(new FakeSheet());
      // game.i18n.localize returns the key unchanged when no translation
      // exists; the assertion is that the function is called and the
      // result is what landed in `label`.
      expect(tabs.primary.attributes.label).to.equal(game.i18n.localize("OSE.tab.attributes"));
    });

    it("drops tabs for which the filter predicate returns false", () => {
      const tabs = buildTabsContext(new FakeSheet(), (t: { id: string }) => t.id !== "spells");
      expect(tabs.primary).to.have.all.keys("attributes", "abilities");
      expect(tabs.primary).to.not.have.property("spells");
    });

    it("returns an empty object when the class has no TABS config", () => {
      // Use an object literal here (and below) rather than a second class
      // declaration; the project's max-classes-per-file lint rule caps a
      // file at one class definition. A plain object with a `constructor`
      // proxy mimics the shape buildTabsContext reads.
      const bare = { constructor: { TABS: undefined }, tabGroups: {} };
      const tabs = buildTabsContext(bare);
      expect(tabs).to.deep.equal({});
    });
  });
};
