import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { verifyDeployment } from "../scripts/verify-deployment.mjs";
const sha = "a".repeat(40);
function fixture() {
  const files = new Map([
    ["index.html", "current entry"],
    ["assets/main.js", "world-space-fixed-step"],
    ["assets/main.css", "marine rounded ui"],
    ["fonts/russo.woff2", "russo"],
    ["fonts/chakra500.woff2", "medium"],
    ["fonts/chakra600.woff2", "semibold"],
  ]);
  const info = {
    commit: sha,
    version: "0.22.0",
    identity: "MARINE-87",
    simulation: "world-space-fixed-step",
    campaign: "four-track-1987",
    controls: "analog-input-v1",
    economy: "wallet-v2",
    streaming: "worker-tiles-v1",
    replays: "recorded-world-poses-v1",
    foundation: "portable-data-v1",
    fonts: ["Russo One", "Chakra Petch"],
    assets: [...files].map(([path, text]) => ({
      path,
      bytes: Buffer.byteLength(text),
      sha256: createHash("sha256").update(text).digest("hex"),
    })),
  };
  return {
    files,
    info,
    fetchImpl: async (url) =>
      new Response(
        url.pathname.endsWith("/build-info.json")
          ? JSON.stringify(info)
          : files.get(url.pathname.replace("/Jet-Sprint/", "")),
        { status: 200 },
      ),
  };
}
test("deployment verification reads and hashes actual live HTML, code, styles and fonts", async () => {
  const f = fixture(),
    result = await verifyDeployment("https://example.test/Jet-Sprint/", sha, {
      fetchImpl: f.fetchImpl,
      attempts: 1,
    });
  assert.equal(result.status, "verified");
  assert.equal(result.files, 6);
});
test("deployment verification rejects an old deployment and mismatched live assets", async () => {
  const f = fixture();
  f.info.commit = "old";
  await assert.rejects(
    verifyDeployment("https://example.test/Jet-Sprint/", sha, {
      fetchImpl: f.fetchImpl,
      attempts: 1,
    }),
    /Stale/,
  );
  f.info.commit = sha;
  f.files.set("assets/main.js", "old cached code");
  await assert.rejects(
    verifyDeployment("https://example.test/Jet-Sprint/", sha, {
      fetchImpl: f.fetchImpl,
      attempts: 1,
    }),
    /differs/,
  );
});
