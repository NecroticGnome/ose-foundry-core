/**
 * @file Shared tab-context helper for V2 sheets.
 */

/**
 * Build the `tabs` context entry consumed by tab-nav partials.
 * Reads the sheet's static `TABS` config and active tab from `tabGroups`.
 *
 * @param {object}   sheet      - The V2 sheet instance.
 * @param {Function} [filterFn] - Optional `(tab) => boolean` to hide tabs.
 * @returns {object} Nested object keyed by group id then tab id.
 */
export function buildTabsContext(sheet, filterFn) {
  const tabsConfig = sheet.constructor.TABS ?? {};
  return Object.fromEntries(
    Object.entries(tabsConfig).map(([groupId, group]) => {
      const built = (group.tabs ?? [])
        .filter((tab) => !filterFn || filterFn(tab))
        .reduce((acc, tab) => {
          const active = sheet.tabGroups?.[groupId] === tab.id;
          acc[tab.id] = {
            id: tab.id,
            group: groupId,
            icon: tab.icon,
            label: tab.label ? game.i18n.localize(tab.label) : "",
            active,
            cssClass: active ? "active" : "",
          };
          return acc;
        }, {});
      return [groupId, built];
    }),
  );
}
