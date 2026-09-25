import { useEffect, useState } from 'react';

/*
 * The worlds are flat illustrations, drawn as SVG at 1200x800 and rendered
 * once through an ordered (Bayer) dither at low resolution, the same
 * pixel texture as the kivi website. Each scene has an opaque back layer
 * and a transparent front layer so the two can move apart for parallax.
 * Every scene shares a floor line at y = FLOOR so Kivi can walk across all
 * three without stepping up or down.
 */

export const ART_W = 1200;
export const ART_H = 800;
export const FLOOR = 640;

const svg = (body: string, defs = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ART_W} ${ART_H}" width="${ART_W}" height="${ART_H}"><defs>${defs}</defs>${body}</svg>`;

const glow = (id: string, color: string, o = 0.9) =>
  `<radialGradient id="${id}"><stop offset="0" stop-color="${color}" stop-opacity="${o}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>`;

// Five-petal flower like the ones on the website.
const flower = (x: number, y: number, r: number, c: string, core: string) =>
  `<g transform="translate(${x} ${y})">${[0, 72, 144, 216, 288]
    .map((a) => `<ellipse cx="0" cy="${-r * 0.55}" rx="${r * 0.38}" ry="${r * 0.55}" fill="${c}" transform="rotate(${a})"/>`)
    .join('')}<circle r="${r * 0.22}" fill="${core}"/></g>`;

const leaf = (x: number, y: number, len: number, rot: number, c: string) =>
  `<path d="M0 0 Q ${len * 0.35} ${-len * 0.28} ${len} 0 Q ${len * 0.35} ${len * 0.28} 0 0Z" fill="${c}" transform="translate(${x} ${y}) rotate(${rot})"/>`;

const stars = (n: number, seed: number, c: string, yMax = 400) => {
  let s = seed;
  const r = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  return Array.from({ length: n }, () => `<rect x="${(r() * ART_W).toFixed(0)}" y="${(r() * yMax).toFixed(0)}" width="${r() > 0.8 ? 6 : 3}" height="${r() > 0.8 ? 6 : 3}" fill="${c}" opacity="${(0.3 + r() * 0.6).toFixed(2)}"/>`).join('');
};

/* ---------------------------------- intro ---------------------------------- */

const introBack = svg(
  `<rect width="1200" height="800" fill="url(#sky)"/>
  ${stars(60, 3, '#d8c38a')}
  <circle cx="250" cy="150" r="70" fill="url(#moon)"/>
  <path d="M-40 800 C 120 520 180 300 420 180 C 620 90 820 120 980 260 C 1100 360 1180 520 1260 800Z" fill="#141c11" opacity="0.8"/>
  ${[
    [520, 120, 90],
    [760, 90, 110],
    [640, 200, 70],
    [900, 190, 80],
  ]
    .map(([x, y, s]) => [0, 60, 120, 180, 240, 300].map((a) => leaf(x, y, s, a + x, '#2f4a24')).join(''))
    .join('')}
  <ellipse cx="620" cy="${FLOOR + 10}" rx="360" ry="40" fill="#1f2a18" opacity="0.8"/>`,
  `<radialGradient id="sky" cx="0.5" cy="0.35" r="0.8"><stop offset="0" stop-color="#1b2616"/><stop offset="1" stop-color="#090d08"/></radialGradient>
   <radialGradient id="moon" cx="0.4" cy="0.4"><stop offset="0" stop-color="#e8c47a"/><stop offset="0.6" stop-color="#b58a4a"/><stop offset="1" stop-color="#6f8f3e"/></radialGradient>`,
);

const introFront = svg(
  `${flower(90, 700, 70, '#5b4128', '#8a6a38')}${flower(230, 760, 50, '#3f5a2c', '#6a8a3e')}${flower(40, 560, 40, '#4b3a22', '#7a5a2e')}
   ${flower(1110, 690, 76, '#3f5a2c', '#6d8d40')}${flower(980, 770, 56, '#5b4128', '#8a6a38')}${flower(1170, 540, 44, '#4b3a22', '#7a5a2e')}
   ${[0, 1, 2, 3, 4, 5].map((i) => leaf(300 + i * 12, 800, 140 - i * 10, -70 - i * 8, '#2c4222')).join('')}
   ${[0, 1, 2, 3, 4].map((i) => leaf(900 - i * 10, 800, 130 - i * 10, -110 + i * 8, '#2c4222')).join('')}`,
);

