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
