// The worker process of one cron run (vercel/worker.ts starts it and stops it with SIGTERM).
import "./setup-env.ts";
import "../apps/worker/src/main.ts";
