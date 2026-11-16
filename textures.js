/**
 * textures.js — Génération 100 % procédurale des textures via Canvas 2D.
 *
 * Une « spec » décrit une illustration :
 *   { bg: [haut, bas], emoji: '🍄' | ['ligne 1', 'ligne 2'], pattern, accent,
 *     patternAlpha, emojiScale, border, repeat: [x, y] }
 *
 * Les symboles sont des emojis rendus par la police système (aucun fichier
 * image, aucun texte de titre). Pour un autre style, il suffit de remplacer
 * drawSymbols() par vos propres tracés vectoriels.
 */
import * as THREE from 'three';

const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Twemoji Mozilla",sans-serif';

/* Générateur pseudo-aléatoire déterministe : même spec → même texture. */
function seeded(seed) {
  let s = (seed >>> 0) || 1;
  return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
}
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

/* ───────────── Motifs de fond ───────────── */
const PATTERNS = {
  stripes(ctx, w, h) {
    for (let x = 0; x < w; x += w / 6) ctx.fillRect(x, 0, w / 12, h);
  },
  diag(ctx, w, h) {
    ctx.lineWidth = w / 14;
    for (let x = -h; x < w + h; x += w / 5) {
      ctx.beginPath(); ctx.moveTo(x, h); ctx.lineTo(x + h, 0); ctx.stroke();
    }
  },
  dots(ctx, w, h) {
    const step = Math.min(w, h) / 5;
    for (let y = step / 2, row = 0; y < h; y += step, row++) {
      for (let x = (row % 2 ? step : step / 2); x < w; x += step) {
        ctx.beginPath(); ctx.arc(x, y, step * 0.2, 0, Math.PI * 2); ctx.fill();
      }
    }
  },
  grid(ctx, w, h) {
    ctx.lineWidth = Math.max(1, w / 128);
    const step = Math.min(w, h) / 8;
    for (let x = 0; x <= w; x += step) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 0; y <= h; y += step) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  },
  rays(ctx, w, h) {
    const cx = w / 2, cy = h / 2, r = Math.hypot(w, h);
    for (let i = 0; i < 12; i += 2) {
      const a0 = (i / 12) * Math.PI * 2, a1 = ((i + 1) / 12) * Math.PI * 2;
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a0) * r, cy + Math.sin(a0) * r);
      ctx.lineTo(cx + Math.cos(a1) * r, cy + Math.sin(a1) * r);
      ctx.closePath(); ctx.fill();
    }
  },
  stars(ctx, w, h, rnd) {
    for (let i = 0; i < 70; i++) {
      ctx.beginPath(); ctx.arc(rnd() * w, rnd() * h, 0.6 + rnd() * (w / 180), 0, Math.PI * 2); ctx.fill();
    }
  },
  mountains(ctx, w, h, rnd) {
    for (let layer = 0; layer < 2; layer++) {
      const base = h, top = h * (0.55 + layer * 0.15);
      ctx.beginPath(); ctx.moveTo(0, base);
      const peaks = 4 + layer;
      for (let i = 0; i <= peaks; i++) {
        const x = (i / peaks) * w;
        ctx.lineTo(x - w / (peaks * 2), top + rnd() * h * 0.12);
        ctx.lineTo(x, top + h * 0.16 + rnd() * h * 0.08);
      }
      ctx.lineTo(w, base); ctx.closePath(); ctx.fill();
    }
  },
  blobs(ctx, w, h, rnd) {
    for (let i = 0; i < 9; i++) {
      ctx.beginPath();
      ctx.ellipse(rnd() * w, rnd() * h, w * (0.06 + rnd() * 0.12), h * (0.05 + rnd() * 0.1), rnd() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  planks(ctx, w, h, rnd) {
    ctx.lineWidth = Math.max(1, h / 90);
    const rows = 5;
    for (let r = 1; r < rows; r++) {
      const y = (r / rows) * h;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    for (let r = 0; r < rows; r++) {
      const x = rnd() * w, y = (r / rows) * h;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + h / rows); ctx.stroke();
    }
  },
  scanlines(ctx, w, h) {
    for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 1);
  },
  pixels(ctx, w, h) {
    const n = 12, cw = w / n, ch = h / Math.round(n * h / w);
    for (let y = 0, r = 0; y < h; y += ch, r++) {
      for (let x = 0, c = 0; x < w; x += cw, c++) if ((r + c) % 2) ctx.fillRect(x, y, cw, ch);
    }
  },
  sun(ctx, w, h) {
    ctx.beginPath(); ctx.arc(w / 2, h * 0.36, Math.min(w, h) * 0.3, 0, Math.PI * 2); ctx.fill();
  },
  lanes(ctx, w, h) {
    // moitié haute = rivière (laissée telle quelle), moitié basse = route
    ctx.fillRect(0, h * 0.42, w, h * 0.16);                 // berge centrale
    const dash = w / 12;
    for (let x = dash / 2; x < w; x += dash * 2) ctx.fillRect(x, h * 0.79, dash, h * 0.015);
  },
  seams(ctx, w, h) {
    ctx.lineWidth = Math.max(2, h / 40);
    ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke();
    for (const x of [0, w / 4, w / 2, (3 * w) / 4, w]) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
  },
  clock(ctx, w, h) {
    const cx = w / 2, cy = h / 2, r = Math.min(w, h) / 2;
    ctx.lineWidth = r * 0.04;
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.93, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2, big = i % 3 === 0;
      ctx.lineWidth = r * (big ? 0.06 : 0.03);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r * (big ? 0.72 : 0.8), cy + Math.sin(a) * r * (big ? 0.72 : 0.8));
      ctx.lineTo(cx + Math.cos(a) * r * 0.9, cy + Math.sin(a) * r * 0.9);
      ctx.stroke();
    }
  },
};

