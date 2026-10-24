// 页面：附近（我附近）——用 GPS 按距离列出身边的地点，参考 Go Israel。

import { CATEGORIES, category, categoryList } from '../categories.js';
import { filterPlaces } from '../search.js';
import { nearby, arrowFor, directionName, formatDistance, movedEnough } from '../geo.js';
import { watchMe } from '../locate.js';
import { esc, setBackground } from '../ui.js';
import { nameLines } from '../names.js';
import { popularityLine } from '../popularity.js';
import { placeHref, mapState } from './map.js';

const RADII = [[5, '5 km'], [20, '20 km'], [50, '50 km'], [null, '全部']];
export const nearbyState = { radius: 20, cats: new Set() };
let stop = null;

export function leaveNearby() {
  stop?.();
  stop = null;
}

export function renderNearby(view, ctx) {
  setBackground(null, { blurred: true });
  const st = nearbyState;
  view.innerHTML = `
    <div class="detail-top"><span></span><a class="icon-btn" href="#/map" id="on-map">🗺 在地图上看</a></div>
    <header class="page-head"><h1>我附近</h1><div class="sub" id="gps">📡 正在定位…</div></header>
    <div class="seg" id="radius">${RADII.map(([r, l]) => `<button data-r="${r ?? ''}" class="${st.radius === r ? 'on' : ''}">${l}</button>`).join('')}</div>
    <div class="fchips" id="ncats"></div>
    <div id="near-list"><div class="empty-note">定位后会按距离列出身边的景点、遗迹和吃喝玩乐的地方。</div></div>`;

  const drawCats = () => {
    view.querySelector('#ncats').innerHTML = `<button class="fchip ${st.cats.size ? '' : 'on'}" data-cat="">全部</button>` +
      CATEGORIES.map((c) => `<button class="fchip ${st.cats.has(c.id) ? 'on' : ''}" data-cat="${c.id}" style="--c:${c.color}">${c.icon} ${c.short}</button>`).join('');
  };
  drawCats();

  let me = null;
  let shownAt = null;
  const draw = () => {
    if (!me) return;
    shownAt = me;
    const list = filterPlaces(ctx.all, { cats: st.cats });
    const rows = nearby(list, me, st.radius);
    ctx.navList = rows.map((r) => r.place.id);
    const box = view.querySelector('#near-list');
    if (!rows.length) {
      box.innerHTML = `<div class="empty-note">${st.radius ? `${st.radius} 公里内没有符合条件的地点。试试放大范围。` : '没有符合条件的地点。'}</div>`;
      return;
    }
    box.innerHTML = rows.map(({ place: p, distance, bearing }) => {
      const img = ctx.images(p.id)[0]?.file;
      const c = category(p.category);
      const cats = categoryList(p).slice(0, 3).map((x) => `${x.icon}${x.short}`).join(' · ');
      return `<a class="glass nrow" href="${placeHref(p)}" data-id="${p.id}">
        ${img ? `<div class="sthumb" style="background-image:url('${esc(img)}')"></div>` : `<div class="sthumb" style="--c:${c.color}">${c.icon}</div>`}
        <div class="pinfo">
          <div class="pname two">${nameLines(p)}</div>
          <div class="small muted">${cats} · ${ctx.visited.has(p.id) ? '✅ 已去' : '⬜ 未去'}${p.category === 'food' ? ` · ${esc(p.price)}` : ''}</div>
          ${p.category === 'food' && popularityLine(p) ? `<div class="small pop">🔥 ${esc(popularityLine(p))}</div>` : ''}
        </div>
        <div class="ndist" title="在你的${directionName(bearing)}方"><span class="arrow" aria-label="${directionName(bearing)}">${arrowFor(bearing)}</span><span class="km">${formatDistance(distance)}</span></div>
      </a>`;
    }).join('');
  };

  view.querySelector('#radius').addEventListener('click', (e) => {
    const b = e.target.closest('[data-r]');
    if (!b) return;
    st.radius = b.dataset.r ? Number(b.dataset.r) : null;
    view.querySelectorAll('#radius button').forEach((x) => x.classList.toggle('on', x === b));
    draw();
  });
  view.querySelector('#ncats').addEventListener('click', (e) => {
    const b = e.target.closest('[data-cat]');
    if (!b) return;
    const id = b.dataset.cat;
    if (!id) st.cats = new Set();
    else if (st.cats.has(id)) st.cats.delete(id);
    else st.cats.add(id);
    drawCats();
    draw();
  });

  leaveNearby();
  stop = watchMe({
    onPosition: (pos) => {
      me = pos;
      mapState.me = pos;
      view.querySelector('#gps').textContent = `📍 已定位 ±${Math.round(pos.accuracy ?? 0)} m`;
      if (movedEnough(shownAt, pos)) draw();
    },
    onError: (msg) => {
      view.querySelector('#gps').textContent = '⚠️ 无法定位';
      view.querySelector('#near-list').innerHTML = `<div class="glass card" id="gps-error"><div class="card-label">📍 需要定位权限</div><p class="small">${esc(msg)}</p></div>`;
    },
  });
}
