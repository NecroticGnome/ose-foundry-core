/**
 * @file The system-specific Item entity, containing logic for operating on all available Item types.
 */
import OSE from "../config";
import OseDice from "../helpers-dice";

/**
 * Override and extend the basic :class:`Item` implementation
 */
export default class OseItem extends Item {
  // Replacing default image */
  static get defaultIcons() {
    return {
      spell: `${OSE.assetsPath}/default/spell.png`,
      ability: `${OSE.assetsPath}/default/ability.png`,
      armor: `${OSE.assetsPath}/default/armor.png`,
      weapon: `${OSE.assetsPath}/default/weapon.png`,
      item: `${OSE.assetsPath}/default/item.png`,
      container: `${OSE.assetsPath}/default/bag.png`,
    };
  }

  static async create(data, context = {}) {
    if (data.img === undefined) {
      data.img = this.defaultIcons[data.type];
    }
    return super.create(data, context);
  }

  static migrateData(source) {
    if (source?.img === "" && source.type) {
      source.img = this.defaultIcons(source.type);
    }
    if (source?.system?.itemslots === undefined) {
      if (
        (source?.system?.tags ?? []).some(
          (tag) => tag.value === "Two-handed"
        ) &&
        source?.type === "weapon"
      )
        source.system.itemslots = 2;
      if (source?.system?.type === "heavy" && source.type === "armor")
        source.system.itemslots = 2;
    }

    return source;
  }

  prepareData() {
    super.prepareData();
  }

  async prepareDerivedData() {
    // Rich text description
    this.system.enrichedDescription =
      await foundry.applications.ux.TextEditor.implementation.enrichHTML(
        this.system.description,
        { async: true }
      );
  }

  static chatListeners(html) {
    // Use event delegation for buttons
    html.addEventListener("click", (event) => {
      const button = event.target.closest(".card-buttons button");
      if (button) {
        OseItem._onChatCardAction(event);
      }

      const itemName = event.target.closest(".item-name");
      if (itemName) {
        OseItem._onChatCardToggleContent(event);
      }
    });
  }

  async getChatData(htmlOptions) {
    const itemType = this.type;

    const itemData = this.system;

    // Item properties
    const props = [];

    if (itemType === "weapon") {
      itemData.tags.forEach((t) => props.push(t.value));
    }
    if (itemType === "spell") {
      props.push(
        `${itemData.class} ${itemData.lvl}`,
        itemData.range,
        itemData.duration
      );
    }
    if (itemData.hasOwnProperty("equipped")) {
      props.push(itemData.equipped ? "Equipped" : "Not Equipped");
    }

    // Filter properties and return
    itemData.properties = props.filter((p) => !!p);
    return itemData;
  }

