import {
  normalizeLedger,
  beginAttempt,
  creditCompletion,
  eventById,
} from "./campaign-rewards.js";
import { campaignDefinition } from "./campaign-data.js";
export const campaignKey = "jet-sprint-campaign-v2";
export const legacyCampaignKey = "jet-sprint-campaign-v1";
const initialMoney = () => normalizeLedger();
const defaults = () => ({
  schema: 2,
  ...initialMoney(),
  unlocked: 1,
  bestRace: null,
  bestBonus: 0,
  bestRaces: {},
  bestRivers: {},
});
export class CampaignProgress {
  constructor(storage) {
    this.storage = storage;
    this.warning = "";
    this.dirty = false;
    this.values = defaults();
    try {
      const raw =
        storage.getItem(campaignKey) ?? storage.getItem(legacyCampaignKey);
      if (!raw) return;
      const v = JSON.parse(raw);
      if (![1, 2].includes(v?.schema)) throw Error("Unknown campaign schema");
      if (v.schema === 2) Object.assign(this.values, normalizeLedger(v));
      if (Number.isInteger(v.unlocked))
        this.values.unlocked = Math.max(1, Math.min(4, v.unlocked));
      if (Number.isFinite(v.bestRace) && v.bestRace > 0)
        this.values.bestRace = v.bestRace;
      if (Number.isFinite(v.bestBonus) && v.bestBonus >= 0)
        this.values.bestBonus = Math.floor(v.bestBonus);
      for (const stage of campaignDefinition.tracks) {
        const t = v.bestRaces?.[stage.id];
        if (Number.isFinite(t) && t > 0) this.values.bestRaces[stage.id] = t;
      }
      for (const stage of campaignDefinition.rivers) {
        const score = v.bestRivers?.[stage.id];
        if (Number.isFinite(score) && score >= 0)
          this.values.bestRivers[stage.id] = Math.floor(score);
      }
      if (this.values.bestRace !== null)
        this.values.bestRaces[campaignDefinition.tracks[0].id] = Math.min(
          this.values.bestRaces[campaignDefinition.tracks[0].id] ?? Infinity,
          this.values.bestRace,
        );
      for (const [id, time] of Object.entries(this.values.bestRaces)) {
        const e = this.values.events[id];
        if (e) e.bestTime = Math.min(e.bestTime ?? Infinity, time);
      }
    } catch {
      this.warning = "Campaign record unavailable. Tuning is unchanged.";
    }
  }
  save() {
    try {
      this.storage.setItem(campaignKey, JSON.stringify(this.values));
      this.warning = "";
      this.dirty = false;
      return true;
    } catch {
      this.warning =
        "Wallet/progress is active for this visit but not saved. Retry saving before leaving.";
      this.dirty = true;
      return false;
    }
  }
  latest() {
    if (this.dirty) return;
    try {
      const raw = JSON.parse(this.storage.getItem(campaignKey) || "null");
      if (raw?.schema === 2) {
        Object.assign(this.values, normalizeLedger(raw));
        this.values.unlocked = Math.max(
          1,
          Math.min(4, Number.isInteger(raw.unlocked) ? raw.unlocked : 1),
        );
      }
    } catch {
      /* Keep the already sanitized in-memory record. */
    }
  }
  begin(id) {
    this.latest();
    const next = beginAttempt(this.values, id);
    Object.assign(this.values, next.ledger);
    this.save();
    return next.attempt;
  }
  complete(attempt, record) {
    this.latest();
    const next = creditCompletion(this.values, attempt, record);
    if (!next) return null;
    Object.assign(this.values, next.ledger);
    const e = eventById.get(attempt.eventId);
    this.values.unlocked = Math.max(
      this.values.unlocked,
      Math.min(4, Math.floor(e.stage / 2) + 1),
    );
    if (e.kind === "race") {
      this.values.bestRaces[e.id] = next.ledger.events[e.id].bestTime;
      if (e.number === 1)
        this.values.bestRace = next.ledger.events[e.id].bestTime;
    }
    const saved = this.save();
    return { ...next.reward, pending: !saved };
  }
  retry() {
    return this.save();
  }
  race(time, id = campaignDefinition.tracks[0].id) {
    if (
      Number.isFinite(time) &&
      time > 0 &&
      campaignDefinition.tracks.some((t) => t.id === id)
    ) {
      this.values.bestRaces[id] = Math.min(
        this.values.bestRaces[id] ?? Infinity,
        time,
      );
      if (this.values.events[id])
        this.values.events[id].bestTime = Math.min(
          this.values.events[id].bestTime ?? Infinity,
          time,
        );
      if (id === campaignDefinition.tracks[0].id)
        this.values.bestRace = this.values.bestRaces[id];
      this.save();
    }
  }
  arrive(
    score,
    riverId = campaignDefinition.rivers[0].id,
    trackId = campaignDefinition.tracks[1].id,
  ) {
    const index = campaignDefinition.tracks.findIndex(
      (t) => t.id === trackId && t.status !== "planned",
    );
    if (
      index < 0 ||
      !Number.isFinite(score) ||
      score < 0 ||
      !campaignDefinition.rivers.some(
        (r) => r.id === riverId && r.status === "playable",
      )
    )
      return;
    this.values.unlocked = Math.max(this.values.unlocked, index + 1);
    this.values.bestRivers[riverId] = Math.max(
      this.values.bestRivers[riverId] ?? 0,
      Math.floor(score),
    );
    if (riverId === campaignDefinition.rivers[0].id)
      this.values.bestBonus = this.values.bestRivers[riverId];
    this.save();
  }
  reset() {
    this.values = defaults();
    this.save();
  }
}
