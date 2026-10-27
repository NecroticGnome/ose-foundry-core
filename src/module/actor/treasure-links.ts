/**
 * @file A monster's treasure tables, stored as space-separated @UUID links.
 */

const LINK = /@UUID\[([^\]]+)\](\{[^}]*\})?/g;

const links = (text: string | null | undefined) => [...(text ?? "").matchAll(LINK)];

export const addTreasureTable = (text: string | null | undefined, link: string) => {
  const uuid = links(link)[0]?.[1];
  const current = links(text);
  if (current.some((m) => m[1] === uuid)) return current.map((m) => m[0]).join(" ");
  return [...current.map((m) => m[0]), link].join(" ");
};

export const removeTreasureTable = (text: string | null | undefined, uuid: string) =>
  links(text)
    .filter((m) => m[1] !== uuid)
    .map((m) => m[0])
    .join(" ");

/** The first linked table (an @UUID link) and how many more tables or typed text sit behind it. */
export type TreasureSummary = { first: string; more: number };

// When a treasure summary is needed (more than one treasure table) it returns the details, otherwise null.
export const treasureSummary = (
  text: string | null | undefined,
  typed: string | null | undefined,
): TreasureSummary | null => {
  const [head, ...rest] = links(text);
  const more = rest.length + (typed ? 1 : 0);
  return head && more ? { first: head[0], more } : null;
};
