import { campaignEvents } from "./campaign-data.js";
export const money = (amount) =>
  "$" + Math.floor(amount).toLocaleString("en-US");
export const eventById = new Map(campaignEvents.map((e) => [e.id, e]));
const integer = (n, max = Number.MAX_SAFE_INTEGER) =>
  Number.isSafeInteger(n) && n >= 0 && n <= max;
export function initialLedger() {
  return { wallet: 0, lifetimeEarnings: 0, events: {} };
}
export function normalizeLedger(raw = {}) {
  raw = raw && typeof raw === "object" ? raw : {};
  const next = initialLedger();
  next.wallet = integer(raw.wallet) ? raw.wallet : 0;
  next.lifetimeEarnings = integer(raw.lifetimeEarnings)
    ? Math.max(next.wallet, raw.lifetimeEarnings)
    : next.wallet;
  for (const event of campaignEvents) {
    const old = raw.events?.[event.id] ?? {};
    next.events[event.id] = {
      sequence: integer(old.sequence) ? old.sequence : 0,
      paidSequence: integer(old.paidSequence) ? old.paidSequence : 0,
      completions: integer(old.completions) ? old.completions : 0,
      bestTime:
        Number.isFinite(old.bestTime) && old.bestTime > 0 ? old.bestTime : null,
      cleanClears: integer(old.cleanClears) ? old.cleanClears : 0,
      cleanBonusClaimed: old.cleanBonusClaimed === true,
      firstClearClaimed: old.firstClearClaimed === true,
    };
  }
  for (const e of Object.values(next.events))
    e.paidSequence = Math.min(e.sequence, e.paidSequence);
  return next;
}
export function beginAttempt(ledger, id) {
  if (!eventById.has(id)) throw Error("Unknown campaign event.");
  const next = normalizeLedger(ledger),
    e = next.events[id];
  if (e.sequence >= Number.MAX_SAFE_INTEGER)
    throw Error("Attempt limit reached.");
  e.sequence++;
  return { ledger: next, attempt: { eventId: id, sequence: e.sequence } };
}
export function creditCompletion(
  ledger,
  attempt,
  { time, clean = false } = {},
) {
  const event = eventById.get(attempt?.eventId);
  if (!event || !Number.isFinite(time) || time <= 0) return null;
  const next = normalizeLedger(ledger),
    e = next.events[event.id];
  // Only the active attempt can complete. A restart invalidates older callbacks;
  // its paid watermark is permanent, with bounded memory rather than an ever-growing log.
  if (
    !integer(attempt.sequence) ||
    attempt.sequence !== e.sequence ||
    attempt.sequence <= e.paidSequence
  )
    return null;
  const bonus = clean && !e.cleanBonusClaimed ? event.cleanPrize : 0,
    amount = event.prize + bonus;
  if (
    !Number.isSafeInteger(next.wallet + amount) ||
    !Number.isSafeInteger(next.lifetimeEarnings + amount)
  )
    return null;
  const personalBest = e.bestTime === null || time < e.bestTime;
  e.paidSequence = attempt.sequence;
  e.completions++;
  e.bestTime = Math.min(e.bestTime ?? Infinity, time);
  e.firstClearClaimed = true;
  if (clean) {
    e.cleanClears++;
    e.cleanBonusClaimed = true;
  }
  next.wallet += amount;
  next.lifetimeEarnings += amount;
  return {
    ledger: next,
    reward: {
      id: `${event.id}:${attempt.sequence}`,
      eventId: event.id,
      name: event.name,
      kind: event.kind,
      time,
      personalBest,
      clean,
      prize: event.prize,
      cleanBonus: bonus,
      total: amount,
      wallet: next.wallet,
    },
  };
}
