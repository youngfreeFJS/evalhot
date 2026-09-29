// The web request handler shared by the production server (server.ts) and bundled deployments
// (vercel/): the shared redirect table, built client assets, api-owned path routing and SSR with the
// site's cache policy. How an api-owned request reaches the api is the caller's choice.
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import type { IncomingMessage, ServerResponse, OutgoingHttpHeaders } from "node:http";
import path from "node:path";
import { createRequestListener } from "@react-router/node";
import type { ServerBuild } from "react-router";
import { isApiOwned, resolveRedirect } from "@aihot/contracts/http-policy";

export interface WebHandlerOptions {
  build: ServerBuild;
  /** Built client assets; null when something in front (a CDN) serves them. */
  clientDir: string | null;
  /**
   * Whether a reverse proxy in front (Caddy, nginx, the Vercel edge) records the visitor in
   * X-Forwarded-For. Without one the header is never believed: a visitor could name any address and
   * slip past the api's per-visitor limits (sign-in attempts, feedback).
   */
  trustProxy: boolean;
  /** Serves an api-owned request; x-forwarded-for and x-real-ip already carry the visitor's address. */
  api: (req: IncomingMessage, res: ServerResponse) => void;
}

/** Browsers keep a page at most this long, so a withdrawal reaches them within minutes. */
const BROWSER_MAX_SECONDS = 300;

const TYPES: Record<string, string> = {
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".json": "application/json",
  ".txt": "text/plain; charset=utf-8",
  ".ico": "image/x-icon",
  ".map": "application/json",
};

class BadRequest extends Error {}

/** Hashed build assets are immutable; anything else from the client build gets a short cache. */
async function serveStatic(clientDir: string, pathname: string, res: ServerResponse): Promise<boolean> {
  if (pathname.includes("..") || pathname.endsWith("/")) return false;
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    throw new BadRequest("malformed percent-encoding");
  }
  const file = path.join(clientDir, decoded);
  if (!file.startsWith(clientDir)) return false;
  const info = await stat(file).catch(() => null);
  if (!info?.isFile()) return false;
  const immutable = pathname.startsWith("/assets/");
  res.writeHead(200, {
    "Content-Type": TYPES[path.extname(file)] ?? "application/octet-stream",
    "Content-Length": info.size,
    "Cache-Control": immutable ? "public, max-age=31536000, immutable" : "public, max-age=3600",
    "X-Content-Type-Options": "nosniff",
  });
  createReadStream(file).pipe(res);
  return true;
}

/** Public navigation returns all matched loaders, so `_routes` never changes a cached answer. */
function pageCache(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? "/", "http://web.local");
  const pathname = decodeURIComponent(url.pathname).replace(/\.data$/, "");
  const publicRead = (req.method === "GET" || req.method === "HEAD") && !/^\/admin(?:\/|$)/i.test(pathname);
  if (publicRead && url.pathname.endsWith(".data")) {
    url.searchParams.delete("_routes");
    req.url = url.pathname + url.search;
  }

  // React Router uses the same route headers for HTML and single-fetch data. Apply the final
  // status here: a route's successful cache policy must never cache its error or action result.
  const writeHead = res.writeHead.bind(res);
  res.writeHead = ((status: number, messageOrHeaders?: string | OutgoingHttpHeaders, headers?: OutgoingHttpHeaders) => {
    const outgoing = typeof messageOrHeaders === "string" ? headers : messageOrHeaders;
    for (const [name, value] of Object.entries(outgoing ?? {})) if (value !== undefined) res.setHeader(name, value);
    const cc = String(res.getHeader("Cache-Control") ?? "");
    if (!publicRead || status !== 200 || res.hasHeader("Set-Cookie") || !cc || /(?:private|no-store)/i.test(cc)) {
      res.removeHeader("Expires");
      res.setHeader("Cache-Control", "private, no-store");
      res.setHeader("X-Accel-Expires", "0");
    } else {
      const now = new Date();
      const nowSeconds = Math.floor(now.getTime() / 1000);
      const sharedSeconds = Number(cc.match(/(?:^|,)\s*s-maxage=(\d+)/i)?.[1] ?? 0);
      const expires = String(res.getHeader("X-Accel-Expires") ?? `@${nowSeconds + sharedSeconds}`);
      // A sibling loader may have delayed this response after the selected loader set its TTL.
      const seconds = /(?:^|,)\s*no-cache(?:,|$)/i.test(cc) || expires === "0" ? 0
        : Math.max(0, Math.min(sharedSeconds, Number(expires.slice(1)) - nowSeconds));
      res.setHeader("Date", now.toUTCString());
      res.setHeader("X-Accel-Expires", seconds > 0 ? expires : "0");
      // Reuse intent-prefetched data in the browser within the same shared-cache deadline (capped).
      // Never serve it beyond that deadline, including while revalidating or on an error.
      const directives = cc.split(",").map((value) => value.trim()).filter((value) => !/^(?:max-age|s-maxage|stale-while-revalidate|stale-if-error|must-revalidate)(?:=|$)/i.test(value));
      res.setHeader("Cache-Control", seconds > 0
        ? `${directives.join(", ")}, max-age=${Math.min(seconds, BROWSER_MAX_SECONDS)}, s-maxage=${seconds}, must-revalidate`
        : "no-cache");
    }
    return typeof messageOrHeaders === "string" ? writeHead(status, messageOrHeaders) : writeHead(status);
  }) as typeof res.writeHead;
}

export function createWebHandler(opts: WebHandlerOptions): (req: IncomingMessage, res: ServerResponse) => void {
  const ssr = createRequestListener({ build: opts.build, mode: "production" });

  async function handle(req: IncomingMessage, res: ServerResponse) {
    const raw = req.url ?? "/";
    const qi = raw.indexOf("?");
    const pathname = qi >= 0 ? raw.slice(0, qi) : raw;
    const search = qi >= 0 ? raw.slice(qi) : "";

    const decision = resolveRedirect(pathname, search);
    if (decision) {
      for (const [k, v] of Object.entries(decision.headers)) res.setHeader(k, v);
      if (decision.location) res.setHeader("Location", decision.location);
      res.statusCode = decision.status;
      return res.end(decision.location ? undefined : decision.status === 410 ? "Gone" : "Not found");
    }

    if (isApiOwned(pathname)) {
      // The visitor's address, decided here: the one the trusted proxy saw (the last X-Forwarded-For
      // entry), or this connection's own. Both headers carry only that.
      const forwarded = String(req.headers["x-forwarded-for"] ?? "").split(",").map((v) => v.trim()).filter(Boolean);
      const client = opts.trustProxy && forwarded.length ? forwarded[forwarded.length - 1]! : (req.socket.remoteAddress ?? "");
      req.headers["x-forwarded-for"] = client;
      req.headers["x-real-ip"] = client;
      return opts.api(req, res);
    }

    if (opts.clientDir && (req.method === "GET" || req.method === "HEAD") && pathname.includes(".") && (await serveStatic(opts.clientDir, pathname, res))) return;
    pageCache(req, res);
    return ssr(req, res);
  }

  // One bad request must never take the process down: answer it and keep serving.
  return (req, res) => {
    handle(req, res).catch((error: unknown) => {
      const bad = error instanceof BadRequest || error instanceof URIError;
      if (!bad) console.error(JSON.stringify({ level: "error", msg: "web request failed", path: (req.url ?? "").split("?")[0]!.slice(0, 200), error: String(error).slice(0, 500) }));
      if (res.headersSent) return res.destroy();
      res.writeHead(bad ? 400 : 500, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
      res.end(bad ? "Bad request" : "Internal error");
    });
  };
}
