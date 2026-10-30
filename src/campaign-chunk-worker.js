import { buildChunkGeometry } from "./campaign-chunk-geometry.js";
self.onmessage = ({ data }) => {
  try {
    const result = buildChunkGeometry(data),
      transfer = [];
    for (const mesh of Object.values(result)) {
      for (const a of Object.values(mesh.attributes))
        transfer.push(a.array.buffer);
      if (mesh.index) transfer.push(mesh.index.buffer);
    }
    self.postMessage({ id: data.id, result }, transfer);
  } catch (error) {
    self.postMessage({ id: data.id, error: String(error.message || error) });
  }
};
