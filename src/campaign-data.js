// Portable metre/second data only. No renderer, DOM or engine objects.
export const track1 = {
  id: "kowhai-sprint-park",
  status: "playable",
  number: 1,
  name: "Rookie Run",
  venueName: "Kōwhai Sprint Park",
  prize: 500,
  cleanPrize: 250,
  difficulty: 1,
  biome: "rookie",
  routeId: "club-route-1987",
  version: 1,
  seed: 1987,
  fluidSize: 256,
  sampleSpacing: 1.4,
  laps: 3,
  waterWidth: 9,
  // Three island lobes meet at J. The prescribed route visits each in order.
  spline: [
    [-80, 35],
    [-99, 18],
    [-86, -8],
    [-62, 3],
    [-48, -22],
    [-69, -48],
    [-35, -53],
    [-16, -35],
    [-62, 3],
    [-27, 28],
    [4, 15],
    [3, -9],
    [-17, -14],
    [-62, 3],
    [-59, 29],
    [-70, 43],
  ],
  nodes: {
    S: [-80, 35],
    W: [-99, 18],
    J: [-62, 3],
    N: [-69, -48],
    R: [4, 15],
    K: [-113, -6],
  },
  edges: [
    { id: "S-W", from: "S", to: "W", start: 0, end: 1 },
    { id: "W-J", from: "W", to: "J", start: 1, end: 3 },
    { id: "J-N", from: "J", to: "N", start: 3, end: 5 },
    { id: "N-J", from: "N", to: "J", start: 5, end: 8 },
    { id: "J-R", from: "J", to: "R", start: 8, end: 10 },
    { id: "R-J", from: "R", to: "J", start: 10, end: 13 },
    { id: "J-S", from: "J", to: "S", start: 13, end: 16 },
    {
      id: "staging",
      from: "W",
      to: "K",
      via: [
        [-113, 12],
        [-116, 0],
      ],
    },
  ],
  route: ["S-W", "W-J", "J-N", "N-J", "J-R", "R-J", "J-S"],
  exitRouteIndex: 7,
};

// Authored local loops, translated into one continuous world. The route graph
// retains explicit junction visits instead of accepting arbitrary figure-eights.
function course(
  id,
  number,
  name,
  centre,
  local,
  breaks,
  prize,
  cleanPrize,
  biome,
) {
  const spline = local.map(([x, z]) => [x + centre[0], z + centre[1]]),
    nodes = {},
    edges = [];
  const ids = new Map();
  const node = (i) => {
    const p = spline[i % spline.length],
      key = p.join(",");
    if (!ids.has(key)) {
      const id = i === 0 ? "S" : `J${ids.size}`;
      ids.set(key, id);
      nodes[id] = p;
    }
    return ids.get(key);
  };
  for (let i = 0; i < breaks.length - 1; i++)
    edges.push({
      id: `${id}:leg-${i}`,
      from: node(breaks[i]),
      to: node(breaks[i + 1]),
      start: breaks[i],
      end: breaks[i + 1],
    });
  const start = spline[0],
    entry = [start[0] + 100, start[1] + 100];
  return {
    status: "playable",
    id,
    number,
    name,
    centre,
    spline,
    nodes,
    edges,
    route: edges.map((e) => e.id),
    routeId: `${id}-route-1987`,
    version: 1,
    seed: 1987 + number * 97,
    sampleSpacing: 1.6,
    laps: 3,
    waterWidth: 9 - (number - 1) * 0.3,
    prize,
    cleanPrize,
    biome,
    difficulty: [1, 1.25, 1.5, 1.85][number - 1],
    staging: {
      spline: [
        entry,
        [start[0] + 70, start[1] + 68],
        [start[0] + 30, start[1] + 30],
        start,
      ],
      waterWidth: 11.5,
    },
    presentation: { focus: centre },
  };
}
export const track2 = course(
  "matai-basin",
  2,
  "Timberline",
  [90, -1330],
  [
    [-70, 38],
    [-101, 10],
    [-82, -21],
    [-48, -4],
    [-64, -40],
    [-37, -63],
    [2, -51],
    [13, -22],
    [-48, -4],
    [-19, 34],
    [14, 25],
    [33, 1],
    [22, -30],
    [-11, -24],
    [-48, -4],
    [-44, 26],
    [-57, 49],
  ],
  [0, 1, 3, 5, 8, 10, 14, 17],
  1000,
  500,
  "timber",
);
export const track3 = course(
  "devils-bend",
  3,
  "Devil’s Bend",
  [-180, -3170],
  [
    [-93, 37],
    [-124, 11],
    [-110, -20],
    [-72, -8],
    [-87, -36],
    [-58, -65],
    [-28, -50],
    [-50, -28],
    [-72, -8],
    [-36, 18],
    [-4, 3],
    [4, -25],
    [31, -39],
    [48, -10],
    [31, 17],
    [-4, 3],
    [-72, -8],
    [-46, 43],
    [-14, 57],
    [-40, 78],
    [-83, 64],
  ],
  [0, 1, 3, 5, 8, 10, 13, 15, 16, 18, 21],
  2000,
  1000,
  "gorge",
);
export const track4 = course(
  "championship",
  4,
  "Championship",
  [140, -5760],
  [
    [-80, 43],
    [-115, 20],
    [-104, -12],
    [-65, -6],
    [-89, -36],
    [-65, -65],
    [-28, -47],
    [-65, -6],
    [-20, 13],
    [12, -4],
    [-5, -40],
    [25, -63],
    [55, -38],
    [42, -7],
    [12, -4],
    [35, 28],
    [5, 53],
    [-20, 13],
    [-34, -22],
    [-65, -6],
    [-40, 48],
    [-16, 74],
    [-55, 87],
    [-90, 68],
  ],
  [0, 1, 3, 5, 7, 9, 11, 14, 16, 17, 19, 21, 24],
  5000,
  2500,
  "championship",
);

