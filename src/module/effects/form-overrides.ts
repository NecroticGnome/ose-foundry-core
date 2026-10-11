/**
 * @file Keeps Active Effect changes out of the values a sheet stores.
 */

// Sheets show values after effects and lock the fields effects change.
export const withoutOverrides = (submitted: Record<string, unknown>, overridden: string[]) =>
  Object.fromEntries(Object.entries(submitted).filter(([path]) => !overridden.includes(path)));
