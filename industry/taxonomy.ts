// 这个行业的分类体系：类别、标签词表、公司（主体）名录，以及防止张冠李戴的身份词典。
// 模型按这里的词表打标签，主题页（topics.json）按标签归类，筛选栏按类别分组。
// 换行业时：类别的 key 会出现在网址里（/all?category=…），上线后就不要再改；标签和名录可以随时增减。
//
// EvalHot：围绕“一个模型到底有多强”组织：模型发布 → 评测结果与榜单 → 基准与方法 → 工具与实践 → 行业与观点。

/**
 * 网页上的类别（筛选栏、卡片角标、RSS 分类订阅）。key 是网址和接口里的身份，上线后不要改。
 * section 是日报里的分节标题（几个类别可以共用一节，按这里的顺序排）；guide 告诉模型怎么归类。
 * 没归上类的资料在日报里放进第一个 key 为 industry 的类别所在的节（没有就放最后一节）。
 */
export const CATEGORIES = [
  { key: "models", label: "模型", section: "前沿模型", guide: "新模型、模型版本、开放权重的发布与更新，以及厂商随发布公布的能力、价格、上下文和自报成绩" },
  { key: "results", label: "评测结果", section: "评测结果与榜单", guide: "第三方评测成绩、榜单名次变化、独立复测、实测对比和评测报告；评测方不是模型厂商本身" },
  { key: "benchmarks", label: "基准", section: "基准与方法", guide: "新 benchmark、数据集、评测任务的发布与版本更新" },
  { key: "methods", label: "方法", section: "基准与方法", guide: "评测方法与协议、数据污染、裁判偏差、刷榜、基准饱和与失效的研究和讨论" },
  { key: "tools", label: "工具", section: "工具与实践", guide: "评测框架、harness、评测平台与服务的发布更新，以及做评测的实践经验与教程" },
  { key: "industry", label: "行业", section: "行业与观点", guide: "评测机构与榜单运营方的动态、标准与监管、融资与人事，以及关于评测和模型能力的观点与趋势" },
] as const;

/**
 * 内容理解一步给每篇资料判的“内容类型”（写在 prompts/content-understanding.md 里，改了类型要同步改那份提示词）。
 * 评分提示词（prompts/selection-score.md）按类型给五个维度不同的权重。
 */
export const ITEM_TYPES = [
  "model_release", "eval_result", "benchmark_release", "eval_method", "eval_tooling", "research_paper", "industry_event", "opinion_analysis",
] as const;

// ── 标签词表 ────────────────────────────────────────────────────────────────────────────

/** 每篇资料的第一个标签必须是这些“分类标签”之一。最后一个是兜底。 */
export const CATEGORY_TAGS = [
  "模型发布", "评测结果", "榜单变化", "新基准/数据集", "评测方法", "污染/刷榜", "评测工具", "实践/教程", "论文/研究", "行业动态", "标准/监管", "观点/趋势",
  "其他",
] as const;

/** 可选的主题标签：被评测的能力方向。 */
export const TOPIC_TAGS = [
  "编码", "Agent", "推理", "数学", "知识/事实性", "长上下文", "多模态", "语音", "中文/多语言", "工具调用", "指令遵循", "写作", "安全评测", "成本/效率",
  "人类偏好", "开源模型",
] as const;

/** 可选的实体标签：模型厂商与评测机构。 */
export const ENTITY_TAGS = [
  "OpenAI", "Anthropic", "Google", "DeepSeek", "Meta", "xAI", "Qwen", "Mistral", "LMArena", "Artificial Analysis", "Epoch AI", "METR", "Hugging Face", "arXiv",
] as const;

