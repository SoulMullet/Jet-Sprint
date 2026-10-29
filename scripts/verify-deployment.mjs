import { createHash } from "node:crypto";
import { appendFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
export async function verifyDeployment(
  baseURL,
  expectedCommit,
  {
    fetchImpl = fetch,
    attempts = 10,
    pause = (ms) => new Promise((r) => setTimeout(r, ms)),
  } = {},
) {
  const base = new URL(baseURL.endsWith("/") ? baseURL : baseURL + "/");
  if (!["http:", "https:"].includes(base.protocol))
    throw Error("Expected an HTTP deployment URL.");
  let failure;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const manifestURL = new URL("build-info.json", base);
      manifestURL.searchParams.set("verify", expectedCommit);
      manifestURL.searchParams.set("attempt", attempt);
      const response = await fetchImpl(manifestURL, {
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw Error(`Build proof HTTP ${response.status}`);
      const info = await response.json();
      if (info.commit !== expectedCommit)
        throw Error(`Stale deployed commit: ${info.commit}`);
      if (
        info.identity !== "MARINE-87" ||
        info.simulation !== "world-space-fixed-step"
      )
        throw Error("Wrong live interface or simulation identity.");
      if (
        !info.fonts?.includes("Russo One") ||
        !info.fonts?.includes("Chakra Petch")
      )
        throw Error("Wrong deployed font families.");
      const paths = info.assets?.map((a) => a.path) || [];
      if (
        !paths.includes("index.html") ||
        !paths.some((p) => p.endsWith(".js")) ||
        !paths.some((p) => p.endsWith(".css")) ||
        paths.filter((p) => p.endsWith(".woff2")).length !== 3
      )
        throw Error("Incomplete deployed assets.");
      await Promise.all(
        info.assets.map(async (asset) => {
          const url = new URL(asset.path, base);
          if (
            url.origin !== base.origin ||
            !url.pathname.startsWith(base.pathname)
          )
            throw Error("Asset outside deployment.");
          url.searchParams.set("verify", expectedCommit);
          const r = await fetchImpl(url, {
            cache: "no-store",
            signal: AbortSignal.timeout(15000),
          });
          if (!r.ok) throw Error(`${asset.path}: HTTP ${r.status}`);
          const bytes = new Uint8Array(await r.arrayBuffer());
          if (bytes.length !== asset.bytes || digest(bytes) !== asset.sha256)
            throw Error(
              `${asset.path}: live content differs from published build proof`,
            );
        }),
      );
      return {
        status: "verified",
        commit: info.commit,
        version: info.version,
        files: info.assets.length,
        identity: info.identity,
        simulation: info.simulation,
      };
    } catch (error) {
      failure = error;
      if (attempt + 1 < attempts) await pause(2000);
    }
  }
  throw failure;
}
if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  const result = await verifyDeployment(
    process.env.PAGES_URL || process.argv[2],
    process.env.EXPECTED_COMMIT || process.argv[3],
  );
  console.log(JSON.stringify(result, null, 2));
  if (process.env.GITHUB_STEP_SUMMARY)
    await appendFile(
      process.env.GITHUB_STEP_SUMMARY,
      `## Published build verified\n\nCommit: \`${result.commit}\`\n\n${result.files} actual live files fetched and SHA-256 verified, including HTML, JavaScript, CSS and all three font files.\n\nIdentity: ${result.identity}; simulation: ${result.simulation}.\n`,
    );
}
