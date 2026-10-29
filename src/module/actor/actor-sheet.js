/**
 * @file The base class we use for Character and Monster sheets. Shared behavior goes here!
 */
import { readChanges } from "../classes/effects";
import { withoutOverrides } from "../effects/form-overrides";
import { displayItemInChat } from "../sheet/chat-helpers";
import { bindInventoryContextMenu } from "../sheet/context-menu";
import { prepareActorContext } from "../sheet/data-context";
import { chooseItemType, openEntityTweaksFor } from "../sheet/dialogs";
import {
  onContainerItemAdd,
  onContainerItemRemove,
  onDragStartItem,
  onDropFolder,
  onDropItem,
  onDropItemCreate,
} from "../sheet/drag-drop";
import {
  createItem,
  onSpellChange,
  promptRemoveItemFromActor,
  removeItemFromActor,
  resetSpells,
  rollAbility,
  rollAttack,
  rollSave,
  updateItemQuantity,
  useConsumable,
} from "../sheet/inventory-actions";
import { toggleContainedItems, toggleItemCategory, toggleItemSummary } from "../sheet/listeners";
import { durationText, groupEffects } from "./effects-list";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

export default class OseActorSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    // Always light.
    classes: ["ose", "sheet", "actor", "themed", "theme-light"],
    form: { submitOnChange: true },
    window: {
      resizable: true,
      controls: [
        {
          action: "configureActor",
          icon: "fas fa-code",
          label: "OSE.dialog.tweaks",
          ownership: "OWNER",
          visible: function () {
            return this.isEditable;
          },
        },
      ],
    },
    actions: {
      configureActor: OseActorSheet._onConfigureActor,
      rollSave: OseActorSheet._onRollSave,
      rollAttack: OseActorSheet._onRollAttack,
      rollHitDice: OseActorSheet._onRollHitDice,
      rollItem: OseActorSheet._onRollItem,
      toggleCategory: OseActorSheet._onToggleCategory,
      toggleContained: OseActorSheet._onToggleContained,
      toggleSummary: OseActorSheet._onToggleSummary,
      showItem: OseActorSheet._onShowItem,
      createItem: OseActorSheet._onCreateItem,
      editItem: OseActorSheet._onEditItem,
      deleteItem: OseActorSheet._onDeleteItem,
      consumableSpend: OseActorSheet._onConsumableSpend,
      consumableRestore: OseActorSheet._onConsumableRestore,
      resetSpells: OseActorSheet._onResetSpells,
      createEffect: OseActorSheet._onCreateEffect,
      editEffect: OseActorSheet._onEditEffect,
      toggleEffect: OseActorSheet._onToggleEffect,
      deleteEffect: OseActorSheet._onDeleteEffect,
    },
  };

  _onSubmitForm(formConfig, event) {
    // Check if the document exists before ProseMirror tries to save a deleted document.
    if (!this.document.collection?.has(this.document.id)) return;
    return super._onSubmitForm(formConfig, event);
  }

  /**
   * @param {string} _tabId
   * @returns {boolean} Whether the tab is shown for this actor.
   */
  _isTabVisible(_tabId) {
    return true;
  }

  _effectsTabEnabled() {
    return game.settings.get(game.system.id, "effectsTab");
  }

  #effectGroups() {
    const rows = [...this.actor.allApplicableEffects()].map((e) => ({
      uuid: e.uuid,
      name: e.name,
      img: e.img,
      disabled: e.disabled,
      temporary: e.isTemporary,
      source: e.parent === this.actor ? null : (e.parent?.name ?? null),
      duration: durationText(e.duration ?? {}, (k) => game.i18n.localize(k)),
    }));
    // Include any class's prime requisite XP adjustment.
    for (const cls of this.actor.system.classes ?? []) {
      const bonus = this.actor.system.classXpBonus(cls);
      if (!bonus) continue;
      rows.push({
        uuid: cls.uuid,
        name: game.i18n.format("OSE.effects.ClassXp", { bonus: bonus > 0 ? `+${bonus}` : `${bonus}` }),
        img: cls.img,
        disabled: false,
        temporary: false,
        source: cls.name,
        duration: "",
        fixed: true,
      });
    }
    return groupEffects(rows).map((g) => ({ ...g, label: `OSE.effects.${g.key}` }));
  }

  _getTabsConfig(group) {
    const config = super._getTabsConfig(group);
    if (!config) return config;
    const tabs = config.tabs.filter((tab) => this._isTabVisible(tab.id));
    if (!tabs.some((tab) => tab.id === this.tabGroups[group])) this.tabGroups[group] = tabs[0]?.id;
    return { ...config, tabs };
  }

  get title() {
    if (!this.actor.isToken) return this.actor.name;
    return `[${game.i18n.localize(foundry.documents.TokenDocument.metadata.label)}] ${this.actor.name}`;
  }

  /**
   * IDs for items on the sheet that have been expanded.
   * @type {Set<string>}
   */
  _expanded = new Set();

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    return Object.assign(context, {
      ...this.actor.toObject(false),
      system: this.actor.system,
      cssClass: this.options.classes.join(" "),
      ...(await prepareActorContext(this.actor, this._expanded)),
      effectGroups: this._effectsTabEnabled() ? this.#effectGroups() : null,
    });
  }

  _getItemFromActor(element) {
    return this.actor.items.get(element.closest(".item-entry")?.dataset.itemId);
  }

  // Delegates retained as instance methods so subclasses (and tests) can override.
  _removeItemFromActor(item) {
    return removeItemFromActor(this.actor, item);
  }
  _promptRemoveItemFromActor(item) {
    return promptRemoveItemFromActor(this, item);
  }
  _chooseItemType(choices) {
    return chooseItemType(choices);
  }
  _onContainerItemAdd(item, target) {
    return onContainerItemAdd(this, item, target);
  }
  _onContainerItemRemove(item, container) {
    return onContainerItemRemove(this, item, container);
  }
  _onDropItemCreate(droppedItem, targetContainer) {
    return onDropItemCreate(this, droppedItem, targetContainer);
  }
  _onDropFolder(event, folder) {
    return onDropFolder(this, event, folder);
  }
  _onDropItem(event, item) {
    if (!this.actor.isOwner) return null;
    return onDropItem(this, event, item);
  }
  _onDragStart(event) {
    return onDragStartItem(this, event);
  }

  async _onFirstRender(context, options) {
    await super._onFirstRender(context, options);
    bindInventoryContextMenu(this, this.element);
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    this._sizeResizables();
    if (!this.isEditable) return;
    this.#lockOverriddenFields();
    for (const input of this.element.querySelectorAll(".quantity input, .memorize input, .counter input")) {
      input.addEventListener("click", (event) => event.target.select());
    }
  }

  _onPosition(position) {
    super._onPosition(position);
    this._sizeResizables();
  }

  _sizeResizables() {
    const heightDelta = this.position.height - this.options.position.height;
    for (const el of this.element?.querySelectorAll(".resizable") ?? []) {
      el.style.height = `${heightDelta + Number.parseInt(el.dataset.baseSize, 10)}px`;
    }
  }

  _processFormData(event, form, formData) {
    const { flattenObject, expandObject } = foundry.utils;
    const data = flattenObject(super._processFormData(event, form, formData));
    return expandObject(withoutOverrides(data, this.#overriddenPaths()));
  }

  #overriddenPaths() {
    return Object.keys(foundry.utils.flattenObject(this.actor.overrides ?? {}));
  }

  #effectsChanging(path) {
    return this.actor.appliedEffects.filter((e) => readChanges(e).some((c) => c.key === path));
  }

  // Fields an effect changes are locked.
  #lockOverriddenFields() {
    for (const path of this.#overriddenPaths()) {
      for (const input of this.element.querySelectorAll(`input[name="${path}"]`)) {
        const names = this.#effectsChanging(path).map((e) => e.name);
        if (!names.length) continue;
        input.readOnly = true;
        input.classList.add("effect-locked");
        input.dataset.tooltip = game.i18n.format("OSE.effects.Locked", { effects: names.join(", ") });
        input.addEventListener("click", () => this.#offerToDisable(path));
      }
    }
  }

  async #offerToDisable(path) {
    const effects = this.#effectsChanging(path);
    const list = effects.map((e) => `<li>${foundry.utils.escapeHTML(e.name)}</li>`).join("");
    const ok = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize("OSE.effects.LockedTitle") },
      content: `<p>${game.i18n.localize("OSE.effects.LockedPrompt")}</p><ul>${list}</ul>`,
      rejectClose: false,
    });
    if (ok) for (const effect of effects) await effect.update({ disabled: true });
  }

  // Item row inputs update the item, not the actor.
  _onChangeForm(formConfig, event) {
    const input = event.target;
    if (input.closest(".quantity")) return updateItemQuantity(this, event);
    if (input.closest(".memorize")) return onSpellChange(this, event);
    return super._onChangeForm(formConfig, event);
  }

  /* -------------------------------------------- */
  /*  Actions                                     */
  /* -------------------------------------------- */

  static _onConfigureActor() {
    return openEntityTweaksFor(this);
  }

  static _onRollSave(event, target) {
    return rollSave(this, event, target);
  }

  static _onRollAttack(event, target) {
    return rollAttack(this, event, target);
  }

  static _onRollHitDice(event) {
    return this.actor.rollHitDice({ event });
  }

  static _onRollItem(event, target) {
    return rollAbility(this, event, target);
  }

  static _onToggleCategory(event, target) {
    return toggleItemCategory(event, target);
  }

  static _onToggleContained(_event, target) {
    return toggleContainedItems(target);
  }

  static _onToggleSummary(_event, target) {
    return toggleItemSummary(this, target);
  }

  static _onShowItem(_event, target) {
    return displayItemInChat(this, target);
  }

  static _onCreateItem(_event, target) {
    if (this.isEditable) return createItem(this, target);
  }

  static _onEditItem(_event, target) {
    if (this.isEditable) return this._getItemFromActor(target)?.sheet.render({ force: true });
  }

  static _onDeleteItem(_event, target) {
    const item = this._getItemFromActor(target);
    if (this.isEditable && item) return this._promptRemoveItemFromActor(item);
  }

  static async _onCreateEffect() {
    if (!this.isEditable) return;
    const [effect] = await this.actor.createEmbeddedDocuments("ActiveEffect", [
      { name: game.i18n.localize("OSE.effects.New"), img: "icons/svg/aura.svg" },
    ]);
    effect?.sheet.render(true);
  }

  static _onEditEffect(_event, target) {
    fromUuidSync(target.closest("[data-effect-uuid]")?.dataset.effectUuid)?.sheet.render(true);
  }

  static _onToggleEffect(_event, target) {
    const effect = fromUuidSync(target.closest("[data-effect-uuid]")?.dataset.effectUuid);
    if (this.isEditable && effect) return effect.update({ disabled: !effect.disabled });
  }

  static async _onDeleteEffect(_event, target) {
    const effect = fromUuidSync(target.closest("[data-effect-uuid]")?.dataset.effectUuid);
    if (!this.isEditable || effect?.parent !== this.actor) return;
    const ok = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize("OSE.effects.Delete") },
      content: `<p>${game.i18n.format("OSE.effects.DeleteConfirm", { name: foundry.utils.escapeHTML(effect.name) })}</p>`,
      rejectClose: false,
    });
    if (ok) return effect.delete();
  }

  static _onConsumableSpend(_event, target) {
    if (this.isEditable) return useConsumable(this, target, true);
  }

  static _onConsumableRestore(_event, target) {
    if (this.isEditable) return useConsumable(this, target, false);
  }

  static _onResetSpells(_event, target) {
    if (this.isEditable) return resetSpells(this, target);
  }
}
