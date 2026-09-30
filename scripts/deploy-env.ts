// Settings and secrets of the production deployment (docs/evalhot.md): the website on Vercel and the
// worker on GitHub Actions, one file for both.
//   node scripts/deploy-env.ts            first run: writes .env.deploy with fresh secrets; fill in the rest
//   node scripts/deploy-env.ts --vercel   uploads to the linked Vercel project (production environment)
//   node scripts/deploy-env.ts --github   uploads the worker's variables as GitHub Actions secrets of this repository
//                                         and enables the worker workflow
// --vercel needs the Vercel CLI, logged in and linked (vercel login, vercel link); --github needs the GitHub
// CLI, logged in (gh auth login). Values go through stdin, never the command line. .env.deploy stays on this
// machine (.gitignore: .env.*).
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseEnv } from "node:util";

const FILE = ".env.deploy";
/** What the worker workflow reads (.github/workflows/worker.yml). */
const WORKER = ["DATABASE_URL", "SITE_URL", "IMG_PROXY_SIGN_SECRET", "LLM_BASE_URL", "LLM_API_KEY", "LLM_MODEL", "LLM_EXTRA_JSON", "DASHSCOPE_API_KEY", "DASHSCOPE_BASE_URL"];
/** On Vercel the Neon integration provides the database variables itself. */
const NOT_ON_VERCEL = ["DATABASE_URL"];
/** The website runs without a model (only the worker calls one), so it can go up before the key is there. */
const REQUIRED = {
  vercel: ["SITE_URL", "ADMIN_PASSWORD", "SESSION_SECRET", "IMG_PROXY_SIGN_SECRET"],
  github: ["SITE_URL", "DATABASE_URL", "IMG_PROXY_SIGN_SECRET", "LLM_API_KEY", "LLM_MODEL"],
};

const target = process.argv.includes("--vercel") ? "vercel" : process.argv.includes("--github") ? "github" : null;

if (!target) {
  if (existsSync(FILE)) {
    console.error(`${FILE} 已经存在，没有覆盖。填好以后运行 node scripts/deploy-env.ts --vercel 和 --github 上传。`);
    process.exit(1);
  }
  const hex = (n: number) => randomBytes(n).toString("hex");
  writeFileSync(FILE, `# EvalHot 生产环境的配置：网页在 Vercel，worker 在 GitHub Actions。
# 填好以后运行 node scripts/deploy-env.ts --vercel 和 node scripts/deploy-env.ts --github 上传。

# ===== 需要你填 =====
# 站点地址：Vercel 项目的生产地址，比如 https://evalhot.vercel.app（链接、RSS、分享图、MCP 都用它）
SITE_URL=
# 数据库：只给 worker 用（Vercel 上由 Neon 集成自动注入，不会上传过去）。留空时 --github 会从已关联的
# Vercel 项目取 Neon 的直连地址（DATABASE_URL_UNPOOLED）。
DATABASE_URL=
# 模型：任何 OpenAI 兼容接口。下面是阿里云百炼的写法；国际站的 key 把域名换成 dashscope-intl.aliyuncs.com
LLM_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
LLM_API_KEY=
# 模型名以控制台为准，例如 qwen3.8-flash
LLM_MODEL=
LLM_EXTRA_JSON={"enable_thinking":false}
# 向量（事件归组）：百炼的 key，默认用 text-embedding-v4；国际站再填 DASHSCOPE_BASE_URL
DASHSCOPE_API_KEY=
DASHSCOPE_BASE_URL=

# ===== 已自动生成 =====
# 管理员密码，登录 /admin 用
ADMIN_PASSWORD=${randomBytes(12).toString("base64url")}
SESSION_SECRET=${hex(32)}
# 网页和 worker 必须一致（图片地址的签名）
IMG_PROXY_SIGN_SECRET=${hex(32)}

# ===== 网页的运行设置 =====
# Vercel 的边缘节点在 X-Forwarded-For 里写访客地址
TRUST_PROXY=true
MODEL_CALLS_ENABLED=true
# 每个函数实例的数据库连接数（Neon 的连接数有上限）
DATABASE_POOL_MAX=5
`, { mode: 0o600 });
  console.log(`已生成 ${FILE}：网页只需要 SITE_URL（填好就能 --vercel 上传）；worker 还要 DATABASE_URL、LLM_API_KEY、LLM_MODEL、DASHSCOPE_API_KEY（填好再 --github）。`);
  process.exit(0);
}

const all = Object.entries(parseEnv(readFileSync(FILE, "utf8")) as Record<string, string>).filter(([, v]) => v.trim() !== "");
// The worker's database address, when not filled in: Neon's direct address from the linked Vercel project.
if (target === "github" && !all.some(([name]) => name === "DATABASE_URL")) {
  const dir = mkdtempSync(path.join(tmpdir(), "evalhot-env-"));
  try {
    execFileSync(process.env.VERCEL_CLI || "vercel", ["env", "pull", path.join(dir, "env"), "--environment=production", "--yes"], { stdio: "ignore" });
    const pulled = parseEnv(readFileSync(path.join(dir, "env"), "utf8")) as Record<string, string>;
    const url = pulled.DATABASE_URL_UNPOOLED || pulled.POSTGRES_URL_NON_POOLING;
    if (url) all.push(["DATABASE_URL", url]);
  } catch {
    // Not linked or not logged in: the check below names what is missing.
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
const missing = REQUIRED[target].filter((k) => !all.some(([name]) => name === k));
if (missing.length) {
  console.error(`${FILE} 里还没填：${missing.join("、")}`);
  process.exit(1);
}

const vars = target === "vercel" ? all.filter(([name]) => !NOT_ON_VERCEL.includes(name)) : all.filter(([name]) => WORKER.includes(name));
for (const [name, value] of vars) {
  if (target === "github") {
    execFileSync("gh", ["secret", "set", name], { input: value, stdio: ["pipe", "ignore", "inherit"] });
    console.log(`+ ${name}`);
    continue;
  }
  const run = (command: "add" | "update") => execFileSync(process.env.VERCEL_CLI || "vercel", ["env", command, name, "production"], { input: value, stdio: ["pipe", "ignore", "pipe"] });
  try {
    run("add");
    console.log(`+ ${name}`);
  } catch {
    // Already there: update it.
    run("update");
    console.log(`~ ${name}`);
  }
}
if (target === "github") {
  // The worker workflow stays disabled until its secrets exist; it runs every 10 minutes from here on.
  execFileSync("gh", ["workflow", "enable", "worker.yml"], { stdio: "inherit" });
  console.log(`已上传 ${vars.length} 个 GitHub Actions secrets，并启用了 worker 工作流（每 10 分钟一次）。`);
} else {
  console.log(`已上传 ${vars.length} 个变量到 Vercel production，重新部署后生效。`);
}
