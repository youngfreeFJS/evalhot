// Production web server: built client assets, the shared redirect table and SSR (handler.ts). Api-owned
// paths are proxied to the api process, so one port serves the whole site; a reverse proxy in front may
// also send them to the api directly.
import { createServer, request as httpRequest } from "node:http";
import path from "node:path";
import { createWebHandler } from "./handler.ts";

const PORT = Number(process.env.WEB_PORT || process.env.PORT || 3000);
const HOST = process.env.WEB_HOST || "127.0.0.1";
const API = new URL(process.env.API_BASE_URL || "http://127.0.0.1:3001");

const build = await import(path.resolve(import.meta.dirname, "build/server/index.js"));

const handler = createWebHandler({
  build,
  clientDir: path.resolve(import.meta.dirname, "build/client"),
  trustProxy: process.env.TRUST_PROXY === "true",
  api: (req, res) => {
    const upstream = httpRequest({ hostname: API.hostname, port: API.port, path: req.url ?? "/", method: req.method, headers: req.headers }, (up) => {
      res.writeHead(up.statusCode ?? 502, up.headers);
      up.pipe(res);
    });
    upstream.on("error", () => {
      res.statusCode = 502;
      res.end("api unavailable");
    });
    req.pipe(upstream);
  },
});

const server = createServer(handler);

process.on("unhandledRejection", (reason) => {
  console.error(JSON.stringify({ level: "error", msg: "unhandled rejection", error: String(reason).slice(0, 500) }));
});

server.keepAliveTimeout = 65_000;
server.listen(PORT, HOST, () => console.log(JSON.stringify({ level: "info", msg: "web started", port: (server.address() as import("node:net").AddressInfo).port, pid: process.pid })));

const shutdown = () => server.close(() => process.exit(0));
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
