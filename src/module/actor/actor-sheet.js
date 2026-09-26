/**
 * @file The base class we use for Character and Monster sheets. Shared behavior goes here!
 */
import { displayItemInChat } from "../sheet/chat-helpers";
import { prepareActorContext } from "../sheet/data-context";
import { chooseItemType, openEntityTweaksFor, promptRemoveItemFromActor } from "../sheet/dialogs";
import {
  onContainerItemAdd,
  onContainerItemRemove,
  onDragStartItem,
  onDropFolder,
  onDropItem,
  onDropItemCreate,
  onSortItem,
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

export default class OseActorSheet extends foundry.appv1.sheets.ActorSheet {
  /**
   * IDs for items on the sheet that have been expanded.
   * @type {Set<string>}
   */
  _expanded = new Set();

  async getData() {
    const data = foundry.utils.deepClone(super.getData().data);
    Object.assign(data, await prepareActorContext(this.actor, this._expanded));
    data.editable = this.actor.sheet.isEditable;
    return data;
  }

  activateEditor(name, options, initialContent) {
    super.activateEditor(name, options, initialContent);
  }

  _getItemFromActor(event) {
    const li = event.currentTarget.closest(".item-entry");
    return this.actor.items.get(li.dataset.itemId);
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
  _onDropFolder(event, data) {
    return onDropFolder(this, event, data);
  }
  _onDropItem(event, data) {
    return onDropItem(this, event, data);
  }
  _onDragStart(event) {
    return onDragStartItem(this, event);
  }
  _onSortItem(event, itemData) {
    return onSortItem(this, event, itemData, (ev, data) => super._onSortItem(ev, data));
  }

  // Resizable lifecycle (V1-only — stage 7 replaces with V2 _onRender)
  async _renderInner(...args) {
    const html = await super._renderInner(...args);
    this.form = html[0];
    const resizable = html.find(".resizable");
    if (resizable.length === 0) return;
    resizable.each((_, el) => {
      const heightDelta = this.position.height - this.options.height;
      el.style.height = `${heightDelta + Number.parseInt(el.dataset.baseSize, 10)}px`;
    });
    return html;
  }

  async _onResize(event) {
    super._onResize(event);
    const html = $(this.form);
    const resizable = html.find(".resizable");
    if (resizable.length === 0) return;
    resizable.each((_, el) => {
      const heightDelta = this.position.height - this.options.height;
      el.style.height = `${heightDelta + Number.parseInt(el.dataset.baseSize, 10)}px`;
    });
    const editors = html.find(".editor");
    editors.each((_id, editor) => {
      const container = editor.closest(".resizable-editor");
      if (container) {
        const heightDelta = this.position.height - this.options.height;
        editor.style.height = `${heightDelta + Number.parseInt(container.dataset.editorSize, 10)}px`;
      }
    });
  }

  _getHeaderButtons() {
    let buttons = super._getHeaderButtons();
    const canConfigure = game.user.isGM || this.actor.isOwner;
    if (this.options.editable && canConfigure) {
      buttons = [
        {
          label: game.i18n.localize("OSE.dialog.tweaks"),
          class: "configure-actor",
          icon: "fas fa-code",
          onclick: () => openEntityTweaksFor(this),
        },
        ...buttons,
      ];
    }
    return buttons;
  }

  activateListeners(html) {
    super.activateListeners(html);

    // Attributes
    html.find(".saving-throw .attribute-name a").click((event) => rollSave(this, event));
    html.find(".attack a").click((event) => rollAttack(this, event));
    html.find(".hit-dice .attribute-name").click((event) => this.actor.rollHitDice({ event }));

    // Items (Abilities, Inventory and Spells)
    html.find(".item-rollable .item-image").click((event) => rollAbility(this, event));
    html.find(".inventory .item-category-title").click(toggleItemCategory);
    html.find(".inventory .item-category-title input").click((event) => event.stopPropagation());
    html.find(".inventory .category-caret").click(toggleContainedItems);
    html.find(".item-name").click((event) => toggleItemSummary(this, event));
    html.find(".item-controls .item-show").click((event) => displayItemInChat(this, event));

    if (!this.options.editable) return;

    // Item Management
    html.find(".item-create").click((event) => createItem(this, event));
    html.find(".item-edit").click((event) => this._getItemFromActor(event).sheet.render(true));
    html.find(".item-delete").click((event) => {
      const item = this._getItemFromActor(event);
      this._promptRemoveItemFromActor(item);
    });

    html
      .find(".quantity input")
      .click((ev) => ev.target.select())
      .change((event) => updateItemQuantity(this, event));

    // Consumables
    html.find(".consumable-counter .full-mark").click((event) => useConsumable(this, event, true));
    html.find(".consumable-counter .empty-mark").click((event) => useConsumable(this, event, false));

    // Spells
    html
      .find(".memorize input")
      .click((event) => event.target.select())
      .change((event) => onSpellChange(this, event));

    html.find(".spells .item-reset[data-action='reset-spells']").click((event) => resetSpells(this, event));
  }
}
