/**
 * @file The system-specific Item entity, containing logic for operating on all available Item types.
 */
import OSE from "../config";
import OseDice from "../helpers-dice";
import { getRollMode } from "../helpers-message-mode";
import type { ITEM_DATA_MODELS } from "./data-models";
import type { DisplayTag, ItemTag } from "./item-types";

/** The Item subtypes this system registers. */
type OseItemType = keyof typeof ITEM_DATA_MODELS;

/**
 * The union of every registered item's system data.
 *
 * Methods below switch on `this.type` before reading subtype-specific fields,
 * but TypeScript cannot narrow `this.system` from `this.type` — `this` is not a
 * discriminated union — so those reads assert the shape the switch guarantees.
 */
// biome-ignore lint/suspicious/noExplicitAny: the union is read field-by-field after a type switch
type AnyItemSystem = Item["system"] & Record<string, any>;

/**
 * The owning Actor, as this file needs it. The actor entity is still JavaScript
 * and its data models are not registered with fvtt-types, so members like
 * `targetAttack` and `rollSave` are not yet visible on Foundry's `Actor`.
 */
// biome-ignore lint/suspicious/noExplicitAny: until the actor entity is TypeScript
type OwningActor = Actor & Record<string, any>;

/**
 * Override and extend the basic :class:`Item` implementation
 */
export default class OseItem extends Item {
  // Replacing default image */
  static get defaultIcons(): Record<OseItemType, string> {
    return {
      spell: `${OSE.assetsPath}/default/spell.png`,
      ability: `${OSE.assetsPath}/default/ability.png`,
      armor: `${OSE.assetsPath}/default/armor.png`,
      weapon: `${OSE.assetsPath}/default/weapon.png`,
      item: `${OSE.assetsPath}/default/item.png`,
      container: `${OSE.assetsPath}/default/bag.png`,
    };
  }

  // Narrowing these to Item.CreateData / CreateOperation breaks static-side
  // compatibility with Item.create's generic overloads (TS2417).
  // biome-ignore lint/suspicious/noExplicitAny: see above
  static async create(data: any, context: any = {}) {
    if (data.img === undefined) {
      data.img = OseItem.defaultIcons[data.type as OseItemType];
    }
    return Item.create(data, context);
  }

  static migrateData(source: {
    img?: string;
    type?: string;
    system?: { itemslots?: number; tags?: ItemTag[]; type?: string };
  }) {
    if (source?.img === "" && source.type) {
      source.img = OseItem.defaultIcons[source.type as OseItemType];
    }
    if (source?.system?.itemslots === undefined) {
      if ((source?.system?.tags ?? []).some((tag: ItemTag) => tag.value === "Two-handed") && source?.type === "weapon")
        (source.system as { itemslots?: number }).itemslots = 2;
      if (source?.system?.type === "heavy" && source.type === "armor") source.system.itemslots = 2;
    }

    return source;
  }

  prepareData() {
    super.prepareData();
  }

  async prepareDerivedData(): Promise<void> {
    // Rich text description
    (this.system as AnyItemSystem).enrichedDescription =
      // `async` was removed from EnrichmentOptions in v13; kept so the call is
      // byte-identical to the JavaScript this replaces.
      await foundry.applications.ux.TextEditor.implementation.enrichHTML((this.system as AnyItemSystem).description, {
        async: true,
      } as never);
  }

  static chatListeners(html: HTMLElement) {
    // Use event delegation for buttons
    html.addEventListener("click", (event: MouseEvent) => {
      const button = (event.target as HTMLElement).closest(".card-buttons button");
      if (button) {
        OseItem._onChatCardAction(event);
      }

      const itemName = (event.target as HTMLElement).closest(".item-name");
      if (itemName) {
        OseItem._onChatCardToggleContent(event);
      }
    });
  }

  async getChatData(_htmlOptions?: unknown) {
    const itemType = this.type;

    const itemData = this.system as AnyItemSystem;

    // Item properties
    const props = [];

    if (itemType === "weapon") {
      for (const t of itemData.tags) {
        props.push(t.value);
      }
    }
    if (itemType === "spell") {
      props.push(`${itemData.class} ${itemData.lvl}`, itemData.range, itemData.duration);
    }
    if (Object.hasOwn(itemData, "equipped")) {
      props.push(itemData.equipped ? "Equipped" : "Not Equipped");
    }

    // Filter properties and return
    itemData.properties = props.filter((p) => !!p);
    return itemData;
  }

