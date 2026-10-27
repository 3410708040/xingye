/**
 * set-domain.mjs — 一条命令切换站点域名。
 *
 *   node set-domain.mjs xingye.blog      # 绑定自定义域名（根路径 + 写 CNAME）
 *   node set-domain.mjs --pages          # 回到 GitHub Pages 项目站（/xingye 子路径）
 *
 * 它只改 content/site.json，然后做一次本地构建自检，并把要填的 DNS 记录打印出来。
 * 真正的 push 由你决定（脚本不会自动提交）。
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const configPath = join(here, "content", "site.json");
const config = JSON.parse(readFileSync(configPath, "utf8"));
const arg = (process.argv[2] ?? "").trim();

if (arg === "") {
  console.log(`
当前配置：
  domain : ${config.domain ?? "（未绑定）"}
  url    : ${config.url ?? "（空）"}
  base   : ${config.base ?? "（空）"}

用法：
  node set-domain.mjs xingye.blog   # 绑定自定义域名
  node set-domain.mjs --pages       # 回到 <owner>.github.io/<repo> 子路径部署
`);
  process.exit(0);
}

if (arg === "--pages") {
  config.domain = "";
  config.url = "";
  config.base = "";
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  console.log("已切回 Pages 项目站模式（构建时由工作流注入 /<repo> 与完整地址）");
  process.exit(0);
}

const domain = arg.replace(/^https?:\/\//, "").replace(/\/.*$/, "").toLowerCase();
if (!/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/.test(domain)) {
  console.error(`域名看起来不对：${domain}`);
  process.exit(1);
}

config.domain = domain;
config.url = `https://${domain}`;
config.base = "";
writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");

// 本地构建自检（CNAME / canonical / 链接前缀）
execFileSync(process.execPath, [join(here, "build.mjs")], {
  cwd: here,
  env: { ...process.env, XINGYE_DOMAIN: domain, XINGYE_URL: `https://${domain}`, XINGYE_BASE: "" },
  stdio: "inherit",
});
const cname = readFileSync(join(here, "dist", "CNAME"), "utf8").trim();
const index = readFileSync(join(here, "dist", "index.html"), "utf8");
const canonical = /<link rel="canonical" href="([^"]+)"/.exec(index)?.[1] ?? "";

console.log(`
已写入 content/site.json：
  domain = ${config.domain}
  url    = ${config.url}
  base   = （根路径）

构建自检：
  dist/CNAME        = ${cname}
  canonical         = ${canonical}

接下来（顺序别乱）：

1) DNS（在你买域名的服务商后台加这些记录）
   顶点域名 ${domain}：
     A     @    185.199.108.153
     A     @    185.199.109.153
     A     @    185.199.110.153
     A     @    185.199.111.153
     AAAA  @    2606:50c0:8000::153
     AAAA  @    2606:50c0:8001::153
     AAAA  @    2606:50c0:8002::153
     AAAA  @    2606:50c0:8003::153
   www 子域：
     CNAME www  3410708040.github.io

2) 提交并推送
     git add -A && git commit -m "chore: 绑定域名 ${domain}" && git push

3) GitHub 仓库 → Settings → Pages → Custom domain 填 ${domain} → Save
   等 DNS 检查通过后勾选 Enforce HTTPS
`);
