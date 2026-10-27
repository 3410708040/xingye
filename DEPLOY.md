# 星夜 · 部署

产物是纯静态的 `dist/`，三条路任选一条。**上线前记得把正式域名告诉构建**（`XINGYE_URL`），
RSS / sitemap / canonical 全靠它。

---

## 方案 A · GitHub Pages（免费、最省事）

1. 建仓库，把 `xingye/` 整个推上去（`main` 分支）：

   ```powershell
   cd xingye
   git init
   git add .
   git commit -m "xingye: initial"
   git branch -M main
   git remote add origin https://github.com/<你的用户名>/xingye.git
   git push -u origin main
   ```

2. 仓库 **Settings → Pages → Build and deployment → Source** 选 **GitHub Actions**。
3. 仓库 **Settings → Secrets and variables → Actions → Variables** 新增
   `XINGYE_URL = https://<你的用户名>.github.io/xingye`（用自定义域名就填域名）。
4. 推一次代码即触发 `.github/workflows/deploy.yml`，构建 + 发布一条龙。
   `build.mjs` 会写 `dist/.nojekyll`，所以 `_` 开头的路径不会被 Jekyll 吞掉。

> 自定义域名：Pages 里填 Custom domain，并在 DNS 加 CNAME；再把 `XINGYE_URL` 改成那个域名。

## 方案 B · Vercel

```powershell
npm i -g vercel
cd xingye
vercel            # 首次会问项目名，直接回车
vercel --prod
```

已带 `vercel.json`：build command = `node build.mjs`，输出目录 = `dist`，`cleanUrls` 打开
（所以 `/star/foo` 和 `/star/foo.html` 都能访问）。

环境变量：Vercel 项目 → Settings → Environment Variables 加 `XINGYE_URL`。

## 方案 C · Cloudflare Pages

```powershell
npm i -g wrangler
cd xingye
wrangler pages deploy dist --project-name xingye
```

或在 Cloudflare Dashboard 连 Git 仓库：Build command `node build.mjs`，Output directory `dist`，
环境变量 `XINGYE_URL=https://xingye.pages.dev`。

## 方案 D · 自己的服务器（rsync）

```bash
node build.mjs
rsync -avz --delete dist/ user@host:/var/www/xingye/
```

Nginx 片段（把 `.html` 省略的路径也接上）：

```nginx
location / {
  try_files $uri $uri.html $uri/ =404;
}
```

---

## 上线检查清单

- [ ] `content/site.json` 的 `url` 或环境变量 `XINGYE_URL` 已是正式域名
- [ ] `/feed.xml`、`/sitemap.xml`、`/robots.txt` 里的域名正确
- [ ] 首页星图能点、能连线（Shift + 点击两颗星）
- [ ] 文章页星轨、双声道样式正常
- [ ] 手机宽度下顶部状态条不溢出
- [ ] 站点分享预览：把首页链接贴到 IM 里，确认标题/描述正确

## 本地验证生产构建

```powershell
$env:XINGYE_URL = "https://xingye.example.com"
node build.mjs
node serve.mjs   # http://127.0.0.1:4173/ ，和线上是同一份 dist
```
