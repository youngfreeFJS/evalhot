# EvalHot

**AI 评测热点站：哪个模型在什么条件下真的更强。**

EvalHot 盯住模型厂商、评测机构、榜单、评测论文和评测工具的动态，用大模型预筛、独立打两次分、写中文标题和摘要，把一个模型的发布、厂商自报成绩和第三方复测归到同一个事件里，每天早上出一份评测日报。另有一个汇总多家公开评测的模型榜。

- **按证据强度选**：第三方、可复现、写明运行条件的成绩排在厂商自报前面；条件不清的“SOTA”、刷榜和营销压下去。
- **一个模型一个事件页**：发布、自报成绩、各家评测方的成绩、复测和争议挂在一起，综述里并列写出不一致的地方。
- **给人看也给 Agent 用**：网页、RSS、公开 API、MCP。

## 基于 AIHOT

EvalHot 基于 [AIHOT 开源框架](https://github.com/KKKKhazix/AIHOT)（MIT 许可）搭建：采集、精选、聚簇、热度、日报和模型榜都来自框架，EvalHot 换掉的是行业包（`industry/`：信源、分类、提示词）并加上了 Vercel 与 GitHub Actions 的部署方式。框架本身的用法见 AIHOT 仓库的 README 和本仓库 `docs/` 里的框架文档。

AIHOT 的名字和 Logo 不在 MIT 许可范围内，本项目不使用它们。

## 文档

| 文档 | 内容 |
|---|---|
| [EvalHot 说明](docs/evalhot.md) | 精选口味、分类、信源、对框架的改动、部署（Vercel + GitHub Actions + Neon） |
| [精选与校准](docs/selection.md) | 一条资料怎么变成精选，怎么用自己的样本校准 |
| [信源](docs/sources.md) | 六种信源怎么配 |
| [架构](docs/architecture.md) | 三个进程、公开读取层、对外出口 |
| [模型榜](docs/leaderboard.md) | 模型榜的数据来源与共识方法 |

## 运行状态

worker 每 10 分钟在 GitHub Actions 上运行一次，最近一次运行记录在 [`.github/worker-version.json`](.github/worker-version.json)。

## 许可

代码使用 [MIT 许可证](LICENSE)，版权说明见 [NOTICE](NOTICE)。字体、模型厂商和评测来源的标志各有自己的许可和商标归属。
