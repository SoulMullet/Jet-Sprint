import {
  decodeProfile,
  migrateLegacy,
  validateProfile,
  PROFILE_LIMIT,
} from "./profile-model.js";
export const profileKey = "jet-sprint-player-profile-v1";
// Synchronous local adapter. A cloud adapter must enforce atomic revision checks
// and idempotent transactions on the server; localStorage is not cross-tab CAS.
export class LocalProfileRepository {
  constructor(storage) {
    this.storage = storage;
  }
  load(levels, options) {
    let raw = null;
    try {
      raw = this.storage.getItem(profileKey);
      if (raw) {
        const p = decodeProfile(raw);
        return { profile: p, baseRevision: p.revision, notes: [] };
      }
    } catch (error) {
      if (error.code === "FUTURE")
        return {
          ...migrateLegacy({ getItem: () => null }, levels, options),
          baseRevision: null,
          readOnly: true,
          notes: [error.message],
        };
      if (raw) {
        try {
          this.storage.setItem(
            profileKey + ".corrupt",
            raw.slice(0, PROFILE_LIMIT),
          );
        } catch {
          /* Recovery can still read the independent backup. */
        }
      }
      try {
        const backup = decodeProfile(
          this.storage.getItem(profileKey + ".backup"),
        );
        return {
          profile: backup,
          baseRevision: this.revision(),
          notes: [
            "Recovered the last valid profile backup. The unreadable original was quarantined where storage allowed.",
          ],
        };
      } catch {
        /* Fresh recovery never reads fuel/condition from tuning stores. */
      }
      const next = migrateLegacy(this.storage, levels, options);
      return {
        ...next,
        baseRevision: this.revision(),
        notes: [
          "Profile unavailable; recovered from validated legacy data/defaults. " +
            error.message,
          ...next.notes,
        ],
      };
    }
    return {
      ...migrateLegacy(this.storage, levels, options),
      baseRevision: null,
    };
  }
  revision() {
    try {
      return decodeProfile(this.storage.getItem(profileKey)).revision;
    } catch {
      return null;
    }
  }
  commit(profile, expectedRevision) {
    const previous = this.storage.getItem(profileKey);
    let previousVersion;
    try {
      previousVersion = JSON.parse(previous)?.schemaVersion;
    } catch {
      /* Invalid raw data can be recovered from the backup. */
    }
    if (previousVersion > 1)
      throw Error("A newer profile version cannot be overwritten.");
    if (this.revision() !== expectedRevision) {
      const e = Error(
        "Another tab changed this profile. Export this visit, then reload before spending or earning.",
      );
      e.code = "CONFLICT";
      throw e;
    }
    const next = validateProfile({
        ...profile,
        revision: (expectedRevision ?? profile.revision) + 1,
      }),
      text = JSON.stringify(next);
    if (text.length > PROFILE_LIMIT)
      throw Error("Profile exceeds its storage budget.");
    if (previous) {
      try {
        decodeProfile(previous);
        this.storage.setItem(profileKey + ".backup", previous);
      } catch {
        /* Primary write still reports quota/storage failure. */
      }
    }
    this.storage.setItem(profileKey, text);
    return next;
  }
}