/* ───────────── Symboles (emojis) ───────────── */
function drawSymbols(ctx, emoji, w, h, scale) {
  const lines = Array.isArray(emoji) ? emoji : [emoji];
  const n = lines.length;
  const lineH = (h * 0.84) / n;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur = Math.min(w, h) * 0.03;
  ctx.shadowOffsetY = Math.min(w, h) * 0.012;
  ctx.fillStyle = '#ffffff';
  lines.forEach((line, i) => {
    let size = Math.min(lineH * 0.8, Math.min(w, h) * scale * (n > 1 ? 0.8 : 1));
    ctx.font = `${size}px ${EMOJI_FONT}`;
    const tw = ctx.measureText(line).width;
    if (tw > w * 0.86) {
      size *= (w * 0.86) / tw;
      ctx.font = `${size}px ${EMOJI_FONT}`;
    }
    ctx.fillText(line, w / 2, h / 2 + (i - (n - 1) / 2) * lineH + size * 0.04);
  });
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
}

/* ───────────── Fabrique (une par instance du quiz) ───────────── */
export function createTextureFactory({ symbols = true } = {}) {
  const cache = new Map();

  function finish(canvas, spec = {}) {
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    if (spec.repeat) {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(spec.repeat[0], spec.repeat[1]);
    }
    return tex;
  }

  /** Illustration générique : dégradé + motif + symbole(s) + bordure. */
  function art(spec, w = 256, h = 256) {
    const key = JSON.stringify([spec, w, h, symbols]);
    if (cache.has(key)) return cache.get(key);

    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    const [c1, c2] = spec.bg ?? ['#444444', '#222222'];

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, c1); grad.addColorStop(1, c2 ?? c1);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    if (spec.pattern && PATTERNS[spec.pattern]) {
      ctx.save();
      ctx.globalAlpha = spec.patternAlpha ?? 0.35;
      ctx.fillStyle = ctx.strokeStyle = spec.accent ?? '#ffffff';
      PATTERNS[spec.pattern](ctx, w, h, seeded(hash(key)));
      ctx.restore();
    }
    if (spec.emoji && symbols) drawSymbols(ctx, spec.emoji, w, h, spec.emojiScale ?? 0.46);
    if (spec.border) {
      ctx.strokeStyle = spec.border;
      ctx.lineWidth = Math.min(w, h) * 0.05;
      ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, w - ctx.lineWidth, h - ctx.lineWidth);
    }

    const tex = finish(canvas, spec);
    cache.set(key, tex);
    return tex;
  }

  /** Badge « Trouvé » : pastille dorée cerclée de vert avec une coche. */
  function badge() {
    if (cache.has('badge')) return cache.get('badge');
    const s = 128;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = s;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(s * 0.4, s * 0.35, s * 0.05, s / 2, s / 2, s * 0.46);
    grad.addColorStop(0, '#fff6c2'); grad.addColorStop(0.6, '#f5c542'); grad.addColorStop(1, '#c98a12');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(s / 2, s / 2, s * 0.44, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#2ecc71'; ctx.lineWidth = s * 0.06;
    ctx.beginPath(); ctx.arc(s / 2, s / 2, s * 0.44, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#1e7a3c'; ctx.lineWidth = s * 0.11; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(s * 0.3, s * 0.52); ctx.lineTo(s * 0.45, s * 0.67); ctx.lineTo(s * 0.72, s * 0.36); ctx.stroke();
    const tex = finish(canvas);
    cache.set('badge', tex);
    return tex;
  }

  function dispose() {
    for (const tex of cache.values()) tex.dispose();
    cache.clear();
  }

  return { art, badge, dispose };
}
