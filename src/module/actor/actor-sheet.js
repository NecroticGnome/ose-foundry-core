/**
 * @file The base class we use for Character and Monster sheets. Shared behavior goes here!
 */
import { displayItemInChat } from "../sheet/chat-helpers";
import { bindInventoryContextMenu } from "../sheet/context-menu";
import { prepareActorContext } from "../sheet/data-context";
import { chooseItemType, openEntityTweaksFor, promptRemoveItemFromActor } from "../sheet/dialogs";
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
  removeItemFromActor,
  resetSpells,
  rollAbility,
  rollAttack,
  rollSave,
  updateItemQuantity,
  useConsumable,
} from "../sheet/inventory-actions";
import { toggleContainedItems, toggleItemCategory, toggleItemSummary } from "../sheet/listeners";

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
    },
  };

  /**
   * @param {string} _tabId
   * @returns {boolean} Whether the tab is shown for this actor.
   */
  _isTabVisible(_tabId) {
    return true;
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
