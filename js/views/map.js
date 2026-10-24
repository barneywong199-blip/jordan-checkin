// 页面 1：地图（首页）。地图只建立一次，切换页面时隐藏，回来时保持原来的位置和筛选。

import { createMap, maplibregl } from '../map/basemap.js';
import { CATEGORIES, category, categoryList } from '../categories.js';
import { filterPlaces } from '../search.js';
import { distanceKm, formatDistance } from '../geo.js';
import { esc, toast } from '../ui.js';
import { watchMe } from '../locate.js';
import { nameLines, pinName } from '../names.js';
import { popularityLine } from '../popularity.js';

const root = () => document.getElementById('map-root');
let map = null;
let creating = null;
let markers = new Map(); // key -> { marker, el }
let meMarker = null;
let ctxRef = null;
let view = null;

export const mapState = {
  query: '',
  cats: new Set(),
  era: '',
  status: 'all',
  selected: null,
  sheet: 'peek', // peek | list | card
  me: null,
};

export function placeHref(p) {
  return p.category === 'food' ? '#/place/' + p.id : '#/site/' + p.id;
}

function currentList() {
  return filterPlaces(ctxRef.all, { query: mapState.query, cats: mapState.cats, era: mapState.era || null, status: mapState.status, visited: ctxRef.visited });
}

function geojson(list) {
  return {
    type: 'FeatureCollection',
    features: list.map((p) => ({
      type: 'Feature',
      id: undefined,
      properties: { id: p.id, cat: p.category, visited: ctxRef.visited.has(p.id) ? 1 : 0 },
      geometry: { type: 'Point', coordinates: [p.coords.lng, p.coords.lat] },
    })),
  };
}

async function ensureMap(ctx) {
  if (map) return map;
  creating ??= (async () => {
    const container = document.getElementById('map');
    const status = document.getElementById('map-status');
    status.hidden = false;
    status.textContent = '正在准备离线地图…';
    const m = await createMap(container, {
      onProgress: (a, b) => { status.textContent = `第一次使用：正在下载离线地图 ${b ? Math.floor((a / b) * 100) : ''}%（约 ${Math.round(b / 1048576)} MB，建议连 Wi-Fi）`; },
    });
    await new Promise((r) => (m.loaded() ? r() : m.once('load', r)));
    m.addSource('places', { type: 'geojson', data: geojson([]), cluster: true, clusterRadius: 44, clusterMaxZoom: 11 });
    // 看不见的图层：只是为了让 MapLibre 计算聚合，真正的图钉用 HTML 画（才能显示中文）
    m.addLayer({ id: 'places-hit', type: 'circle', source: 'places', paint: { 'circle-radius': 1, 'circle-opacity': 0 } });
    m.addSource('trails', { type: 'geojson', data: ctx.data.trails });
    m.addLayer({ id: 'trails-casing', type: 'line', source: 'trails', paint: { 'line-color': '#0b1020', 'line-width': 5, 'line-opacity': 0.6 }, layout: { 'line-join': 'round', 'line-cap': 'round' } });
    m.addLayer({ id: 'trails', type: 'line', source: 'trails', paint: { 'line-color': category('hike').color, 'line-width': 3, 'line-dasharray': [2, 1.5] }, layout: { 'line-join': 'round', 'line-cap': 'round' } });
    m.on('click', 'trails', (e) => {
      const id = e.features[0]?.properties?.siteId;
      if (id) select(id);
    });
    m.on('mouseenter', 'trails', () => { m.getCanvas().style.cursor = 'pointer'; });
    m.on('mouseleave', 'trails', () => { m.getCanvas().style.cursor = ''; });
    m.on('sourcedata', (e) => { if (e.sourceId === 'places' && e.isSourceLoaded) syncMarkers(); });
    m.on('moveend', () => { syncMarkers(); drawSheet(); });
    m.on('click', (e) => {
      if (e.originalEvent.target.closest?.('.pin, .cluster')) return;
      if (!m.queryRenderedFeatures(e.point, { layers: ['trails'] }).length && mapState.sheet === 'card') {
        mapState.selected = null;
        mapState.sheet = 'peek';
        drawSheet();
      }
    });
    status.hidden = true;
    map = m;
    window.__mainMap = m;
    return m;
  })().catch((err) => {
    creating = null;
    const status = document.getElementById('map-status');
    status.hidden = false;
    status.textContent = '地图载入失败：' + err.message + '（请连网后重开 App）';
    throw err;
  });
  return creating;
}

