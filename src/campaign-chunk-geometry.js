import {
  channelGeometry,
  shorelineGeometry,
  landGeometry,
  nearestOnTrack,
} from "./track.js";
import { renderGeometry } from "./fluid/render-geometry.js";
export function buildChunkGeometry({ bounds, paths }) {
  const network = {
    paths: paths.map((p) =>
      Object.assign(
        p.points.map(([x, z]) => ({ x, z })),
        { id: p.id, waterWidth: p.width },
      ),
    ),
    baseWidth: 9,
    gradedFloodplain: true,
    bounds,
    clipBounds: bounds,
  };
  const pack = (g) => {
    const attributes = {};
    for (const [name, a] of Object.entries(g.attributes))
      attributes[name] = { array: a.array, itemSize: a.itemSize };
    const result = { attributes, index: g.index?.array ?? null };
    g.dispose();
    return result;
  };
  const out = { land: pack(landGeometry(network, 10.1)) };
  if (network.paths.length) {
    const g = channelGeometry(network, 9);
    if (g.attributes.position.count) {
      out.water = pack(
        renderGeometry(g, (x, z) => nearestOnTrack(network, x, z), 9, 2.8),
      );
      out.bank = pack(shorelineGeometry(network, 9, 10.1));
    }
    g.dispose();
  }
  return out;
}
