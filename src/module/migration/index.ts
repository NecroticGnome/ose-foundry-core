/**
 * @file Opt-in world migration from typed classes to class items.
 */
import { buildClassIndex } from "./class-index";
import { convertActor, type ReportEntry } from "./convert-actor";

export const CLASS_ITEMS_MIGRATION = "classItems-1";

const STATUS_ORDER = ["error", "review", "custom", "matched", "none"] as const;

// biome-ignore lint/suspicious/noExplicitAny: world, token and compendium actors
const isPending = (actor: any) =>
  actor?.type === "character" &&
  !actor.getFlag(game.system.id, "migrations.classItems") &&
  !!String(actor._source?.system?.details?.class ?? "").trim();

// biome-ignore lint/suspicious/noExplicitAny: world, token and compendium actors
export const findActorsToMigrate = async (): Promise<any[]> => {
  // biome-ignore lint/suspicious/noExplicitAny: mixed world, token and compendium actors
  const actors: any[] = [...(game.actors?.filter(isPending) ?? [])];
  for (const scene of game.scenes ?? []) {
    for (const token of scene.tokens) {
      if (!token.actorLink && isPending(token.actor)) actors.push(token.actor);
    }
  }
  const packs = game.packs?.filter((p) => p.documentName === "Actor" && p.metadata.packageType === "world") ?? [];
  const scope = game.system.id;
  for (const pack of packs) {
    if (pack.locked) continue;
    const fields = ["type", "system.details.class", `flags.${scope}.migrations.classItems`];
    const index = await pack.getIndex({ fields: fields as never });
    const get = foundry.utils.getProperty;
    const ids = (index as unknown as Record<string, unknown>[])
      .filter(
        (e) =>
          e.type === "character" &&
          !get(e, `flags.${scope}.migrations.classItems`) &&
          !!String(get(e, "system.details.class") ?? "").trim(),
      )
      .map((e) => e._id as string);
    if (!ids.length) continue;
    actors.push(...((await pack.getDocuments({ _id__in: ids } as never)) as unknown[]).filter(isPending));
  }
  return actors;
};

// biome-ignore lint/suspicious/noExplicitAny: world, token and compendium actors
export const runClassMigration = async (actors: any[]): Promise<ReportEntry[]> => {
  const note = ui.notifications?.info(game.i18n.localize("OSE.migration.Running"), { permanent: true });
  const index = await buildClassIndex();
  const entries: ReportEntry[] = [];
  for (const actor of actors) {
    try {
      entries.push(await convertActor(actor, index));
      await actor.setFlag(game.system.id, "migrations.classItems", true);
    } catch (err) {
      console.error(`OSE | Class item migration failed for ${actor.uuid}`, err);
      entries.push({ actorUuid: actor.uuid, actorName: actor.name, text: "", status: "error", note: String(err) });
    }
  }
  if (note) ui.notifications?.remove(note);
  return entries;
};

export const postReport = async (entries: ReportEntry[]) => {
  console.table(entries);
  const esc = foundry.utils.escapeHTML;
  const sections = STATUS_ORDER.map((status) => {
    const rows = entries.filter((e) => e.status === status);
    if (!rows.length) return "";
    const items = rows
      .map((e) => {
        const detail = [
          e.text && `“${esc(e.text)}”`,
          e.source && esc(game.packs?.get(e.source)?.title ?? e.source),
          e.note && esc(e.note),
        ]
          .filter(Boolean)
          .join(" — ");
        return `<li>@UUID[${e.actorUuid}]{${esc(e.actorName)}}${detail ? ` ${detail}` : ""}</li>`;
      })
      .join("");
    return `<h4>${game.i18n.localize(`OSE.migration.${status}`)} (${rows.length})</h4><ul>${items}</ul>`;
  }).join("");
  await ChatMessage.create({
    content: `<h3>${game.i18n.localize("OSE.migration.Report")}</h3>${sections}`,
    whisper: ChatMessage.getWhisperRecipients("GM").map((u) => u.id),
  });
};

const prompt = (count: number) =>
  foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize("OSE.migration.Title") },
    content: game.i18n.format("OSE.migration.Prompt", { count: String(count) }),
    buttons: [
      { action: "backup", label: game.i18n.localize("OSE.migration.BackupFirst"), icon: "fas fa-floppy-disk" },
      { action: "migrate", label: game.i18n.localize("OSE.migration.MigrateNow"), icon: "fas fa-check", default: true },
      { action: "later", label: game.i18n.localize("OSE.migration.Later"), icon: "fas fa-clock" },
    ],
    rejectClose: false,
  });

// Runs on ready for the active GM.
export const promptClassMigration = async () => {
  if (!game.user?.isActiveGM) return;
  if (game.settings.get(game.system.id, "systemMigrationVersion") === CLASS_ITEMS_MIGRATION) return;
  const actors = await findActorsToMigrate();
  if (!actors.length) {
    await game.settings.set(game.system.id, "systemMigrationVersion", CLASS_ITEMS_MIGRATION);
    return;
  }
  const choice = await prompt(actors.length);
  if (choice === "backup") {
    ui.notifications?.info(game.i18n.localize("OSE.migration.BackupHint"), { permanent: true });
    return;
  }
  if (choice !== "migrate") return;
  const entries = await runClassMigration(actors);
  await postReport(entries);
  if (!entries.some((e) => e.status === "error")) {
    await game.settings.set(game.system.id, "systemMigrationVersion", CLASS_ITEMS_MIGRATION);
  }
};
