/**
 * @file The Character Creator application.
 */
import OSE from "../config";
import OseDice from "../helpers-dice";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

const SCORE_KEYS = ["str", "int", "dex", "wis", "con", "cha"];

export default class OseCharacterCreator extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(document, options = {}) {
    super(options);
    this.document = document;
    this.counters = { str: 0, int: 0, dex: 0, wis: 0, con: 0, cha: 0, gold: 0 };
    this.stats = { sum: 0, avg: 0, std: 0 };
    this.scores = {};
    this.gold = 0;
  }

  /** Bring an open dialog forward (closing if it's for a different actor) before creating a new one. */
  static open(document, options = {}) {
    const existing = foundry.applications.instances.get("character-creator");
    if (existing?.document === document) {
      existing.bringToFront();
      return existing;
    }
    existing?.close();
    const sheet = new OseCharacterCreator(document, options);
    sheet.render({ force: true });
    return sheet;
  }

  static DEFAULT_OPTIONS = {
    id: "character-creator",
    classes: ["ose", "dialog", "creator"],
    tag: "form",
    form: {
      handler: OseCharacterCreator.#onSubmitForm,
      submitOnChange: false,
      closeOnSubmit: true,
    },
    position: { width: 320, height: "auto" },
    window: { resizable: true },
    actions: {
      rollScore: OseCharacterCreator._onRollScore,
      rollGold: OseCharacterCreator._onRollGold,
      autoRoll: OseCharacterCreator._onAutoRoll,
    },
  };

  static PARTS = {
    main: { template: "systems/__SYSTEM_ID__/dist/templates/actors/dialogs/character-creation.html" },
  };

  get title() {
    return `${this.document.name}: ${game.i18n.localize("OSE.dialog.generator")}`;
  }

  async _prepareContext() {
    const context = this.document.toObject();
    context.user = game.user;
    context.config = CONFIG.OSE;
    return context;
  }

  /** Wire the score-value `change` listeners after each render (action map doesn't cover input events). */
  _onRender() {
    this.element.querySelectorAll("input.score-value").forEach((input) => {
      input.addEventListener("change", () => this._recomputeStats());
    });
  }

  async rollScore(score, options = {}) {
    this.counters[score] += 1;
    const label = score === "gold" ? "Gold" : game.i18n.localize(`OSE.scores.${score}.long`);
    const data = { roll: {} };
    if (options.skipMessage) {
      const skipMessageRoll = new Roll("3d6");
      await skipMessageRoll.evaluate();
    }
    return OseDice.Roll({
      event: options.event,
      parts: ["3d6"],
      data,
      skipDialog: true,
      speaker: ChatMessage.getSpeaker({ actor: this.document }),
      flavor: game.i18n.format("OSE.dialog.generateScore", { score: label, count: this.counters[score] }),
      title: game.i18n.format("OSE.dialog.generateScore", { score: label, count: this.counters[score] }),
    });
  }

  _recomputeStats() {
    const values = Object.values(this.scores);
    const n = values.length;
    if (n === 0) return;
    const sum = values.reduce((acc, next) => acc + next.value, 0);
    const mean = sum / n;
    const std = Math.sqrt(values.map((x) => (x.value - mean) ** 2).reduce((acc, next) => acc + next, 0) / n);
    this.stats = {
      sum,
      avg: Math.round((10 * sum) / n) / 10,
      std: Math.round(100 * std) / 100,
    };
    // Update the display
    this.element.querySelector(".roll-stats .sum").textContent = this.stats.sum;
    this.element.querySelector(".roll-stats .avg").textContent = this.stats.avg;
    this.element.querySelector(".roll-stats .std").textContent = this.stats.std;
    // Enable the submit button once all six scores have been rolled
    if (n >= 6) {
      this.element.querySelector('button[type="submit"]')?.removeAttribute("disabled");
    }
  }

  // biome-ignore lint/complexity/noThisInStatic: V2 actions bind `this` to the application instance.
  static _onRollScore(event, target) {
    return this._handleRollScore(event, target);
  }
  // biome-ignore lint/complexity/noThisInStatic: V2 actions bind `this` to the application instance.
  static _onRollGold(event, target) {
    return this._handleRollGold(event, target);
  }
  // biome-ignore lint/complexity/noThisInStatic: V2 actions bind `this` to the application instance.
  static _onAutoRoll(event) {
    return this._handleAutoRoll(event);
  }

  async _handleRollScore(event, target) {
    const row = target.closest("[data-score]");
    const score = row.dataset.score;
    const r = await this.rollScore(score, { event });
    this.scores[score] = { value: r.total };
    row.querySelector("input.score-value").value = r.total;
    this._recomputeStats();
  }

  async _handleRollGold(event, target) {
    const container = target.closest(".roll-stats");
    const r = await this.rollScore("gold", { event });
    this.gold = 10 * r.total;
    container.querySelector(".gold-value").value = this.gold;
  }

  async _handleAutoRoll(event) {
    for (const score of SCORE_KEYS) {
      const r = await this.rollScore(score, { event, skipMessage: true });
      this.scores[score] = { value: r.total };
    }
    this._recomputeStats();
    const goldRoll = await this.rollScore("gold", { event, skipMessage: true });
    this.gold = 10 * goldRoll.total;
    this.element.requestSubmit();
  }

  static async #onSubmitForm(_event, _form, _formData) {
    // biome-ignore lint/complexity/noThisInStatic: V2 form.handler binds `this` to the application instance.
    return this._submit();
  }

  async _submit() {
    // Persist scores on the actor
    await this.document.update({ system: { scores: this.scores } });

    // Post the creation summary to chat
    const speaker = ChatMessage.getSpeaker({ actor: this.document });
    const templateData = {
      config: CONFIG.OSE,
      scores: this.scores,
      title: game.i18n.localize("OSE.dialog.generator"),
      stats: this.stats,
      gold: this.gold,
    };
    const content = await foundry.applications.handlebars.renderTemplate(
      "systems/__SYSTEM_ID__/dist/templates/chat/roll-creation.html",
      templateData,
    );
    await ChatMessage.create({
      style: CONST.CHAT_MESSAGE_STYLES.OTHER,
      content,
      speaker,
    });

    // Drop the rolled gold into inventory as a treasure item
    await this.document.createEmbeddedDocuments("Item", [
      {
        name: game.i18n.localize("OSE.items.gp.short"),
        type: "item",
        img: `${OSE.assetsPath}/gold.png`,
        system: {
          treasure: true,
          cost: 1,
          weight: 1,
          quantity: { value: this.gold },
        },
      },
    ]);
  }
}