/** 模型常写的近义词，统一成词表里的写法。 */
export const TAG_SYNONYMS: Readonly<Record<string, string>> = {
  发布: "模型发布", 模型: "模型发布", 新模型: "模型发布", 开源权重: "模型发布",
  评测: "评测结果", 测评: "评测结果", 复测: "评测结果", 实测: "评测结果", 评估: "评测结果", "评测/基准": "评测结果", 对比: "评测结果",
  榜单: "榜单变化", 排行榜: "榜单变化", 排名: "榜单变化", leaderboard: "榜单变化", arena: "榜单变化",
  基准: "新基准/数据集", 数据集: "新基准/数据集", benchmark: "新基准/数据集", 新基准: "新基准/数据集",
  方法: "评测方法", 评测协议: "评测方法", 方法论: "评测方法", 裁判: "评测方法", "llm-as-judge": "评测方法",
  污染: "污染/刷榜", 数据污染: "污染/刷榜", 刷榜: "污染/刷榜", 刷分: "污染/刷榜", contamination: "污染/刷榜",
  工具: "评测工具", harness: "评测工具", 框架: "评测工具", 平台: "评测工具", "开源/仓库": "评测工具",
  教程: "实践/教程", 实践: "实践/教程", 指南: "实践/教程", 最佳实践: "实践/教程", "教程/实践": "实践/教程",
  论文: "论文/研究", 研究: "论文/研究", paper: "论文/研究", papers: "论文/研究",
  行业: "行业动态", 融资: "行业动态", 收购: "行业动态", 人事: "行业动态", 合作: "行业动态", 公司动态: "行业动态",
  政策: "标准/监管", 监管: "标准/监管", 标准: "标准/监管", 法规: "标准/监管", "政策/监管": "标准/监管",
  观点: "观点/趋势", 趋势: "观点/趋势", 现象: "观点/趋势", 大佬观点: "观点/趋势", "现象/趋势": "观点/趋势",
  代码: "编码", coding: "编码", 智能体: "Agent", agent: "Agent", 事实性: "知识/事实性", 幻觉: "知识/事实性", 知识: "知识/事实性",
  中文: "中文/多语言", 多语言: "中文/多语言", 视觉: "多模态", 图像: "多模态", 视频: "多模态", 函数调用: "工具调用", "MCP/工具调用": "工具调用",
  安全: "安全评测", 红队: "安全评测", 成本: "成本/效率", 价格: "成本/效率", 速度: "成本/效率", 偏好: "人类偏好", 开源: "开源模型", 开源生态: "开源模型",
};

/** 模型漏了分类标签时，按内容类型补一个。 */
export const CATEGORY_BY_ITEM_TYPE: Readonly<Record<string, string>> = {
  model_release: "模型发布", eval_result: "评测结果", benchmark_release: "新基准/数据集", eval_method: "评测方法", eval_tooling: "评测工具",
  research_paper: "论文/研究", industry_event: "行业动态", opinion_analysis: "观点/趋势",
};

// ── 公司与主体 ──────────────────────────────────────────────────────────────────────────

/** 公司主题：id → 显示名、卡片上显示的标签（null 表示只用 entity:<id> 归类）、别名。 */
export const ENTITIES: Record<string, { name: string; displayTag: string | null; aliases: string[] }> = {
  openai: { name: "OpenAI", displayTag: "OpenAI", aliases: ["OpenAI", "ChatGPT", "GPT", "Codex"] },
  anthropic: { name: "Anthropic", displayTag: "Anthropic", aliases: ["Anthropic", "Claude"] },
  google: { name: "Google", displayTag: "Google", aliases: ["Google", "DeepMind", "Gemini", "谷歌"] },
  deepseek: { name: "DeepSeek", displayTag: "DeepSeek", aliases: ["DeepSeek", "深度求索"] },
  qwen: { name: "千问 Qwen", displayTag: "Qwen", aliases: ["Qwen", "通义", "千问"] },
  kimi: { name: "Kimi / 月之暗面", displayTag: null, aliases: ["Kimi", "月之暗面", "Moonshot"] },
  minimax: { name: "MiniMax", displayTag: null, aliases: ["MiniMax"] },
  zhipu: { name: "智谱 GLM", displayTag: null, aliases: ["智谱", "GLM", "Z.ai"] },
  xai: { name: "xAI", displayTag: "xAI", aliases: ["xAI", "Grok"] },
  meta: { name: "Meta", displayTag: "Meta", aliases: ["Meta", "Llama"] },
  mistral: { name: "Mistral", displayTag: "Mistral", aliases: ["Mistral", "Mixtral"] },
  lmarena: { name: "LMArena", displayTag: "LMArena", aliases: ["LMArena", "Chatbot Arena", "Arena"] },
  "artificial-analysis": { name: "Artificial Analysis", displayTag: "Artificial Analysis", aliases: ["Artificial Analysis", "AA Index"] },
  epoch: { name: "Epoch AI", displayTag: "Epoch AI", aliases: ["Epoch AI", "Epoch", "FrontierMath"] },
  metr: { name: "METR", displayTag: "METR", aliases: ["METR"] },
  "hugging-face": { name: "Hugging Face", displayTag: "Hugging Face", aliases: ["Hugging Face"] },
};

/**
 * 身份词典：摘要和标题里出现的公司，必须在原文里也出现过，否则退回原标题、丢掉摘要（防止模型张冠李戴）。
 * 行业没有这个问题时可以留空数组。
 */