/* --------------------------------- office ---------------------------------- */

const officeBack = svg(
  `<rect width="1200" height="800" fill="url(#wall)"/>
  <rect x="380" y="80" width="600" height="460" fill="url(#glass)"/>
  <circle cx="780" cy="330" r="60" fill="#fff0c8" opacity="0.8"/>
  <path d="M380 420 C 520 380 640 400 760 370 C 860 350 920 380 980 360 L 980 540 L 380 540Z" fill="#c98a52" opacity="0.55"/>
  <g fill="#2a1d13">
    <rect x="372" y="72" width="616" height="16"/><rect x="372" y="532" width="616" height="16"/>
    <rect x="372" y="72" width="16" height="476"/><rect x="972" y="72" width="16" height="476"/>
    <rect x="572" y="80" width="10" height="460"/><rect x="776" y="80" width="10" height="460"/>
    <rect x="380" y="300" width="600" height="8"/>
  </g>
  <path d="M388 548 L 980 548 L 1180 ${FLOOR} L 200 ${FLOOR}Z" fill="#ffd9a0" opacity="0.10"/>
  <path d="M470 90 L 560 90 L 420 ${FLOOR} L 240 ${FLOOR}Z" fill="#ffe4b0" opacity="0.07"/>
  <path d="M800 90 L 900 90 L 1060 ${FLOOR} L 860 ${FLOOR}Z" fill="#ffe4b0" opacity="0.07"/>
  <rect y="${FLOOR}" width="1200" height="${ART_H - FLOOR}" fill="url(#wood)"/>
  ${[0, 1, 2, 3].map((i) => `<rect y="${FLOOR + 20 + i * 38}" width="1200" height="3" fill="#2a1a10" opacity="0.5"/>`).join('')}
  <rect x="150" y="${FLOOR - 70}" width="80" height="70" rx="6" fill="#d8c8b0"/>
  ${[-80, -60, -40, -20, 0, 20, 40, 60].map((a, i) => leaf(190, FLOOR - 70, 150 - Math.abs(a), a - 90, i % 2 ? '#4f6d36' : '#3d5a2c')).join('')}`,
  `<linearGradient id="wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a3a28"/><stop offset="1" stop-color="#21180f"/></linearGradient>
   <linearGradient id="glass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f7d49a"/><stop offset="0.6" stop-color="#e9a868"/><stop offset="1" stop-color="#b8734a"/></linearGradient>
   <linearGradient id="wood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7a5234"/><stop offset="1" stop-color="#3a2616"/></linearGradient>`,
);

const officeFront = svg(
  `<ellipse cx="930" cy="455" rx="140" ry="90" fill="url(#lamp)"/>
  <rect x="560" y="500" width="480" height="18" rx="3" fill="#b07a48"/>
  <rect x="560" y="516" width="480" height="8" fill="#6d4526"/>
  <rect x="590" y="524" width="14" height="${FLOOR - 524}" fill="#4a2e18"/><rect x="996" y="524" width="14" height="${FLOOR - 524}" fill="#4a2e18"/>
  <path d="M700 498 L 860 498 L 850 488 L 710 488Z" fill="#8f8a84"/>
  <path d="M720 488 L 840 488 L 830 400 L 730 400Z" fill="#2a2724"/>
  <path d="M726 484 L 834 484 L 826 406 L 734 406Z" fill="#ffe6b8" opacity="0.28"/>
  <path d="M930 500 L 930 470 L 960 400" stroke="#2a211a" stroke-width="7" fill="none"/>
  <path d="M935 395 L 985 395 L 975 370 L 945 370Z" fill="#2a211a"/>
  <rect x="610" y="470" width="26" height="30" rx="4" fill="#efe4d0"/>
  <path d="M636 478 q 12 7 0 14" stroke="#efe4d0" stroke-width="4" fill="none"/>
  <rect x="640" y="430" width="130" height="150" rx="24" fill="#2b2622"/>
  <rect x="620" y="560" width="170" height="26" rx="10" fill="#3a332d"/>
  <rect x="698" y="586" width="14" height="40" fill="#1e1a17"/>
  <path d="M640 ${FLOOR} L 705 622 L 770 ${FLOOR}" stroke="#1e1a17" stroke-width="8" fill="none"/>`,
  glow('lamp', '#ffd690', 0.55),
);

