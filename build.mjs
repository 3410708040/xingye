/**
 * build.mjs — 星夜的静态站构建器。
 *
 * 读 content/ 下的 Markdown 与 JSON，生成 dist/ 整站：
 *   /                          星图首页
 *   /star/<slug>.html          文章（双声道）
 *   /constellation/<key>.html  星座（主题线）
 *   /constellations.html       星座索引
 *   /vault.html                草稿箱：未完成的星
 *   /night.html                今夜
 *   /observatory.html          观测台（关于 / 出处政策 / Agent 说明）
 *   /feed.xml /sitemap.xml /robots.txt
 */
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { isoDate, parseFrontmatter } from "./src/lib/frontmatter.mjs";
import { outlineOf, renderMarkdown } from "./src/lib/markdown.mjs";
import { layoutStars } from "./src/lib/stars.mjs";
import { esc, renderPage } from "./src/lib/template.mjs";

const ROOT = dirname(fileURLToPath(import.meta.url));
const CONTENT = join(ROOT, "content");
const DIST = join(ROOT, "dist");
const ASSETS = join(ROOT, "assets");
const PUBLIC = join(ROOT, "public");

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));

/** 站内绝对路径前缀：GitHub Pages 项目站部署在 /<repo>/ 下，必须带前缀。 */
function normalizeBase(value) {
  const text = String(value ?? "").trim();
  if (text === "" || text === "/") return "";
  return `/${text.replace(/^\/+|\/+$/g, "")}`;
}