  rollWeapon(options: Record<string, unknown> = {}) {
    const actor = this.actor as OwningActor;
    const isNPC = (actor.type as string) !== "character";
    const itemData = this.system;

    let type = isNPC ? "attack" : "melee";
    const rollData = {
      item: this._source,
      actor: this.actor as OwningActor,
      roll: {
        save: itemData.save,
        target: null,
      },
    };

    if (itemData.missile && itemData.melee && !isNPC) {
      // Dialog
      new foundry.applications.api.DialogV2({
        window: { title: "Choose Attack Range" },
        content: "",
        buttons: [
          {
            action: "melee",
            icon: "fas fa-fist-raised",
            label: game.i18n.localize("OSE.Melee"),
            default: true,
            callback: () => {
              actor.targetAttack(rollData, "melee", options);
            },
          },
          {
            action: "missile",
            icon: "fas fa-bullseye",
            label: game.i18n.localize("OSE.Missile"),
            callback: () => {
              actor.targetAttack(rollData, "missile", options);
            },
          },
        ],
      }).render(true);
      return true;
    }
    if (itemData.missile && !isNPC) {
      type = "missile";
    }
    actor.targetAttack(rollData, type, options);
    return true;
  }

  async rollFormula(options: { event?: Event } = {}) {
    const itemData = this.system;

    if (!itemData.roll) {
      throw new Error("This Item does not have a formula to roll!");
    }

    const label = `${this.name}`;
    const rollParts = [itemData.roll];

    const type = itemData.rollType;

    const rollData: Record<string, unknown> = {
      actor: this.actor as OwningActor,
      item: this._source,
      description: null,
      save: itemData.save,
      properties: this.system.autoTags,
      roll: {
        type,
        target: itemData.rollTarget,
        blindroll: itemData.blindroll,
      },
    };

    if (this.type === "spell") {
      rollData.description = itemData.description;
    }

    // Roll and return
    return OseDice.Roll({
      event: options.event,
      parts: rollParts,
      data: rollData,
      skipDialog: true,
      // biome-ignore lint/suspicious/noExplicitAny: getSpeaker expects an Actor; this passes the Item, as the original did
      speaker: ChatMessage.getSpeaker({ actor: this as any }),
      flavor: game.i18n.format("OSE.roll.formula", { label }),
      title: game.i18n.format("OSE.roll.formula", { label }),
    } as never);
  }

  async spendSpell() {
    if (this.type !== "spell") throw new Error("Trying to spend a spell on an item that is not a spell.");

    const itemData = this.system;
    await this.update({
      system: {
        cast: (itemData.cast ?? 0) - 1,
      },
    });

    if (itemData.roll) {
      await this.rollFormula();
    } else {
      await this.show({ skipDialog: true });
    }
  }

  _getRollTag(data: AnyItemSystem): DisplayTag | undefined {
    if (data.roll) {
      const roll = `${data.roll}${
        data.rollTarget ? CONFIG.OSE.roll_type[data.rollType as keyof typeof CONFIG.OSE.roll_type] : ""
      }${data.rollTarget ? data.rollTarget : ""}`;
      return {
        label: `${game.i18n.localize("OSE.items.Roll")} ${roll}`,
      };
    }
    return undefined;
  }

  _getSaveTag(data: AnyItemSystem): DisplayTag | undefined {
    if (data.save) {
      return {
        label: CONFIG.OSE.saves_long[data.save],
        icon: "fa-skull",
      };
    }
    return undefined;
  }

  getAutoTagList(): DisplayTag[] {
    const tagList: DisplayTag[] = [];
    const data = this.system as AnyItemSystem;
    const itemType = this.type;

    switch (itemType) {
      case "container":
      case "item": {
        break;
      }

      case "weapon": {
        tagList.push({ label: data.damage as string, icon: "fa-tint" });
        if (data.missile) {
          tagList.push({
            label: `${data.range.short}/${data.range.medium}/${data.range.long}`,
            icon: "fa-bullseye",
          });
        }

        // Push manual tags
        data.tags.forEach((t) => {
          tagList.push({ label: t.value });
        });
        break;
      }

      case "armor": {
        tagList.push({ label: CONFIG.OSE.armor[data.type as keyof typeof CONFIG.OSE.armor], icon: "fa-tshirt" });
        break;
      }

      case "spell": {
        tagList.push({ label: data.class }, { label: data.range as string }, { label: data.duration });
        break;
      }

      case "ability": {
        const reqs = (data.requirements ?? "").split(",");
        for (const req of reqs) {
          tagList.push({ label: req });
        }
        break;
      }
    }

    const rollTag = this._getRollTag(data);
    if (rollTag) {
      tagList.push(rollTag);
    }

    const saveTag = this._getSaveTag(data);
    if (saveTag) {
      tagList.push(saveTag);
    }

    return tagList;
  }

