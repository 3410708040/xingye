/**
 * inspect-live.mjs — 抓线上首页并检查关键标记（title / base / 链接前缀）。
 * 用法：node inspect-live.mjs https://3410708040.github.io/xingye
 */
const base = (process.argv[2] ?? "").replace(/\/$/, "");

const get = async (url) => {
  for (let index = 0; index < 3; index += 1) {
    try {
      const response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(20000) });
      return { status: response.status, text: await response.text() };
    } catch (error) {
      if (index === 2) return { status: "ERR", text: "", error: error.message };
    }
  }
};

const home = await get(`${base}/`);
if (home.status !== 200) {
  console.log("fetch failed:", home.status, home.error ?? "");
  process.exit(1);
}
const text = home.text;
const title = /<title>([^<]+)<\/title>/.exec(text)?.[1] ?? "（缺失）";
const baseValue = /window\.__XINGYE_BASE__=([^;]+);/.exec(text)?.[1] ?? '""';
const basePath = baseValue.replace(/^["']|["']$/g, "");
const allHrefs = text.match(/href="\/[^"]*"/g) ?? [];
const prefixed = basePath === "" ? 0 : allHrefs.filter((item) => item.startsWith(`href="${basePath}/`)).length;
const bare = allHrefs.filter((item) => !item.startsWith(`href="${basePath}/`)).length;

console.log(`status      ${home.status}`);
console.log(`bytes       ${Buffer.byteLength(text, "utf8")}`);
console.log(`title       ${title}`);
console.log(`base        ${baseValue}`);
console.log(`站内路径数  ${allHrefs.length}（带前缀 ${prefixed} / 裸链 ${bare}）`);

const css = await get(`${base}/assets/main.css`);
console.log(`css         ${css.status} (${Buffer.byteLength(css.text, "utf8")} bytes)`);
