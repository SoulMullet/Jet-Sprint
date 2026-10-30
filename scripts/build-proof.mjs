import { readFile, writeFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join, relative } from "node:path";
const root = "dist",
  pkg = JSON.parse(await readFile("package.json", "utf8")),
  assets = [];
async function visit(directory) {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, item.name);
    if (item.isDirectory()) await visit(path);
    else if (item.name !== "build-info.json") {
      const bytes = await readFile(path);
      assets.push({
        path: relative(root, path).replaceAll("\\", "/"),
        bytes: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      });
    }
  }
}
await visit(root);
assets.sort((a, b) => a.path.localeCompare(b.path));
await writeFile(
  join(root, "build-info.json"),
  JSON.stringify(
    {
      version: pkg.version,
      commit: process.env.GITHUB_SHA || "local",
      identity: "MARINE-87",
      simulation: "world-space-fixed-step",
      campaign: "four-track-1987",
      controls: "analog-input-v1",
      economy: "wallet-v2",
      streaming: "worker-tiles-v1",
      fonts: ["Russo One", "Chakra Petch"],
      assets,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  `Build proof: ${assets.length} files, ${pkg.version}, ${process.env.GITHUB_SHA?.slice(0, 7) || "local"}`,
);
