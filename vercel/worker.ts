// Vercel cron function (every minute): one run of the worker (apps/worker/src/main.ts) in a child
// process. The run takes new work for RUN_MS, then gets SIGTERM and finishes what it holds: pg-boss stops
// fetching and waits for active jobs (jobs/queue.ts STOP_TIMEOUT_MS), so a paid call in flight completes
// and a job cut short is retried from its receipts. Runs overlap only while one is finishing up. A fresh
// process per run keeps the worker's process-wide state (the queue, the shutdown signal) as it expects.
import { spawn } from "node:child_process";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";

/** How long a run takes new work. */
const RUN_MS = Number(process.env.WORKER_RUN_SECONDS || 50) * 1000;
/** The worker's graceful stop (195 s) plus margin; RUN_MS + DRAIN_MS stays within the function's maxDuration (300 s). */
const DRAIN_MS = 230_000;

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  // Vercel sends the project's CRON_SECRET with every cron request; without one nobody may start a run.
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
    res.statusCode = 401;
    return res.end("unauthorized");
  }
  const started = Date.now();
  const child = spawn(process.execPath, [path.join(import.meta.dirname, "worker-main.mjs")], { env: process.env, stdio: ["ignore", "inherit", "inherit"] });
  const exited = new Promise<number | null>((resolve) => child.once("exit", (code) => resolve(code)));
  const stop = setTimeout(() => child.kill("SIGTERM"), RUN_MS);
  const kill = setTimeout(() => child.kill("SIGKILL"), RUN_MS + DRAIN_MS);
  const code = await exited;
  clearTimeout(stop);
  clearTimeout(kill);
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify({ ok: code === 0, code, ms: Date.now() - started }));
}
