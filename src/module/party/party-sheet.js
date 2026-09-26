/**
 * @file An application for managing the current party.
 */
import OseParty from "./party";
import OsePartyXP from "./party-xp";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;
const { DragDrop } = foundry.applications.ux;

const Party = {
  partySheet: undefined,
};

export default class OsePartySheet extends HandlebarsApplicationMixin(ApplicationV2) {
  static init() {
    Party.partySheet = new OsePartySheet();
  }

  static get partySheet() {
    return Party.partySheet;
  }

  static showPartySheet(options = {}) {
    Party.partySheet?.render({ force: true, ...options });
  }

  static DEFAULT_OPTIONS = {
    id: "party-sheet",
    classes: ["ose", "dialog", "party-sheet"],
    tag: "form",
    form: {
      handler: OsePartySheet.#onSubmitForm,
      submitOnChange: false,
      closeOnSubmit: false,
    },
    position: { width: 280, height: 400 },
    window: { resizable: true },
    dragDrop: [{ dragSelector: ".actor-list .actor", dropSelector: ".party-members" }],
    actions: {
      dealXP: OsePartySheet._onDealXP,
      openActorSheet: OsePartySheet._onOpenActorSheet,
      removeActor: OsePartySheet._onRemoveActor,
    },
  };

  static PARTS = {
    main: { template: "systems/__SYSTEM_ID__/dist/templates/apps/party-sheet.html" },
  };

  get title() {
    return game.i18n.localize("OSE.dialog.partysheet");
  }

  #dragDrop;

  get dragDrop() {
    if (this.#dragDrop) return this.#dragDrop;
    this.#dragDrop = (this.options.dragDrop ?? []).map(
      (cfg) =>
        new DragDrop.implementation({
          ...cfg,
          permissions: {
            dragstart: this._canDragStart.bind(this),
            drop: this._canDragDrop.bind(this),
          },
          callbacks: {
            dragstart: this._onDragStart.bind(this),
            drop: this._onDrop.bind(this),
          },
        }),
    );
    return this.#dragDrop;
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    for (const dd of this.dragDrop) dd.bind(this.element);
  }

  async _prepareContext() {
    return {
      partyActors: OseParty.currentParty,
      config: CONFIG.OSE,
      user: game.user,
      settings: {
        ascending: game.settings.get(game.system.id, "ascendingAC"),
      },
    };
  }

  _canDragStart() {
    return game.user.isGM;
  }

  _canDragDrop() {
    return game.user.isGM;
  }

  async _addActorToParty(actor) {
    if (actor.type !== "character") return;
    await actor.setFlag(game.system.id, "party", true);
  }

  async _removeActorFromParty(actor) {
    await actor.setFlag(game.system.id, "party", false);
  }

  _onDrop(event) {
    event.preventDefault();
    let data;
    try {
      data = JSON.parse(event.dataTransfer.getData("text/plain"));
    } catch (_error) {
      return false;
    }
    if (data.type === "Actor") return this._onDropActor(event, data);
    if (data.type === "Folder") return this._onDropFolder(event, data);
  }

  async _onDropActor(_event, data) {
    const droppedActor = await fromUuid(data.uuid);
    if (!droppedActor) return;
    await this._addActorToParty(droppedActor);
  }

  async _recursiveAddFolder(folder) {
    for (const actor of folder.contents) {
      await this._addActorToParty(actor);
    }
    for (const child of folder.children) {
      await this._recursiveAddFolder(child.folder);
    }
  }

  async _onDropFolder(_event, data) {
    const folder = await fromUuid(data.uuid);
    if (folder?.type !== "Actor") return;
    await this._recursiveAddFolder(folder);
  }

  async _onDragStart(event) {
    try {
      const { uuid } = event.currentTarget.dataset;
      const dragData = (await fromUuid(uuid)).toDragData();
      event.dataTransfer.setData("text/plain", JSON.stringify(dragData));
    } catch (_error) {
      return false;
    }
    return true;
  }

  _getActorFromEvent(target) {
    const id = target.closest(".actor")?.dataset.actorId;
    return id ? game.actors.get(id) : undefined;
  }

  // biome-ignore lint/complexity/noThisInStatic: V2 actions bind `this` to the application instance.
  static _onDealXP() {
    return this._handleDealXP();
  }
  // biome-ignore lint/complexity/noThisInStatic: V2 actions bind `this` to the application instance.
  static _onOpenActorSheet(_event, target) {
    return this._handleOpenActorSheet(target);
  }
  // biome-ignore lint/complexity/noThisInStatic: V2 actions bind `this` to the application instance.
  static _onRemoveActor(_event, target) {
    return this._handleRemoveActor(target);
  }

  _handleDealXP() {
    OsePartyXP.open();
  }

  _handleOpenActorSheet(target) {
    this._getActorFromEvent(target)?.sheet?.render({ force: true });
  }

  async _handleRemoveActor(target) {
    const actor = this._getActorFromEvent(target);
    if (!actor) return;
    await this._removeActorFromParty(actor);
    this.render();
  }

  static async #onSubmitForm() {}
}
