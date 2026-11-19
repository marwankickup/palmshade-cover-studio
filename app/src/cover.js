// Palmshade Cover Studio — composition & render engine.
// Pure Canvas 2D: polygon panel layouts in the multi-panel poster style,
// per-photo cover-fit placement, pixel colour grades, keyline borders,
// and the bold angled title block with an original numeral badge.
// Everything is drawn from local assets only; no network, no libraries.

// ---------------------------------------------------------------- layouts
// Panels are polygons in unit space (0..1); they tile the whole canvas and
// are stretched to whatever aspect the export size asks for. The angled
// cuts give the classic asymmetric cover-collage feel.

export const LAYOUTS = {
  hero: {
    label: 'Hero Stack',
    panels: [
      [[0, 0], [0.60, 0], [0.55, 0.62], [0, 0.68]],
      [[0.60, 0], [1, 0], [1, 0.34], [0.55, 0.40]],
      [[0.55, 0.40], [1, 0.34], [1, 0.66], [0.55, 0.62]],
      [[0, 0.68], [0.55, 0.62], [0.52, 1], [0, 1]],
      [[0.55, 0.62], [1, 0.66], [1, 1], [0.52, 1]],
    ],
  },
  diagonal: {
    label: 'Diagonal Bands',
    panels: [
      [[0, 0], [1, 0], [1, 0.30], [0, 0.48]],
      [[0, 0.48], [1, 0.30], [1, 0.62], [0, 0.80]],
      [[0, 0.80], [1, 0.62], [1, 1], [0, 1]],
    ],
  },
  collage: {
    label: 'Five-Panel Collage',
    panels: [
      [[0, 0], [0.38, 0], [0.34, 1], [0, 1]],
      [[0.38, 0], [0.70, 0], [0.68, 0.42], [0.36, 0.46]],
      [[0.70, 0], [1, 0], [1, 0.44], [0.68, 0.42]],
      [[0.36, 0.46], [0.68, 0.42], [0.66, 1], [0.34, 1]],
      [[0.68, 0.42], [1, 0.44], [1, 1], [0.66, 1]],
    ],
  },
  split: {
    label: 'Duo Split',
    panels: [
      [[0, 0], [1, 0], [1, 0.42], [0, 0.66]],
      [[0, 0.66], [1, 0.42], [1, 1], [0, 1]],
    ],
  },
};

export function panelCount(layoutKey) {
  return LAYOUTS[layoutKey].panels.length;
}

export function panelBBox(poly, w, h) {
  let minX = 1, minY = 1, maxX = 0, maxY = 0;
  for (const [x, y] of poly) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { x: minX * w, y: minY * h, w: (maxX - minX) * w, h: (maxY - minY) * h };
}