// 依地图目前的聚合结果，增删 HTML 图钉
function syncMarkers() {
  if (!map) return;
  const feats = map.querySourceFeatures('places');
  const want = new Map();
  for (const f of feats) {
    const p = f.properties;
    // 聚合编号换资料后会重复使用，所以连同数量一起当作识别；数量变了就重画
    const key = p.cluster ? `c${p.cluster_id}-${p.point_count}` : p.id;
    if (!want.has(key)) want.set(key, f);
  }
  for (const [key, m] of markers) {
    if (!want.has(key)) { m.marker.remove(); markers.delete(key); }
  }
  const showNames = map.getZoom() >= 9.5;
  for (const [key, f] of want) {
    const p = f.properties;
    let m = markers.get(key);
    if (!m) {
      const el = document.createElement('button');
      el.type = 'button';
      if (p.cluster) {
        el.className = 'cluster';
        el.textContent = p.point_count;
        el.setAttribute('aria-label', `${p.point_count} 个地点，点击放大`);
        el.onclick = async (ev) => {
          ev.stopPropagation();
          const zoom = await map.getSource('places').getClusterExpansionZoom(p.cluster_id);
          map.easeTo({ center: f.geometry.coordinates, zoom: zoom + 0.3 });
        };
      } else {
        const place = ctxRef.byId.get(p.id);
        const c = category(place.category);
        el.className = 'pin';
        el.dataset.id = p.id;
        el.style.setProperty('--c', c.color);
        el.innerHTML = `<span class="dot">${c.icon}${ctxRef.visited.has(p.id) ? '<i class="ok">✓</i>' : ''}</span><span class="lbl">${pinName(place)}</span>`;
        el.setAttribute('aria-label', `${place.name.ar} ${place.name.en}`);
        el.onclick = (ev) => { ev.stopPropagation(); select(p.id); };
      }
      const marker = new maplibregl.Marker({ element: el, anchor: p.cluster ? 'center' : 'left', offset: p.cluster ? [0, 0] : [-14, 0] })
        .setLngLat(f.geometry.coordinates).addTo(map);
      m = { marker, el };
      markers.set(key, m);
    }
    m.el.classList.toggle('named', showNames);
    m.el.classList.toggle('on', !p.cluster && mapState.selected === p.id);
  }
}

function refreshData() {
  if (!map) return;
  for (const m of markers.values()) m.marker.remove();
  markers = new Map();
  const list = currentList();
  map.getSource('places').setData(geojson(list));
  map.once('idle', syncMarkers); // 资料换完、地图画好后再同步一次图钉
  // 路线跟着筛选：只画筛选后还在的徒步地点
  const ids = list.map((p) => p.id);
  for (const layer of ['trails', 'trails-casing']) map.setFilter(layer, ['in', ['get', 'siteId'], ['literal', ids]]);
}

function select(id, { fly = false } = {}) {
  mapState.selected = id;
  mapState.sheet = 'card';
  const p = ctxRef.byId.get(id);
  if (fly && p) map.easeTo({ center: [p.coords.lng, p.coords.lat], zoom: Math.max(map.getZoom(), 12) });
  for (const [key, m] of markers) m.el.classList.toggle('on', key === id);
  drawSheet();
}

function visibleSorted() {
  const b = map?.getBounds();
  const list = currentList().filter((p) => !b || b.contains([p.coords.lng, p.coords.lat]));
  if (mapState.me) {
    return list.map((p) => ({ p, d: distanceKm(mapState.me, p.coords) })).sort((a, b) => a.d - b.d);
  }
  return list.map((p) => ({ p, d: null }));
}

function metaLine(p) {
  if (p.category === 'food') {
    const pop = popularityLine(p);
    return `${esc(p.type)} · ${esc(p.price)}${pop ? `<br><span class="pop">🔥 ${esc(pop)}</span>` : ''}`;
  }
  return esc(p.year);
}

function thumb(p) {
  const img = ctxRef.images(p.id)[0]?.file;
  const c = category(p.category);
  return img ? `<div class="sthumb" style="background-image:url('${esc(img)}')"></div>` : `<div class="sthumb" style="--c:${c.color}">${c.icon}</div>`;
}

