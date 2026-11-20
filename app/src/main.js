// Palmshade Cover Studio — editor wiring: photo library, panel selection,
// drag/zoom placement, layout & grade pickers, caption fields, PNG export,
// one-click presets, and the fixed ?shot= scenes used for screenshots.
import { LAYOUTS, GRADES, TITLE_COLORS, EXPORT_SIZES, panelCount, hitPanel, renderCover } from './cover.js';

const $ = (id) => document.getElementById(id);
const canvas = $('preview');
const ctx = canvas.getContext('2d');
const statusEl = $('status');

// ------------------------------------------------------------- app state
const state = {
  layout: 'hero',
  grade: 'sunset',
  title: 'PALMSHADE',
  subtitle: 'VICE HOURS',
  badge: 'VI',
  titleColor: 'classic',
  titleOutline: true,
  size: '1080x1350',
  photos: [],      // loaded HTMLImageElement list (the library)
  photoNames: [],  // parallel display names
  panels: [],      // { photo, zoom, ox, oy } per layout panel
  selected: 0,
};

function freshPanel(photoIdx) {
  return { photo: photoIdx, zoom: 1, ox: 0, oy: 0 };
}

function fitPanels() {
  const n = panelCount(state.layout);
  const next = [];
  for (let i = 0; i < n; i++) {
    next.push(state.panels[i] || freshPanel(state.photos.length ? i % state.photos.length : -1));
    if (next[i].photo >= state.photos.length) next[i].photo = state.photos.length - 1;
  }
  state.panels = next;
  if (state.selected >= n) state.selected = 0;
}

// ------------------------------------------------------------ rendering
let renderQueued = false;
function redraw() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    const [ew, eh] = EXPORT_SIZES[state.size];
    const scale = Math.min(760 / ew, 620 / eh);
    const w = Math.round(ew * scale);
    const h = Math.round(eh * scale);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    renderCover(ctx, w, h, state, true);
  });
}

function setStatus(msg) {
  statusEl.textContent = msg;
}