/* ---------------------------------- café ----------------------------------- */

const cafeBack = svg(
  `<rect width="1200" height="800" fill="url(#cwall)"/>
  ${Array.from({ length: 16 }, (_, r) => `<rect x="${r % 2 ? -40 : 0}" y="${r * 40}" width="1240" height="2" fill="#1a0f09" opacity="0.35"/>`).join('')}
  <path d="M170 520 L 170 260 A 130 130 0 0 1 430 260 L 430 520Z" fill="url(#garden)"/>
  <path d="M170 520 L 170 260 A 130 130 0 0 1 430 260 L 430 520Z" fill="none" stroke="#2a170d" stroke-width="16"/>
  <rect x="294" y="140" width="12" height="380" fill="#2a170d"/>
  ${[0, 1, 2].map((i) => `<rect x="780" y="${230 + i * 110}" width="300" height="12" fill="#6b4226"/>`).join('')}
  ${[
    [800, 190, 40, '#c9774a'], [850, 175, 34, '#e3d3b8'], [900, 195, 30, '#7b9a4c'], [960, 170, 46, '#b85c3a'], [1030, 190, 34, '#e3d3b8'],
    [810, 300, 36, '#e3d3b8'], [870, 290, 50, '#8a5a3a'], [940, 305, 30, '#c9774a'], [1000, 285, 44, '#7b9a4c'],
    [800, 410, 44, '#7b9a4c'], [870, 400, 34, '#e3d3b8'], [930, 395, 50, '#b85c3a'], [1010, 410, 36, '#c9774a'],
  ]
    .map(([x, y, h, c]) => `<rect x="${x}" y="${Number(y) + 40 - Number(h)}" width="40" height="${h}" rx="8" fill="${c}"/>`)
    .join('')}
  ${[520, 680, 840]
    .map((x, i) => `<rect x="${x - 2}" y="0" width="4" height="${150 + i * 30}" fill="#1a0f09"/><circle cx="${x}" cy="${170 + i * 30}" r="120" fill="url(#bulb)"/><path d="M${x - 34} ${150 + i * 30} L ${x + 34} ${150 + i * 30} L ${x + 20} ${128 + i * 30} L ${x - 20} ${128 + i * 30}Z" fill="#2b1a10"/><circle cx="${x}" cy="${160 + i * 30}" r="12" fill="#ffe2a0"/>`)
    .join('')}
  ${[0, 1, 2, 3, 4, 5, 6].map((i) => leaf(40 + i * 18, 20 + i * 40, 70, 60 + i * 12, i % 2 ? '#4f6d36' : '#3a5429')).join('')}
  <rect y="${FLOOR}" width="1200" height="${ART_H - FLOOR}" fill="url(#tile)"/>
  ${Array.from({ length: 13 }, (_, i) => `<rect x="${i * 100}" y="${FLOOR}" width="3" height="${ART_H - FLOOR}" fill="#2a170d" opacity="0.4"/>`).join('')}`,
  `<linearGradient id="cwall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a2a1a"/><stop offset="1" stop-color="#1e110a"/></linearGradient>
   <linearGradient id="garden" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a8c070"/><stop offset="1" stop-color="#4f6d36"/></linearGradient>
   <linearGradient id="tile" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6b4228"/><stop offset="1" stop-color="#2e1b10"/></linearGradient>
   ${glow('bulb', '#ffc670', 0.45)}`,
);