function drawSheet() {
  if (!view) return;
  const sheet = view.querySelector('#sheet');
  if (!sheet) return;
  sheet.dataset.state = mapState.sheet;
  const body = sheet.querySelector('.sheet-body');
  if (mapState.sheet === 'card' && mapState.selected) {
    const p = ctxRef.byId.get(mapState.selected);
    const cats = categoryList(p).map((c) => `<span class="chip-s" style="--c:${c.color}">${c.icon} ${esc(c.name)}</span>`).join('');
    const d = mapState.me ? ` · 距你 ${formatDistance(distanceKm(mapState.me, p.coords))}` : '';
    const short = (t) => (t.length > 28 ? t.slice(0, 27) + '…' : t);
    const ticket = p.category === 'food' ? '' : `<div class="small muted">🎫 ${esc(short(p.ticket.foreign))} · 居民 ${esc(short(p.ticket.local))}</div>`;
    body.innerHTML = `
      <div class="pcard" data-id="${p.id}">
        ${thumb(p)}
        <div class="pinfo">
          <div class="pname">${esc(p.name.en)} ${ctxRef.visited.has(p.id) ? '<span class="okb">✅ 已打卡</span>' : ''}</div>
          <div class="small muted" lang="ar" dir="rtl" style="text-align:left">${esc(p.name.ar)}</div>
          <div class="chips-s">${cats}</div>
          <div class="small">${metaLine(p)}${d}</div>
          ${ticket}
        </div>
      </div>
      <div class="row pbtns">
        <a class="btn" href="${placeHref(p)}" id="card-detail">查看详情</a>
        <a class="btn primary" href="#/checkin/new/${p.id}" id="card-checkin">＋ 打卡</a>
        <a class="btn" href="https://www.google.com/maps/dir/?api=1&destination=${p.coords.lat},${p.coords.lng}" target="_blank" rel="noopener">🧭 导航</a>
      </div>`;
    sheet.querySelector('.sheet-title').textContent = '';
    return;
  }
  const rows = visibleSorted();
  sheet.querySelector('.sheet-title').textContent = `地图上的 ${rows.length} 个地点${mapState.me ? '（按距离）' : ''}`;
  if (mapState.sheet !== 'list') { body.innerHTML = ''; return; }
  ctxRef.navList = rows.map((r) => r.p.id);
  body.innerHTML = rows.slice(0, 80).map(({ p, d }) => `
    <a class="srow" href="${placeHref(p)}" data-id="${p.id}">
      ${thumb(p)}
      <div class="pinfo">
        <div class="pname two">${nameLines(p)}${ctxRef.visited.has(p.id) ? ' ✅' : ''}</div>
        <div class="small muted">${category(p.category).icon} ${metaLine(p)}</div>
      </div>
      ${d != null ? `<div class="dist">${formatDistance(d)}</div>` : ''}
    </a>`).join('') + (rows.length > 80 ? '<p class="small muted" style="text-align:center">放大地图可以看到更多</p>' : '')
    + (rows.length === 0 ? '<p class="small muted" style="text-align:center">这个范围内没有符合条件的地点</p>' : '');
}

function drawFilters() {
  const chips = view.querySelector('#cats');
  chips.innerHTML = `<button class="fchip ${mapState.cats.size ? '' : 'on'}" data-cat="">全部</button>` +
    CATEGORIES.map((c) => `<button class="fchip ${mapState.cats.has(c.id) ? 'on' : ''}" data-cat="${c.id}" style="--c:${c.color}">${c.icon} ${c.short}</button>`).join('');
  view.querySelectorAll('[data-mstatus]').forEach((b) => b.classList.toggle('on', b.dataset.mstatus === mapState.status));
  view.querySelector('#era').value = mapState.era;
}

function applyFilters() {
  drawFilters();
  refreshData();
  if (mapState.selected && !currentList().some((p) => p.id === mapState.selected)) {
    mapState.selected = null;
    mapState.sheet = 'peek';
  }
  drawSheet();
}