export function pointInPanel(poly, nx, ny) {
  // Ray casting in unit space.
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if ((yi > ny) !== (yj > ny) && nx < ((xj - xi) * (ny - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function hitPanel(layoutKey, nx, ny) {
  const polys = LAYOUTS[layoutKey].panels;
  for (let i = polys.length - 1; i >= 0; i--) {
    if (pointInPanel(polys[i], nx, ny)) return i;
  }
  return -1;
}

// ----------------------------------------------------------------- grades
// Each grade is a per-pixel transform over [r, g, b] (0..255).

function lum(r, g, b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function clamp(v) {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

export const GRADES = {
  none: { label: 'No Grade', fn: null },
  sunset: {
    label: 'Sunset',
    fn(r, g, b) {
      const l = lum(r, g, b);
      const sat = 1.22;
      return [
        clamp((l + (r - l) * sat) * 1.07 + 16),
        clamp((l + (g - l) * sat) * 0.99 + 5),
        clamp((l + (b - l) * sat) * 0.86 - 10),
      ];
    },
  },
  neon: {
    label: 'Neon',
    fn(r, g, b) {
      const l = lum(r, g, b);
      const t = l / 255;
      const sat = 1.3;
      return [
        clamp((l + (r - l) * sat) * 0.98 + (t - 0.45) * 52),
        clamp((l + (g - l) * sat) * 1.0 + (0.5 - Math.abs(t - 0.5)) * 22),
        clamp((l + (b - l) * sat) * 1.05 + (0.55 - t) * 46),
      ];
    },
  },
  duotone: {
    label: 'Duotone',
    fn(r, g, b) {
      const t = lum(r, g, b) / 255;
      // Deep purple shadows into hot gold highlights.
      const sr = 34, sg = 8, sb = 66;
      const mr = 178, mg = 44, mb = 122;
      const hr = 255, hg = 198, hb = 74;
      if (t < 0.5) {
        const k = t / 0.5;
        return [sr + (mr - sr) * k, sg + (mg - sg) * k, sb + (mb - sb) * k];
      }
      const k = (t - 0.5) / 0.5;
      return [mr + (hr - mr) * k, mg + (hg - mg) * k, mb + (hb - mb) * k];
    },
  },
  noir: {
    label: 'Noir',
    fn(r, g, b) {
      let v = lum(r, g, b);
      v = clamp((v - 128) * 1.38 + 124);
      return [v, v, v];
    },
  },
};

function applyGrade(canvas, gradeKey) {
  const grade = GRADES[gradeKey];
  if (!grade || !grade.fn) return;
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  if (width === 0 || height === 0) return;
  const data = ctx.getImageData(0, 0, width, height);
  const px = data.data;
  const fn = grade.fn;
  for (let i = 0; i < px.length; i += 4) {
    const out = fn(px[i], px[i + 1], px[i + 2]);
    px[i] = out[0];
    px[i + 1] = out[1];
    px[i + 2] = out[2];
  }
  ctx.putImageData(data, 0, 0);
}

// ------------------------------------------------------------- photo draw
// A photo is rendered once per (panel box, placement, grade) into a small
// offscreen canvas so dragging and re-rendering the poster stays cheap.

const tileCache = new Map();
const TILE_CACHE_MAX = 32;

function photoTile(img, box, panel, gradeKey) {
  const bw = Math.max(2, Math.round(box.w));
  const bh = Math.max(2, Math.round(box.h));
  const key = [
    img.src, bw, bh, gradeKey,
    panel.zoom.toFixed(3), panel.ox.toFixed(3), panel.oy.toFixed(3),
  ].join('|');
  const hit = tileCache.get(key);
  if (hit) return hit;

  const tile = document.createElement('canvas');
  tile.width = bw;
  tile.height = bh;
  const tctx = tile.getContext('2d');
  tctx.fillStyle = '#14101f';
  tctx.fillRect(0, 0, bw, bh);
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (iw > 0 && ih > 0) {
    const s0 = Math.max(bw / iw, bh / ih);
    const s = s0 * panel.zoom;
    const dw = iw * s;
    const dh = ih * s;
    const dx = bw / 2 + panel.ox * bw - dw / 2;
    const dy = bh / 2 + panel.oy * bh - dh / 2;
    tctx.drawImage(img, dx, dy, dw, dh);
  }
  applyGrade(tile, gradeKey);

  if (tileCache.size >= TILE_CACHE_MAX) tileCache.delete(tileCache.keys().next().value);
  tileCache.set(key, tile);
  return tile;
}

// ----------------------------------------------------------------- poster

function tracePath(ctx, poly, w, h) {
  ctx.beginPath();
  poly.forEach(([x, y], i) => {
    if (i === 0) ctx.moveTo(x * w, y * h);
    else ctx.lineTo(x * w, y * h);
  });
  ctx.closePath();
}

function drawBadge(ctx, w, h, text) {
  // Original shield badge: a gold-ringed hexagon with roman-style letters.
  const size = Math.min(w, h) * 0.17;
  const cx = w - size * 0.72;
  const cy = size * 0.72;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.10);
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    const px = Math.cos(a) * size * 0.5;
    const py = Math.sin(a) * size * 0.5;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = 'rgba(16, 8, 28, 0.88)';
  ctx.fill();
  ctx.lineWidth = size * 0.055;
  ctx.strokeStyle = '#ffc233';
  ctx.stroke();
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    const px = Math.cos(a) * size * 0.40;
    const py = Math.sin(a) * size * 0.40;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.lineWidth = size * 0.02;
  ctx.strokeStyle = 'rgba(255, 194, 51, 0.65)';
  ctx.stroke();
  ctx.fillStyle = '#ffd968';
  ctx.font = `${size * 0.40}px Anton, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text || 'VI', 0, size * 0.03);
  ctx.restore();
}

function drawTitleBlock(ctx, w, h, state) {
  const title = (state.title || '').trim();
  const subtitle = (state.subtitle || '').trim();
  if (!title && !subtitle) return;
  const base = Math.min(w, h);
  ctx.save();
  ctx.translate(w * 0.055, h * 0.965);
  ctx.rotate(-0.045);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  if (subtitle) {
    ctx.font = `${base * 0.052}px Anton, sans-serif`;
    const spaced = subtitle.split('').join('  ');
    ctx.lineWidth = base * 0.012;
    ctx.strokeStyle = 'rgba(10, 4, 18, 0.9)';
    ctx.strokeText(spaced, 0, -base * 0.155);
    ctx.fillStyle = '#ffc233';
    ctx.fillText(spaced, 0, -base * 0.155);
  }

  if (title) {
    let fontSize = base * 0.155;
    ctx.font = `${fontSize}px Anton, sans-serif`;
    const maxWidth = w * 0.88;
    const measured = ctx.measureText(title).width;
    if (measured > maxWidth) {
      fontSize = fontSize * (maxWidth / measured);
      ctx.font = `${fontSize}px Anton, sans-serif`;
    }
    // Magenta drop shadow, heavy black keyline, warm white face.
    ctx.fillStyle = '#ff2e88';
    ctx.fillText(title, base * 0.012, base * 0.014);
    ctx.lineWidth = fontSize * 0.16;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0d0518';
    ctx.strokeText(title, 0, 0);
    const grad = ctx.createLinearGradient(0, -fontSize, 0, 0);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.72, '#fff4e0');
    grad.addColorStop(1, '#ffc9de');
    ctx.fillStyle = grad;
    ctx.fillText(title, 0, 0);
  }
  ctx.restore();
}

// Render the full composition. `editor` adds selection chrome (never baked
// into exports). state.photos holds loaded Image objects;
// state.panels[i] = { photo: index into photos, zoom, ox, oy }.
export function renderCover(ctx, w, h, state, editor = false) {
  const layout = LAYOUTS[state.layout];
  ctx.save();
  ctx.fillStyle = '#0d0a16';
  ctx.fillRect(0, 0, w, h);

  layout.panels.forEach((poly, i) => {
    const panel = state.panels[i];
    const box = panelBBox(poly, w, h);
    ctx.save();
    tracePath(ctx, poly, w, h);
    ctx.clip();
    const photoIdx = panel ? panel.photo : -1;
    const img = photoIdx >= 0 ? state.photos[photoIdx] : null;
    if (img && panel) {
      const tile = photoTile(img, box, panel, state.grade);
      ctx.drawImage(tile, box.x, box.y, box.w, box.h);
    } else {
      // Empty panel: a dusk gradient so the collage still reads as a poster.
      const g = ctx.createLinearGradient(box.x, box.y, box.x + box.w, box.y + box.h);
      g.addColorStop(0, '#2a1440');
      g.addColorStop(0.55, '#571d4e');
      g.addColorStop(1, '#c94f36');
      ctx.fillStyle = g;
      ctx.fillRect(box.x, box.y, box.w, box.h);
    }
    ctx.restore();
  });

  // Unify the collage: warm glow from the top, gentle vignette at the foot.
  const glow = ctx.createLinearGradient(0, 0, 0, h);
  glow.addColorStop(0, 'rgba(255, 150, 60, 0.10)');
  glow.addColorStop(0.4, 'rgba(255, 60, 130, 0.04)');
  glow.addColorStop(1, 'rgba(8, 2, 18, 0.28)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  // White keylines around every panel, dark outer frame.
  const key = Math.max(2, Math.min(w, h) * 0.006);
  ctx.lineWidth = key;
  ctx.strokeStyle = '#f7f2ea';
  ctx.lineJoin = 'round';
  for (const poly of layout.panels) {
    tracePath(ctx, poly, w, h);
    ctx.stroke();
  }
  ctx.lineWidth = key * 2.2;
  ctx.strokeStyle = '#0d0518';
  ctx.strokeRect(0, 0, w, h);

  drawBadge(ctx, w, h, state.badge);
  drawTitleBlock(ctx, w, h, state);

  if (editor && state.selected >= 0) {
    const poly = layout.panels[state.selected];
    if (poly) {
      ctx.save();
      tracePath(ctx, poly, w, h);
      ctx.setLineDash([10, 7]);
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#ffc233';
      ctx.stroke();
      const box = panelBBox(poly, w, h);
      ctx.setLineDash([]);
      ctx.fillStyle = '#ffc233';
      ctx.font = `bold ${Math.max(13, Math.min(w, h) * 0.028)}px system-ui, sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillText(`PANEL ${state.selected + 1}`, box.x + 10, box.y + 24);
      ctx.restore();
    }
  }
  ctx.restore();
}

export const EXPORT_SIZES = {
  '1080x1080': [1080, 1080],
  '1080x1350': [1080, 1350],
  '1920x1080': [1920, 1080],
};