// ---------------------------------------------------------- photo input
export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${src}`));
    img.src = src;
  });
}

async function addPhoto(src, name) {
  const img = await loadImage(src);
  state.photos.push(img);
  state.photoNames.push(name);
  const idx = state.photos.length - 1;
  // A fresh photo goes straight into the selected panel if it is empty,
  // otherwise it fills the first empty panel, else joins the library.
  const emptySel = state.panels[state.selected] && state.panels[state.selected].photo < 0;
  const emptyAny = state.panels.findIndex((p) => p.photo < 0);
  if (emptySel) state.panels[state.selected].photo = idx;
  else if (emptyAny >= 0) state.panels[emptyAny].photo = idx;
  buildThumbs();
  redraw();
  return idx;
}

function buildThumbs() {
  const wrap = $('thumbs');
  wrap.innerHTML = '';
  state.photos.forEach((img, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'thumb';
    b.title = `${state.photoNames[i]} — click to place in the selected panel`;
    const im = document.createElement('img');
    im.src = img.src;
    im.alt = state.photoNames[i];
    b.appendChild(im);
    const tag = document.createElement('span');
    tag.textContent = state.photoNames[i];
    b.appendChild(tag);
    b.addEventListener('click', () => {
      if (state.panels[state.selected]) {
        state.panels[state.selected].photo = i;
        redraw();
        setStatus(`Placed "${state.photoNames[i]}" in panel ${state.selected + 1}.`);
      }
    });
    wrap.appendChild(b);
  });
}

$('file').addEventListener('change', async (e) => {
  for (const file of e.target.files) {
    await addPhoto(URL.createObjectURL(file), file.name.replace(/\.[^.]+$/, ''));
  }
  e.target.value = '';
  setStatus('Photo added. Click a panel, then a photo, to arrange the cover.');
});

for (const dropZone of [document.body]) {
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    document.body.classList.add('dragging');
  });
  dropZone.addEventListener('dragleave', () => document.body.classList.remove('dragging'));
  dropZone.addEventListener('drop', async (e) => {
    e.preventDefault();
    document.body.classList.remove('dragging');
    for (const file of e.dataTransfer.files) {
      if (file.type.startsWith('image/')) {
        await addPhoto(URL.createObjectURL(file), file.name.replace(/\.[^.]+$/, ''));
      }
    }
  });
}

$('sample-boulevard').addEventListener('click', () => addPhoto('samples/boulevard.jpg', 'Boulevard'));
$('sample-pier').addEventListener('click', () => addPhoto('samples/pier.jpg', 'Pier'));

// ------------------------------------------------------- panel dragging
let drag = null;
function canvasPoint(e) {
  const r = canvas.getBoundingClientRect();
  return {
    nx: (e.clientX - r.left) / r.width,
    ny: (e.clientY - r.top) / r.height,
    px: (e.clientX - r.left) * (canvas.width / r.width),
    py: (e.clientY - r.top) * (canvas.height / r.height),
  };
}

canvas.addEventListener('pointerdown', (e) => {
  const p = canvasPoint(e);
  const hit = hitPanel(state.layout, p.nx, p.ny);
  if (hit >= 0) {
    state.selected = hit;
    syncPanelControls();
    const panel = state.panels[hit];
    drag = { x: p.px, y: p.py, ox: panel.ox, oy: panel.oy };
    canvas.setPointerCapture(e.pointerId);
    redraw();
  }
});

canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const p = canvasPoint(e);
  const panel = state.panels[state.selected];
  // Offsets are fractions of the panel box; approximate with canvas size
  // scaled by the panel's share — good enough for direct manipulation.
  panel.ox = drag.ox + (p.px - drag.x) / canvas.width * 1.6;
  panel.oy = drag.oy + (p.py - drag.y) / canvas.height * 1.6;
  redraw();
});

canvas.addEventListener('pointerup', () => { drag = null; });
canvas.addEventListener('pointercancel', () => { drag = null; });

canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const panel = state.panels[state.selected];
  if (!panel) return;
  panel.zoom = Math.min(3, Math.max(1, panel.zoom * (e.deltaY < 0 ? 1.07 : 0.93)));
  $('zoom').value = panel.zoom;
  redraw();
}, { passive: false });

$('zoom').addEventListener('input', (e) => {
  const panel = state.panels[state.selected];
  if (!panel) return;
  panel.zoom = Number(e.target.value);
  redraw();
});

$('reset-panel').addEventListener('click', () => {
  const panel = state.panels[state.selected];
  if (!panel) return;
  panel.zoom = 1;
  panel.ox = 0;
  panel.oy = 0;
  $('zoom').value = 1;
  redraw();
});

function syncPanelControls() {
  const panel = state.panels[state.selected];
  $('panel-label').textContent = panel
    ? `Panel ${state.selected + 1} of ${state.panels.length}` : 'No panel';
  if (panel) $('zoom').value = panel.zoom;
}

// ------------------------------------------------------------- pickers
function buildPicker(wrapId, entries, current, onPick) {
  const wrap = $(wrapId);
  wrap.innerHTML = '';
  for (const [key, label] of entries) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.className = 'chip' + (key === current ? ' active' : '');
    b.dataset.key = key;
    b.addEventListener('click', () => onPick(key));
    wrap.appendChild(b);
  }
}

function refreshPickers() {
  buildPicker('layouts',
    Object.entries(LAYOUTS).map(([k, v]) => [k, v.label]),
    state.layout,
    (key) => { state.layout = key; fitPanels(); syncPanelControls(); refreshPickers(); redraw(); });
  buildPicker('grades',
    Object.entries(GRADES).map(([k, v]) => [k, v.label]),
    state.grade,
    (key) => { state.grade = key; refreshPickers(); redraw(); });
}

// --------------------------------------------------------- title styling
function buildTitleColorPicker() {
  const wrap = $('title-colors');
  wrap.innerHTML = '';
  for (const [key, style] of Object.entries(TITLE_COLORS)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'swatch' + (key === state.titleColor ? ' active' : '');
    b.title = style.label;
    b.dataset.key = key;
    b.style.background = `linear-gradient(160deg, ${style.stops[0]}, ${style.stops[1]} 55%, ${style.stops[2]})`;
    b.addEventListener('click', () => {
      state.titleColor = key;
      buildTitleColorPicker();
      redraw();
      setStatus(`Title style: ${style.label}.`);
    });
    wrap.appendChild(b);
  }
}

function syncTitleControls() {
  buildTitleColorPicker();
  $('title-outline').checked = state.titleOutline !== false;
}

$('title-outline').addEventListener('change', (e) => {
  state.titleOutline = e.target.checked;
  redraw();
});

$('title').addEventListener('input', (e) => { state.title = e.target.value.toUpperCase(); redraw(); });
$('subtitle').addEventListener('input', (e) => { state.subtitle = e.target.value.toUpperCase(); redraw(); });
$('badge').addEventListener('input', (e) => { state.badge = e.target.value.toUpperCase().slice(0, 4); redraw(); });
$('size').addEventListener('change', (e) => { state.size = e.target.value; redraw(); });

// -------------------------------------------------------------- presets
const PRESETS = {
  sunset: {
    layout: 'hero', grade: 'sunset', title: 'PALMSHADE', subtitle: 'VICE HOURS', badge: 'VI',
    titleColor: 'classic',
    photos: ['boulevard', 'pier', 'boulevard', 'pier', 'boulevard'],
  },
  neon: {
    layout: 'diagonal', grade: 'neon', title: 'NEON TIDE', subtitle: 'PALMSHADE CITY', badge: 'VI',
    titleColor: 'mint',
    photos: ['pier', 'boulevard', 'pier'],
  },
  gold: {
    layout: 'spotlight', grade: 'goldenhour', title: 'GOLDEN MILE', subtitle: 'PALMSHADE CITY', badge: 'VI',
    titleColor: 'gold',
    photos: ['boulevard', 'pier', 'boulevard', 'pier', 'boulevard'],
  },
  pink: {
    layout: 'chevron', grade: 'vicepink', title: 'VICE PINK', subtitle: 'AFTER DARK', badge: 'VI',
    titleColor: 'ember',
    photos: ['pier', 'boulevard', 'pier', 'boulevard'],
  },
};

async function applyPreset(name) {
  const p = PRESETS[name];
  if (!p) return;
  if (state.photos.length === 0) {
    await addPhoto('samples/boulevard.jpg', 'Boulevard');
    await addPhoto('samples/pier.jpg', 'Pier');
  }
  const byName = (n) => state.photoNames.findIndex((x) => x.toLowerCase() === n);
  state.layout = p.layout;
  state.grade = p.grade;
  state.title = p.title;
  state.subtitle = p.subtitle;
  state.badge = p.badge;
  state.titleColor = p.titleColor || 'classic';
  state.titleOutline = true;
  $('title').value = p.title;
  $('subtitle').value = p.subtitle;
  $('badge').value = p.badge;
  syncTitleControls();
  state.panels = p.photos.map((n) => freshPanel(Math.max(0, byName(n))));
  state.selected = 0;
  fitPanels();
  // Re-assign precisely: fitPanels preserves the array we just set.
  p.photos.forEach((n, i) => { if (state.panels[i]) state.panels[i].photo = Math.max(0, byName(n)); });
  syncPanelControls();
  refreshPickers();
  redraw();
  setStatus('Preset applied — export it, or make it yours.');
}

$('preset-sunset').addEventListener('click', () => applyPreset('sunset'));
$('preset-neon').addEventListener('click', () => applyPreset('neon'));
$('preset-gold').addEventListener('click', () => applyPreset('gold'));
$('preset-pink').addEventListener('click', () => applyPreset('pink'));

// -------------------------------------------------------------- shuffle
// One click, a fresh cover: a random layout and grade, a random title
// style, and the library photos dealt back into the panels with playful
// zooms and offsets. The caption text stays the user's own.
function shuffleCover() {
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  state.layout = pick(Object.keys(LAYOUTS));
  state.grade = pick(Object.keys(GRADES).filter((k) => k !== 'none'));
  state.titleColor = pick(Object.keys(TITLE_COLORS));
  fitPanels();
  state.panels = state.panels.map(() => ({
    photo: state.photos.length ? Math.floor(Math.random() * state.photos.length) : -1,
    zoom: 1 + Math.random() * 0.35,
    ox: (Math.random() - 0.5) * 0.16,
    oy: (Math.random() - 0.5) * 0.16,
  }));
  state.selected = 0;
  syncPanelControls();
  syncTitleControls();
  refreshPickers();
  redraw();
  setStatus('Shuffled — a new mix. Shuffle again, or drag the panels to taste.');
}
$('shuffle').addEventListener('click', shuffleCover);

// --------------------------------------------------------------- export
function exportPNG() {
  const [w, h] = EXPORT_SIZES[state.size];
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  renderCover(off.getContext('2d'), w, h, state, false);
  off.toBlob((blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `palmshade-cover-${w}x${h}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    setStatus(`Saved palmshade-cover-${w}x${h}.png`);
  }, 'image/png');
}
$('export').addEventListener('click', exportPNG);

