/**
 * site.js — 全站行为：
 *   1. 按本地时间给 <html data-night> 四种夜色（白昼/暮色/深夜/凌晨）
 *   2. `/` 打开星尘检索（只在有星表的页面）
 *   3. 快捷键：g 星图 · v 草稿箱 · n 今夜 · o 观测台
 *   4. 文章页：右侧星轨随阅读高亮
 */
(() => {
  /* GitHub Pages 项目站部署在子路径下，所有运行时跳转都要带前缀 */
  const BASE = typeof window.__XINGYE_BASE__ === "string" ? window.__XINGYE_BASE__ : "";
  const url = (path) => `${BASE}${path}`;

  /* ── 1. 夜色 ─────────────────────────────────────── */
  const nightOf = (date) => {
    const hour = date.getHours();
    if (hour >= 4 && hour < 6) return "dawn";
    if (hour >= 6 && hour < 17) return "day";
    if (hour >= 17 && hour < 21) return "dusk";
    return "deep";
  };

  const root = document.documentElement;
  const applyNight = () => {
    const mode = nightOf(new Date());
    if (root.dataset.night !== mode) root.dataset.night = mode;
  };
  applyNight();
  window.setInterval(applyNight, 60 * 1000);

  /* ── 2. 星尘检索 ─────────────────────────────────── */
  const rows = [...document.querySelectorAll(".star-row")];
  if (rows.length > 0) {
    const palette = document.createElement("div");
    palette.className = "palette";
    palette.hidden = true;
    palette.innerHTML =
      '<div class="palette-box" role="dialog" aria-label="星尘检索">' +
      '<input id="palette-input" type="search" placeholder="搜索星星：标题、摘要、星座…" autocomplete="off" spellcheck="false">' +
      '<ul class="palette-list" id="palette-list"></ul>' +
      '<p class="palette-hint">↑↓ 选择 · Enter 打开 · Esc 关闭</p>' +
      "</div>";
    document.body.appendChild(palette);

    const input = palette.querySelector("#palette-input");
    const list = palette.querySelector("#palette-list");
    let matches = [];
    let cursor = 0;

    const renderMatches = () => {
      const query = input.value.trim().toLowerCase();
      matches = rows
        .filter((row) => (query === "" ? true : row.textContent.toLowerCase().includes(query)))
        .slice(0, 8);
      cursor = 0;
      list.innerHTML = matches
        .map((row, index) => {
          const title = row.querySelector(".star-row-title")?.textContent ?? "";
          const meta = row.querySelector(".star-row-meta")?.textContent ?? "";
          return `<li${index === cursor ? ' class="is-active"' : ""}><a href="${row.getAttribute("href")}"><span>${title}</span><em>${meta}</em></a></li>`;
        })
        .join("") || '<li class="is-empty"><span>没有匹配的星</span></li>';
    };

    const openPalette = () => {
      palette.hidden = false;
      renderMatches();
      input.value = "";
      input.focus();
      renderMatches();
    };
    const closePalette = () => {
      palette.hidden = true;
    };

    input.addEventListener("input", renderMatches);
    input.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closePalette();
        return;
      }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        if (matches.length === 0) return;
        cursor = (cursor + (event.key === "ArrowDown" ? 1 : matches.length - 1)) % matches.length;
        [...list.children].forEach((li, index) => li.classList.toggle("is-active", index === cursor));
        list.children[cursor]?.scrollIntoView({ block: "nearest" });
        return;
      }
      if (event.key === "Enter") {
        const target = matches[cursor];
        if (target) window.location.href = target.getAttribute("href");
      }
    });
    palette.addEventListener("click", (event) => {
      if (event.target === palette) closePalette();
    });

    window.addEventListener("keydown", (event) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName ?? "");
      if (event.key === "/" && !typing) {
        event.preventDefault();
        openPalette();
      }
    });
  }

  /* ── 3. 快捷键 ───────────────────────────────────── */
  window.addEventListener("keydown", (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName ?? "");
    if (typing) return;
    const map = { g: url("/"), v: url("/vault.html"), n: url("/night.html"), o: url("/observatory.html") };
    const href = map[event.key.toLowerCase()];
    if (href) window.location.href = href;
  });

  /* ── 4. 星轨高亮 ─────────────────────────────────── */
  const trailLinks = [...document.querySelectorAll(".trail a")];
  if (trailLinks.length > 0) {
    const targets = trailLinks
      .map((link) => {
        const id = decodeURIComponent(link.getAttribute("href")?.slice(1) ?? "");
        const node = id ? document.getElementById(id) : null;
        return node ? { link, node } : null;
      })
      .filter(Boolean);

    const update = () => {
      const offset = window.innerHeight * 0.28;
      let current = targets[0];
      for (const target of targets) {
        if (target.node.getBoundingClientRect().top <= offset) current = target;
      }
      for (const target of targets) target.link.classList.toggle("is-current", target === current);
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
  }
  /* ── 5. 观测助理 ─────────────────────────────────── */
  const assistant = document.getElementById("assistant");
  if (assistant) {
    const closeButton = document.getElementById("assistant-close");
    const owl = document.getElementById("assistant-owl");
    const textNode = document.getElementById("assistant-text");
    const bubble = document.getElementById("assistant-bubble");
    const HIDE_KEY = "xingye:assistant-hidden";
    const page = document.body.dataset.page ?? "home";

    try {
      if (localStorage.getItem(HIDE_KEY) === "1") assistant.dataset.hidden = "true";
    } catch {
      /* 隐私模式 */
    }

    closeButton?.addEventListener("click", () => {
      assistant.dataset.hidden = "true";
      try {
        localStorage.setItem(HIDE_KEY, "1");
      } catch {
        /* 忽略 */
      }
    });

    owl?.addEventListener("click", () => {
      window.location.href = url("/observatory.html");
    });

    const lines = {
      home: [
        "按住 Shift 点两颗星，可以连成一条阅读路径",
        "亮一点的星是长文，位置从左到右是时间",
        "按 / 可以直接搜星星",
        "星座不是标签，是一条线索",
      ],
      star: [
        "紫色框是 Agent 说的话，不是作者",
        "顶部的徽章告诉你这篇是谁写的",
        "右侧星轨会跟着你读到哪",
        "按 g 回星图，按 v 去草稿箱",
      ],
      vault: ["这里允许半成品存在", "进度条是作者自己填的，别当成 KPI"],
      constellations: ["点进一条星座线，会看到它按时间生长"],
      night: ["今夜页是手工更新的，不自动生成"],
      observatory: ["出处政策在这里写得很清楚：谁说的，比说什么更重要"],
    };
    const pool = lines[page] ?? lines.home;
    let cursor = 0;

    if (textNode && pool.length > 0) {
      window.setInterval(() => {
        if (assistant.dataset.hidden === "true") return;
        cursor = (cursor + 1) % pool.length;
        textNode.textContent = pool[cursor];
        bubble?.animate?.(
          [
            { opacity: 0.25, transform: "translateY(3px)" },
            { opacity: 1, transform: "none" },
          ],
          { duration: 260, easing: "ease-out" }
        );
      }, 9000);
    }
  }
})();
