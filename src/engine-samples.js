// Authored by inspecting the supplied recordings' waveform and spectral evolution.
// These are relative timbre anchors, NOT measured source RPM calibrations.
export const engineRecordings = {
  idle: "audio/Engine/EngineIdle.m4a",
  rev: "audio/Engine/EngineRev.m4a",
  revDown: "audio/Engine/EngineRevDown.m4a",
  cruise: "audio/Engine/EngineCruise.m4a",
  cruiseOne: "audio/Engine/EngineCruiseLayerOne.m4a",
  jump: "audio/Engine/EngineJump.m4a",
  cruiseTwo: "audio/Engine/EngineCruiseLayerTwo.m4a",
  highRev: "audio/Engine/EngineHighRev.m4a",
  revOut: "audio/Engine/EngineRevOut.m4a",
};
export const engineRegions = [
  {
    id: "idle",
    recording: "idle",
    start: 0.35,
    end: 4.95,
    referenceRPM: 900,
    overlap: 0.1,
  },
  {
    id: "cruise",
    recording: "cruise",
    start: 0.25,
    end: 1.2,
    referenceRPM: 4200,
    overlap: 0.08,
  },
  {
    id: "cruiseOne",
    recording: "cruiseOne",
    start: 0.25,
    end: 2.2,
    referenceRPM: 4400,
    overlap: 0.08,
  },
  {
    id: "jump",
    recording: "jump",
    start: 0.09,
    end: 0.8,
    referenceRPM: 6400,
    overlap: 0.06,
  },
  {
    id: "cruiseTwo",
    recording: "cruiseTwo",
    start: 0.65,
    end: 5.25,
    referenceRPM: 4500,
    overlap: 0.12,
  },
  {
    id: "highRev",
    recording: "highRev",
    start: 0.55,
    end: 2.02,
    referenceRPM: 6500,
    overlap: 0.09,
  },
  {
    id: "revOut",
    recording: "revOut",
    start: 0.72,
    end: 1.54,
    referenceRPM: 6900,
    overlap: 0.075,
  },
];
export const transientRegions = {
  rev: {
    recording: "rev",
    offsets: [0.28, 0.46, 0.64],
    durations: [1.55, 1.45, 1.35],
    referenceRPM: 4800,
  },
  revDown: {
    recording: "revDown",
    offsets: [0.18, 0.26, 0.34],
    durations: [2.85, 2.7, 2.6],
    referenceRPM: 4800,
  },
};
export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
// Bake a complementary raised-cosine splice once. The buffer's final sample
// approaches the sample immediately preceding its start; no main-thread scheduler.
export function seamlessLoop(context, source, start, end, overlap = 0.08) {
  const rate = source.sampleRate,
    first = Math.round(start * rate),
    last = Math.round(end * rate);
  if (first < 0 || last > source.length || last - first < rate * 0.2)
    throw Error("Recording is too short for its authored loop.");
  const fade = Math.min(
    Math.round(overlap * rate),
    Math.floor((last - first) / 4),
  );
  const n = last - first - fade,
    out = context.createBuffer(source.numberOfChannels, n, rate);
  for (let ch = 0; ch < source.numberOfChannels; ch++) {
    const input = source.getChannelData(ch),
      data = out.getChannelData(ch);
    let mean = 0;
    for (let j = first; j < last; j++) mean += input[j];
    mean /= last - first;
    for (let j = 0; j < n; j++) {
      let sample = input[first + fade + j];
      if (j >= n - fade) {
        const k = j - (n - fade),
          w = Math.sin(((k / (fade - 1)) * Math.PI) / 2) ** 2;
        sample = sample * (1 - w) + input[first + k] * w;
      }
      data[j] = sample - mean;
    }
  }
  // Match level without erasing the recordings' internal dynamics. Bound peak.
  let energy = 0,
    peak = 0;
  for (let ch = 0; ch < out.numberOfChannels; ch++)
    for (const x of out.getChannelData(ch)) {
      energy += x * x;
      peak = Math.max(peak, Math.abs(x));
    }
  const gain = Math.min(
    2,
    0.16 / Math.max(0.01, Math.sqrt(energy / (n * out.numberOfChannels))),
    0.75 / Math.max(0.01, peak),
  );
  for (let ch = 0; ch < out.numberOfChannels; ch++) {
    const data = out.getChannelData(ch);
    for (let j = 0; j < n; j++) data[j] *= gain;
  }
  return out;
}
export async function loadRecording(context, path, fetcher = fetch) {
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetcher(path, { signal: controller.signal });
    if (!response.ok) throw Error(`HTTP ${response.status}`);
    return await context.decodeAudioData(await response.arrayBuffer());
  } finally {
    clearTimeout(timer);
  }
}

// Approximate timbre references, not measurements of RPM in the recordings.
// Absolute simulated RPM makes Idle/Maximum RPM tuning audible at steady state.
export function enginePlaybackRate(rpm, referenceRPM, pitchRange) {
  return clamp(
    (Math.max(1, rpm) / referenceRPM) ** (pitchRange * 0.0055),
    0.72,
    1.32,
  );
}
