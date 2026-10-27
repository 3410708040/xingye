/**
 * template.mjs — 页面外壳：星夜的头、导航、页脚、开机仪式与观测台状态条。
 *
 * 所有页面共用同一层壳；差异只在 <body data-page> 和额外的脚本。
 */

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/** HTML 转义。 */
export function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ESCAPES[char]);
}

const NAV = [
  { href: "/", label: "星图", key: "home" },
  { href: "/constellations.html", label: "星座", key: "constellations" },
  { href: "/vault.html", label: "草稿箱", key: "vault" },
  { href: "/night.html", label: "今夜", key: "night" },
  { href: "/observatory.html", label: "观测台", key: "observatory" },
];

/** 观测助理 · 夜鸮（纯 SVG，无外部资源） */
const OWL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="观测助理">
  <defs>
    <linearGradient id="owlBody" x1="0.2" y1="0" x2="0.8" y2="1">
      <stop offset="0" stop-color="#b9c8f2"/>
      <stop offset="0.55" stop-color="#8ea6e0"/>
      <stop offset="1" stop-color="#6d84c4"/>
    </linearGradient>
    <linearGradient id="owlFace" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff8f2"/>
      <stop offset="1" stop-color="#ecd9d2"/>
    </linearGradient>
  </defs>
  <ellipse class="owl-glow" cx="32" cy="36" rx="22" ry="20" fill="rgba(122,167,255,0.18)"/>
  <path d="M14 22 L20 8 L27 20 Z" fill="url(#owlBody)"/>
  <path d="M50 22 L44 8 L37 20 Z" fill="url(#owlBody)"/>
  <ellipse cx="32" cy="34" rx="20" ry="19" fill="url(#owlBody)"/>
  <ellipse cx="32" cy="36" rx="14" ry="13" fill="url(#owlFace)"/>
  <ellipse cx="25" cy="33" rx="5.4" ry="5.8" fill="#2b3a63"/>
  <ellipse cx="39" cy="33" rx="5.4" ry="5.8" fill="#2b3a63"/>
  <g class="owl-eye">
    <circle cx="23.4" cy="31.2" r="2" fill="#ffffff"/>
    <circle cx="37.4" cy="31.2" r="2" fill="#ffffff"/>
    <circle cx="26.4" cy="35.4" r="1" fill="#ffffff" opacity="0.8"/>
    <circle cx="40.4" cy="35.4" r="1" fill="#ffffff" opacity="0.8"/>
  </g>
  <path d="M32 36.5 L35 41 L32 43 L29 41 Z" fill="#f0a24b"/>
  <path d="M17 36 C13 42 14 48 18 51 C21 46 21 41 19 36 Z" fill="#7b93d0"/>
  <path d="M47 36 C51 42 50 48 46 51 C43 46 43 41 45 36 Z" fill="#7b93d0"/>
  <path d="M32 17 L33.3 20.6 L37 21.6 L33.3 22.7 L32 26.3 L30.7 22.7 L27 21.6 L30.7 20.6 Z" fill="#ffd7e8"/>
  <path d="M26 53 L26 57 M38 53 L38 57" stroke="#f0a24b" stroke-width="1.8" stroke-linecap="round"/>
