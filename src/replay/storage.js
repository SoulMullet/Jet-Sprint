import { validateReplay } from "./model.js";
import { fingerprint, recordKey } from "./course-data.js";
export const REPLAY_DB = "jet-sprint-replays-v1";
export const STORAGE_LIMITS = Object.freeze({
  bytes: 64 * 1024 * 1024,
  count: 32,
});
const references = (records) =>
  new Set(
    records
      .flatMap((r) => [r.bestReplayId, r.previousReplayId])
      .filter(Boolean),
  );
// Shared transaction planner, independently testable without browser APIs.
export function planRecording(
  catalog,
  records,
  replay,
  {
    imported = false,
    pinned = false,
    limits = STORAGE_LIMITS,
    now = Date.now(),
  } = {},
) {
  validateReplay(replay);
  const text = JSON.stringify(replay),
    bytes = new TextEncoder().encode(text).length,
    digest = fingerprint(text),
    id = replay.meta.id,
    old = catalog.find((c) => c.id === id);
  if (old) {
    if (old.digest !== digest)
      throw Error(
        "A different replay already uses this ID. Nothing was overwritten.",
      );
    return {
      catalog: catalog.map((c) =>
        c.id === id ? { ...c, pinned: c.pinned || pinned } : c,
      ),
      records,
      removed: [],
      duplicate: true,
      record: false,
    };
  }
  const key = recordKey(replay.meta),
    previous = records.find((r) => r.key === key),
    eligible = replay.eligible && !imported,
    newBest =
      eligible &&
      (!previous || replay.official.total < previous.bestTotal - 1e-6);
  let nextRecords = records;
  if (eligible) {
    const lap = replay.official.laps.length
        ? Math.min(...replay.official.laps)
        : null,
      stats = {
        key,
        course: replay.meta.course,
        tuneId: replay.meta.tuneId,
        bestTotal: newBest ? replay.official.total : previous.bestTotal,
        bestReplayId: newBest ? id : previous.bestReplayId,
        bestLap:
          lap === null ? null : Math.min(previous?.bestLap ?? Infinity, lap),
        bestRiver:
          replay.meta.course.kind === "river"
            ? Math.min(previous?.bestRiver ?? Infinity, replay.official.total)
            : null,
        previousReplayId: id,
        recentTotal: replay.official.total,
        bestSplits: replay.official.splits.map((s, i) => ({
          ...s,
          t: Math.min(previous?.bestSplits[i]?.t ?? Infinity, s.t),
        })),
      };
    nextRecords = [...records.filter((r) => r.key !== key), stats];
  }
  const item = {
    id,
    key,
    digest,
    bytes,
    savedAt: now,
    label: replay.meta.name,
    course: replay.meta.course,
    total: replay.official.total,
    tuneId: replay.meta.tuneId,
    pinned,
    imported,
    test: !replay.eligible,
    wasPersonalBest: newBest,
  };
  let next = [...catalog, item];
  const protectedIds = references(nextRecords),
    removed = [];
  const over = () =>
    next.length > limits.count ||
    next.reduce((sum, c) => sum + c.bytes, 0) > limits.bytes;
  for (const c of [...catalog].sort((a, b) => a.savedAt - b.savedAt)) {
    if (!over()) break;
    if (c.pinned || c.wasPersonalBest || protectedIds.has(c.id)) continue;
    next = next.filter((v) => v.id !== c.id);
    removed.push(c.id);
  }
  if (over())
    throw Error(
      "Replay storage budget reached. Export/delete recordings to make space. Personal-best and saved replays were preserved.",
    );
  return {
    catalog: next,
    records: nextRecords,
    removed,
    record: newBest,
    firstRecord: newBest && !previous,
    duplicate: false,
    item,
  };
}
export class ReplayRepository {
  constructor(
    idb = globalThis.indexedDB,
    { name = REPLAY_DB, limits = STORAGE_LIMITS } = {},
  ) {
    this.limits = limits;
    this.memory = { catalog: [], records: [], replays: new Map() };
    this.warning = "";
    this.db = null;
    this.ready = new Promise((resolve) => {
      if (!idb) {
        this.warning =
          "IndexedDB unavailable: replays are temporary. Export to keep them.";
        resolve();
        return;
      }
      let done = false;
      const finish = (error) => {
        if (done) return;
        done = true;
        if (error)
          this.warning =
            "Replay storage unavailable: temporary recordings only. Export to keep them.";
        resolve();
      };
      try {
        const request = idb.open(name, 1);
        request.onupgradeneeded = () => {
          const db = request.result;
          for (const store of ["replays", "catalog", "records"])
            if (!db.objectStoreNames.contains(store))
              db.createObjectStore(store, {
                keyPath: store === "records" ? "key" : "id",
              });
        };
        request.onsuccess = () => {
          if (done) {
            request.result.close();
            return;
          }
          this.db = request.result;
          this.db.onversionchange = () => {
            this.db.close();
            this.db = null;
            this.warning =
              "Replay database changed in another tab. Reload or export current recordings.";
          };
          finish();
        };
        request.onerror = () => finish(request.error);
        request.onblocked = () => finish(Error("blocked"));
      } catch (e) {
        finish(e);
      }
    });
  }
  async read(store, key) {
    await this.ready;
    if (!this.db) {
      if (store === "replays") return this.memory.replays.get(key);
      return key === undefined
        ? structuredClone(this.memory[store])
        : structuredClone(
            this.memory[store].find(
              (r) => r[store === "records" ? "key" : "id"] === key,
            ),
          );
    }
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(store, "readonly"),
        request =
          key === undefined
            ? tx.objectStore(store).getAll()
            : tx.objectStore(store).get(key);
      request.onsuccess = () =>
        resolve(request.result?.replay ?? request.result);
      request.onerror = () => reject(request.error);
    });
  }
  list() {
    return this.read("catalog");
  }
  records() {
    return this.read("records");
  }
  async get(id) {
    const r = await this.read("replays", id);
    if (!r) throw Error("Replay is no longer stored.");
    return validateReplay(r);
  }
  async mutate(operation) {
    await this.ready;
    if (!this.db) {
      const result = operation(
        structuredClone(this.memory.catalog),
        structuredClone(this.memory.records),
      );
      this.memory.catalog = result.catalog;
      this.memory.records = result.records;
      for (const id of result.removed || []) this.memory.replays.delete(id);
      if (result.replay)
        this.memory.replays.set(
          result.replay.meta.id,
          structuredClone(result.replay),
        );
      return result;
    }
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(
          ["catalog", "records", "replays"],
          "readwrite",
        ),
        catalog = tx.objectStore("catalog"),
        records = tx.objectStore("records"),
        payloads = tx.objectStore("replays");
      let a, b, result, error;
      const apply = () => {
        if (!a || !b) return;
        try {
          result = operation(a, b);
          catalog.clear();
          records.clear();
          for (const c of result.catalog) catalog.put(c);
          for (const r of result.records) records.put(r);
          for (const id of result.removed || []) payloads.delete(id);
          if (result.replay)
            payloads.put({ id: result.replay.meta.id, replay: result.replay });
        } catch (e) {
          error = e;
          tx.abort();
        }
      };
      const ar = catalog.getAll(),
        br = records.getAll();
      ar.onsuccess = () => {
        a = ar.result;
        apply();
      };
      br.onsuccess = () => {
        b = br.result;
        apply();
      };
      tx.oncomplete = () => resolve(result);
      tx.onabort = () =>
        reject(
          error ||
            tx.error ||
            Error(
              "Replay storage transaction failed. Export this run to keep it.",
            ),
        );
      tx.onerror = () => {};
    });
  }
  commit(replay, options = {}) {
    validateReplay(replay);
    return this.mutate((catalog, records) => {
      const plan = planRecording(catalog, records, replay, {
        ...options,
        limits: this.limits,
      });
      if (!plan.duplicate) plan.replay = replay;
      return plan;
    });
  }
  pin(id, label) {
    return this.mutate((catalog, records) => {
      if (!catalog.some((c) => c.id === id))
        throw Error("Select a stored replay.");
      return {
        catalog: catalog.map((c) =>
          c.id === id
            ? {
                ...c,
                pinned: true,
                label: label?.trim().slice(0, 100) || c.label,
              }
            : c,
        ),
        records,
      };
    });
  }
  remove(id, confirmed = false) {
    return this.mutate((catalog, records) => {
      const c = catalog.find((c) => c.id === id);
      if (!c) throw Error("Replay is no longer stored.");
      if (
        !confirmed &&
        (c.pinned || c.wasPersonalBest || references(records).has(id))
      )
        throw Error(
          "This recording is saved or holds a record. Confirm deletion explicitly.",
        );
      return {
        catalog: catalog.filter((c) => c.id !== id),
        records: records.map((r) => ({
          ...r,
          bestReplayId: r.bestReplayId === id ? null : r.bestReplayId,
          previousReplayId:
            r.previousReplayId === id ? null : r.previousReplayId,
        })),
        removed: [id],
      };
    });
  }
  clearTests() {
    return this.mutate((catalog, records) => {
      const refs = references(records),
        removed = catalog
          .filter(
            (c) => c.test && !c.pinned && !c.wasPersonalBest && !refs.has(c.id),
          )
          .map((c) => c.id);
      return {
        catalog: catalog.filter((c) => !removed.includes(c.id)),
        records,
        removed,
      };
    });
  }
}
