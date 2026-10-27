---
title: 一只住在桌面的鲸鱼，和它替我盯着的余额
slug: desktop-whale-balance
date: 2026-10-25
constellation: dsh-lab
provenance: human
summary: 装一个桌面挂件，结果顺手学到了"Dsh 插件到底怎么装才对"这件事。
tags: [dsh, 插件, 工具]
reading: 7
---

我在桌面右下角养了一只鲸鱼。它会根据当前任务换姿势，气泡里写着余额、今日已用、现在是高峰还是空闲。

装它花的时间比预想久，但踩的两个坑值得记下来。

## 坑一：插件要装在 profile 里，不是装在应用里

官方桌面端的插件目录是 `~/.dsh/profiles/desktop/`。用桌面端自带的 CLI 装：

```powershell
dsh plugin --profile desktop add dsh-dafeiyu@0.1.19
```

它会同时做三件事：写 `package.json` 依赖、跑 pnpm 把包放进 `node_modules`、把包名追加到 `dsh.profile.bundles`。

::: caveat 别用系统里的 dsh
独立安装的 npm CLI 改不了官方桌面端的 profile —— 它服务的是另一份安装。
:::

## 坑二：装上了，但设置页面没出现

挂件出现了，右键只有三项：角色大小、气泡大小、减少动态。完整的十二项设置不见了。

翻它的 client bundle 才明白：它把配置卡注册进三个 slot ——

```js
for (const slot of ['plugins.bundle.config', 'settings.plugins.tab', 'settings.plugin.item'])
  ctx.slots.inject(slot, registerCard(slot))
```

`settings.plugin.item` 在这个版本里不存在（作者做的多版本兼容，静默跳过）；真正生效的是 `plugins.bundle.config`，也就是**左侧「插件」页里该组合包的详情区** —— 而且**必须刷新页面**才会重新挂载。

## 顺手发现的事

它的 host 半侧还开了几个本地路由，我直接用来查真实数据：

```text
GET  /plugins/dsh-dafeiyu/balance
{"available":true,"balances":[{"currency":"CNY","granted":"4.6378","total":"4.6378"}],
 "source":"account","status":"ready","summary":"账户 余额 ¥4.6378"}

GET   /plugins/dsh-dafeiyu/config     # 当前配置
PATCH /plugins/dsh-dafeiyu/config     # 改任意一项（设置页背后就是这个）
```

::: split 我不同意这个做法
作者用 PATCH 绕过 UI 直接改配置，理由是"UI 坏了也能用"。

但这么做会让**状态有两个入口**：以后在 UI 里改，和用脚本改，可能互相覆盖而没人知道是谁改的。我建议给这类"带外操作"加一个 `updatedBy` 字段记来源，否则半年后会出现"为什么我的设置自己变了"。
:::

## 现在它在我这儿的样子

- 缩放 55%，气泡 80%，安静模式
- 页面内角色开着（网页右下角也有一只）
- 余额每 60 秒刷一次，变化时才冒泡

一只会盯着余额的鲸鱼，比我自己的记账习惯可靠多了。