  /**
   * Push a manual tag to the item.
   * This will automatically fill in the checkboxes for melee, slow, and missile tags, skipping the tag list.
   * If the tag has one of these special tags in parentheses (e.g. "Bulky (Slow)"), the Slow checkbox
   * will be checked, and the tag will be added to the list with the title "Bulky".
   *
   * @param {string[]} values - The values of the tags to add.
   * @returns {Promise<OseItem|undefined>>} - The updated Document instance, or undefined if not updated
   */
  async pushManualTag(values: string[]) {
    const data = this?.system as AnyItemSystem;
    let update: ItemTag[] = [];
    if (data.tags) {
      update = data.tags;
    }
    const newData: Record<string, unknown> = {};
    const regExp = /\(([^)]+)\)/;
    values.forEach((val) => {
      // Catch infos in brackets
      const matches = regExp.exec(val);
      let title = "";
      let trimmedVal = "";
      if (matches) {
        title = matches[1] ?? "";
        trimmedVal = val.slice(0, Math.max(0, matches.index)).trim();
      } else {
        trimmedVal = val.trim();
        title = trimmedVal;
      }
      // Auto fill checkboxes
      switch (title.toLowerCase()) {
        case CONFIG.OSE.tags.melee.toLowerCase(): {
          newData.melee = true;
          break;
        }

        case CONFIG.OSE.tags.slow.toLowerCase(): {
          newData.slow = true;
          break;
        }

        case CONFIG.OSE.tags.missile.toLowerCase(): {
          newData.missile = true;
          break;
        }
      }

      // Add the tag if it has a specific title or if it is not a checkbox
      if (title !== trimmedVal || (!newData.melee && !newData.slow && !newData.missile)) {
        update.push({
          title,
          value: trimmedVal,
          label: trimmedVal,
        });
      }

      if (trimmedVal === "Two-handed" && (this.type as string) === "weapon") {
        newData.itemslots = 2;
      }
    });
    newData.tags = update;
    return this.update({ system: newData });
  }

  /**
   * Remove a manual tag from the item.
   *
   * @param {string} value - The value of the tag to remove.
   * @returns {Promise<OseItem|undefined>} - The updated Document instance, or undefined if not updated
   */
  popManualTag(value: string) {
    const itemData = this.system as AnyItemSystem;

    const { tags } = itemData;
    if (!tags) return;

    const update = tags.filter((el: ItemTag) => el.value.toLowerCase() !== value.toLowerCase());
    const newData = {
      tags: update,
    };
    return this.update({ system: newData });
  }

  roll(options: Record<string, unknown> = {}) {
    const itemData = this.system as AnyItemSystem;
    switch (this.type) {
      case "weapon": {
        this.rollWeapon(options);
        break;
      }

      case "spell": {
        this.spendSpell();
        break;
      }

      case "ability": {
        if (itemData.roll) {
          this.rollFormula();
        } else {
          this.show();
        }
        break;
      }

      case "item":
      case "armor": {
        this.show();
        break;
      }
      // No default
    }
  }

  /**
   * Show the item to Chat, creating a chat card which contains follow up attack or damage roll options
   *
   * @returns {Promise}
   */
  async show(_options: Record<string, unknown> = {}) {
    const itemType = this.type;
    // Basic template rendering data
    const token = (this.actor as OwningActor | null)?.token;
    const templateData: Record<string, unknown> = {
      actor: this.actor as OwningActor,
      tokenId: token ? `${token.parent?.id}.${token.id}` : null,
      item: this._source,
      itemId: (this._source as { _id?: string })._id,
      data: await this.getChatData(),
      labels: (this as unknown as Record<string, unknown>).labels,
      isHealing: (this as unknown as Record<string, unknown>).isHealing,
      hasDamage: (this as unknown as Record<string, unknown>).hasDamage,
      isSpell: itemType === "spell",
      hasSave: (this as unknown as Record<string, unknown>).hasSave,
      config: CONFIG.OSE,
    };
    const chatItemData = templateData.data as AnyItemSystem;
    templateData.rollFormula = new Roll(chatItemData.roll ?? "", templateData).formula;
    chatItemData.properties = this.system.autoTags;

    // Render the chat card template
    const template = `${OSE.systemPath()}/templates/chat/item-card.html`;
    const html = await foundry.applications.handlebars.renderTemplate(template, templateData);

    // Basic chat message data
    const chatData: Record<string, unknown> = {
      user: game.user.id,
      style: CONST.CHAT_MESSAGE_STYLES.OTHER,
      content: html,
      speaker: {
        actor: (this.actor as OwningActor | null)?.id,
        token: (this.actor as OwningActor | null)?.token,
        alias: (this.actor as OwningActor | null)?.name,
      },
    };

    // Toggle default roll mode
    const rollMode = getRollMode();
    if (["gmroll", "blindroll"].includes(rollMode)) chatData.whisper = ChatMessage.getWhisperRecipients("GM");
    if (rollMode === "selfroll") chatData.whisper = [game.user.id];
    if (rollMode === "blindroll") chatData.blind = true;

    // Create the chat message
    return ChatMessage.create(chatData as never);
  }

  /**
   * Handle toggling the visibility of chat card content when the name is clicked
   *
   * @param {Event} event - The originating click event
   * @private
   */
  static _onChatCardToggleContent(event: Event) {
    event.preventDefault();
    const header = (event.target as HTMLElement).closest(".item-name");
    const card = header?.closest(".chat-card") as HTMLElement | null;
    const content = card?.querySelector(".card-content") as HTMLElement;
    if (content.style.display === "none") {
      $(content).slideDown(200);
    } else {
      $(content).slideUp(200);
    }
  }

  static async _onChatCardAction(event: Event): Promise<unknown> {
    event.preventDefault();

    // Extract card data
    const button = (event.target as HTMLElement).closest(".card-buttons button") as HTMLButtonElement;
    button.disabled = true;
    const card = button.closest(".chat-card") as HTMLElement;
    const { messageId } = (card.closest(".message") as HTMLElement).dataset;
    const message = game.messages.get(messageId as string);
    const { action } = button.dataset;

    // Validate permission to proceed with the roll
    const isTargetted = action === "save";
    if (!(isTargetted || game.user.isGM || message?.isAuthor)) return;

    // Get the Actor from a synthetic Token
    const actor = OseItem._getChatCardActor(card);
    if (!actor) return;

    // Get the Item
    // Widened because the "damage" branch below calls item.rollDamage, which is
    // defined on the Actor, not the Item — preserved from the JavaScript.
    // biome-ignore lint/suspicious/noExplicitAny: see above
    const item = actor.items.get(card.dataset.itemId as string) as (OseItem & Record<string, any>) | undefined;
    if (!item) {
      return ui.notifications.error(
        game.i18n.format("OSE.error.itemNoLongerExistsOnActor", {
          actorName: actor.name,
          itemId: card.dataset.itemId ?? "",
        }),
      );
    }

    // Get card targets
    let targets: OwningActor[] = [];
    if (isTargetted) {
      targets = OseItem._getChatCardTargets(card);
    }

    // Attack and Damage Rolls
    switch (action) {
      case "damage": {
        await item.rollDamage({ event });
        break;
      }

      case "formula": {
        await item.rollFormula({ event });
        break;
      }

      case "save": {
        if (targets.length === 0) {
          ui.notifications.error(game.i18n.localize("OSE.error.noTokenControlled"));
          button.disabled = false;
          return button.disabled;
        }
        for (const t of targets) {
          await t.rollSave(button.dataset.save, { event });
        }

        break;
      }
      // No default
    }

    // Re-enable the button
    button.disabled = false;
    return undefined;
  }

  static _getChatCardActor(card: HTMLElement): OwningActor | null {
    // Case 1 - a synthetic actor from a Token
    const tokenKey = card.dataset.tokenId;
    if (tokenKey) {
      const [sceneId, tokenId] = tokenKey.split(".");
      const scene = game.scenes.get(sceneId as string);
      if (!scene) return null;
      const tokenData = scene.getEmbeddedDocument("Token", tokenId as string, {});
      if (!tokenData) return null;
      const token = new (Token as unknown as new (data: unknown) => { actor: OwningActor })(tokenData);
      return token.actor;
    }

    // Case 2 - use Actor ID directory
    const { actorId } = card.dataset;
    return game.actors.get(actorId as string) || null;
  }

  static _getChatCardTargets(_card: HTMLElement) {
    const { character } = game.user;
    const { controlled } = canvas.tokens as unknown as { controlled: { actor?: OwningActor }[] };
    const targets = controlled.flatMap((t) => (t.actor ? [t.actor] : []));
    if (character && controlled.length === 0) targets.push(character);
    return targets;
  }
}
