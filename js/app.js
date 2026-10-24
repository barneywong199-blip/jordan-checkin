// 启动、路由和共用状态。

import { loadData } from './data.js';
import { openStore } from './store.js';
import { visitedSet } from './stats.js';
import { releaseUrls, closeOverlay, esc } from './ui.js';
import { renderTimeline } from './views/timeline.js';
import { renderMap, leaveMap } from './views/map.js';
import { renderNearby, leaveNearby } from './views/nearby.js';
import { renderSite } from './views/site.js';
import { renderPlace } from './views/place.js';
import { renderFoodList } from './views/foodlist.js';
import { removeMiniMaps } from './views/minimap.js';
import { renderEditor } from './views/editor.js';
import { renderFootprints } from './views/footprints.js';
import { renderBackup, renderCredits } from './views/backup.js';

const view = document.getElementById('view');

export const ctx = {
  data: null,
  store: null,
  checkins: [],
  visited: new Set(),
  eraById: new Map(),
  siteById: new Map(), // 景点 + 美食，按 id 查（与 byId 相同）
  byId: new Map(),
  all: [], // 景点 + 美食
  navList: null, // 地图 / 附近当时的列表顺序，详情页左右切换用
  timelineState: { query: '', status: 'all' },

  async refreshCheckins() {
    this.checkins = await this.store.listCheckins();
    this.visited = visitedSet(this.checkins);
  },
  images(siteId) {
    return this.data.credits[siteId] ?? [];
  },
  hero(site) {
    return this.images(site.id)[0]?.file ?? null;
  },
};

const routes = [
  [/^#\/map(?:\?(.*))?$/, (m) => renderMap(view, ctx, new URLSearchParams(m[1] ?? '')), 'map'],
  [/^#\/nearby$/, () => renderNearby(view, ctx), 'nearby'],
  [/^#\/food$/, () => renderFoodList(view, ctx), 'detail'],
  [/^#\/timeline$/, () => renderTimeline(view, ctx), 'timeline'],
  [/^#\/site\/([\w-]+)$/, (m) => renderSite(view, ctx, m[1]), 'detail'],
  [/^#\/place\/([\w-]+)$/, (m) => renderPlace(view, ctx, m[1]), 'detail'],
  [/^#\/checkin\/new\/([\w-]+)$/, (m) => renderEditor(view, ctx, { siteId: m[1] }), null],
  [/^#\/checkin\/edit\/([\w-]+)$/, (m) => renderEditor(view, ctx, { checkinId: m[1] }), null],
  [/^#\/footprints$/, () => renderFootprints(view, ctx), 'footprints'],
  [/^#\/backup$/, () => renderBackup(view, ctx), 'backup'],
  [/^#\/credits$/, () => renderCredits(view, ctx), 'backup'],
];

// 记住每一页的滚动位置，从详情页返回时回到原处
const scrollMemory = new Map();
let currentHash = null;

async function route() {
  let hash = location.hash || '#/map';
  // v1 的“按地区”页已改由地图承担
  if (/^#\/regions?\b/.test(hash)) { location.replace('#/map'); return; }
  if (currentHash) scrollMemory.set(currentHash, window.scrollY);
  ctx.prevHash = currentHash;
  currentHash = hash;
  closeOverlay();
  releaseUrls();
  removeMiniMaps();
  window.onscroll = null;
  view.ontouchstart = view.ontouchend = null;
  const found = routes.map(([re, fn, tab]) => [hash.match(re), fn, tab]).find(([m]) => m);
  if (!found) { location.replace('#/map'); return; }
  const [m, fn, tab] = found;
  if (tab !== 'map') leaveMap();
  if (tab !== 'nearby') leaveNearby();
  // 详情页的底部按钮高亮来源页（地图 / 附近 / 时间线 / 足迹）
  const tabOf = tab === 'detail' ? ctx.lastTab ?? 'map' : tab;
  if (tab && tab !== 'detail') ctx.lastTab = tab;
  document.body.classList.toggle('no-tabs', tab === null);
  document.querySelectorAll('#tabs a').forEach((a) => a.classList.toggle('on', a.dataset.tab === tabOf));
  try {
    await fn(m);
  } catch (err) {
    console.error(err);
    view.innerHTML = `<div class="glass card"><div class="card-label">出错了</div><p>${esc(err.message)}</p></div>`;
  }
  const isList = /^#\/(timeline|nearby|footprints|food)/.test(hash);
  window.scrollTo(0, isList ? scrollMemory.get(hash) ?? 0 : 0);
}

async function boot() {
  view.innerHTML = '<div class="empty-note">载入中…</div>';
  try {
    const [data, store] = await Promise.all([loadData(), openStore()]);
    ctx.data = data;
    ctx.store = store;
    ctx.eraById = new Map(data.eras.map((e) => [e.id, e]));
    ctx.all = [...data.sites, ...data.places];
    ctx.byId = new Map(ctx.all.map((s) => [s.id, s]));
    ctx.siteById = ctx.byId;
    await ctx.refreshCheckins();
  } catch (err) {
    view.innerHTML = `<div class="glass card"><div class="card-label">无法启动</div><p>${esc(err.message)}</p>
      <p class="small muted">如果是在 iPhone 的“无痕浏览”里打开，请改用普通模式。</p></div>`;
    return;
  }
  // 请浏览器不要自动清除这里的资料（iPhone 主屏幕 App 默认就会保留）
  navigator.storage?.persist?.().catch(() => {});
  window.addEventListener('hashchange', route);
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeOverlay(); });
  await route();
  window.__appReady = true;
}

// 时间线列表点进详情页时，左右切换按同一年代
window.addEventListener('click', (e) => {
  const a = e.target.closest?.('a[href^="#/site/"], a[href^="#/place/"]');
  if (a && !a.closest('#sheet, #near-list')) ctx.navList = null;
}, true);

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  // 有新版本装好时自动刷新一次（第一次安装不刷新）
  const hadController = Boolean(navigator.serviceWorker.controller);
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController && !reloaded) { reloaded = true; location.reload(); }
  });
  navigator.serviceWorker.register('sw.js').then((reg) => reg.update()).catch((err) => console.warn('离线功能未启用：', err));
}

boot();
