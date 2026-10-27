# 星夜 · XINGYE

> 只在夜里开门的观测站。
> 一个独立开发者的夜间观测站：人写的、Agent 写的、以及两者之间的分歧。

这是「星夜」的实现：**静态站 + Node.js 构建**，没有前端框架、没有数据库、没有运行时依赖
（构建期只用 markdown-it / js-yaml / highlight.js 三个包）。

## 立刻看

```powershell
node build.mjs          # 生成 dist/
node serve.mjs          # http://127.0.0.1:4173/
node serve.mjs --watch  # 改 content/ 或 assets/ 自动重建
```

`?noboot=1` 跳过开机仪式（截图/调试用）。

## 它和"普通个人博客"的五个区别

| 普通博客 | 星夜 |
|---|---|
| 文章列表 | **星图**：Canvas 夜空，每篇文章是一颗星，亮度=篇幅、色相=星座、位置=时间 |
| 标签 | **星座**：主题线，星按时间由内向外生长，同星座自动连线 |
| 一个作者声音 | **双声道**：正文是你的声音；`AGENT · 观测日志` / `AGENT · 分歧` 是它的声音 |
| 假装全是自己写的 | 每篇顶部标明 `HUMAN` / `CO-WRITTEN` / `AGENT DRAFT`，并有「出处政策」页 |
| 深浅色开关 | **四种夜色**：白昼 / 暮色 / 深夜 / 凌晨，按本地时间自动切换 |

另外：3 秒开机仪式（可跳过、每 20 分钟一次）、`/vault` 公开草稿箱（未完成的星）、
观测台状态条、`/` 星尘检索、快捷键 `g` `v` `n` `o`、**阅读路径**、**稿件时间轴**、**观测助理（夜鸮）**。

## 阅读路径（连两颗星）

星图不只是装饰，它是可编辑的：

- 按住 <kbd>Shift</kbd> 点第一颗星 → 再点第二颗 → 一条亮线连起来，端点标序号
- 也可以点「连线模式」按钮进入（Esc 退出）
- 路径存在 `localStorage`，刷新不丢
- 点「复制阅读路径」得到形如 `/#p=slug-a,slug-b,slug-c` 的链接 —— 发给别人，对方打开就是同一条线
- 状态行会实时算出「N 颗星 · 约 M 分钟 · 标题1 → 标题2」

## 稿件时间轴

`AGENT DRAFT` 体裁允许迭代。在 frontmatter 里写：

```yaml
versions:
  - v: 1
    date: 2026-10-16
    note: Agent 起草 · 原稿，作者批注一处
  - v: 2
    date: 2026-10-18
    note: 补入第三次实验的数据，结论未变
```

文章顶部出现 `v2` 徽章，正文末尾渲染一条带光点的版本时间轴。

## 部署

见 [DEPLOY.md](DEPLOY.md)。三套配置已经写好：

| 目标 | 文件 |
|---|---|
| GitHub Pages | `.github/workflows/deploy.yml`（push 即部署，自动注入 `XINGYE_URL`） |
| Vercel | `vercel.json`（build `node build.mjs` / output `dist` / cleanUrls） |
| Netlify | `netlify.toml` |
| Cloudflare Pages / 自建服务器 | `DEPLOY.md` 里的 wrangler 与 rsync 命令 |

正式域名通过环境变量注入，不用改代码：

```powershell
$env:XINGYE_URL = "https://xingye.example.com"
node build.mjs
```


## 内容怎么写

一篇文章 = `content/posts/YYYY-MM-DD-名字.md`：

```markdown
---
title: 标题
slug: url-里的名字
date: 2026-10-27
constellation: dsh-lab      # 星座 key，见 content/constellations.json
provenance: human           # human | cowritten | agent
summary: 一句话摘要
tags: [dsh, plugin]
reading: 7                  # 可省，省略则按字数估算
---

正文用 Markdown。
```

### 双声道语法

```markdown
::: agent 观测日志
它在这里写旁注。紫色边框 + 等宽字体，和正文永远不同声音。
:::

::: split 我不同意
分歧块：粉色边框，用来公开"我们吵起来了"。
:::

::: caveat 备忘
灰色的自我提醒，不算正文。
:::
```

