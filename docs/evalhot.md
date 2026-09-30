# EvalHot

EvalHot 是用 [AIHOT 开源框架](https://github.com/KKKKhazix/AIHOT) 搭的 AI 评测热点站：盯住模型厂商、评测机构、榜单、评测论文和评测工具，把一个模型的发布、自报成绩和第三方复测归到同一个事件里，每天早上出一份评测日报。

这份文档记录 EvalHot 相对框架做了哪些改动、为什么这样改、怎么部署、还有哪些事没做。框架本身的用法见 AIHOT 仓库的 README 和 `docs/` 里的其他文档。

## 仓库与同步

- remote `upstream` 指向 AIHOT，框架更新用 `git fetch upstream && git merge upstream/main` 合进来。
- 行业相关的改动都在 `industry/`；框架代码只动了几处（见“框架代码改动”），合并上游时冲突会很少。

## 读者与精选口味

读者是做模型评测、模型选型和前沿跟踪的工程师、产品经理与研究者。他们关心“哪个模型在什么条件下真的更强、这个结论有多可信”。

评分标准（`industry/prompts/selection-score.md`）保留了框架的结构（内容类型 × 五维加权 × 噪声上限），改的是“什么重要、什么是噪声”：

- **8 种内容类型**：模型发布、第三方评测结果、新基准、评测方法、评测工具、其他论文、行业事件、观点。每种类型五个维度的权重不同，第三方评测结果的证据强度（`cred`）权重最高。
- **`cred` 按证据强度分档**：第三方且写明运行条件并公开数据 → 第三方但条件不全 → 厂商自报且条件写清 → 厂商自报且条件不清 → 个人体感、泄露、传闻。
- **必须正常评价**：前沿模型发布、第三方首批成绩、榜单头部变化、自报与复测的差距、抗污染的新基准、评测失效的证据、可复用的评测方法和工具、中文与专业任务评测。
- **必须压住**：条件不清的自报 SOTA、挑选对比对象、靠推理档位或多次采样刷出的纪录、榜单中游波动、例行小版本、个人体感、预告与泄露、营销、辅助小模型、没有可比评测的应用案例。
- **知识截止**：预筛、评分、内容理解三份提示词都明确告诉模型“不认识的新模型只说明它比你新”。试调时有模型把真实的 Claude Sonnet 5.5 发布判成了虚构，这一条是为此加的。

门槛（`industry/selection.ts`）沿用 AIHOT 的 T1 60 / T1_5 65 / T2 76，没有另外校准；上线后按实际错例调整提示词。

## 分类、标签与主题

- 类别（`industry/taxonomy.ts`）：`models` 模型、`results` 评测结果、`benchmarks` 基准、`methods` 方法、`tools` 工具、`industry` 行业。key 会出现在网址和接口里，上线后不要改。
- 分类标签 13 个，能力方向标签 16 个，实体标签是模型厂商和评测机构（LMArena、Artificial Analysis、Epoch AI、METR 等）。
- 主题（`industry/topics.json`）44 个，分“厂商与评测机构 / 能力方向 / 内容形态”三组。

## 聚簇

`industry/prompts/group-definitions.md` 加了评测相关的规则：

- 同一个评测方对同一个模型的同一轮成绩，是同一次发生。
- 不同评测方对同一个模型的成绩不合并，它们各自都是这个模型发布的后续进展（SAME_STORY），都会挂到发布事件下。
- 一次榜单更新同时列出多个模型、没有单一焦点时，按盘点处理。

效果是：一个模型发布事件的页面，就是这个模型的评测证据汇总。事件综述（`story-digest.md`）按“厂商自报 → 第三方成绩 → 复测与争议”组织，自报和第三方不一致时并列写出。

## 信源

`industry/sources.json` 里 27 个信源，网址都在 2026-09-29 用框架自己的抓取器实际试抓过：

| 分组 | 信源 | 说明 |
|---|---|---|
| 模型厂商（T1） | OpenAI、Anthropic、Google DeepMind、Google AI、Mistral、HF Blog | Anthropic 没有 RSS，用网页列表；选择器同时抓列表项和顶部置顶区（模型发布在置顶区，链接是 `/claude-*`） |
| 开放权重（T1） | Hugging Face 上 DeepSeek、Qwen、Kimi、智谱、MiniMax 的新模型仓库 | 读 HF 接口，发布时间用 `lastModified`（仓库常常先私有建好，`createdAt` 会早于真正发布）；标题里带量化后缀的变体过滤掉 |
| 评测机构（T1） | Epoch AI、METR、Stanford CRFM（HELM） | METR 的 RSS 约 9MB，超过框架 8MB 上限，改抓博客列表页 |
| 论文（T1_5） | arXiv cs.CL 评测与基准检索、HF Daily Papers | HF Daily Papers 的摘要直接当正文；arXiv 条目会抓摘要页 |
| 评测工具（T1） | lm-evaluation-harness、Inspect、OpenCompass、HELM、SWE-bench 的 GitHub Releases | Atom 格式：版本说明超过 280 字直接当正文；更短的（多是例行补丁）会先试抓页面，失败 3 次后按摘要判断 |
| 媒体与个人（T2） | Interconnects、Import AI、Latent Space、Simon Willison、量子位 | |
| 聚合（T2） | AIHOT 全部动态（`aihot.news/api/v1/items?mode=all`） | 见下文；X 上的评测账号（Arena、Artificial Analysis 等）也通过它间接拿到，不单独接 SocialData |

### AIHOT 作为信源

- 用 `mode=all`，不用精选：AIHOT 的精选口味面向普通 AI 读者，会压低评测和基准内容（2026-09-29 抽查，模型分类精选率约 14%，论文约 12%）。
- 网址取原文链接（`links.original`），和直接抓到的同一篇自然判重；`signal_group_id = aihot`，热度里只算一个参与者。
- 使用范围见 [aihot.news 使用规则](https://aihot.news/terms)。

## 框架代码改动

| 文件 | 改动 |
|---|---|
| `scripts/seed.ts` | 支持 `sources.json` 里的 `signal_group_id` |
| `packages/backend/src/publication/items.ts`、`apps/api/src/routes/v1.ts` | 去掉写死的 AIHOT 分类 `tip` / `opinion` |
| `apps/web/app/features/report/format.ts`、`ReportPaper.tsx`、`routes/report-latest.tsx`、`routes/hot.tsx`、`routes/topics.tsx` | 写死的“AI”文案改成跟随行业词 |
| `tests/*.test.ts` | 测试用例里的分类和提示词开头换成 EvalHot 的 |
| `packages/backend/src/config.ts` | `REPO_ROOT` 可以用 `AIHOT_REPO_ROOT` 指定（打包部署时文件和代码不在原来的相对位置） |
| `packages/backend/src/leaderboard/method/compute.ts` | 模型榜计算线程的脚本可以用 `AIHOT_LB_WORKER_FILE` 指定（打包部署时是单独的 `.mjs`） |
| `apps/web/server.ts` → `apps/web/handler.ts` | 请求处理逻辑（重定向、静态文件、缓存头、api 路径分流、SSR）原样抽成共用模块，自建服务器和 Vercel 函数都用它 |
| `apps/worker/src/schedules.ts` | `SCHEDULE_MISSED=once`：worker 间歇运行时，停机期间错过的定时任务在下次启动时补跑一次 |

## 部署：Vercel + GitHub Actions + Neon

### 结构

框架原本是三个常驻进程（api、worker、web）加 PostgreSQL。现在拆成：

| 放在哪 | 做什么 | 代码 |
|---|---|---|
| Vercel 函数 `index` | 所有页面和接口：网页处理逻辑和 api 在同一个进程里。页面数据加载原本经 HTTP 调 api，这里拦截发往内部地址的 `fetch`，直接交给 Fastify 处理 | `vercel/app.ts`、`vercel/setup-env.ts` |
| Vercel CDN | 网页的客户端构建（`/assets/*`） | |
| GitHub Actions | worker：每 10 分钟启动一次，先跑数据库迁移（已应用的跳过），worker 领 6 分钟新任务，然后收到 SIGTERM，停止领新任务、最多用 195 秒收尾（付费调用不会被掐断）；最后把这一轮写进 `.github/worker-version.json` 并提交 | `.github/workflows/worker.yml` |
| Neon | PostgreSQL，经 Vercel 集成接入，用直连地址（`DATABASE_URL_UNPOOLED`） | |

几个细节：

- **定时任务补跑**：worker 只有一部分时间在跑，GitHub 的定时任务也可能延迟或被丢弃。`SCHEDULE_MISSED=once` 让停机期间错过的定时任务（日报、热度快照等）在下次启动时各补跑一次，不会重复跑多次。
- **版本号文件**：每轮都提交，公开仓库因此一直有活动，GitHub 不会因为 60 天没有活动而停掉定时任务。这些提交用 `GITHUB_TOKEN` 推送，不会再触发别的工作流；`vercel.json` 的 `ignoreCommand` 让 Vercel 跳过只改了这个文件的提交，不会每 10 分钟部署一次。
- **区域**：GitHub 的托管机器在美国，worker 和数据库之间的查询非常频繁，所以 Neon 选美国东部（N. Virginia），Vercel 函数也放 `iad1`。页面走 CDN 缓存，国内访问受的影响不大。想换区域设 `EVALHOT_REGION`。
- **想换回 Vercel 定时任务**（需要 Vercel Pro）：构建时设 `EVALHOT_VERCEL_WORKER=1`，会多生成一个每分钟触发的 worker 函数（`vercel/worker.ts`），还要在 Vercel 上设 `CRON_SECRET`；同时停用 GitHub 上的 worker 工作流。

### 构建

构建命令是 `node scripts/vercel-build.ts`（`vercel.json`），它直接产出 Vercel 的 Build Output（`.vercel/output`），不依赖 Vercel 对框架的自动识别：

1. 生产构建时先跑数据库迁移和种子数据（预览构建不动数据库）。
2. 构建网页。
3. 用 esbuild 把函数打成单文件；`sharp`、`@resvg/resvg-js`、`satori`、`highs` 这类运行时要读原生二进制或 wasm 的包不打包，用 `@vercel/nft` 追踪后整包复制进函数目录。
4. 把运行时要读的文件（`industry/`、`assets/`、`reference/`、`database/seeds/`）复制进函数目录。

本地验证构建产物：`node scripts/vercel-build.ts` 之后，写一个小服务器加载 `.vercel/output/functions/index.func/app.mjs`，静态文件从 `.vercel/output/static` 提供，就能模拟 Vercel 访问。

### 步骤

1. 在 Vercel 导入这个 GitHub 仓库：Application Preset 选 **Other**（Vercel 会因为看到 `apps/api` 和 `apps/web` 推荐 Services 多服务模式，不要选），Root Directory 保持 `./`，构建和安装命令沿用 `vercel.json`。推送到默认分支就会自动部署。第一次部署会因为还没接数据库而失败，接好 Neon 后重新部署即可。
2. Vercel 项目 → Storage → 创建 Neon 数据库，区域选 **US East (N. Virginia)**，连接到这个项目。
3. 生成并填写配置，分别上传到 Vercel 和 GitHub。网页不需要模型，填好 `SITE_URL` 就能先上传 `--vercel`；worker 还要数据库地址和模型 key，齐了再上传 `--github`：

   ```bash
   node scripts/deploy-env.ts            # 生成 .env.deploy（只在本机，已被 gitignore）
   node scripts/deploy-env.ts --vercel   # 需要 vercel login、vercel link
   node scripts/deploy-env.ts --github   # 需要 gh auth login
   ```

4. 在 Vercel 上重新部署一次，让环境变量生效；构建时会迁移数据库并导入信源。
5. worker 工作流在 secrets 上传之前是停用的，`--github` 上传完会自动启用它。到 GitHub 仓库的 Actions 页面手动运行一次 Worker，确认能跑通；之后它每 10 分钟自己运行。

### 限制

- 函数里只有 `/tmp` 可写，而且实例回收后就没了：图片缓存、分享图缓存无所谓（CDN 也会缓存），但**后台上传的二维码和反馈截图不会长期保存**。需要的话以后改存 Vercel Blob。
- 数据库每天备份（`DB_BACKUP_STORE_*`）要调用 `pg_dump`，在 Vercel 和 Actions 上都不配置；改用 Neon 自带的时间点恢复。
- worker 每 10 分钟跑一次，内容从抓到入选会慢几分钟到十几分钟；GitHub 高峰期还会更晚。
- 后台的“worker 心跳”告警会因为 worker 间歇运行而误报，看的时候注意。
- 注意 Vercel、Neon、GitHub Actions 各自的免费额度和使用条款。

## 本机运行

需要 Node.js 24 和 PostgreSQL（16 或 17）。

```bash
node --env-file=.env apps/api/src/main.ts                   # 接口，3001
node --env-file=.env apps/worker/src/main.ts                # 采集、模型处理、定时任务
node --env-file=.env node_modules/@react-router/dev/bin.cjs dev apps/web --port 3000 --host 127.0.0.1   # 网页，3000
```

如果所在网络会拦截部分海外信源，在 `.env` 里设 `EGRESS_PROXY_URL`，抓信源时走代理（模型调用不走）。

## 还没做的

1. **门槛校准**：从信源里挑 100–200 条标注“该选 / 不该选”，存到 `.data/gold.jsonl`，用 `scripts/eval-selection.ts` 跑，在后台 SelectBench 里看错例，先改评分标准再动门槛（见 `docs/selection.md`）。
2. **向量阈值**：聚簇的余弦阈值（召回 0.6、免复核 0.85、讨论帖 0.72 / 0.92，见 `packages/backend/src/events/group.ts`）是 AIHOT 在它自己的 embedding 模型上调的。换了 embedding 模型，要用一批真实的“同一事件 / 不同事件”报道对核对一次。
3. **正文抓取兜底**：OpenAI 官网等页面直接抓不到正文，现在按订阅摘要判断。需要时配 `JINA_API_KEY`（按次计费）。
4. **模型榜的 Artificial Analysis 一项**没有 key，不参与排名；它的份额空着，不转给别的评测，所以综合榜会和 AIHOT 的不一样。
5. **使用规则与隐私说明**（`industry/pages/`）还是框架模板，对外之前要按实际情况改写。
6. 可选增强：榜单快照变化自动生成条目；结构化抽取“模型、基准、分数、运行条件”四元组，积累评测证据库。