/** 把生成好的 HTML 里的站内绝对路径统一加上 base 前缀。 */
function prefixPaths(html, base) {
  if (base === "") return html;
  return html
    .replace(/href="\//g, `href="${base}/`)
    .replace(/src="\//g, `src="${base}/`)
    .replace(/"href":"\//g, `"href":"${base}/`);
}

const readDir = (path) =>
  existsSync(path)
    ? readdirSync(path)
        .filter((name) => name.endsWith(".md"))
        .sort()
        .map((name) => ({ name, path: join(path, name) }))
    : [];

/* ────────────────────────────── 内容装载 ────────────────────────────── */

function readingMinutes(body) {
  const text = String(body);
  const cjk = (text.match(/[\u3400-\u9fff]/g) ?? []).length;
  const words = (text.match(/[A-Za-z0-9]+/g) ?? []).length;
  return Math.max(1, Math.round(cjk / 380 + words / 220));
}

function loadPosts() {
  return readDir(join(CONTENT, "posts")).map(({ name, path }) => {
    const { data, body } = parseFrontmatter(readFileSync(path, "utf8"));
    const fallbackSlug = name.replace(/\.md$/, "").replace(/^\d{4}-\d{2}-\d{2}-/, "");
    const slug = String(data.slug ?? fallbackSlug);
    const date = isoDate(data.date ?? name.slice(0, 10));
    return {
      kind: "post",
      slug,
      date,
      title: String(data.title ?? slug),
      summary: String(data.summary ?? ""),
      constellation: String(data.constellation ?? "misc"),
      provenance: String(data.provenance ?? "human"),
      tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
      reading: Number(data.reading) > 0 ? Number(data.reading) : readingMinutes(body),
      versions: Array.isArray(data.versions)
        ? data.versions.map((entry) => ({
            v: Number(entry?.v) || 1,
            date: isoDate(entry?.date ?? ""),
            note: String(entry?.note ?? ""),
          }))
        : [],
      body,
      source: name,
    };
  }).sort((left, right) => right.date.localeCompare(left.date));
}

function loadDrafts() {
  return readDir(join(CONTENT, "drafts")).map(({ name, path }) => {
    const { data, body } = parseFrontmatter(readFileSync(path, "utf8"));
    return {
      kind: "draft",
      slug: String(data.slug ?? name.replace(/\.md$/, "")),
      date: isoDate(data.date ?? ""),
      title: String(data.title ?? "无题"),
      note: String(data.note ?? ""),
      progress: Number(data.progress ?? 0),
      body,
      source: name,
    };
  });
}

function loadPage(name) {
  const path = join(CONTENT, "pages", `${name}.md`);
  if (!existsSync(path)) return { title: name, body: "" };
  const { data, body } = parseFrontmatter(readFileSync(path, "utf8"));
  return { title: String(data.title ?? name), summary: String(data.summary ?? ""), body };
}

/* ────────────────────────────── 小组件 ────────────────────────────── */

const PROVENANCE = {
  human: { label: "HUMAN", text: "人写", className: "badge-human" },
  cowritten: { label: "CO-WRITTEN", text: "人机合写", className: "badge-cowritten" },
  agent: { label: "AGENT DRAFT", text: "Agent 起草", className: "badge-agent" },
};

function badge(provenance) {
  const spec = PROVENANCE[provenance] ?? PROVENANCE.human;
  return `<span class="badge ${spec.className}" title="${esc(spec.text)}">${spec.label}</span>`;
}

function starLink(post) {
  return `<a class="star-row" href="/star/${esc(post.slug)}.html">
    <span class="star-row-title">${esc(post.title)}</span>
    <span class="star-row-meta">${badge(post.provenance)}<time>${esc(post.date)}</time><span>${post.reading} 分钟</span></span>
    <span class="star-row-summary">${esc(post.summary)}</span>
  </a>`;
}

function constellationName(constellations, key) {
  return constellations[key]?.name ?? key;
}

/* ────────────────────────────── 页面 ────────────────────────────── */

function homePage({ site, posts, constellations, starData, status }) {
  const starIndex = new Map(posts.map((post) => [post.slug, post]));
  const starsJson = starData.stars.map((star) => {
    const post = starIndex.get(star.slug);
    return {
      ...star,
      href: `/star/${star.slug}.html`,
      title: post?.title ?? star.slug,
      date: post?.date ?? "",
      provenance: post?.provenance ?? "human",
      constellationName: constellationName(constellations, star.constellation),
      reading: post?.reading ?? 0,
    };
  });

  const lines = starData.lines;
  const anchors = Object.entries(constellations).map(([key, item]) => {
    const center = starData.centers[key] ?? { x: 0.5, y: 0.5, hue: item.hue };
    return {
      key,
      name: item.name,
      hue: item.hue,
      x: center.x,
      y: center.y,
      count: posts.filter((post) => post.constellation === key).length,
      href: `/constellation/${key}.html`,
    };
  });
  const legend = Object.entries(constellations)
    .map(([key, item]) => `<li><span class="legend-dot" style="--hue:${item.hue}"></span>${esc(item.name)}<em>${posts.filter((post) => post.constellation === key).length}</em></li>`)
    .join("");

  const body = `
  <section class="starfield-wrap" aria-labelledby="sky-title">
    <h1 class="sky-title" id="sky-title">
      <span class="sky-mark">${esc(site.name)}</span>
      <span class="sky-sub">${esc(site.tagline)}</span>
    </h1>
    <div class="sky-stage">
      <canvas id="sky" class="sky" aria-hidden="true"></canvas>
      <div class="sky-tip" id="sky-tip" role="tooltip" hidden></div>
      <noscript><p class="sky-noscript">星图需要 JavaScript；下面同样列出了全部文章。</p></noscript>
    </div>
    <div class="sky-hud">
      <ul class="sky-legend" aria-label="星座图例">${legend}</ul>
      <p class="sky-hint">拖动鼠标看深浅 · 点击星星进入文章 · <kbd>Shift</kbd>+点击两颗星连成阅读路径 · <kbd>/</kbd> 检索</p>
    </div>
    <div class="sky-tools">
      <button class="sky-chip" id="connect-toggle" type="button" aria-pressed="false">连线模式</button>
      <button class="sky-chip" id="connect-copy" type="button" disabled>复制阅读路径</button>
      <button class="sky-chip" id="connect-clear" type="button" disabled>清空</button>
      <p class="sky-status" id="connect-status">Shift + 点击任意两颗星，连成一条阅读路径</p>
    </div>
  </section>

  <section class="star-table" aria-labelledby="table-title">
    <h2 id="table-title">星表<span class="section-note">按时间从新到旧，也是这座站的索引入口</span></h2>
    <div class="star-list">
      ${posts.map(starLink).join("\n      ")}
    </div>
  </section>

  <script type="application/json" id="sky-data">${JSON.stringify({ stars: starsJson, lines, anchors }).replace(/</g, "\\u003c")}</script>
  <script src="/assets/sky.js" defer></script>
`;

  return renderPage({
    site,
    page: "home",
    title: site.name,
    path: "/",
    body,
    status,
    scripts: ["/assets/site.js"],
  });
}

function articlePage({ site, post, posts, constellations, status, pages }) {
  const siblings = posts.filter((candidate) => candidate.constellation === post.constellation);
  const index = siblings.findIndex((candidate) => candidate.slug === post.slug);
  const previous = siblings[index + 1];
  const next = siblings[index - 1];
  const outline = outlineOf(post.body);
  const constellation = constellations[post.constellation] ?? { name: post.constellation, hue: 210 };
  const spec = PROVENANCE[post.provenance] ?? PROVENANCE.human;
  const latestVersion = post.versions.length > 0 ? post.versions[post.versions.length - 1] : null;

  const timelineHtml = post.versions.length > 0
    ? `<aside class="timeline"><p class="timeline-label">稿件时间轴 · VERSION HISTORY</p><ol>${post.versions
        .map(
          (entry) =>
            `<li><div class="version-head"><strong>v${entry.v}</strong><time>${esc(entry.date)}</time></div>${
              entry.note ? `<p class="note">${esc(entry.note)}</p>` : ""
            }</li>`
        )
        .join("")}</ol></aside>`
    : "";

  const outlineHtml = outline.length > 1
    ? `<nav class="trail" aria-label="文内星轨"><p class="trail-label">星轨</p><ol>${outline
        .filter((item) => item.level <= 3)
        .map((item) => `<li data-level="${item.level}"><a href="#${esc(item.id)}">${esc(item.text)}</a></li>`)
        .join("")}</ol></nav>`
    : "";

  const body = `
  <article class="post" style="--hue:${constellation.hue}">
    <header class="post-head">
      <p class="post-crumb"><a href="/">星图</a> / <a href="/constellation/${esc(post.constellation)}.html">${esc(constellation.name)}</a></p>
      <h1 class="post-title">${esc(post.title)}</h1>
      <p class="post-meta">
        ${badge(post.provenance)}
        ${latestVersion ? `<span class="post-version">v${latestVersion.v}</span>` : ""}
        <time datetime="${esc(post.date)}">${esc(post.date)}</time>
        <span>${post.reading} 分钟</span>
        <span class="post-provenance-text">${esc(spec.text)}</span>
      </p>
      <p class="post-summary">${esc(post.summary)}</p>
    </header>

    <div class="post-layout">
      <div class="post-body prose">
${renderMarkdown(post.body)}
        ${timelineHtml}
        <footer class="post-foot">
          <p class="voice-legend">
            <span class="badge ${spec.className}">${spec.label}</span> 本文为${esc(spec.text)}；
            <a href="/observatory.html#provenance">出处政策</a>。
          </p>
          <nav class="post-nav">
            ${previous ? `<a class="prev" href="/star/${esc(previous.slug)}.html"><span>上一颗星</span>${esc(previous.title)}</a>` : "<span></span>"}
            ${next ? `<a class="next" href="/star/${esc(next.slug)}.html"><span>下一颗星</span>${esc(next.title)}</a>` : "<span></span>"}
          </nav>
        </footer>
      </div>
      ${outlineHtml}
    </div>
  </article>
  <script src="/assets/site.js" defer></script>
`;

  return renderPage({
    site,
    page: "star",
    title: post.title,
    description: post.summary || site.description,
    path: `/star/${post.slug}.html`,
    body,
    status,
    styles: ["/assets/prose.css"],
  });
}

function constellationPage({ site, key, item, posts, constellations, status }) {
  const list = posts.filter((post) => post.constellation === key);
  const body = `
  <section class="index-page" style="--hue:${item.hue}">
    <p class="index-crumb"><a href="/constellations.html">星座</a></p>
    <h1>${esc(item.name)}</h1>
    <p class="index-desc">${esc(item.desc ?? "")}</p>
    <div class="star-list">
      ${list.length > 0 ? list.map(starLink).join("\n      ") : '<p class="empty">这条星座线还没有星。</p>'}
    </div>
  </section>
  <script src="/assets/site.js" defer></script>
`;

  return renderPage({
    site,
    page: "constellations",
    title: item.name,
    description: item.desc,
    path: `/constellation/${key}.html`,
    body,
    status,
  });
}

function constellationsIndex({ site, constellations, posts, status }) {
  const cards = Object.entries(constellations)
    .map(([key, item]) => {
      const count = posts.filter((post) => post.constellation === key).length;
      return `<a class="constellation-card" href="/constellation/${esc(key)}.html" style="--hue:${item.hue}">
        <span class="constellation-glyph" aria-hidden="true">✧</span>
        <h2>${esc(item.name)}</h2>
        <p>${esc(item.desc ?? "")}</p>
        <span class="constellation-count">${count} 颗星</span>
      </a>`;
    })
    .join("\n      ");

  const body = `
  <section class="index-page">
    <p class="index-crumb"><a href="/">星图</a></p>
    <h1>星座</h1>
    <p class="index-desc">星座不是标签，是阅读线：同一星座的星会连成一条线，从内向外按时间生长。</p>
    <div class="constellation-grid">
      ${cards}
    </div>
  </section>
  <script src="/assets/site.js" defer></script>
`;

  return renderPage({ site, page: "constellations", title: "星座", path: "/constellations.html", body, status });
}

function vaultPage({ site, drafts, status }) {
  const cards = drafts
    .map((draft) => {
      const progress = Math.max(0, Math.min(100, Math.round(draft.progress)));
      return `<article class="draft-card">
        <header>
          <h2>${esc(draft.title)}</h2>
          <p class="draft-meta">${draft.date ? `<time>${esc(draft.date)}</time>` : "未定日期"}<span>${progress}% 写完</span></p>
        </header>
        ${draft.note ? `<p class="draft-note">${esc(draft.note)}</p>` : ""}
        <div class="draft-meter" aria-hidden="true"><i style="width:${progress}%"></i></div>
        ${draft.body.trim() ? `<div class="draft-excerpt prose">${renderMarkdown(draft.body)}</div>` : ""}
      </article>`;
    })
    .join("\n      ");

  const body = `
  <section class="index-page">
    <p class="index-crumb"><a href="/">星图</a></p>
    <h1>草稿箱</h1>
    <p class="index-desc">未完成的星：有标题没正文的、有正文没结论的、写到一半放下的。这里允许半成品存在。</p>
    ${drafts.length > 0 ? `<div class="draft-list">${cards}</div>` : '<p class="empty">草稿箱是空的。</p>'}
  </section>
  <script src="/assets/site.js" defer></script>
`;

  return renderPage({
    site,
    page: "vault",
    title: "草稿箱",
    path: "/vault.html",
    body,
    status,
    styles: ["/assets/prose.css"],
  });
}

function markdownPage({ site, page, title, body: source, status, extra = "" }) {
  const body = `
  <section class="index-page prose-page">
    <p class="index-crumb"><a href="/">星图</a></p>
    <h1>${esc(title)}</h1>
    <div class="prose">
${renderMarkdown(source)}
    </div>
    ${extra}
  </section>
  <script src="/assets/site.js" defer></script>
`;

  return renderPage({
    site,
    page,
    title,
    path: `/${page}.html`,
    body,
    status,
    styles: ["/assets/prose.css"],
  });
}

/* ────────────────────────────── 附属文件 ────────────────────────────── */

function feedXml({ site, posts }) {
  const items = posts
    .slice(0, 20)
    .map((post) => `    <item>
      <title>${esc(post.title)}</title>
      <link>${esc((site.url ?? "") + `/star/${post.slug}.html`)}</link>
      <guid>${esc((site.url ?? "") + `/star/${post.slug}.html`)}</guid>
      <pubDate>${new Date(`${post.date}T00:00:00+08:00`).toUTCString()}</pubDate>
      <description>${esc(post.summary)}</description>
    </item>`)
    .join("\n");

  return `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0">
  <channel>
    <title>${esc(site.name)}</title>
    <link>${esc(site.url ?? "")}</link>
    <description>${esc(site.description)}</description>
    <language>zh-CN</language>
${items}
  </channel>
</rss>
`;
}

function sitemap({ site, paths }) {
  const urls = paths
    .map((path) => `  <url><loc>${esc((site.url ?? "") + path)}</loc></url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="utf-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

/* ────────────────────────────── 主流程 ────────────────────────────── */

function main() {
  const site = readJson(join(CONTENT, "site.json"));
  // 部署时用环境变量覆盖（CI 里注入正式域名与子路径，RSS / sitemap / canonical / 站内链接一起跟着变）
  if (process.env.XINGYE_URL) site.url = String(process.env.XINGYE_URL).replace(/\/$/, "");
  const base = normalizeBase(process.env.XINGYE_BASE ?? site.base ?? "");
  site.base = base;
  const constellations = readJson(join(CONTENT, "constellations.json"));
  const status = readJson(join(CONTENT, "status.json"));
  const posts = loadPosts();
  const drafts = loadDrafts();
  const observatory = loadPage("observatory");
  const night = loadPage("night");

  for (const post of posts) {
    if (!constellations[post.constellation]) {
      constellations[post.constellation] = {
        name: post.constellation,
        hue: 210,
        desc: "尚未归入任何星座的文章。",
      };
    }
  }

  const starData = layoutStars(posts, Object.entries(constellations).map(([key, item]) => ({ key, hue: item.hue })));
  const liveStatus = {
    ...status,
    drafts: drafts.length,
    // status.json 里可以用 {count} 占位，构建时替换成真实星数
    hint: String(status.hint ?? "").replace("{count}", String(posts.length)),
  };

  rmSync(DIST, { recursive: true, force: true });
  mkdirSync(DIST, { recursive: true });

  const write = (path, contents) => {
    const target = join(DIST, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, path.endsWith(".html") ? prefixPaths(contents, base) : contents, "utf8");
  };

  write("index.html", homePage({ site, posts, constellations, starData, status: liveStatus }));

  for (const post of posts) {
    write(`star/${post.slug}.html`, articlePage({ site, post, posts, constellations, status: liveStatus }));
  }

  for (const [key, item] of Object.entries(constellations)) {
    write(`constellation/${key}.html`, constellationPage({ site, key, item, posts, constellations, status: liveStatus }));
  }

  write("constellations.html", constellationsIndex({ site, constellations, posts, status: liveStatus }));
  write("vault.html", vaultPage({ site, drafts, status: liveStatus }));
  write(
    "observatory.html",
    markdownPage({ site, page: "observatory", title: observatory.title, body: observatory.body, status: liveStatus })
  );
  write("night.html", markdownPage({ site, page: "night", title: night.title, body: night.body, status: liveStatus }));
  write(
    "404.html",
    renderPage({
      site,
      page: "observatory",
      title: "404 · 这里没有星",
      path: "/404.html",
      status: liveStatus,
      body: `<section class="index-page">
    <p class="index-crumb"><a href="/">星图</a></p>
    <h1>404 · 这里没有星</h1>
    <p class="index-desc">你要找的那颗星可能还没被点亮，或者已经熄灭了。</p>
    <p style="display:flex;gap:8px;flex-wrap:wrap"><a class="sky-chip" href="/">回星图</a><a class="sky-chip" href="/vault.html">去草稿箱</a><a class="sky-chip" href="/night.html">看今夜</a></p>
  </section>`,
    })
  );

  write("data/starmap.json", JSON.stringify({ site: site.name, stars: starData.stars, lines: starData.lines }, null, 2));
  write("feed.xml", feedXml({ site, posts }));
  write(
    "sitemap.xml",
    sitemap({
      site,
      paths: [
        "/",
        "/constellations.html",
        "/vault.html",
        "/night.html",
        "/observatory.html",
        ...posts.map((post) => `/star/${post.slug}.html`),
        ...Object.keys(constellations).map((key) => `/constellation/${key}.html`),
      ],
    })
  );
  write("robots.txt", `User-agent: *\nAllow: /\nSitemap: ${site.url ?? ""}/sitemap.xml\n`);
  write(".nojekyll", "");

  // 自定义域名：GitHub Pages 认 artifact 里的 CNAME 文件
  const domain = String(process.env.XINGYE_DOMAIN ?? site.domain ?? "").trim();
  if (domain !== "") write("CNAME", `${domain}\n`);

  cpSync(ASSETS, join(DIST, "assets"), { recursive: true });
  if (existsSync(PUBLIC)) cpSync(PUBLIC, DIST, { recursive: true });

  const draftsMissing = drafts.filter((draft) => !draft.title);
  console.log(
    `星夜构建完成 · ${posts.length} 篇文章 / ${Object.keys(constellations).length} 条星座 / ${drafts.length} 颗未完成的星` +
      (draftsMissing.length > 0 ? ` · ${draftsMissing.length} 个草稿缺标题` : "")
  );
}

main();
