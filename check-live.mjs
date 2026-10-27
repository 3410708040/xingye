/**
 * check-live.mjs — 用 Node 原生 fetch 复查线上地址（curl 在国内容易 000）。
 * 用法：node check-live.mjs https://3410708040.github.io/xingye
 */
const base = (process.argv[2] ?? "").replace(/\/$/, "");
const paths = ["/", "/assets/main.css", "/assets/sky.js", "/star/night-is-honest.html", "/feed.xml", "/sitemap.xml", "/robots.txt", "/data/starmap.json", "/404.html", "/CNAME"];

const attempt = async (url, tries = 3) => {
  for (let index = 0; index < tries; index += 1) {
    try {
      const response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(15000) });
      return { status: response.status, length: (await response.arrayBuffer()).byteLength };
    } catch (error) {
      if (index === tries - 1) return { status: "ERR", length: 0, error: error.message };
    }
  }
};

for (const path of paths) {
  const result = await attempt(`${base}${path}`);
  const flag = result.status === 200 ? "✓" : result.status === 404 ? "✗404" : `?${result.status}`;
  console.log(`${flag} ${path} (${result.length} bytes)`);
}