const cafeFront = svg(
  `<path d="M300 ${FLOOR} C 300 540 330 480 400 480 L 500 480 C 560 480 580 540 580 ${FLOOR}Z" fill="#8a3f28"/>
  <rect x="330" y="540" width="220" height="60" rx="18" fill="#a34d30"/>
  <ellipse cx="760" cy="520" rx="130" ry="22" fill="#c08452"/>
  <ellipse cx="760" cy="516" rx="130" ry="18" fill="#d49a64"/>
  <rect x="752" y="530" width="16" height="${FLOOR - 540}" fill="#3a2414"/>
  <ellipse cx="760" cy="${FLOOR - 4}" rx="60" ry="8" fill="#3a2414"/>
  ${[700, 810]
    .map((x) => `<ellipse cx="${x}" cy="508" rx="34" ry="7" fill="#efe4d0"/><path d="M${x - 20} 506 L ${x + 20} 506 L ${x + 16} 476 L ${x - 16} 476Z" fill="#f4ecdc"/><path d="M${x + 18} 484 q 14 6 0 16" stroke="#f4ecdc" stroke-width="5" fill="none"/><path d="M${x - 6} 466 q -10 -16 0 -30 q 10 -14 0 -28" stroke="#f4ecdc" stroke-width="4" fill="none" opacity="0.45"/>`)
    .join('')}
  <rect x="1020" y="${FLOOR - 90}" width="90" height="90" rx="10" fill="#b8683e"/>
  ${[-70, -45, -20, 5, 30, 55].map((a, i) => leaf(1065, FLOOR - 90, 190 - Math.abs(a) * 0.8, a - 90, i % 2 ? '#3f5f2c' : '#2f4a22')).join('')}`,
);

/* -------------------------------- developer -------------------------------- */

const code = (x: number, y: number, w: number, rows: number, seed: number) => {
  let s = seed;
  const r = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  const colors = ['#a4e35a', '#6fbf73', '#e8e3c9', '#e8e3c9', '#7fb8a4'];
  return Array.from({ length: rows }, (_, i) => {
    const indent = Math.floor(r() * 3) * 16;
    const segs = 1 + Math.floor(r() * 3);
    let cx = x + indent;
    return Array.from({ length: segs }, () => {
      const len = 20 + r() * (w * 0.35);
      const out = cx + len < x + w ? `<rect x="${cx.toFixed(0)}" y="${y + i * 16}" width="${len.toFixed(0)}" height="7" rx="3" fill="${colors[Math.floor(r() * colors.length)]}" opacity="0.85"/>` : '';
      cx += len + 10;
      return out;
    }).join('');
  }).join('');
};

const devBack = svg(
  `<rect width="1200" height="800" fill="url(#dwall)"/>
  ${Array.from({ length: 30 }, (_, i) => `<rect x="${i * 40}" y="0" width="1" height="${FLOOR}" fill="#a4e35a" opacity="0.05"/>`).join('')}
  ${Array.from({ length: 16 }, (_, i) => `<rect x="0" y="${i * 40}" width="1200" height="1" fill="#a4e35a" opacity="0.05"/>`).join('')}
  <rect x="820" y="60" width="300" height="200" fill="#08100c"/>
  ${stars(22, 9, '#cfe8a8', 200).replace(/x="(\d+)"/g, (_, v) => `x="${820 + (Number(v) % 300)}"`).replace(/y="(\d+)"/g, (_, v) => `y="${60 + (Number(v) % 200)}"`)}
  <circle cx="1040" cy="140" r="42" fill="url(#dmoon)"/>
  <rect x="812" y="52" width="316" height="216" fill="none" stroke="#1d2a20" stroke-width="16"/>
  <circle cx="640" cy="330" r="360" fill="url(#screenglow)"/>
  <rect x="380" y="250" width="200" height="140" rx="6" fill="#0c1a12" stroke="#2e4a32" stroke-width="6"/>
  ${code(396, 268, 170, 7, 5)}
  <rect x="600" y="210" width="260" height="180" rx="6" fill="#0c1a12" stroke="#3b5e3e" stroke-width="6"/>
  <path d="M620 300 ${Array.from({ length: 22 }, (_, i) => `L ${632 + i * 10} ${300 + Math.sin(i * 0.9) * (8 + (i % 5) * 7)}`).join(' ')}" stroke="#a4e35a" stroke-width="5" fill="none"/>
  ${code(620, 330, 220, 3, 17)}
  <rect x="880" y="280" width="150" height="110" rx="6" fill="#0c1a12" stroke="#2e4a32" stroke-width="6"/>
  ${code(894, 296, 120, 5, 29)}
  <rect y="${FLOOR}" width="1200" height="${ART_H - FLOOR}" fill="url(#dfloor)"/>
  ${[0, 1, 2].map((i) => `<rect y="${FLOOR + 30 + i * 45}" width="1200" height="2" fill="#a4e35a" opacity="0.06"/>`).join('')}`,
  `<linearGradient id="dwall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0f1a13"/><stop offset="1" stop-color="#060a07"/></linearGradient>
   <linearGradient id="dfloor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#111a13"/><stop offset="1" stop-color="#050805"/></linearGradient>
   <radialGradient id="dmoon" cx="0.4" cy="0.4"><stop offset="0" stop-color="#e8c47a"/><stop offset="0.7" stop-color="#9a8a44"/><stop offset="1" stop-color="#5a7a34"/></radialGradient>
   ${glow('screenglow', '#6fbf73', 0.22)}`,
);

