/**
 * boot.js — 开机仪式：3 秒星空校准，可点击/按键跳过。
 *
 * 每个会话只演一次（sessionStorage 记 20 分钟）；系统开启「减少动态」时
 * 缩短到 700ms 并跳过所有入场动画。
 */
(() => {
  const boot = document.getElementById("boot");
  if (!boot) return;

  const KEY = "xingye:boot-at";
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const duration = reduced ? 700 : 3000;
  const skipWindowMs = 20 * 60 * 1000;

  // 截图/调试用：?noboot=1 直接跳过仪式
  let forceSkip = false;
  try {
    forceSkip = new URLSearchParams(window.location.search).has("noboot");
  } catch {
    forceSkip = false;
  }

  let playedRecently = false;
  try {
    const at = Number(sessionStorage.getItem(KEY) ?? 0);
    playedRecently = Number.isFinite(at) && at > 0 && Date.now() - at < skipWindowMs;
  } catch {
    playedRecently = false;
  }

  const finish = () => {
    boot.classList.add("is-done");
    document.body.classList.remove("is-booting");
    try {
      sessionStorage.setItem(KEY, String(Date.now()));
    } catch {
      /* 隐私模式下忽略 */
    }
    window.removeEventListener("keydown", onSkip);
    boot.removeEventListener("click", onSkip);
  };

  const onSkip = (event) => {
    if (event.type === "keydown" && event.key === "Tab") return;
    finish();
  };

  if (playedRecently || forceSkip) {
    boot.classList.add("is-done");
    boot.setAttribute("aria-hidden", "true");
    boot.style.display = "none";
    return;
  }

  document.body.classList.add("is-booting");
  boot.addEventListener("click", onSkip);
  window.addEventListener("keydown", onSkip);
  window.setTimeout(finish, duration);
})();
