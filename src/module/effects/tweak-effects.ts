/**
 * @file Reads, writes and migrates the Active Effects behind the Tweaks modifiers.
 */
import { buildEffectData, readChanges } from "../classes/effects";
import { planTweakMigration, type TweakField, tweakFields } from "./tweaks";

// biome-ignore lint/suspicious/noExplicitAny: Foundry documents
type Any = any;

const scope = () => game.system.id;
const tweakEffect = (actor: Any, id: string) => actor.effects.find((e: Any) => e.getFlag(scope(), "tweak") === id);
const changeData = (t: TweakField, value: number) => [{ key: t.path, type: "add" as const, value }];
const effectData = (t: TweakField, value: number) =>
  buildEffectData(game.i18n.localize(t.label), changeData(t, value), game.release.generation, {
    flags: { [scope()]: { tweak: t.id } },
  });

// Each modifier as the Tweaks dialog shows it: its effect plus anything still stored on the field.
export const tweakValues = (actor: Any): Record<string, number> =>
  Object.fromEntries(
    tweakFields(actor.type).map((t) => {
      const effect = tweakEffect(actor, t.id);
      const fromEffect = effect ? Number(readChanges(effect).find((c) => c.key === t.path)?.value) || 0 : 0;
      return [t.id, fromEffect + (Number(foundry.utils.getProperty(actor._source, t.path)) || 0)];
    }),
  );

// Saves the dialog's modifiers to their effects and clears the stored fields.
export const saveTweaks = async (actor: Any, values: Record<string, unknown>) => {
  const create: unknown[] = [];
  const remove: string[] = [];
  const update: Record<string, number | boolean> = {};
  for (const t of tweakFields(actor.type)) {
    if (!(t.id in values)) continue;
    const value = Number(values[t.id]) || 0;
    const effect = tweakEffect(actor, t.id);
    update[t.path] = 0;
    if (t.twin) update[t.twin] = 0;
    if (!value) {
      if (effect) remove.push(effect.id);
    } else if (!effect) create.push(effectData(t, value));
    else {
      const data = effectData(t, value) as Record<string, unknown>;
      await effect.update(
        game.release.generation >= 14 ? { "system.changes": changeData(t, value) } : { changes: data.changes },
      );
    }
  }
  if (remove.length) await actor.deleteEmbeddedDocuments("ActiveEffect", remove);
  if (create.length) await actor.createEmbeddedDocuments("ActiveEffect", create);
  await actor.update(update);
};

export const migrateActorTweaks = async (actor: Any) => {
  if (!["character", "monster"].includes(actor?.type)) return false;
  const plan = planTweakMigration({
    type: actor.type,
    hasClasses: actor.items.some((i: Any) => i.type === "class"),
    source: actor._source.system,
    tweakEffects: actor.effects.map((e: Any) => e.getFlag(scope(), "tweak")).filter(Boolean),
  });
  if (!plan.effects.length) return false;
  const fields = tweakFields(actor.type);
  await actor.createEmbeddedDocuments(
    "ActiveEffect",
    plan.effects.map((e) => effectData(fields.find((t) => t.id === e.id) as TweakField, e.value)),
  );
  await actor.update(plan.update);
  return true;
};

// Once per world, for the active GM: world actors, unlinked tokens and unlocked world compendiums.
export const migrateTweaks = async () => {
  if (!game.user?.isActiveGM || game.settings.get(game.system.id, "tweaksMigrated")) return;
  const actors: Any[] = [...(game.actors ?? [])];
  for (const scene of game.scenes ?? []) {
    for (const token of scene.tokens) if (!token.actorLink && token.actor) actors.push(token.actor);
  }
  for (const pack of game.packs ?? []) {
    if (pack.documentName !== "Actor" || pack.metadata.packageType !== "world" || pack.locked) continue;
    actors.push(...((await pack.getDocuments()) as Any[]));
  }
  let count = 0;
  for (const actor of actors) {
    try {
      if (await migrateActorTweaks(actor)) count++;
    } catch (err) {
      console.error(`OSE | Tweaks migration failed for ${actor.uuid}`, err);
    }
  }
  await game.settings.set(game.system.id, "tweaksMigrated", true);
  if (count) ui.notifications?.info(game.i18n.format("OSE.migration.TweaksDone", { count: String(count) }));
};
