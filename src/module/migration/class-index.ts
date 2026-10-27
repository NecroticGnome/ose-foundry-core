/**
 * @file Finds class items matching free-text class names.
 */
import type { ClassicClassName } from "../../types/classes";
import { CLASSIC_PRIME_REQS, classicClassToItemData } from "../classes/classic-to-item";
import { normaliseName, toKey } from "../classes/matching";

export interface IndexEntry {
  name: string;
  key: string;
  source: string;
  uuid?: string;
  load: () => Promise<Record<string, unknown>>;
}

const PREFERRED_PACKS = [
  "ose-premiumgame.classes",
  "ose-advancedfantasytome.classes",
  "classicfantasycompendium.classes",
];

export const resolveClass = (text: string, entries: IndexEntry[]) => {
  const n = normaliseName(text);
  if (!n) return null;
  const k = toKey(text);
  return entries.find((e) => e.key && e.key === k) ?? entries.find((e) => normaliseName(e.name) === n) ?? null;
};

export const packRank = (id: string) => {
  const i = PREFERRED_PACKS.indexOf(id);
  return i === -1 ? PREFERRED_PACKS.length : i;
};

// World items, then preferred packs, other packs, and finally the bundled Classic tables.
export const buildClassIndex = async (): Promise<IndexEntry[]> => {
  const entries: IndexEntry[] = [];
  for (const item of game.items?.filter((i) => i.type === "class") ?? []) {
    entries.push({
      name: item.name,
      key: (item.system as { key?: string }).key ?? "",
      source: "world",
      uuid: item.uuid,
      load: async () => item.toObject() as Record<string, unknown>,
    });
  }
  const packs = [...(game.packs?.filter((p) => p.documentName === "Item") ?? [])];
  packs.sort((a, b) => packRank(a.collection) - packRank(b.collection));
  for (const pack of packs) {
    const index = await pack.getIndex({ fields: ["type", "system.key"] as never });
    for (const entry of index as unknown as {
      _id: string;
      name: string;
      type: string;
      uuid: string;
      system?: { key?: string };
    }[]) {
      if (entry.type !== "class") continue;
      entries.push({
        name: entry.name,
        key: entry.system?.key ?? "",
        source: pack.collection,
        uuid: entry.uuid,
        load: async () => ((await pack.getDocument(entry._id)) as Item).toObject() as Record<string, unknown>,
      });
    }
  }
  for (const [name, cls] of Object.entries(CONFIG.OSE.classes?.classic ?? {})) {
    const data = classicClassToItemData(cls, CLASSIC_PRIME_REQS[name as ClassicClassName] ?? [], (key, d) =>
      game.i18n.format(key, d),
    );
    entries.push({
      name,
      key: data.system.key ?? "",
      source: game.system.id,
      load: async () => foundry.utils.deepClone(data) as Record<string, unknown>,
    });
  }
  return entries;
};
