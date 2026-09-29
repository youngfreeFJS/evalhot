// First import of every bundled Vercel entry (scripts/vercel-build.ts copies the industry pack, assets
// and seeds next to the bundle). It runs before any backend module reads its configuration.
import path from "node:path";

const here = import.meta.dirname;

// Files the backend reads at run time, and the only writable place in a function.
process.env.AIHOT_REPO_ROOT ||= here;
process.env.AIHOT_DATA_DIR ||= "/tmp/evalhot-data";
// The leaderboard computation thread ships as its own file (packages/backend/src/leaderboard/method/compute.ts).
process.env.AIHOT_LB_WORKER_FILE ||= path.join(here, "compute-worker.mjs");
// Route loaders read the api at this address; vercel/app.ts answers it in process.
process.env.API_BASE_URL ||= "http://api.internal";
// Neon: prepared statements and the jit startup parameter (packages/backend/src/db.ts) need a direct
// connection; the pooled address goes through PgBouncer.
if (process.env.DATABASE_URL_UNPOOLED) process.env.DATABASE_URL = process.env.DATABASE_URL_UNPOOLED;
