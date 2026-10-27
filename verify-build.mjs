/**
 * verify-build.mjs — 检查构建产物：子路径前缀、canonical、RSS、404。
 * 用法（先构建）：
 *   $env:XINGYE_BASE="/xingye"; $env:XINGYE_URL="https://x.github.io/xingye"; node build.mjs
 *   node verify-build.mjs /xingye
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dist = join(dirname(fileURLToPath(import.meta.url)), "dist");
const base = (process.argv[2] ?? "").trim();
const read = (name) => readFileSync(join(dist, name), "utf8");
const count = (text, pattern) => (text.match(pattern) ?? []).length;

const index = read("index.html");
const post = read("star/night-is-honest.html");
const notFound = existsSync(join(dist, "404.html"));
const feed = read("feed.xml");

const bare = base === "" ? /href="\/(?!\/)/g : new RegExp(`href="/(?!${base.replace(/^\//, "")}/)`, "g");
const rows = [
  ["首页 href 带前缀", base === "" ? "n/a" : count(index, new RegExp(`href="${base}/`, "g"))],
  ["首页 src 带前缀", base === "" ? "n/a" : count(index, new RegExp(`src="${base}/`, "g"))],
  ["首页残留裸站内链接", count(index, bare)],
  ["文章页残留裸站内链接", count(post, bare)],
  ["星空数据 href 带前缀", base === "" ? "n/a" : count(index, new RegExp(`"href":"${base}/`, "g"))],
  ["canonical", /<link rel="canonical" href="([^"]+)"/.exec(index)?.[1] ?? "缺失"],
  ["runtime base", /window\.__XINGYE_BASE__=([^;]+);/.exec(index)?.[1] ?? "缺失"],
  ["404.html", notFound ? "有" : "缺失"],
  ["RSS 首条链接", /<link>([^<]+)<\/link>/.exec(feed)?.[1] ?? "缺失"],
  ["RSS 域名", /<link>([^<]+)<\/link>/.exec(feed)?.[1]?.includes("github.io") ? "ok" : "可疑"],
];

let failed = 0;
for (const [label, value] of rows) {
  const bad = value === "缺失" || (label.includes("残留") && Number(value) > 0);
  if (bad) failed += 1;
  console.log(`${bad ? "✗" : "✓"} ${label}: ${value}`);
}
console.log(failed === 0 ? "\n全部通过" : `\n${failed} 项需要检查`);
process.exitCode = failed === 0 ? 0 : 1;
