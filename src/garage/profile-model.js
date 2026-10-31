import { BOAT_ID, GARAGE_VERSION, garageEconomy } from "./definitions.js";
export const PROFILE_VERSION = 1,
  PROFILE_LIMIT = 256 * 1024;
export const uid = () =>
  globalThis.crypto?.randomUUID?.() ||
  `profile-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const plain = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const id = (v) =>
  typeof v === "string" &&
  /^[a-zA-Z0-9_-]{1,100}$/.test(v) &&
  !["__proto__", "prototype", "constructor"].includes(v);
const amount = (v) => Number.isSafeInteger(v) && v >= 0 && v <= 1e9;
const percent = (v) => Number.isFinite(v) && v >= 0 && v <= 100;
const time = (v) => Number.isFinite(v) && v > 0 && v <= 86400;
const unique = (a) =>
  Array.isArray(a) &&
  a.length <= 32 &&
  a.every(id) &&
  new Set(a).size === a.length;
export function freshProfile(levels, { existingPlayer = false } = {}) {
  return {
    type: "jet-sprint-player-profile",
    schemaVersion: PROFILE_VERSION,
    id: uid(),
    revision: 0,
    economyVersion: GARAGE_VERSION,
    cash: garageEconomy.startingCash,
    lifetimeEarnings: 0,
    boat: { id: BOAT_ID, fuel: 100, condition: 100, installedUpgrades: [] },
    career: {
      unlockedCourses: existingPlayer
        ? levels.map((l) => l.id)
        : [levels[0].id],
      completedCourses: [],
      records: {},
      sequence: 0,
      paidSequence: 0,
      activeAttempt: null,
    },
    results: [],
    extensions: {},
  };
}
export function normalizeRecord(r) {
  if (
    !plain(r) ||
    typeof r.revision !== "string" ||
    r.revision.length > 100 ||
    !time(r.best) ||
    !time(r.recent) ||
    !Number.isSafeInteger(r.completions) ||
    r.completions < 1 ||
    r.completions > 1e9
  )
    throw Error("Invalid career record.");
  return {
    revision: r.revision,
    best: r.best,
    recent: r.recent,
    completions: r.completions,
    completed: true,
  };
}
export function validateProfile(raw) {
  if (
    !plain(raw) ||
    raw.type !== "jet-sprint-player-profile" ||
    raw.schemaVersion !== 1
  )
    throw Error("Unsupported player profile version.");
  if (
    !id(raw.id) ||
    !amount(raw.revision) ||
    !amount(raw.cash) ||
    !amount(raw.lifetimeEarnings) ||
    raw.economyVersion !== GARAGE_VERSION
  )
    throw Error("Invalid profile identity or balance.");
  const b = raw.boat,
    c = raw.career;
  if (
    !plain(b) ||
    b.id !== BOAT_ID ||
    !percent(b.fuel) ||
    !percent(b.condition) ||
    !Array.isArray(b.installedUpgrades) ||
    b.installedUpgrades.length > 16 ||
    !b.installedUpgrades.every(id)
  )
    throw Error("Invalid owned boat.");
  if (
    !plain(c) ||
    !unique(c.unlockedCourses) ||
    !c.unlockedCourses.length ||
    !unique(c.completedCourses) ||
    !plain(c.records) ||
    Object.keys(c.records).length > 32 ||
    !amount(c.sequence) ||
    !amount(c.paidSequence) ||
    c.paidSequence > c.sequence
  )
    throw Error("Invalid career progress.");
  const records = {};
  for (const [key, r] of Object.entries(c.records)) {
    if (!id(key)) throw Error("Invalid course ID.");
    records[key] = normalizeRecord(r);
  }
  const a = c.activeAttempt;
  if (
    a !== null &&
    (!plain(a) ||
      !amount(a.sequence) ||
      a.sequence !== c.sequence ||
      !id(a.courseId) ||
      typeof a.revision !== "string" ||
      a.revision.length > 100 ||
      !Number.isInteger(a.gateCount) ||
      a.gateCount < 1 ||
      a.gateCount > 500 ||
      !Number.isInteger(a.checkpoints) ||
      a.checkpoints < 0 ||
      a.checkpoints > a.gateCount ||
      !Number.isFinite(a.seconds) ||
      a.seconds < 0 ||
      a.seconds > 86400 ||
      !Number.isFinite(a.lastGateTime) ||
      a.lastGateTime < 0 ||
      a.lastGateTime > 86400 ||
      typeof a.valid !== "boolean" ||
      typeof a.clean !== "boolean" ||
      typeof a.practice !== "boolean")
  )
    throw Error("Invalid race attempt.");
  if (!Array.isArray(raw.results) || raw.results.length > 50)
    throw Error("Invalid result history.");
  for (const r of raw.results)
    if (
      !plain(r) ||
      !id(r.courseId) ||
      !amount(r.sequence) ||
      r.sequence > c.paidSequence ||
      !time(r.total) ||
      !amount(r.prize) ||
      typeof r.at !== "string" ||
      r.at.length > 40
    )
      throw Error("Invalid result.");
  if (!plain(raw.extensions) || JSON.stringify(raw.extensions).length > 64000)
    throw Error("Invalid profile extensions.");
  const next = structuredClone(raw);
  next.career.records = records;
  return next;
}
// A documented pre-release v0 shape migrates explicitly. Future versions are never overwritten.
export function decodeProfile(text) {
  if (typeof text !== "string" || text.length > PROFILE_LIMIT)
    throw Error("Player profile exceeds 256 KB.");
  const raw = JSON.parse(text);
  if (raw?.schemaVersion > PROFILE_VERSION) {
    const e = Error(
      "A newer game owns this profile. Update this tab; saved data is unchanged.",
    );
    e.code = "FUTURE";
    throw e;
  }
  if (raw?.schemaVersion === 0) {
    raw.schemaVersion = 1;
    raw.cash = raw.money;
    delete raw.money;
    raw.boat = {
      id: raw.boatId || BOAT_ID,
      fuel: raw.fuel ?? 100,
      condition: raw.condition ?? 100,
      installedUpgrades: raw.upgrades || [],
    };
    raw.economyVersion = GARAGE_VERSION;
    raw.results ??= [];
    raw.extensions ??= {};
  }
  return validateProfile(raw);
}
export function migrateLegacy(
  storage,
  levels,
  { existingPlayer = false } = {},
) {
  const p = freshProfile(levels, { existingPlayer }),
    notes = [];
  function read(key) {
    try {
      const text = storage.getItem(key);
      if (!text) return null;
      if (text.length > PROFILE_LIMIT) throw Error();
      return JSON.parse(text);
    } catch {
      notes.push(
        `Older ${key} data could not be read; its original key is unchanged.`,
      );
      return null;
    }
  }
  const wallet =
      read("jet-sprint-campaign-v2") ?? read("jet-sprint-campaign-v1"),
    rivers = read("jet-sprint-river-runs-v1");
  if (wallet?.schema === 2 && amount(wallet.wallet)) {
    p.cash = wallet.wallet;
    p.lifetimeEarnings = amount(wallet.lifetimeEarnings)
      ? wallet.lifetimeEarnings
      : wallet.wallet;
    p.extensions.legacyCampaign = {
      walletImported: true,
      unlocked: Number.isInteger(wallet.unlocked) ? wallet.unlocked : 1,
    };
    notes.push(
      "Existing campaign balance imported once; original wallet retained.",
    );
  }

  if ([1, 2].includes(wallet?.schema)) {
    p.career.unlockedCourses = levels.map((l) => l.id);
    const archived = {};
    for (const [key, row] of Object.entries(wallet.events || {}).slice(0, 32))
      if (id(key) && time(row?.bestTime))
        archived[key] = {
          bestTime: row.bestTime,
          completions: amount(row.completions) ? row.completions : 0,
        };
    for (const [key, best] of Object.entries(wallet.bestRaces || {}).slice(
      0,
      8,
    ))
      if (id(key) && time(best))
        archived[key] = {
          bestTime: Math.min(archived[key]?.bestTime ?? Infinity, best),
          completions: archived[key]?.completions || 0,
        };
    p.extensions.legacyCampaign = {
      ...(p.extensions.legacyCampaign || {}),
      records: archived,
      sourceSchema: wallet.schema,
    };
  }
  if (rivers?.schema === 1) {
    p.career.unlockedCourses = levels.map((l) => l.id);
    for (const l of levels) {
      try {
        const r = normalizeRecord(rivers.records?.[l.id]);
        if (r.revision !== l.revision) continue;
        p.career.records[l.id] = r;
        p.career.completedCourses.push(l.id);
      } catch {
        /* Invalid old records never invent a result. */
      }
    }
    notes.push("Standalone river records imported without retroactive prizes.");
  }
  return { profile: p, notes };
}
