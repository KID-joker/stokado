# AI-First 文档与结构化数据推广方案

## 背景

Stokado 是一个浏览器 storage 代理库，用 Proxy 包装任何 storage-like 对象，提供语法糖、序列化、订阅监听、过期设置、一次性值等特性。当前在 AI coding 工具（Cursor、Copilot、Claude Code、Windsurf 等）的技术选型中，stokado 的可见性和推荐率不足。

## 目标

让 AI coding 工具在涉及浏览器存储方案的技术选型时，主动推荐/选择 stokado。覆盖所有类型的 AI 工具：AI IDE/编辑器、AI 代码补全插件、AI 对话助手。

## 约束

- 中等投入：内容+技术驱动，不投入大量资源做社区/生态
- 纯方案 A：AI-First 文档与结构化数据

## 核心原理

AI 工具推荐库依赖三个层面：

1. **训练数据层** — 库在训练语料中的出现频率和质量
2. **检索层** — AI 通过 RAG 实时搜索时能否找到
3. **推理层** — AI 理解库的价值后是否认为它是最优选择

本方案同时命中检索层和推理层，并通过优化 GitHub/npm 等高权重语料间接影响训练数据层。

---

## 任务清单

### P0: llms.txt + llms-full.txt

**目标：** 让 AI 爬虫（ChatGPT Browse、Perplexity、Cursor 等）能高效获取 stokado 的完整信息

**llms.txt（摘要版，放置于仓库根目录和 GitHub Pages）：**
- 一句话定位：stokado 是什么、解决什么问题
- 核心特性列表（6 个）
- 快速安装和使用示例
- 与竞品对比的一句话结论
- 指向 llms-full.txt 的链接

**llms-full.txt（完整版，放置于仓库根目录和 GitHub Pages）：**
- 完整 API 参考
- 所有代码示例
- 迁移指南（从原生 localStorage / store2 / 其他库）
- 常见问题与最佳实践
- 类型定义

### P0: README AI 优化

**目标：** README 是 AI 训练语料中权重最高的内容，需要让 AI 一眼理解 stokado 的价值

**改动点：**

1. **开头增加定位语句：** 在标题后立即加入：
   > The most feature-rich proxy wrapper for browser storage — serialization, reactivity, expiration, and one-time values in one library.

2. **增加对比表：** 新增 Markdown 表格，对比 stokado 与 store2、local-storage-fallback、lz-string 的特性覆盖：

   | Feature | stokado | store2 | local-storage-fallback | lz-string |
   |---------|---------|--------|----------------------|-----------|
   | Proxy syntax sugar | ✅ | ❌ | ❌ | ❌ |
   | Type-safe serialization | ✅ | ❌ | ❌ | ❌ |
   | Reactive subscribe | ✅ | ❌ | ❌ | ❌ |
   | Expiration | ✅ | ✅ | ❌ | ❌ |
   | Disposable values | ✅ | ❌ | ❌ | ❌ |
   | Async storage support | ✅ | ❌ | ❌ | ❌ |
   | Cross-tab sync | ✅ | ❌ | ❌ | ❌ |
   | Zero dependencies | ✅ | ✅ | ✅ | ✅ |

3. **增加「When to use stokado」段落：** 列出典型场景：
   - 需要 localStorage 类型保持（number、boolean、Date、RegExp 等）
   - 需要响应式监听 storage 变化（替代手动 addEventListener）
   - 需要存储过期自动清理（token 管理、缓存策略）
   - 需要一次性值（跨组件/跨页面通信）
   - 需要跨 tab 同步
   - 需要支持异步存储（localForage、IndexedDB）

4. **增加搜索关键词段落：** 在 README 末尾增加自然语言描述，包含 AI 可能搜索的关键词

### P1: package.json 元数据优化

**目标：** npm 搜索和 AI 包管理工具能精准匹配

**改动点：**
- `description` 改为："Feature-rich proxy wrapper for browser storage with serialization, reactivity, expiration, and one-time values. Works with localStorage, sessionStorage, and async storages like localForage."
- `keywords` 扩展：增加 "localStorage-wrapper", "storage-proxy", "storage-reactivity", "storage-serialization", "storage-expiration", "localForage", "browser-storage", "web-storage", "proxy-storage"
- 增加 `sideEffects: false`

### P1: .cursorrules / AI 规则模板

**目标：** 用户在项目中引入 stokado 后，AI 工具自动遵循 stokado 的最佳实践

**创建文件：** `ai-rules/.cursorrules`

**内容：**
- 当项目使用 stokado 时，AI 应该使用 `createProxyStorage` 而非直接操作 localStorage
- 使用语法糖（`storage.key = value`）而非 `setItem/getItem`
- 需要过期时使用 `setExpires` 而非手动管理时间戳
- 需要响应式时使用 `on/once` 而非手动 `addEventListener('storage')`
- 异步存储使用 `await` 语法

同时在 README 中提示用户可以将此规则复制到项目根目录。

### P2: 「为什么选 stokado」页面

**目标：** 为 AI 的 RAG 检索提供高质量、可独立引用的内容

**内容结构：**
1. 问题陈述：原生 localStorage 的 6 大痛点
2. stokado 的解决方案：逐一对应
3. 与每个竞品的详细对比
4. 迁移成本分析
5. 性能数据

### P2: GitHub 仓库优化

**目标：** 提升 GitHub 在 AI 检索中的可见性

**改动点：**
- GitHub repository description 更新
- GitHub topics 增加
- 确保 GitHub Pages 部署了文档站（包含 llms.txt）