const devFront = svg(
  `<rect x="340" y="420" width="720" height="16" rx="3" fill="#202b22"/>
  <rect x="340" y="434" width="720" height="8" fill="#101712"/>
  <rect x="370" y="442" width="14" height="${FLOOR - 442}" fill="#0c120d"/><rect x="1016" y="442" width="14" height="${FLOOR - 442}" fill="#0c120d"/>
  <rect x="610" y="404" width="240" height="16" rx="4" fill="#1b231d"/>
  ${Array.from({ length: 14 }, (_, i) => `<rect x="${618 + i * 16}" y="408" width="12" height="4" rx="1" fill="#a4e35a" opacity="${i % 3 ? 0.35 : 0.8}"/>`).join('')}
  <rect x="880" y="386" width="28" height="34" rx="5" fill="#2c3a2e"/>
  <rect x="420" y="380" width="46" height="40" rx="6" fill="#3a2c20"/>
  ${[-60, -35, -10, 15, 40, 65].map((a, i) => leaf(443, 380, 90 - Math.abs(a) * 0.5, a - 90, i % 2 ? '#5f8a3a' : '#4a6e2c')).join('')}
  <path d="M760 442 C 760 520 700 560 720 ${FLOOR}" stroke="#1a241c" stroke-width="6" fill="none"/>
  <circle cx="1048" cy="${FLOOR - 190}" r="4" fill="#a4e35a"/>`,
);

export const SCENES = {
  intro: { back: introBack, front: introFront },
  office: { back: officeBack, front: officeFront },
  cafe: { back: cafeBack, front: cafeFront },
  developer: { back: devBack, front: devFront },
};
export type SceneId = keyof typeof SCENES;

/* ------------------------------ dither render ------------------------------ */

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => v / 16 - 0.5);
const cache = new Map<string, Promise<string>>();

// Rasterises an SVG at `w` pixels wide and dithers it to `levels` per channel.
function dither(markup: string, w: number, levels: number): Promise<string> {
  const key = `${w}:${levels}:${markup}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const job = new Promise<string>((resolve, reject) => {
    const h = Math.round((w * ART_H) / ART_W);
    const img = new Image();
    const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml' }));
    img.onload = () => {
      URL.revokeObjectURL(url);
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d');
      if (!ctx) return reject(new Error('no 2d context'));
      ctx.drawImage(img, 0, 0, w, h);
      const data = ctx.getImageData(0, 0, w, h);
      const px = data.data;
      const L = levels - 1;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          const b = BAYER[(y & 3) * 4 + (x & 3)];
          for (let k = 0; k < 3; k++) px[i + k] = Math.max(0, Math.min(255, Math.round((px[i + k] / 255) * L + b) * (255 / L)));
          px[i + 3] = px[i + 3] / 255 + b > 0.5 ? 255 : 0;
        }
      }
      ctx.putImageData(data, 0, 0);
      c.toBlob((blob) => (blob ? resolve(URL.createObjectURL(blob)) : reject(new Error('toBlob failed'))));
    };
    img.onerror = reject;
    img.src = url;
  });
  cache.set(key, job);
  return job;
}

// Layers render at these widths; the page warms every scene up during the intro.
export const LAYER_W = { back: 400, front: 480 };
export const preloadScenes = () => Object.values(SCENES).forEach((s) => (['back', 'front'] as const).forEach((l) => dither(s[l], LAYER_W[l], 7).catch(() => {})));

export function useDithered(markup: string, width = 400, levels = 7) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    dither(markup, width, levels).then((s) => live && setSrc(s), () => {});
    return () => {
      live = false;
    };
  }, [markup, width, levels]);
  return src;
}