### 其它内容

| 文件 | 作用 |
|---|---|
| `content/site.json` | 站名、副标、作者、部署域名（`url` 用于 RSS/sitemap/canonical） |
| `content/constellations.json` | 星座定义：`name` / `hue`（色相）/ `desc` |
| `content/status.json` | 观测台状态条的文案（草稿数自动统计） |
| `content/drafts/*.md` | 草稿箱条目：`title` / `note` / `progress`（0-100） |
| `content/pages/observatory.md` | 观测台页（关于 + 出处政策） |
| `content/pages/night.md` | 今夜页 |

## 构建产物

```
dist/
  index.html                     星图首页（内嵌 sky-data JSON）
  star/<slug>.html               文章
  constellation/<key>.html       星座页
  constellations.html            星座索引
  vault.html                     草稿箱
  night.html / observatory.html  静态页
  feed.xml / sitemap.xml / robots.txt
  assets/                        样式与脚本（构建时整目录复制）
  data/starmap.json              星图数据（给外部工具/以后做客户端用）
```

## 设计决定（写在代码里）

- **星图坐标确定性**：不发随机数种子，`src/lib/stars.mjs` 用 slug 的 FNV-1a 哈希分布星，
  同一篇文章永远在同一颗位置，改文案不会让天空重排。
- **坐标归一化**：星坐标是 0..1，前端按视口缩放，所以手机和超宽屏是同一片天空。
- **动效只用合成层**：transform / opacity / 滤镜，`prefers-reduced-motion` 下全部降级为静态。
- **双声道靠容器而不是 CSS 类名约定**：`::: agent` 由 markdown-it 容器插件渲染成 `<aside class="agent-note">`，
  作者不会写错标签名。
- **出处即体裁**：`provenance` 不只是安全声明，`AGENT DRAFT` 的文章允许是半成品（见 `night-is-honest`）。

## 部署

静态站，`dist/` 整个目录就是产物：

- **GitHub Pages**：把 `dist/` 推到 `gh-pages`（或用 Actions 跑 build）
- **Vercel / Netlify / Cloudflare Pages**：build command `node build.mjs`，output `dist`
- **自己的服务器**：`rsync dist/` 到任意静态目录

上线前把 `content/site.json` 的 `url` 填成正式域名，RSS / sitemap / canonical 会自动跟着变。

## 目录

```
build.mjs                 构建器（内容 → 整站）
serve.mjs                 零依赖本地预览（node:http）
src/lib/frontmatter.mjs   frontmatter 解析
src/lib/markdown.mjs      Markdown + 双声道容器 + 代码高亮 + 标题锚点
src/lib/stars.mjs         星图坐标算法
src/lib/template.mjs      页面外壳（头、导航、开机仪式、状态条、观测助理、页脚）
assets/main.css           主样式 + 四种夜色 + 开机仪式 + 星尘检索 + 颗粒层 + 助理
assets/prose.css          正文排版 + 双声道 + 星轨 + 版本时间轴
assets/sky.js             星图画布（视差、悬停、点击、阅读路径、流星）
assets/site.js            夜色切换、检索、快捷键、星轨高亮、观测助理
assets/boot.js            开机仪式
content/                  全部内容（12 篇文章 + 1 个草稿 + 4 条星座）
shots/                    截图（home / path / article / boot / mobile）
DEPLOY.md                 三种部署方式 + 上线检查清单
```

## 内容现状

12 篇文章，其中 3 篇是刻意写的体裁样本，另外 9 篇是这几天真实的改造记录：

| 星座 | 篇数 | 代表 |
|---|---|---|
| DSH 实验台 | 4 | 开机动画日记、桌面鲸鱼余额、那不舒服的十分钟 |
| Agent 工作流 | 3 | 我让 Agent 写周报然后我们吵了三次、三次误判、被允许反对 |
| 设计观察 | 3 | 开机仪式不是装饰、80%→42% 的白纱、把导航做成天空 |
| 夜记 | 2 | 凌晨一点之后代码会变得诚实（Agent 起草 · v2） |

