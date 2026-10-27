/**
 * serve.mjs — 本地预览服务（零依赖，只用 node:http）。
 *
 *   node serve.mjs            构建一次后起服务
 *   node serve.mjs --watch    监听 content/ 与 assets/，改动自动重建
 *   node serve.mjs --port 4100
 */
import { createServer } from "node:http";
import { existsSync, readFileSync, statSync, watch } from "node:fs";
import { extname, join, normalize, sep } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = dirname(fileURLToPath(import.meta.url));
const DIST = join(ROOT, "dist");

const args = process.argv.slice(2);
const watchMode = args.includes("--watch");
const portArg = args.indexOf("--port");
const PORT = portArg >= 0 ? Number(args[portArg + 1]) : 4173;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
};

function build() {
  const result = spawnSync(process.execPath, [join(ROOT, "build.mjs")], { stdio: "inherit" });
  if (result.status !== 0) console.error("构建失败，继续提供上一版 dist/");
}

function resolvePath(urlPath) {
  const raw = decodeURIComponent(urlPath.split("?")[0].split("#")[0]);
  // 部署在子路径（如 /xingye/）时，本地预览也接受带前缀的地址
  const base = (process.env.XINGYE_BASE ?? "").trim().replace(/\/+$/, "");
  const withoutBase = base !== "" && raw.startsWith(`${base}/`) ? raw.slice(base.length) : raw === base ? "/" : raw;
  const clean = withoutBase;
  const relative = normalize(clean).replace(/^([/\\])+/, "");
  const target = join(DIST, relative);
  if (!target.startsWith(DIST + sep) && target !== DIST) return null;
  if (existsSync(target) && statSync(target).isDirectory()) {
    const index = join(target, "index.html");
    return existsSync(index) ? index : null;
  }
  if (existsSync(target)) return target;
  // 允许省略 .html
  const withHtml = `${target}.html`;
  if (!extname(target) && existsSync(withHtml)) return withHtml;
  return null;
}

build();

if (watchMode) {
  let timer = 0;
  for (const dir of ["content", "assets", "public", "src"]) {
    const target = join(ROOT, dir);
    if (!existsSync(target)) continue;
    watch(target, { recursive: true }, () => {
      clearTimeout(timer);
      timer = setTimeout(build, 180);
    });
  }
  console.log("watch 模式：content/ assets/ public/ src/ 改动会自动重建");
}

createServer((request, response) => {
  const file = resolvePath(request.url ?? "/");
  if (file === null) {
    const notFound = join(DIST, "404.html");
    response.writeHead(404, { "content-type": MIME[".html"] });
    response.end(existsSync(notFound) ? readFileSync(notFound) : "<h1>404 · 这里没有星</h1>");
    return;
  }
  const type = MIME[extname(file).toLowerCase()] ?? "application/octet-stream";
  response.writeHead(200, { "content-type": type, "cache-control": "no-store" });
  response.end(readFileSync(file));
}).listen(PORT, "127.0.0.1", () => {
  console.log(`星夜预览：http://127.0.0.1:${PORT}/`);
});
