// Vercel function for every request the CDN does not answer from the client build: the web handler
// (apps/web/handler.ts) with the api (apps/api/src/app.ts) in the same process. The worker runs in its
// own cron function (vercel/worker.ts).
import "./setup-env.ts";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { InjectOptions } from "fastify";
import type { ServerBuild } from "react-router";
import { assertProductionSecrets, config } from "@aihot/backend/config";
import { buildApp } from "../apps/api/src/app.ts";
import { createWebHandler } from "../apps/web/handler.ts";
// @ts-ignore built by react-router before bundling (scripts/vercel-build.ts)
import * as serverBuild from "../apps/web/build/server/index.js";

// The same start-up checks as the api process (apps/api/src/main.ts).
assertProductionSecrets([
  ["auth", "SESSION_SECRET"],
  ["auth", "IMG_PROXY_SIGN_SECRET"],
]);
if (config.environmentName === "production" && !(config.adminPassword && config.adminPassword.length >= 12) && !process.env.FEISHU_LOGIN_APP_ID) {
  throw new Error("Refusing to start in production: set ADMIN_PASSWORD (at least 12 characters) or configure Feishu sign-in");
}

const api = await buildApp();
await api.ready();

// Route loaders read the api over HTTP (apps/web/app/lib/*.server.ts). Here it runs in the same
// function, so requests to its internal address are answered in process, without a network hop.
const INTERNAL = new URL(process.env.API_BASE_URL!).origin;
const nativeFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const request = new Request(input, init);
  const url = new URL(request.url);
  if (url.origin !== INTERNAL) return nativeFetch(input, init);
  const res = await api.inject({
    method: request.method as InjectOptions["method"],
    url: url.pathname + url.search,
    headers: Object.fromEntries(request.headers),
    payload: request.body ? Buffer.from(await request.arrayBuffer()) : undefined,
  });
  const headers = new Headers();
  for (const [name, value] of Object.entries(res.headers)) {
    if (value === undefined) continue;
    for (const v of Array.isArray(value) ? value : [value]) headers.append(name, String(v));
  }
  const empty = request.method === "HEAD" || res.statusCode === 204 || res.statusCode === 304;
  return new Response(empty ? null : new Uint8Array(res.rawPayload), { status: res.statusCode, headers });
};

const web = createWebHandler({
  build: serverBuild as unknown as ServerBuild,
  // The CDN serves the client build (.vercel/output/static).
  clientDir: null,
  // The Vercel edge sets X-Forwarded-For to the visitor's address.
  trustProxy: true,
  api: (req, res) => api.routing(req, res),
});

export default function handler(req: IncomingMessage, res: ServerResponse) {
  web(req, res);
}
