/**
 * stars.mjs — 把文章排布成星图（确定性算法，构建期算一次）。
 *
 * 规则：
 *   · 每个星座（= 主题线）占夜空里的一块区域，中心按黄金角散开；
 *   · 同一星座的文章围绕中心做小螺旋，越早的越靠内（时间从内向外扩散）；
 *   · 亮度来自阅读时长，色相来自星座。
 *
 * 输出坐标全部归一化到 0..1，前端按视口尺寸缩放，所以同一份数据在手机和
 * 超宽屏上都是同一片天空。
 */

/** 稳定的 32 位字符串哈希（FNV-1a）。 */
export function hashOf(text) {
  let hash = 0x811c9dc5;
  const source = String(text);
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

/** 由哈希得到 0..1 的伪随机数。 */
function unit(text, salt = "") {
  return (hashOf(`${text}#${salt}`) % 100000) / 100000;
}

const GOLDEN = Math.PI * (3 - Math.sqrt(5));

/**
 * @param {{ slug: string, date: string, reading: number, constellation: string }[]} posts
 * @param {{ key: string, hue: number }[]} constellations
 * @returns {{
 *   stars: { slug: string, x: number, y: number, mag: number, hue: number, constellation: string }[],
 *   centers: Record<string, { x: number, y: number, hue: number }>,
 *   lines: { constellation: string, points: [number, number][] }[]
 * }}
 */
export function layoutStars(posts, constellations) {
  const ordered = [...constellations].sort((left, right) => left.key.localeCompare(right.key));
  const centers = {};

  ordered.forEach((constellation, index) => {
    const angle = GOLDEN * index + unit(constellation.key, "angle") * 0.5;
    const radius = 0.34 - 0.06 * unit(constellation.key, "radius");
    centers[constellation.key] = {
      x: clamp(0.5 + Math.cos(angle) * radius * 1.18, 0.16, 0.84),
      y: clamp(0.5 + Math.sin(angle) * radius * 0.82, 0.18, 0.82),
      hue: constellation.hue,
    };
  });

  const byConstellation = new Map();
  for (const post of posts) {
    const bucket = byConstellation.get(post.constellation) ?? [];
    bucket.push(post);
    byConstellation.set(post.constellation, bucket);
  }

  const stars = [];
  for (const [key, bucket] of byConstellation.entries()) {
    const center = centers[key] ?? { x: 0.5, y: 0.5, hue: 210 };
    const sorted = [...bucket].sort((left, right) => left.date.localeCompare(right.date));
    sorted.forEach((post, index) => {
      const fraction = sorted.length === 1 ? 0.5 : index / (sorted.length - 1);
      const spiral = GOLDEN * index + unit(post.slug, "spiral") * 0.8;
      const radius = 0.03 + 0.072 * fraction;
      stars.push({
        slug: post.slug,
        constellation: key,
        hue: center.hue + (unit(post.slug, "hue") * 24 - 12),
        x: clamp01(center.x + Math.cos(spiral) * radius * 1.35),
        y: clamp01(center.y + Math.sin(spiral) * radius * 0.95),
        mag: magnitudeOf(post.reading),
      });
    });
  }

  const lines = [];
  for (const [key, bucket] of byConstellation.entries()) {
    if (bucket.length < 2) continue;
    const sorted = [...bucket].sort((left, right) => left.date.localeCompare(right.date));
    const points = sorted
      .map((post) => {
        const star = stars.find((candidate) => candidate.slug === post.slug);
        return star ? [star.x, star.y] : null;
      })
      .filter(Boolean);
    if (points.length >= 2) lines.push({ constellation: key, points });
  }

  return { stars, centers, lines };
}

function magnitudeOf(reading) {
  const minutes = Number.isFinite(reading) && reading > 0 ? reading : 6;
  return clamp(0.55 + Math.log2(1 + minutes) * 0.22, 0.55, 1.7);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function clamp01(value) {
  return clamp(value, 0.1, 0.9);
}
