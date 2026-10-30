import { campaignDefinition } from "./campaign-data.js";
export const campaignKey = "jet-sprint-campaign-v1";
const defaults = () => ({
  schema: 1,
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
    this.values = defaults();
    try {
      const raw = storage.getItem(campaignKey);
      if (!raw) return;
      const v = JSON.parse(raw);
      if (v?.schema !== 1) throw Error("Unknown campaign schema");
      if (Number.isInteger(v.unlocked))
        this.values.unlocked = Math.max(1, Math.min(2, v.unlocked));
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
    } catch {
      this.warning = "Campaign record unavailable. Tuning is unchanged.";
    }
  }
  save() {
    try {
      this.storage.setItem(campaignKey, JSON.stringify(this.values));
      this.warning = "";
    } catch {
      this.warning =
        "Campaign progress is active, but cannot be saved on this device.";
    }
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
