import {
  garageEconomy,
  maintenanceSpecs,
  maintenanceDefaults,
} from "./garage/definitions.js";
import {
  handlingDefaults,
  physicsControls,
  handlingProfiles,
} from "./handling.js";
import {
  BOAT_MASS,
  REFERENCE_YAW_INERTIA,
  PHYSICS_STEP,
  channelParameters,
} from "./physics-parameters.js";
import {
  audioControls,
  enginePresets,
  defaultAudio,
} from "./audio-settings.js";
import { cameraSpecs } from "./racing-camera-settings.js";
import { controlSpecs, controlPresets } from "./control-settings.js";
import { summerControls, summerProfiles } from "./summer-settings.js";
import { registry } from "./settings.js";
import { visibilitySpecs } from "./gameplay-settings.js";
import { replayDefaults } from "./replay/settings.js";
import {
  SAMPLE_FIELDS,
  REPLAY_VERSION,
  REPLAY_LIMITS,
} from "./replay/model.js";
import {
  courseDescriptor,
  BOAT_CONFIG,
  PHYSICS_VERSION,
} from "./replay/course-data.js";
// Explicit projection into JSON data. Never serialize Three.js scenes or closures.
export function portableGameData(world, tuning = {}, build = "local") {
  return {
    type: "jet-sprint-foundation",
    garage: {
      economy: garageEconomy,
      maintenance: {
        controls: maintenanceSpecs,
        defaults: maintenanceDefaults(),
      },
      profileSchema: "urn:jet-sprint:player-profile:v1",
      profileVersion: 1,
      storage:
        "Replace local revision adapter with atomic backend transactions and idempotency; player JSON exports separately.",
    },
    version: 1,
    build,
    activeMode: world.riverRunLevels ? "river-runs-v1" : "legacy-campaign-v1",
    primaryRiverLevels:
      world.riverRunLevels?.map((l) => ({
        id: l.id,
        name: l.name,
        environmentId: l.environmentId,
        start: l.start,
        finish: l.finish,
        startDistance: l.startDistance,
        revision: l.revision,
        unlockRequirements: l.unlockRequirements,
        replayDescriptor: l.replayDescriptor,
      })) || [],
    coordinates: {
      convention: "RH_Y_UP_X_FORWARD",
      distance: "metres",
      time: "seconds",
      angle: "radians",
      quaternion: "xyzw",
      parameterUnits:
        "Use each control registry unit; degree-valued tuning knobs remain degrees.",
      unrealPosition: "[100*x,100*z,100*y]",
      unrealQuaternion: "[-qx,-qz,-qy,qw]",
      unrealAngularVelocity: "[-wx,-wz,-wy] radians/s",
    },
    boat: {
      id: BOAT_CONFIG,
      massKg: BOAT_MASS,
      referenceYawInertiaKgM2: REFERENCE_YAW_INERTIA,
      physicsVersion: PHYSICS_VERSION,
      fixedStep: PHYSICS_STEP,
      defaults: handlingDefaults,
      controls: physicsControls,
      presets: handlingProfiles,
    },
    campaign: world.definition,
    courses: world.courses.map((c, i) => ({
      descriptor: courseDescriptor(world, i),
      nodes: c.nodes,
      route: c.legs.map((l) => ({ id: l.id, from: l.from, to: l.to })),
      edges: c.edges.map((e) => ({
        id: e.id,
        points: e.points.map((p) => [p.x, p.z]),
      })),
      routeSamples: c.line.map((p) => ({
        x: p.x,
        z: p.z,
        distance: p.distance,
        edgeId: p.edgeId,
      })),
      checkpoints: c.gates.map((g) => ({
        x: g.x,
        z: g.z,
        tx: g.tx,
        tz: g.tz,
        distance: g.distance,
        halfWidth: g.halfWidth,
        edgeId: g.edgeId,
      })),
      checkpointAcceptance: {
        policy: "active-edge-clearance",
        ownEdgeMargin: 0.2,
        competingEdgeTolerance: 0.6,
      },
    })),
    rivers: world.legs.map((l, i) => ({
      descriptor: courseDescriptor(world, i, "river"),
      points: l.river.points.map((p) => [p.x, p.z]),
      checkpoints: l.checkpoints.map((g) => ({
        x: g.x,
        z: g.z,
        tx: g.tx,
        tz: g.tz,
        distance: g.distance,
        halfWidth: g.halfWidth,
      })),
      entry: l.gate,
    })),
    boundaries: {
      representation: "union-of-swept-discs",
      paths: world.network.paths.map((p) => ({
        id: p.id || "channel",
        waterHalfWidth: p.waterWidth ?? channelParameters.water,
        points: p.map((v) => [v.x, v.z]),
      })),
      hullRadius: 2.5,
      rockHullPadding: 1.2,
      ambiguousJoinSupportDirections: 16,
      channel: channelParameters,
      rocks: world.rocks,
    },
    raceRules: {
      orderedForwardCrossings: true,
      startGateIndex: 0,
      firstRequiredGateIndex: 1,
      lapCountByCourse: world.definition.tracks.map((c) => c.laps),
      clock:
        "official monotonic elapsed seconds; paused/background/viewer time excluded",
      raceToRiver:
        "finish required laps, open gate, cross forward; keep control",
    },
    input: {
      actions: { steering: { min: -1, max: 1 }, throttle: { min: 0, max: 1 } },
      controls: controlSpecs,
      presets: controlPresets,
    },
    cameras: {
      controls: cameraSpecs,
      states: ["FLAT_TRACK_FIXED", "RIVER_TRANSITION", "RIVER_FOLLOW"],
    },
    audio: {
      controls: audioControls,
      defaults: defaultAudio(),
      presets: enginePresets,
      implementation:
        "Procedural V8 DSP must be reimplemented/adapted; JSON contains parameters, not sound.",
    },
    labs: {
      game: registry,
      graphics: summerControls,
      graphicsPresets: summerProfiles,
      visibility: visibilitySpecs,
      replayDefaults,
    },
    replay: {
      version: REPLAY_VERSION,
      fields: SAMPLE_FIELDS,
      limits: REPLAY_LIMITS,
      playback: "Interpolate recorded world poses; never resimulate inputs.",
    },
    tuning,
  };
}