export const IDENTITY_LEXICON: ReadonlyArray<{ id: string; name: string; patterns: RegExp[] }> = [
  { id: "openai", name: "OpenAI", patterns: [/openai|chatgpt|\bgpt-?[o\d]|\bsora\b|\bcodex\b/i] },
  { id: "anthropic", name: "Anthropic", patterns: [/anthropic|\bclaude\b/i, /\b(?:opus|sonnet|haiku)\s*\d+(?:[.\-]\d+)*\b/i, /\bfable\s*\d+(?:[.\-]\d+)*\b|\bmythos\b/i] },
  { id: "google", name: "Google / Gemini", patterns: [/google|deepmind|\bgemini\b|\bgemma\b|\bveo\s?\d/i] },
  { id: "deepseek", name: "DeepSeek", patterns: [/deepseek|深度求索/i] },
  { id: "xai", name: "xAI / Grok", patterns: [/\bxai\b|\bgrok\b/i] },
  { id: "meta", name: "Meta / Llama", patterns: [/\bMeta\b/, /\bmeta\s?ai\b|\bllama\b/i] },
  { id: "microsoft", name: "Microsoft", patterns: [/microsoft|微软|\bphi-?\d/i] },
  { id: "nvidia", name: "NVIDIA", patterns: [/nvidia|英伟达|\bnemotron\b/i] },
  { id: "qwen", name: "千问 Qwen", patterns: [/\bqwen|通义|千问/i] },
  { id: "kimi", name: "Kimi / 月之暗面", patterns: [/\bkimi\b|月之暗面|\bmoonshot\s?ai\b/i] },
  { id: "minimax", name: "MiniMax", patterns: [/minimax/i] },
  { id: "zhipu", name: "智谱 GLM", patterns: [/智谱|\bglm-?[4-9]/i] },
  { id: "hunyuan", name: "腾讯混元", patterns: [/混元|hunyuan/i] },
  { id: "doubao", name: "字节豆包 / Seed", patterns: [/豆包|doubao|字节跳动|bytedance|\bseed-?\d/i] },
  { id: "mistral", name: "Mistral", patterns: [/mistral|mixtral/i] },
  { id: "baidu", name: "百度文心", patterns: [/百度|baidu|文心|\bernie\b/i] },
  { id: "hugging-face", name: "Hugging Face", patterns: [/hugging\s?face/i] },
  { id: "lmarena", name: "LMArena", patterns: [/lmarena|chatbot arena|\barena\.ai\b/i] },
  { id: "artificial-analysis", name: "Artificial Analysis", patterns: [/artificial\s?analysis/i] },
  { id: "epoch", name: "Epoch AI", patterns: [/\bepoch\s?ai\b|frontiermath/i] },
  { id: "metr", name: "METR", patterns: [/\bMETR\b/] },
];

/** 这些域名上的文章，发布方就是对应的公司（托管平台如 GitHub、arXiv 不算）。 */
export const PUBLISHER_DOMAINS: ReadonlyArray<{ entityId: string; domains: readonly string[] }> = [
  { entityId: "openai", domains: ["openai.com"] },
  { entityId: "anthropic", domains: ["anthropic.com", "claude.com"] },
  { entityId: "google", domains: ["deepmind.google", "ai.google", "blog.google"] },
  { entityId: "deepseek", domains: ["deepseek.com"] },
  { entityId: "xai", domains: ["x.ai"] },
  { entityId: "meta", domains: ["ai.meta.com"] },
  { entityId: "qwen", domains: ["qwen.ai"] },
  { entityId: "mistral", domains: ["mistral.ai"] },
  { entityId: "lmarena", domains: ["lmarena.ai", "arena.ai"] },
  { entityId: "artificial-analysis", domains: ["artificialanalysis.ai"] },
  { entityId: "epoch", domains: ["epoch.ai"] },
  { entityId: "metr", domains: ["metr.org"] },
];

/** 原文里的这些写法也算提到了对应公司。 */
export const IDENTITY_CONTEXT_ALIASES: ReadonlyArray<{ entityId: string; pattern: RegExp }> = [
  { entityId: "meta", pattern: /@AIatMeta\b/i },
  { entityId: "zhipu", pattern: /\bZhipu(?:\s+AI\b|['’]s\b)/i },
  { entityId: "lmarena", pattern: /@(?:lmarena_ai|arena)\b/i },
  { entityId: "artificial-analysis", pattern: /@ArtificialAnlys\b/i },
  { entityId: "epoch", pattern: /@EpochAIResearch\b/i },
];