  rollWeapon(options = {}) {
    const isNPC = this.actor.type != "character";
    const targets = 5;
    const itemData = this.system;

    let type = isNPC ? "attack" : "melee";
    const rollData = {
      item: this._source,
      actor: this.actor,
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
              this.actor.targetAttack(rollData, "melee", options);
            },
          },
          {
            action: "missile",
            icon: "fas fa-bullseye",
            label: game.i18n.localize("OSE.Missile"),
            callback: () => {
              this.actor.targetAttack(rollData, "missile", options);
            },
          },
        ],
      }).render(true);
      return true;
    }
    if (itemData.missile && !isNPC) {
      type = "missile";
    }
    this.actor.targetAttack(rollData, type, options);
    return true;
  }

  async rollFormula(options = {}) {
    const itemData = this.system;

    if (!itemData.roll) {
      throw new Error("This Item does not have a formula to roll!");
    }

    const label = `${this.name}`;
    const rollParts = [itemData.roll];

    const type = itemData.rollType;

    const rollData = {
      actor: this.actor,
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
      rollData.description = itemData.description
    };

    // Roll and return
    return OseDice.Roll({
      event: options.event,
      parts: rollParts,
      data: rollData,
      skipDialog: true,
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: game.i18n.format("OSE.roll.formula", { label }),
      title: game.i18n.format("OSE.roll.formula", { label }),
    });
  }

  async spendSpell() {
    if (this.type !== "spell")
      throw new Error(
        "Trying to spend a spell on an item that is not a spell."
      );

    const itemData = this.system;
    await this.update({
      system: {
        cast: itemData.cast - 1,
      },
    });

    if (itemData.roll) {
      await this.rollFormula()
    } else {
      await this.show({ skipDialog: true })
    }
  }

  _getRollTag(data) {
    if (data.roll) {
      const roll = `${data.roll}${data.rollTarget ? CONFIG.OSE.roll_type[data.rollType] : ""
        }${data.rollTarget ? data.rollTarget : ""}`;
      return {
        label: `${game.i18n.localize("OSE.items.Roll")} ${roll}`,
      };
    }
  }

  _getSaveTag(data) {
    if (data.save) {
      return {
        label: CONFIG.OSE.saves_long[data.save],
        icon: "fa-skull",
      };
    }
  }

  getAutoTagList() {
    const tagList = [];
    const data = this.system;
    const itemType = this.type;

    switch (itemType) {
      case "container":
      case "item": {
        break;
      }

      case "weapon": {
        tagList.push({ label: data.damage, icon: "fa-tint" });
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
        tagList.push({ label: CONFIG.OSE.armor[data.type], icon: "fa-tshirt" });
        break;
      }

      case "spell": {
        tagList.push(
          { label: data.class },
          { label: data.range },
          { label: data.duration }
        );
        break;
      }

      case "ability": {
        const reqs = data.requirements.split(",");
        reqs.forEach((req) => tagList.push({ label: req }));
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
  async pushManualTag(values) {
    const data = this?.system;
    let update = [];
    if (data.tags) {
      update = data.tags;
    }
    const newData = {};
    const regExp = /\(([^)]+)\)/;
    values.forEach((val) => {
      // Catch infos in brackets
      const matches = regExp.exec(val);
      let title = "";
      if (matches) {
        title = matches[1];
        val = val.slice(0, Math.max(0, matches.index)).trim();
      } else {
        val = val.trim();
        title = val;
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
      if (
        title !== val ||
        (!newData.melee && !newData.slow && !newData.missile)
      ) {
        update.push({
          title,
          value: val,
          label: val,
        });
      }

      if (val === "Two-handed" && this.type === "weapon") {
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
  popManualTag(value) {
    const itemData = this.system;

    const { tags } = itemData;
    if (!tags) return;

    const update = tags.filter(
      (el) => el.value.toLowerCase() !== value.toLowerCase()
    );
    const newData = {
      tags: update,
    };
    return this.update({ system: newData });
  }

  roll(options = {}) {
    const itemData = this.system;
    switch (this.type) {
      case "weapon": {
        this.rollWeapon(options);
        break;
      }

      case "spell": {
        this.spendSpell(options);
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
      }
    }
  }

  /**
   * Show the item to Chat, creating a chat card which contains follow up attack or damage roll options
   *
   * @returns {Promise}
   */
  async show() {
    const itemType = this.type;
    // Basic template rendering data
    const token = this.actor?.token;
    const templateData = {
      actor: this.actor,
      tokenId: token ? `${token.parent.id}.${token.id}` : null,
      item: this._source,
      itemId: this._source._id,
      data: await this.getChatData(),
      labels: this.labels,
      isHealing: this.isHealing,
      hasDamage: this.hasDamage,
      isSpell: itemType === "spell",
      hasSave: this.hasSave,
      config: CONFIG.OSE,
    };
    templateData.rollFormula = new Roll(
      templateData.data.roll,
      templateData
    ).formula;
    templateData.data.properties = this.system.autoTags;

    // Render the chat card template
    const template = `${OSE.systemPath()}/templates/chat/item-card.html`;
    const html = await foundry.applications.handlebars.renderTemplate(template, templateData);

    // Basic chat message data
    const chatData = {
      user: game.user.id,
      type: CONST.CHAT_MESSAGE_STYLES.OTHER,
      content: html,
      speaker: {
        actor: this.actor?.id,
        token: this.actor?.token,
        alias: this.actor?.name,
      },
    };

    // Toggle default roll mode
    const rollMode = game.settings.get("core", "rollMode");
    if (["gmroll", "blindroll"].includes(rollMode))
      chatData.whisper = ChatMessage.getWhisperRecipients("GM");
    if (rollMode === "selfroll") chatData.whisper = [game.user.id];
    if (rollMode === "blindroll") chatData.blind = true;

    // Create the chat message
    return ChatMessage.create(chatData);
  }

  /**
   * Handle toggling the visibility of chat card content when the name is clicked
   *
   * @param {Event} event - The originating click event
   * @private
   */
  static _onChatCardToggleContent(event) {
    event.preventDefault();
    const header = event.target.closest(".item-name");
    const card = header.closest(".chat-card");
    const content = card.querySelector(".card-content");
    if (content.style.display === "none") {
      $(content).slideDown(200);
    } else {
      $(content).slideUp(200);
    }
  }

  static async _onChatCardAction(event) {
    event.preventDefault();

    // Extract card data
    const button = event.target.closest(".card-buttons button");
    button.disabled = true;
    const card = button.closest(".chat-card");
    const { messageId } = card.closest(".message").dataset;
    const message = game.messages.get(messageId);
    const { action } = button.dataset;

    // Validate permission to proceed with the roll
    const isTargetted = action === "save";
    if (!(isTargetted || game.user.isGM || message.isAuthor)) return;

    // Get the Actor from a synthetic Token
    const actor = this._getChatCardActor(card);
    if (!actor) return;

    // Get the Item
    const item = actor.items.get(card.dataset.itemId);
    if (!item) {
      return ui.notifications.error(
        game.i18n.format("OSE.error.itemNoLongerExistsOnActor", {
          actorName: actor.name,
          itemId: card.dataset.itemId,
        })
      );
    }

    // Get card targets
    let targets = [];
    if (isTargetted) {
      targets = this._getChatCardTargets(card);
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
          ui.notifications.error(
            game.i18n.localize("OSE.error.noTokenControlled")
          );
          return (button.disabled = false);
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
  }

  static _getChatCardActor(card) {
    // Case 1 - a synthetic actor from a Token
    const tokenKey = card.dataset.tokenId;
    if (tokenKey) {
      const [sceneId, tokenId] = tokenKey.split(".");
      const scene = game.scenes.get(sceneId);
      if (!scene) return null;
      const tokenData = scene.getEmbeddedDocument("Token", tokenId);
      if (!tokenData) return null;
      const token = new Token(tokenData);
      return token.actor;
    }

    // Case 2 - use Actor ID directory
    const { actorId } = card.dataset;
    return game.actors.get(actorId) || null;
  }

  static _getChatCardTargets(card) {
    const { character } = game.user;
    const { controlled } = canvas.tokens;
    const targets = controlled.reduce(
      (arr, t) => (t.actor ? [...arr, t.actor] : arr),
      []
    );
    if (character && controlled.length === 0) targets.push(character);
    return targets;
  }
}
