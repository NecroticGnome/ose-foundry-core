/**
 * @file Converts one character's typed class into a class item.
 */
import { buildEffectData, type Change } from "../classes/effects";
import { saveTweaks, tweakValues } from "../effects/tweak-effects";
import { buildClassIndex, type IndexEntry, resolveClass } from "./class-index";
import { adjustmentRows, type ClassData, planConversion, type ReportStatus, readSource } from "./plan-conversion";

export interface ReportEntry {
  actorUuid: string;
  actorName: string;
  text: string;
  status: ReportStatus;
  source?: string;
  note?: string;
  itemUuid?: string;
  changes?: Change[];
  bonusKept?: number;
}

// Tags everything the migration adds.
const migrationFlags = () => ({ [game.system.id]: { migration: true } });

// biome-ignore lint/suspicious/noExplicitAny: accepts world, token and compendium actors alike
export const convertActor = async (actor: any, index: IndexEntry[]): Promise<ReportEntry> => {
  // An old Bonus Experience is the prime requisite, stored or already moved to its Tweaks effect.
  const system = actor._source.system;
  const bonus = tweakValues(actor).xp ?? 0;
  const src = readSource({ ...system, details: { ...system.details, xp: { ...system.details?.xp, bonus } } });
  const base = { actorUuid: actor.uuid, actorName: actor.name, text: src.text };
  if (actor.items.some((i: Item) => i.type === "class")) return { ...base, status: "none", note: "hasClasses" };
  const match = resolveClass(src.text, index);
  const data = match ? ((await match.load()) as ClassData) : null;
  const plan = planConversion(src, data);
  if (!plan.item) return { ...base, status: plan.status };
  const item: Record<string, unknown> = {
    ...plan.item,
    flags: foundry.utils.mergeObject(plan.item.flags ?? {}, migrationFlags()),
  };
  delete item._id;
  delete item.folder;
  delete item.sort;
  if (match?.uuid) item._stats = { compendiumSource: match.uuid };
  const [created] = await actor.createEmbeddedDocuments("Item", [item]);
  await saveTweaks(actor, { xp: plan.xpBonus ?? 0 });
  if (plan.changes?.length) {
    const name = game.i18n.localize("OSE.migration.EffectName");
    await actor.createEmbeddedDocuments("ActiveEffect", [
      buildEffectData(name, plan.changes, game.release.generation, { flags: migrationFlags() }),
    ]);
  }
  const bonusKept = plan.xpBonus || undefined;
  return {
    ...base,
    status: plan.status,
    source: match?.source,
    note: plan.note,
    itemUuid: created?.uuid,
    changes: plan.changes,
    bonusKept,
  };
};

// The sheet's "Convert to class items" button.
// biome-ignore lint/suspicious/noExplicitAny: any character actor
export const convertSingleActor = async (actor: any) => {
  const before = actor.classStats();
  const entry = await convertActor(actor, await buildClassIndex());
  await actor.setFlag(game.system.id, "migrations.classItems", true);
  const message = game.i18n.format(`OSE.migration.single.${entry.status}`, {
    name: actor.name,
    text: entry.text,
    source: (entry.source && game.packs?.get(entry.source)?.title) || entry.source || "",
  });
  ui.notifications?.info(message);
  const item = entry.itemUuid && actor.items.find((i: Item) => i.uuid === entry.itemUuid);
  if (item) {
    const i18n = game.i18n;
    const lines = [message];
    if (entry.bonusKept != null) lines.push(i18n.format("OSE.migration.card.Bonus", { bonus: entry.bonusKept }));
    if (entry.note) lines.push(i18n.localize(`OSE.migration.card.${entry.note}`));
    await actor.postClassChanges(item, before, null, {
      title: i18n.format("OSE.migration.card.Title", { cls: item.name, level: item.system.level }),
      lines,
      kept: adjustmentRows(entry.changes ?? []),
    });
  }
  return entry;
};
