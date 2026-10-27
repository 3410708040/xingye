/**
 * sky.js — 首页星图（手写 Canvas）。
 *
 * 数据来自 #sky-data：文章 → 星，星座 → 连线。坐标是归一化的，所以同一片天空
 * 在手机和超宽屏上是同一个形状。
 *
 * 交互：鼠标移动做分层视差、悬停浮出星信息、点击进入文章；触摸设备上点一次
 * 直接进入。系统开启「减少动态」时关掉视差。
 */
(() => {
  const dataEl = document.getElementById("sky-data");
  const canvas = document.getElementById("sky");
  const tip = document.getElementById("sky-tip");
  if (!dataEl || !canvas || !tip) return;

  let data;
  try {
    data = JSON.parse(dataEl.textContent ?? "{}");
  } catch {
    return;
  }
  const stars = Array.isArray(data.stars) ? data.stars : [];
  const lines = Array.isArray(data.lines) ? data.lines : [];
  const anchors = Array.isArray(data.anchors) ? data.anchors : [];
  if (stars.length === 0) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isTouch = window.matchMedia("(hover: none)").matches;

  let width = 0;
  let height = 0;
  let dpr = 1;
  let hovered = -1;
  let dirty = true;
  const pointer = { x: 0.5, y: 0.5, inside: false };
  const meteors = [];
  let connectMode = false;
  /** 阅读路径：按顺序记录的 slug。存在 localStorage，也能用 #p=a,b 分享。 */
  let path = [];
  const PATH_KEY = "xingye:path";

  /* 背景微星：固定种子，所以每次刷新都是同一片底噪 */
  let seed = 20261027;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const ambient = Array.from({ length: 360 }, () => ({
    x: random(),
    y: random(),
    r: random() * 0.85 + 0.22,
    a: random() * 0.45 + 0.16,
  }));

  const parallax = () => (reduced ? { x: 0, y: 0 } : { x: (pointer.x - 0.5) * 2, y: (pointer.y - 0.5) * 2 });

  function project(star) {
    const shift = parallax();
    return {
      x: star.x * width + shift.x * 6,
      y: star.y * height + shift.y * 4,
    };
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    dirty = true;
  }

  function draw() {
    if (!dirty) return;
    dirty = false;
    const shift = parallax();
    ctx.clearRect(0, 0, width, height);

    /* 底噪星 */
    for (const star of ambient) {
      const x = star.x * width + shift.x * 3;
      const y = star.y * height + shift.y * 2;
      ctx.beginPath();
      ctx.arc(x, y, star.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(232, 240, 255, ${star.a})`;
      ctx.fill();
    }

    /* 星座连线 */
    ctx.setLineDash([2, 7]);
    ctx.lineWidth = 1;
    for (const line of lines) {
      if (!Array.isArray(line.points) || line.points.length < 2) continue;
      ctx.beginPath();
      line.points.forEach(([x, y], index) => {
        const px = x * width + shift.x * 5;
        const py = y * height + shift.y * 3;
        if (index === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.strokeStyle = "rgba(140, 180, 255, 0.38)";
      ctx.stroke();
    }
    ctx.setLineDash([]);

    /* 星座锚点：即使只有一颗星，也要让人看出"这里有四条阅读线" */
    const anchorByKey = new Map(anchors.map((anchor) => [anchor.key, anchor]));
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const anchor of anchors) {
      const radius = 13 + Math.min(6, anchor.count * 2);
      /* 环与名字都夹在画布内，窄屏也不会被切掉 */
      const x = Math.min(width - radius - 6, Math.max(radius + 6, anchor.x * width + shift.x * 5));
      const y = Math.min(height - radius - 22, Math.max(radius + 6, anchor.y * height + shift.y * 3));
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.strokeStyle = `hsla(${anchor.hue} 90% 74% / 0.22)`;
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(x, y, 1.6, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${anchor.hue} 100% 86% / 0.5)`;
      ctx.fill();

      ctx.font = '10px "SF Mono", "JetBrains Mono", Consolas, monospace';
      ctx.fillStyle = `hsla(${anchor.hue} 80% 82% / 0.42)`;
      const halfText = ctx.measureText(anchor.name).width / 2;
      const labelX = Math.min(width - halfText - 6, Math.max(halfText + 6, x));
      const labelY = Math.min(height - 8, y + radius + 12);
      ctx.textAlign = "center";
      ctx.fillText(anchor.name, labelX, labelY);
    }

    /* 锚点 → 属于它的星：一根淡线，说明这颗星挂在哪条阅读线上 */
    for (const star of stars) {
      const anchor = anchorByKey.get(star.constellation);
      if (!anchor) continue;
      const from = project({ x: anchor.x, y: anchor.y });
      const to = project(star);
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.strokeStyle = `hsla(${star.hue} 90% 78% / 0.18)`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    /* 星 */
    stars.forEach((star, index) => {
      const { x, y } = project(star);
      const radius = 1.6 + star.mag * 2.1;
      const active = index === hovered;
      const halo = ctx.createRadialGradient(x, y, 0, x, y, radius * 9);
      halo.addColorStop(0, `hsla(${star.hue} 100% 94% / ${active ? 0.98 : 0.82})`);
      halo.addColorStop(0.3, `hsla(${star.hue} 100% 76% / ${active ? 0.6 : 0.34})`);
      halo.addColorStop(1, `hsla(${star.hue} 100% 70% / 0)`);
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(x, y, radius * 9, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = `hsl(${star.hue} 100% 96%)`;
      ctx.fill();

      /* 十字星芒：让亮星更像"星"而不是"点" */
      const spike = radius * 4.2;
      const streak = ctx.createLinearGradient(x - spike, y, x + spike, y);
      streak.addColorStop(0, `hsla(${star.hue} 100% 88% / 0)`);
      streak.addColorStop(0.5, `hsla(${star.hue} 100% 92% / ${active ? 0.55 : 0.3})`);
      streak.addColorStop(1, `hsla(${star.hue} 100% 88% / 0)`);
      ctx.strokeStyle = streak;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - spike, y);
      ctx.lineTo(x + spike, y);
      ctx.stroke();

      if (active) {
        ctx.beginPath();
        ctx.arc(x, y, radius + 4, 0, Math.PI * 2);
        ctx.strokeStyle = `hsla(${star.hue} 100% 88% / 0.8)`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    });

    /* 阅读路径：连起来的那条线是全场最亮的东西 */
    if (path.length >= 2) {
      const points = path
        .map((slug) => stars.find((star) => star.slug === slug))
        .filter(Boolean)
        .map(project);
      const gradient = ctx.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, "rgba(122, 167, 255, 0.95)");
      gradient.addColorStop(0.5, "rgba(177, 140, 255, 0.95)");
      gradient.addColorStop(1, "rgba(255, 158, 203, 0.95)");
      ctx.beginPath();
      points.forEach((point, index) => (index === 0 ? ctx.moveTo(point.x, point.y) : ctx.lineTo(point.x, point.y)));
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 1.6;
      ctx.shadowColor = "rgba(122, 167, 255, 0.8)";
      ctx.shadowBlur = 12;
      ctx.stroke();
      ctx.shadowBlur = 0;

      points.forEach((point, index) => {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 2.2, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.95)";
        ctx.fill();
        ctx.font = '9px "SF Mono", Consolas, monospace';
        ctx.fillStyle = "rgba(232,240,255,0.75)";
        ctx.textAlign = "center";
        ctx.fillText(String(index + 1), point.x, point.y - 10);
      });
    }

    /* 流星：偶尔划一颗，给静态的夜空一点时间感 */
    if (meteors.length > 0) {
      const now = performance.now();
      for (let index = meteors.length - 1; index >= 0; index -= 1) {
        const meteor = meteors[index];
        const t = (now - meteor.start) / meteor.duration;
        if (t >= 1) {
          meteors.splice(index, 1);
          continue;
        }
        const ease = t * t;
        const headX = meteor.x + meteor.dx * ease;
        const headY = meteor.y + meteor.dy * ease;
        const tailX = headX - meteor.dx * 0.16;
        const tailY = headY - meteor.dy * 0.16;
        const fade = Math.sin(Math.PI * t);
        const trail = ctx.createLinearGradient(tailX, tailY, headX, headY);
        trail.addColorStop(0, "rgba(232,240,255,0)");
        trail.addColorStop(1, `rgba(255,255,255,${0.85 * fade})`);
        ctx.strokeStyle = trail;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(headX, headY);
        ctx.stroke();
      }
    }
  }

  function spawnMeteor() {
    if (document.hidden) return;
    const startX = width * (0.15 + Math.random() * 0.7);
    const startY = height * (0.05 + Math.random() * 0.3);
    const length = 120 + Math.random() * 180;
    const angle = Math.PI * (0.16 + Math.random() * 0.1);
    meteors.push({
      x: startX,
      y: startY,
      dx: Math.cos(angle) * length * 1.6,
      dy: Math.sin(angle) * length,
      start: performance.now(),
      duration: 900 + Math.random() * 500,
    });
  }

  function tick() {
    if (meteors.length > 0) dirty = true;
    draw();
    window.requestAnimationFrame(tick);
  }

  function pickTarget(event) {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    let bestStar = -1;
    let bestDistance = 22;
    stars.forEach((star, index) => {
      const point = project(star);
      const distance = Math.hypot(point.x - x, point.y - y);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestStar = index;
      }
    });
    if (bestStar >= 0) return { kind: "star", index: bestStar, x, y };

    let bestAnchor = -1;
    bestDistance = 26;
    anchors.forEach((anchor, index) => {
      const distance = Math.hypot(anchor.x * width - x, anchor.y * height - y);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestAnchor = index;
      }
    });
    return { kind: bestAnchor >= 0 ? "anchor" : "none", index: bestAnchor, x, y };
  }

  const PROVENANCE_TEXT = { human: "人写", cowritten: "人机合写", agent: "Agent 起草" };

  function placeTip(x, y) {
    tip.hidden = false;
    const padding = 12;
    const half = tip.offsetWidth / 2;
    tip.style.left = `${Math.min(width - half - padding, Math.max(half + padding, x))}px`;
    tip.style.top = `${Math.max(tip.offsetHeight + 8, y)}px`;
  }

  function showTip(index, x, y) {
    const star = stars[index];
    if (!star) return;
    tip.innerHTML =
      `<strong>${escapeHtml(star.title)}</strong>` +
      `<span>${escapeHtml(star.constellationName)} · ${escapeHtml(star.date)} · ${PROVENANCE_TEXT[star.provenance] ?? "人写"} · ${star.reading} 分钟</span>`;
    placeTip(x, y);
  }

  function showAnchorTip(index, x, y) {
    const anchor = anchors[index];
    if (!anchor) return;
    tip.innerHTML =
      `<strong>${escapeHtml(anchor.name)}</strong>` +
      `<span>${anchor.count} 颗星 · 点击查看这条星座线</span>`;
    placeTip(x, y);
  }

  function escapeHtml(text) {
    return String(text ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  }

  /* ── 事件 ─────────────────────────────────────────── */

  let hoverKey = "";

  canvas.addEventListener("pointermove", (event) => {
    const rect = canvas.getBoundingClientRect();
    pointer.x = (event.clientX - rect.left) / width;
    pointer.y = (event.clientY - rect.top) / height;
    pointer.inside = true;
    const target = pickTarget(event);
    const key = target.kind === "star" ? `s${target.index}` : target.kind === "anchor" ? `a${target.index}` : "";
    if (key !== hoverKey) {
      hoverKey = key;
      hovered = target.kind === "star" ? target.index : -1;
      dirty = true;
    }
    if (target.kind === "star") showTip(target.index, target.x, target.y);
    else if (target.kind === "anchor") showAnchorTip(target.index, target.x, target.y);
    else tip.hidden = true;
    canvas.style.cursor = connectMode ? "cell" : target.kind === "none" ? "crosshair" : "pointer";
  });

  canvas.addEventListener("pointerleave", () => {
    pointer.inside = false;
    hoverKey = "";
    if (hovered !== -1) {
      hovered = -1;
      dirty = true;
    }
    tip.hidden = true;
  });

  canvas.addEventListener("click", (event) => {
    const target = pickTarget(event);
    const wantConnect = connectMode || event.shiftKey;

    if (target.kind === "star") {
      if (wantConnect) {
        if (!connectMode) enterConnectMode(true);
        const slug = slugOf(target.index);
        setPath(path.includes(slug) ? path.filter((item) => item !== slug) : [...path, slug]);
        return;
      }
      const star = stars[target.index];
      if (star?.href) window.location.href = star.href;
      return;
    }

    if (target.kind === "anchor" && !wantConnect) {
      const anchor = anchors[target.index];
      if (anchor?.href) window.location.href = anchor.href;
    }
  });

  window.addEventListener("resize", () => {
    resize();
    dirty = true;
  });

  /* ── 阅读路径（连两颗星） ─────────────────────────── */

  const toggleButton = document.getElementById("connect-toggle");
  const copyButton = document.getElementById("connect-copy");
  const clearButton = document.getElementById("connect-clear");
  const statusText = document.getElementById("connect-status");

  const slugOf = (index) => stars[index]?.slug ?? "";
  const starBySlug = (slug) => stars.find((star) => star.slug === slug);

  function savePath() {
    try {
      if (path.length === 0) localStorage.removeItem(PATH_KEY);
      else localStorage.setItem(PATH_KEY, JSON.stringify(path));
    } catch {
      /* 隐私模式忽略 */
    }
  }

  function readPath() {
    try {
      const raw = localStorage.getItem(PATH_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter((slug) => starBySlug(slug)) : [];
    } catch {
      return [];
    }
  }

  function pathMinutes() {
    return path.reduce((total, slug) => total + (starBySlug(slug)?.reading ?? 0), 0);
  }

  function updateTools() {
    if (toggleButton) toggleButton.setAttribute("aria-pressed", String(connectMode));
    if (copyButton) copyButton.disabled = path.length < 2;
    if (clearButton) clearButton.disabled = path.length === 0;
    if (!statusText) return;
    if (path.length === 0) {
      statusText.textContent = connectMode
        ? "点第一颗星开始，再点第二颗连起来（Esc 退出）"
        : "Shift + 点击任意两颗星，连成一条阅读路径";
      return;
    }
    const titles = path.map((slug) => `《${starBySlug(slug)?.title ?? slug}》`);
    statusText.textContent = `${path.length} 颗星 · 约 ${pathMinutes()} 分钟 · ${titles.join(" → ")}`;
  }

  function setPath(next, { silent = false } = {}) {
    path = next;
    savePath();
    updateTools();
    dirty = true;
    if (!silent) return;
  }

  function enterConnectMode(next) {
    connectMode = next;
    if (next) canvas.style.cursor = "cell";
    updateTools();
  }

  if (toggleButton) {
    toggleButton.addEventListener("click", () => {
      enterConnectMode(!connectMode);
      if (!connectMode) setPath([]);
    });
  }

  if (clearButton) {
    clearButton.addEventListener("click", () => {
      setPath([]);
      if (history.replaceState) history.replaceState(null, "", location.pathname + location.search);
    });
  }

  if (copyButton) {
    copyButton.addEventListener("click", async () => {
      if (path.length < 2) return;
      const shareUrl = `${location.origin}${location.pathname}#p=${path.join(",")}`;
      try {
        await navigator.clipboard.writeText(shareUrl);
        copyButton.textContent = "已复制链接";
      } catch {
        copyButton.textContent = shareUrl.replace(/^https?:\/\//, "");
      }
      window.setTimeout(() => {
        copyButton.textContent = "复制阅读路径";
      }, 2200);
    });
  }

  window.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (connectMode) {
      enterConnectMode(false);
      setPath([]);
    }
  });

  path = readPath();
  try {
    const hash = new URLSearchParams(location.hash.replace(/^#/, ""));
    const shared = hash.get("p");
    if (shared) {
      path = shared.split(",").map((slug) => slug.trim()).filter((slug) => starBySlug(slug));
      connectMode = true;
    }
  } catch {
    /* 坏掉的 hash 就当没有 */
  }
  updateTools();
  if (!reduced) {
    window.setInterval(spawnMeteor, 7000);
    window.setTimeout(spawnMeteor, 2400);
  }

  resize();
  dirty = true;
  if (!reduced) window.requestAnimationFrame(tick);
  else draw();
})();
