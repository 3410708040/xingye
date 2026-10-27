/**
 * frontmatter.mjs — 极简 frontmatter 解析（YAML 头 + 正文）。
 *
 * 约定：文件以 `---\n` 开头时，第一段夹在 `---` 之间的内容是 YAML，其余是正文。
 * 解析失败直接抛错（构建期就该炸，别让脏数据上线）。
 */
import yaml from "js-yaml";

const DELIM = /^---\s*$/;

/**
 * @param {string} raw 文件原文
 * @returns {{ data: Record<string, any>, body: string }}
 */
export function parseFrontmatter(raw) {
  const text = String(raw).replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const lines = text.split("\n");
  if (!DELIM.test(lines[0] ?? "")) return { data: {}, body: text };

  const end = lines.findIndex((line, index) => index > 0 && DELIM.test(line));
  if (end < 0) throw new Error("frontmatter: 缺少结尾的 ---");

  const header = lines.slice(1, end).join("\n");
  const body = lines.slice(end + 1).join("\n");
  const data = header.trim() === "" ? {} : yaml.load(header);
  if (data !== null && typeof data !== "object") throw new Error("frontmatter: 头部必须是对象");
  return { data: data ?? {}, body };
}

/** 把 Date 变成 `YYYY-MM-DD`。 */
export function isoDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  const text = String(value ?? "").trim();
  const match = /^\d{4}-\d{2}-\d{2}/.exec(text);
  return match ? match[0] : text;
}
