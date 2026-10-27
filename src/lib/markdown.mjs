/**
 * markdown.mjs — 文章渲染：Markdown + 双声道容器 + 代码高亮 + 标题锚点。
 *
 * 双声道语法（这就是「人机共写」在内容层的实现）：
 *
 *   ::: agent 观测日志
 *   这一段 Agent 不同意……
 *   :::
 *
 *   ::: split 我不同意
 *   当作者说「……」时，我这边有一条反例。
 *   :::
 *
 *   ::: caveat
 *   给自己的提醒，不属于正文。
 *   :::
 */
import MarkdownIt from "markdown-it";
import container from "markdown-it-container";
import hljs from "highlight.js";

const NOTE_KINDS = {
  agent: { className: "agent-note", label: "AGENT · 观测日志" },
  split: { className: "agent-note agent-split", label: "AGENT · 分歧" },
  caveat: { className: "caveat", label: "备忘" },
};

/** GitHub 风格的 slug（只保留字母数字与中日韩字符）。 */
export function slugify(text) {
  return String(text)
    .trim()
    .toLowerCase()
    .replace(/[\s]+/g, "-")
    .replace(/[^\p{Letter}\p{Number}\-]+/gu, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
}

function createMarkdown() {
  const md = new MarkdownIt({
    html: false,
    linkify: true,
    typographer: true,
    highlight(code, language) {
      const lang = String(language ?? "").trim();
      if (lang && hljs.getLanguage(lang)) {
        try {
          return `<pre class="code"><code class="hljs language-${lang}">${hljs.highlight(code, { language: lang }).value}</code></pre>`;
        } catch {
          /* 落到下面 */
        }
      }
      return `<pre class="code"><code class="hljs">${md.utils.escapeHtml(code)}</code></pre>`;
    },
  });

  for (const [kind, spec] of Object.entries(NOTE_KINDS)) {
    md.use(container, kind, {
      validate: (params) => params.trim().split(/\s+/)[0] === kind,
      render(tokens, index) {
        const token = tokens[index];
        if (token.nesting === 1) {
          const title = token.info.trim().slice(kind.length).trim();
          const label = title === "" ? spec.label : title;
          const kindAttr = ` data-voice="${kind}"`;
          return `<aside class="${spec.className}"${kindAttr}><p class="voice-label">${md.utils.escapeHtml(label)}</p>\n`;
        }
        return "</aside>\n";
      },
    });
  }

  // 标题锚点
  md.renderer.rules.heading_open = (tokens, index) => {
    const inline = tokens[index + 1];
    const text = inline && inline.type === "inline" ? inline.content : "";
    const id = slugify(text);
    const level = tokens[index].tag;
    return `<${level} id="${id}"><a class="anchor" href="#${id}" aria-label="锚点">#</a>`;
  };
  md.renderer.rules.heading_close = (tokens, index) => `</${tokens[index].tag}>`;

  // 外链新开窗口
  const defaultLink = md.renderer.rules.link_open ?? ((tokens, index, options, env, self) => self.renderToken(tokens, index, options));
  md.renderer.rules.link_open = (tokens, index, options, env, self) => {
    const href = tokens[index].attrGet("href") ?? "";
    if (/^https?:\/\//i.test(href)) {
      tokens[index].attrSet("target", "_blank");
      tokens[index].attrSet("rel", "noopener noreferrer");
    }
    return defaultLink(tokens, index, options, env, self);
  };

  return md;
}

const md = createMarkdown();

/**
 * 渲染正文 HTML。
 * @param {string} body Markdown 正文
 * @returns {string} HTML
 */
export function renderMarkdown(body) {
  return md.render(String(body ?? ""));
}

/**
 * 抽出正文里的小标题，做右侧"星轨"目录。
 * @param {string} body Markdown 正文
 * @returns {{ level: number, text: string, id: string }[]}
 */
export function outlineOf(body) {
  const tokens = md.parse(String(body ?? ""), {});
  const result = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.type !== "heading_open") continue;
    const inline = tokens[index + 1];
    const text = inline && inline.type === "inline" ? inline.content : "";
    result.push({ level: Number(token.tag.slice(1)), text, id: slugify(text) });
  }
  return result;
}