</svg>`;

/** 观测台状态条：从 status.json 投影成一行小字。 */
function statusLine(status) {
  const bits = [];
  if (status.drafts > 0) bits.push(`${status.drafts} 颗未完成的星`);
  if (status.idea) bits.push(status.idea);
  if (status.updated) bits.push(`上次更新 ${status.updated}`);
  const text = bits.length > 0 ? bits.join(" · ") : "今夜风平浪静";
  return `<p class="status-line"><span class="status-dot" aria-hidden="true"></span>今夜观测 · ${esc(text)}</p>`;
}

/**
 * 渲染一层页面壳。
 * @param {{
 *   site: { name: string, romanized: string, tagline: string, description: string, author: string, url?: string },
 *   title: string,
 *   description?: string,
 *   body: string,
 *   page: string,
 *   path: string,
 *   status?: { drafts?: number, idea?: string, updated?: string },
 *   scripts?: string[],
 *   styles?: string[],
 *   bodyAttrs?: string,
 * }} options
 * @returns {string}
 */
export function renderPage(options) {
  const { site, title, description, body, page, path, status = {}, scripts = [], styles = [], bodyAttrs = "" } = options;
  const fullTitle = page === "home" ? `${site.name} · ${site.tagline}` : `${title} · ${site.name}`;
  const desc = description ?? site.description;
  const nav = NAV.map((item) => {
    const current = item.key === page ? ' aria-current="page"' : "";
    return `<a href="${item.href}"${current}>${esc(item.label)}</a>`;
  }).join("");

  const css = ["/assets/main.css", ...styles].map((href) => `<link rel="stylesheet" href="${href}">`).join("\n  ");
  const js = ["/assets/boot.js", ...scripts].map((src) => `<script src="${src}" defer></script>`).join("\n  ");

  return `<!doctype html>
<html lang="zh-CN" data-night="deep">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(fullTitle)}</title>
  <meta name="description" content="${esc(desc)}">
  <meta name="author" content="${esc(site.author)}">
  <meta name="color-scheme" content="dark">
  <meta name="theme-color" content="#0b1026">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${esc(fullTitle)}">
  <meta property="og:description" content="${esc(desc)}">
  <link rel="icon" href="/assets/star.svg" type="image/svg+xml">
  <link rel="alternate" type="application/rss+xml" title="${esc(site.name)}" href="/feed.xml">
  <link rel="canonical" href="${esc((site.url ?? "") + path)}">
  <script>window.__XINGYE_BASE__=${JSON.stringify(site.base ?? "")};</script>
  ${css}
</head>
<body data-page="${esc(page)}"${bodyAttrs}>
  <div class="boot" id="boot" role="status" aria-label="正在校准星图">
    <div class="boot-sky" aria-hidden="true"></div>
    <div class="boot-core">
      <p class="boot-mark">${esc(site.name)}</p>
      <p class="boot-roman">${esc(site.romanized)}</p>
      <div class="boot-meter" aria-hidden="true"><i></i></div>
      <p class="boot-steps" aria-hidden="true"><span>定位天顶</span><span>校准星图</span><span>就绪</span></p>
      <p class="boot-hint">正在校准星图…<span class="boot-skip">点击或按任意键跳过</span></p>
    </div>
  </div>

  <div class="grain" aria-hidden="true"></div>

  <header class="masthead">
    <a class="brand" href="/">
      <span class="brand-glyph" aria-hidden="true">✦</span>
      <span class="brand-text">${esc(site.name)}<em>${esc(site.romanized)}</em></span>
    </a>
    <nav class="main-nav" aria-label="主导航">${nav}</nav>
    ${statusLine(status)}
  </header>

  <main id="main">
${body}
  </main>

  <footer class="site-footer">
    <p>${esc(site.name)} · ${esc(site.tagline)}</p>
    <p class="voice-legend">
      <span class="badge badge-human">HUMAN</span> 人写
      <span class="badge badge-cowritten">CO-WRITTEN</span> 人机合写
      <span class="badge badge-agent">AGENT DRAFT</span> Agent 起草
    </p>
  </footer>

  <div class="assistant" id="assistant" aria-live="polite">
    <div class="assistant-bubble" id="assistant-bubble">
      <button type="button" id="assistant-close" aria-label="收起助理">×</button>
      <span id="assistant-text">今夜观测：${esc(status.hint ?? "星图已校准")}</span>
    </div>
    <button class="assistant-owl" type="button" id="assistant-owl" aria-label="观测助理，点击进入观测台" title="观测助理 · 点击进入观测台">
      ${OWL_SVG}
    </button>
  </div>

  ${js}
</body>
</html>
`;
}
