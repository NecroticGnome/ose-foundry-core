/**
 * @file Adds attribute key suggestions and a reference link to Foundry's Active Effect editor.
 */
import { type EffectKey, effectKeys } from "./effect-keys";

const REFERENCE = "https://necroticgnome.github.io/ose-foundry-core/actor-attributes.html";
const TYPES = ["character", "monster"] as const;
type ActorType = (typeof TYPES)[number];

// biome-ignore lint/suspicious/noExplicitAny: the effect's parent is an actor, an item, or an item on an actor
const actorType = (parent: any): ActorType | null => {
  const actor = parent?.documentName === "Actor" ? parent : parent?.parent;
  return TYPES.includes(actor?.type) ? actor.type : null;
};

// biome-ignore lint/suspicious/noExplicitAny: Foundry application and document
export const augmentEffectConfig = (app: any, element: HTMLElement | JQuery) => {
  const root = element instanceof HTMLElement ? element : element[0];
  const section = root?.querySelector('section[data-tab="changes"]');
  if (!section) return;
  const type = actorType(app.document?.parent);
  const keys = new Map<string, EffectKey>();
  for (const t of type ? [type] : TYPES) for (const k of effectKeys(t)) keys.set(k.key, k);

  const id = `ose-effect-keys-${app.id}`;
  const list = document.createElement("datalist");
  list.id = id;
  for (const { key, label, data } of keys.values()) {
    const text = data
      ? game.i18n.format(label, Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])))
      : game.i18n.localize(label);
    list.append(new Option(text, key));
  }
  section.append(list);
  for (const input of section.querySelectorAll<HTMLInputElement>('input[name$=".key"]')) input.setAttribute("list", id);

  const heading = section.querySelector("header .key");
  if (heading && !heading.querySelector(".ose-effects-help")) {
    const help = document.createElement("a");
    help.className = "ose-effects-help";
    help.href = `${REFERENCE}#${type ?? "reading-this-reference"}`;
    help.target = "_blank";
    help.rel = "noopener";
    help.dataset.tooltip = "OSE.effects.Help";
    help.innerHTML = '<i class="fas fa-circle-question"></i>';
    heading.append(" ", help);
  }
};