// Exposed for screenshot scenes and automated checks.
window.__studio = { state, applyPreset, exportPNG, redraw, shuffleCover };

// ---------------------------------------------------------------- shots
// ?shot=editor&layout=collage&grade=neon  → a staged editor scene
// ?shot=preset&name=neon                  → a preset, editor chrome visible
async function runShotScene() {
  const q = new URLSearchParams(location.search);
  const shot = q.get('shot');
  if (!shot) return false;
  document.body.classList.add('shot');
  await applyPreset(q.get('name') || 'sunset');
  if (q.get('layout')) {
    state.layout = q.get('layout');
    fitPanels();
    refreshPickers();
  }
  if (q.get('grade')) state.grade = q.get('grade');
  if (q.get('color')) state.titleColor = q.get('color');
  if (q.get('size') && EXPORT_SIZES[q.get('size')]) {
    state.size = q.get('size');
    $('size').value = state.size;
  }
  if (q.get('title')) { state.title = q.get('title'); $('title').value = state.title; }
  if (q.get('subtitle')) { state.subtitle = q.get('subtitle'); $('subtitle').value = state.subtitle; }
  syncTitleControls();
  syncPanelControls();
  refreshPickers();
  redraw();
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
  return true;
}

// ----------------------------------------------------------------- boot
async function boot() {
  fitPanels();
  refreshPickers();
  syncTitleControls();
  syncPanelControls();
  try {
    await document.fonts.load('100px Anton');
  } catch { /* the fallback stack still renders */ }
  const staged = await runShotScene();
  if (!staged) {
    // First paint is a finished sample cover, not an empty form.
    await applyPreset('sunset');
  }
  redraw();
}

boot();
