// Authored by inspecting the supplied recordings' waveform and spectral evolution.
// These are relative timbre anchors, NOT measured source RPM calibrations.
export const engineRecordings = {
  cruise: "audio/Engine/EngineCruise.m4a",
  rev: "audio/Engine/EngineRev.m4a",
};
export const engineRegions = [
  { id: "idle", recording: "rev", start: 0.16, end: 0.76, anchor: 0 },
  { id: "low", recording: "cruise", start: 2.05, end: 2.75, anchor: 0.32 },
  { id: "cruise", recording: "cruise", start: 0.25, end: 1.15, anchor: 0.63 },
  { id: "high", recording: "rev", start: 1.35, end: 3.05, anchor: 1 },
];
export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export function layerMix(position, regions = engineRegions) {
  const weights = regions.map(() => 0);
  position = clamp(position);
  let i = 0;
  while (i < regions.length - 2 && position > regions[i + 1].anchor) i++;
  const t = clamp(
    (position - regions[i].anchor) /
      (regions[i + 1].anchor - regions[i].anchor),
  );
  weights[i] = Math.cos((t * Math.PI) / 2);
  weights[i + 1] = Math.sin((t * Math.PI) / 2);
  return weights;
}
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
  const response = await fetcher(path);
  if (!response.ok) throw Error(`HTTP ${response.status}`);
  return context.decodeAudioData(await response.arrayBuffer());
}