// Broad, non-self-intersecting valley meanders. Length is a consequence of
// authored bends and world connections, never an artificial duration timer.
function river(number, from, to, amplitude, steps, prize, cleanPrize, current) {
  const exit =
    number === 1
      ? [-16, -35]
      : from.spline.reduce((a, b) => (b[1] < a[1] ? b : a));
  const end = to.staging.spline[0],
    spline = [exit];
  if (number === 1) spline.push([-9, -51], [5, -63], [35, -82]);
  else spline.push([exit[0] + 8, exit[1] - 35], [exit[0] + 35, exit[1] - 80]);
  const origin = spline.at(-1);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const envelope = Math.sin(Math.PI * t) ** 0.4;
    spline.push([
      origin[0] +
        (end[0] - origin[0]) * t +
        Math.sin(t * Math.PI * steps * 0.58) * amplitude * envelope,
      origin[1] + (end[1] - origin[1]) * t,
    ]);
  }
  spline.push(end);
  return {
    status: "playable",
    id: number === 1 ? "kowhai-upstream" : `river-rush-${number}`,
    number,
    name: `River Rush ${number}`,
    from: from.id,
    to: to.id,
    difficulty: number,
    waterWidth: 10.5 + (number - 1) * 0.9,
    current,
    currentResponse: 0.65,
    prize,
    cleanPrize,
    targetSeconds: [
      [90, 120],
      [120, 180],
      [180, 240],
    ][number - 1],
    sampleSpacing: 3.5,
    spline,
    gateDistance: number === 1 ? 44 : 42,
    checkpointSpacing: 95 + (number - 1) * 12,
    scoring: {
      checkpoint: 100,
      clean: 75,
      speedFactor: 12,
      maxSpeedBonus: 300,
    },
    jump: {
      distance: 170,
      side: -1,
      offset: 4,
      halfWidth: 1.2,
      minSpeed: 7,
      launch: 3.4,
      bonus: 150,
    },
    rapids: { spacing: 140 - (number - 1) * 15, strength: 0.2 + number * 0.22 },
    rockSpacing: number === 1 ? 0 : number === 2 ? 175 : 150,
  };
}
export const river1 = river(1, track1, track2, 92, 14, 250, 150, 0.9);
export const river2 = river(2, track2, track3, 100, 19, 500, 250, 1.5);
export const river3 = river(3, track3, track4, 110, 24, 1000, 500, 2.1);
export const campaignDefinition = {
  schema: 2,
  id: "upstream-1987",
  tracks: [track1, track2, track3, track4],
  rivers: [river1, river2, river3],
};
export const campaignEvents = campaignDefinition.tracks.flatMap((track, i) => [
  { ...track, kind: "race", stage: i * 2 + 1 },
  ...(campaignDefinition.rivers[i]
    ? [{ ...campaignDefinition.rivers[i], kind: "river", stage: i * 2 + 2 }]
    : []),
]);