export async function renderMap(viewEl, ctx, params = new URLSearchParams()) {
  ctxRef = ctx;
  view = viewEl;
  document.body.classList.add('map-mode');
  root().hidden = false;
  if (params.has('era')) { mapState.era = params.get('era'); mapState.cats = new Set(); mapState.query = ''; }
  if (params.has('cat')) mapState.cats = new Set([params.get('cat')]);

  view.innerHTML = `
    <div class="map-top">
      <input class="search" id="mq" type="search" placeholder="🔍 搜索景点或餐厅（中文 / English / عربي）" value="${esc(mapState.query)}" autocomplete="off">
      <div class="fchips" id="cats"></div>
      <div class="row map-row2">
        <select id="era" class="era-sel" aria-label="年代">
          <option value="">年代：全部</option>
          ${ctx.data.eras.map((e) => `<option value="${e.id}">${esc(e.name.split('：')[0])}（${esc(e.range)}）</option>`).join('')}
        </select>
        <div class="seg mini">
          <button data-mstatus="all">全部</button><button data-mstatus="unvisited">⬜ 未去</button><button data-mstatus="visited">✅ 已去</button>
        </div>
      </div>
    </div>
    <div class="map-tools">
      <button class="icon-btn" id="locate" aria-label="我的位置">◎</button>
      <button class="icon-btn" id="fit" aria-label="看全国">🇯🇴</button>
      <a class="icon-btn" id="food-list-btn" href="#/food" aria-label="探店清单">🍽</a>
    </div>
    <section id="sheet" class="sheet glass" data-state="peek">
      <button class="sheet-handle" id="handle" aria-label="展开或收起列表"><i></i><span class="sheet-title"></span></button>
      <div class="sheet-body"></div>
    </section>`;
  drawFilters();

  view.querySelector('#mq').addEventListener('input', (e) => { mapState.query = e.target.value; applyFilters(); });
  view.querySelector('#cats').addEventListener('click', (e) => {
    const b = e.target.closest('[data-cat]');
    if (!b) return;
    const id = b.dataset.cat;
    if (!id) mapState.cats = new Set();
    else if (mapState.cats.has(id)) mapState.cats.delete(id);
    else mapState.cats.add(id);
    applyFilters();
  });
  view.querySelector('#era').addEventListener('change', (e) => { mapState.era = e.target.value; applyFilters(); });
  view.querySelectorAll('[data-mstatus]').forEach((b) => b.addEventListener('click', () => { mapState.status = b.dataset.mstatus; applyFilters(); }));
  view.querySelector('#handle').addEventListener('click', () => {
    mapState.sheet = mapState.sheet === 'list' ? 'peek' : 'list';
    if (mapState.sheet === 'list') mapState.selected = null;
    syncMarkers();
    drawSheet();
  });
  view.querySelector('#fit').addEventListener('click', () => map && fitToList(ctxRef.all));
  view.querySelector('#locate').addEventListener('click', () => startLocate(true));
  // 往上 / 往下拖动列表把手
  let y0 = null;
  const handle = view.querySelector('#handle');
  handle.addEventListener('touchstart', (e) => { y0 = e.touches[0].clientY; }, { passive: true });
  handle.addEventListener('touchend', (e) => {
    if (y0 == null) return;
    const dy = e.changedTouches[0].clientY - y0;
    y0 = null;
    if (Math.abs(dy) < 30) return;
    mapState.sheet = dy < 0 ? 'list' : 'peek';
    if (mapState.sheet === 'list') mapState.selected = null;
    drawSheet();
  });

  const first = !map;
  await ensureMap(ctx);
  map.resize();
  refreshData();
  if (params.has('focus')) select(params.get('focus'), { fly: true });
  else if (params.has('era')) fitToList();
  else if (first) fitToList(ctx.all, 0);
  drawSheet();
  if (mapState.me) placeMe();
  window.__mapReady = true;
}

// 让这些地点都落在搜索栏和底部列表之间
function fitToList(list = currentList(), duration = 600) {
  if (!list.length) return;
  const b = new maplibregl.LngLatBounds();
  for (const p of list) b.extend([p.coords.lng, p.coords.lat]);
  map.fitBounds(b, { padding: { top: 175, bottom: 90, left: 30, right: 30 }, maxZoom: 11, duration });
}

let stopWatch = null;
function startLocate(fly) {
  stopWatch ??= watchMe({
    onPosition: (pos) => {
      const first = !mapState.me;
      mapState.me = pos;
      placeMe();
      if (first && fly) map.easeTo({ center: [pos.lng, pos.lat], zoom: Math.max(map.getZoom(), 11) });
      drawSheet();
    },
    onError: (msg) => { toast(msg, 6000); stopWatch?.(); stopWatch = null; },
  });
  if (mapState.me && fly) map.easeTo({ center: [mapState.me.lng, mapState.me.lat], zoom: Math.max(map.getZoom(), 11) });
}

function placeMe() {
  if (!map || !mapState.me) return;
  if (!meMarker) {
    const el = document.createElement('div');
    el.className = 'me-dot';
    meMarker = new maplibregl.Marker({ element: el }).setLngLat([mapState.me.lng, mapState.me.lat]).addTo(map);
  } else {
    meMarker.setLngLat([mapState.me.lng, mapState.me.lat]);
  }
}

// 离开地图页时调用
export function leaveMap() {
  document.body.classList.remove('map-mode');
  const r = root();
  if (r) r.hidden = true;
  view = null;
}

export function getMainMap() { return map; }
