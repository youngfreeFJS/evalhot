// Builds the Vercel deployment (Build Output API v3, .vercel/output) from this repository; Vercel runs it
// as the build command (vercel.json). The client build on the CDN and the functions:
//   index            every other request: the web handler with the api in process (vercel/app.ts)
//   api/cron/worker  only with EVALHOT_VERCEL_WORKER=1 (needs Vercel Pro for a per-minute cron): one
//                    worker run per minute (vercel/worker.ts). By default the worker runs on GitHub
//                    Actions instead (.github/workflows/worker.yml).
// Each function is an esbuild bundle, the packages it loads from disk (native binaries, wasm) traced
// with @vercel/nft, and the files the backend reads at run time (industry pack, assets, seeds).
// On a production build the database is migrated and seeded first (preview builds share the database
// and leave it alone). Locally: node scripts/vercel-build.ts [--db]
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, lstatSync, mkdirSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { build, type BuildOptions } from "esbuild";
import { nodeFileTrace } from "@vercel/nft";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, ".vercel/output");
const BUNDLE = path.join(ROOT, ".vercel/bundle");
/** Next to the database, which sits next to the worker: GitHub-hosted runners are in the US. */
const REGION = process.env.EVALHOT_REGION || "iad1";
const VERCEL_WORKER = process.env.EVALHOT_VERCEL_WORKER === "1";
const WORKER_CRON = process.env.EVALHOT_WORKER_CRON || "* * * * *";

/** Loaded from disk at run time, so never bundled: native addons and packages that read their own wasm. */
const RUNTIME_PACKAGES = ["sharp", "@resvg/resvg-js", "satori", "highs"];
/** Optional requires of bundled packages that are absent on purpose. */
const ABSENT = ["pg-native", "canvas", "bufferutil", "utf-8-validate", "fsevents"];
/** Files the backend reads through REPO_ROOT (packages/backend/src/config.ts). */
const DATA = ["industry", "assets", "reference", "database/seeds"];

function run(command: string, args: string[], env: NodeJS.ProcessEnv = process.env) {
  execFileSync(command, args, { cwd: ROOT, stdio: "inherit", env });
}

// 1. Database.
const onVercel = !!process.env.VERCEL;
const migrate = onVercel ? process.env.VERCEL_ENV === "production" : process.argv.includes("--db");
if (migrate) {
  const env = { ...process.env, DATABASE_URL: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL };
  if (!env.DATABASE_URL) throw new Error("DATABASE_URL is not set: connect a database (Vercel → Storage → Neon) first");
  run(process.execPath, ["scripts/migrate.ts"], env);
  run(process.execPath, ["scripts/seed.ts"], env);
}

// 2. The React Router client and server builds.
run("npm", ["run", "build", "-w", "@aihot/web"]);

// 3. Bundles.
rmSync(OUT, { recursive: true, force: true });
rmSync(BUNDLE, { recursive: true, force: true });
const common: BuildOptions = {
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node24",
  external: [...RUNTIME_PACKAGES, ...ABSENT],
  define: { "process.env.NODE_ENV": '"production"' },
  // CommonJS dependencies inside an ES module bundle still call require and read __dirname.
  banner: {
    js: [
      'import { createRequire as __evalhotRequire } from "node:module";',
      'import { fileURLToPath as __evalhotPath } from "node:url";',
      "const require = __evalhotRequire(import.meta.url);",
      "const __filename = __evalhotPath(import.meta.url);",
      'const __dirname = __filename.slice(0, __filename.lastIndexOf("/"));',
    ].join("\n"),
  },
  outExtension: { ".js": ".mjs" },
  legalComments: "none",
  logLevel: "warning",
};
await build({ ...common, entryPoints: { app: "vercel/app.ts" }, outdir: path.join(BUNDLE, "index") });
if (VERCEL_WORKER) {
  await build({
    ...common,
    entryPoints: { worker: "vercel/worker.ts", "worker-main": "vercel/worker-main.ts", "compute-worker": "packages/backend/src/leaderboard/method/compute-worker.ts" },
    outdir: path.join(BUNDLE, "worker"),
  });
}

// 4. Functions.
function copyInto(dir: string, relative: string) {
  const from = path.join(ROOT, relative);
  const to = path.join(dir, relative);
  mkdirSync(path.dirname(to), { recursive: true });
  cpSync(lstatSync(from).isSymbolicLink() ? realpathSync(from) : from, to, { recursive: true, dereference: true });
}

async function writeFunction(name: string, bundleDir: string, handler: string, settings: { maxDuration: number; memory: number }) {
  const dir = path.join(OUT, "functions", `${name}.func`);
  mkdirSync(dir, { recursive: true });
  cpSync(bundleDir, dir, { recursive: true });
  // The runtime packages and every package they load, as the bundle's imports resolve them. Whole
  // package directories: the wasm and native files they locate at run time (satori → harfbuzzjs's
  // hb.wasm) are not always traceable.
  const bundles = readdirSync(bundleDir).filter((f) => f.endsWith(".mjs")).map((f) => path.join(bundleDir, f));
  const entries = [...bundles, ...RUNTIME_PACKAGES.map((p) => path.join(ROOT, "node_modules", p, "package.json"))].filter(existsSync);
  const { fileList } = await nodeFileTrace(entries, { base: ROOT, processCwd: ROOT });
  const packages = new Set<string>(["@img", "@resvg"].filter((p) => existsSync(path.join(ROOT, "node_modules", p))).map((p) => `node_modules/${p}`));
  for (const file of fileList) {
    const m = /^((?:.+\/)?node_modules\/(?:@[^/]+\/)?[^/]+)\//.exec(file);
    if (m) packages.add(m[1]!);
  }
  for (const p of packages) copyInto(dir, p);
  for (const d of DATA) copyInto(dir, d);
  writeFileSync(path.join(dir, "package.json"), JSON.stringify({ type: "module" }));
  writeFileSync(path.join(dir, ".vc-config.json"), JSON.stringify({
    runtime: "nodejs24.x",
    handler,
    launcherType: "Nodejs",
    shouldAddHelpers: false,
    supportsResponseStreaming: true,
    regions: [REGION],
    // The bundles are built for production (esbuild define); the backend reads it at run time too.
    environment: { NODE_ENV: "production" },
    ...settings,
  }, null, 2));
}

await writeFunction("index", path.join(BUNDLE, "index"), "app.mjs", { maxDuration: 60, memory: 1024 });
if (VERCEL_WORKER) await writeFunction("api/cron/worker", path.join(BUNDLE, "worker"), "worker.mjs", { maxDuration: 300, memory: 1024 });

// 5. The client build on the CDN, and routing.
cpSync(path.join(ROOT, "apps/web/build/client"), path.join(OUT, "static"), { recursive: true });
writeFileSync(path.join(OUT, "config.json"), JSON.stringify({
  version: 3,
  routes: [
    { src: "^/assets/(.*)$", headers: { "Cache-Control": "public, max-age=31536000, immutable" }, continue: true },
    { handle: "filesystem" },
    { src: "^/(.*)$", dest: "/index" },
  ],
  ...(VERCEL_WORKER ? { crons: [{ path: "/api/cron/worker", schedule: WORKER_CRON }] } : {}),
}, null, 2));

rmSync(BUNDLE, { recursive: true, force: true });
console.log(`vercel build: ${path.relative(ROOT, OUT)} (region ${REGION}, worker ${VERCEL_WORKER ? `on a Vercel cron "${WORKER_CRON}"` : "on GitHub Actions"})`);
