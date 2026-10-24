// 页面 2：景点详情（整屏照片背景 + 一块块毛玻璃卡片；左右滑动切换同年代景点）

import { eraNeighbors, mapUrl, regionName, areaName } from '../data.js';
import { categoryList } from '../categories.js';
import { esc, setBackground, setScrollShade, showMedia, blobUrl } from '../ui.js';
import { miniMap } from './minimap.js';

const hrefOf = (p) => (p.category === 'food' ? '#/place/' : '#/site/') + p.id;

// 左右切换的“上一个 / 下一个”：从地图或附近进来，按当时的列表；否则按同一年代
export function neighborsOf(ctx, id) {
  const list = ctx.navList;
  if (list?.includes(id)) {
    const i = list.indexOf(id);
    const get = (j) => (j >= 0 && j < list.length ? ctx.byId.get(list[j]) : null);
    return { list: list.map((x) => ctx.byId.get(x)), index: i, prev: get(i - 1), next: get(i + 1), href: hrefOf, label: '' };
  }
  const nb = eraNeighbors(ctx.data.sites, id) ?? { list: [ctx.byId.get(id)], index: 0, prev: null, next: null };
  return { ...nb, href: hrefOf, label: ctx.eraById.get(ctx.byId.get(id)?.era)?.name.split('：')[0] ?? '' };
}

// 左右滑动切换（图片轮播区内的滑动不算）
export function swipeNav(view, nb) {
  let start = null;
  view.ontouchstart = (e) => {
    start = e.target.closest('.gallery, .minimap') ? null : { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  view.ontouchend = (e) => {
    if (!start) return;
    const dx = e.changedTouches[0].clientX - start.x;
    const dy = e.changedTouches[0].clientY - start.y;
    start = null;
    if (Math.abs(dx) < 70 || Math.abs(dy) > 50) return;
    const to = dx < 0 ? nb.next : nb.prev;
    if (to) location.replace(nb.href(to));
  };
}

function hikeCard(h) {
  if (!h) return '';
  return `<section class="glass card" id="card-hike">
      <div class="card-label">🥾 徒步${h.name ? ' · ' + esc(h.name) : ''}</div>
      <dl class="kv">
        <dt>全长</dt><dd>${esc(h.lengthKm)} km</dd>
        <dt>用时</dt><dd>${esc(h.hours)}</dd>
        <dt>难度</dt><dd>${esc(h.difficulty)}</dd>
        <dt>季节</dt><dd>${esc(h.season)}</dd>
        <dt>向导</dt><dd>${esc(h.guide)}</dd>
        ${h.permit ? `<dt>许可</dt><dd>${esc(h.permit)}</dd>` : ''}
      </dl>
      <a class="btn block" style="margin-top:10px" href="https://www.google.com/maps/dir/?api=1&destination=${h.start.lat},${h.start.lng}" target="_blank" rel="noopener">🧭 导航到起点</a>
    </section>`;
}

export async function renderSite(view, ctx, siteId) {
  const site = ctx.byId.get(siteId);
  if (!site) { location.replace('#/map'); return; }
  if (site.category === 'food') { location.replace('#/place/' + siteId); return; }
  const era = ctx.eraById.get(site.era);
  const others = site.otherEras.map((id) => ctx.eraById.get(id)?.name).filter(Boolean);
  const nb = neighborsOf(ctx, siteId);
  const images = ctx.images(siteId);
  const checkins = await ctx.store.listBySite(siteId);
  const t = site.ticket;
  setBackground(images[0]?.file ?? null, { blurred: false });

  const bible = site.bible;
  view.innerHTML = `
    <div class="detail-top">
      <button class="icon-btn" id="back" aria-label="返回">‹ 返回</button>
      <div class="row">
        <a class="icon-btn" ${nb.prev ? `href="${nb.href(nb.prev)}"` : 'disabled'} id="prev" aria-label="上一个">‹</a>
        <a class="icon-btn" ${nb.next ? `href="${nb.href(nb.next)}"` : 'disabled'} id="next" aria-label="下一个">›</a>
      </div>
    </div>

    <header class="hero">
      <div class="zh">${esc(site.name.en)}</div>
      <div class="ar" lang="ar" dir="rtl">${esc(site.name.ar)}</div>
      <div class="year ${site.year.length > 8 ? 'long' : ''}">${esc(site.year)}</div>
      <div class="era">${esc(era?.name ?? '')} · ${checkins.length ? `✅ 已打卡 ${checkins.length} 次` : '⬜ 未打卡'}</div>
      <div class="hero-cats" id="hero-cats">${categoryList(site).map((c) => `<span class="chip-s" style="--c:${c.color}">${c.icon} ${esc(c.name)}</span>`).join('')}</div>
    </header>

    ${images.length ? `
    <section class="glass card" id="card-photos">
      <div class="card-label">🖼 图片 <span class="right" id="photo-n">1 / ${images.length}</span></div>
      <div class="gallery" id="gallery">
        ${images.map((im, i) => `<img src="${esc(im.file)}" alt="${esc(site.name.en)} ${i + 1}" data-i="${i}" loading="lazy">`).join('')}
      </div>
      <div class="credit" id="credit"></div>
    </section>` : ''}

    <section class="glass card" id="card-place">
      <div class="card-label">📍 地点与门票</div>
      <dl class="kv">
        <dt>地点</dt><dd id="area">${esc(areaName(site).en)}<br><span lang="ar" dir="rtl">${esc(areaName(site).ar)}</span><br><span class="small muted">${esc(regionName(site.region))}</span></dd>
        <dt>外国游客</dt><dd>${esc(t.foreign)}</dd>
        <dt>约旦居民</dt><dd>${esc(t.local)}</dd>
        <dt>Jordan Pass</dt><dd>${t.jordanPass === true ? '包含' : t.jordanPass === false ? '不包含' : '未确认'}</dd>
        ${site.hours ? `<dt>开放时间</dt><dd>${esc(site.hours)}</dd>` : ''}
      </dl>
      ${t.note ? `<p class="small muted" style="margin-top:8px">${esc(t.note)}</p>` : ''}
      <p class="tiny" style="margin-top:8px">票价查询于 ${esc(t.checked)}，出发前请再核实。</p>
      <div class="minimap" id="mini"></div>
      <div class="row" style="margin-top:10px">
        <a class="btn" href="#/map?focus=${site.id}" style="flex:1" id="on-map">🗺 在地图上看</a>
        <a class="btn" href="${mapUrl(site)}" target="_blank" rel="noopener" style="flex:1" id="map-link">🧭 谷歌地图</a>
      </div>
    </section>
    ${hikeCard(site.hike)}

    <section class="glass card" id="card-summary">
      <div class="card-label">ℹ️ 简介</div>
      <p class="zh-name">中文名：${esc(site.name.zh)}</p>
      <p>${esc(site.summary)}</p>
      ${others.length ? `<p class="small muted">也涉及：${others.map(esc).join('、')}</p>` : ''}
    </section>

    <section class="glass card" id="card-history">
      <div class="card-label">📜 历史</div>
      ${site.history.map((p) => `<p>${esc(p)}</p>`).join('')}
    </section>

    <section class="glass card" id="card-bible">
      <div class="card-label">📖 圣经 <span class="right">${bible.type === 'direct' ? '直接关联' : '时间对照'}</span></div>
      ${bible.refs.length ? `<ul class="refs">${bible.refs.map((r) => `<li><span class="ref">${esc(r.ref)}</span><br>${esc(r.note)}</li>`).join('')}</ul>` : ''}
      <p>${esc(bible.text)}</p>
      ${bible.type === 'timeline' && era ? `<p class="small muted"><b>同时期圣经（${esc(era.range)}）：</b>${esc(era.bible)}</p>` : ''}
    </section>

    <section class="glass card" id="card-checkins">
      <div class="card-label">👣 我的打卡</div>
      <a class="btn primary block" href="#/checkin/new/${site.id}" id="add-checkin">＋ 打卡 / 写记录</a>
      <div id="checkin-list">${checkins.length ? '' : '<p class="small muted" style="margin-top:10px">还没有打卡记录。</p>'}</div>
    </section>

    <section class="glass card">
      <div class="card-label">🔗 资料来源</div>
      <ol class="sources">${site.sources.map((u) => `<li><a href="${esc(u)}" target="_blank" rel="noopener">${esc(u)}</a></li>`).join('')}</ol>
    </section>

    ${nb.list.length > 1 ? `<div class="dots" aria-hidden="true">${nb.list.length <= 14
      ? nb.list.map((_, i) => `<i class="${i === nb.index ? 'on' : ''}"></i>`).join('')
      : `<span>${esc(nb.label)} ${nb.index + 1} / ${nb.list.length}</span>`}</div>` : ''}`;

  view.querySelector('#back').onclick = () => {
    if (history.length > 1) history.back(); else location.hash = '#/map';
  };

  // 图片轮播：滑到哪张就显示哪张的来源
  const gallery = view.querySelector('#gallery');
  if (gallery) {
    const showCredit = (i) => {
      const im = images[i];
      view.querySelector('#photo-n').textContent = `${i + 1} / ${images.length}`;
      view.querySelector('#credit').innerHTML = creditLine(im);
    };
    showCredit(0);
    gallery.addEventListener('scroll', () => showCredit(Math.round(gallery.scrollLeft / gallery.clientWidth)), { passive: true });
    gallery.addEventListener('click', (e) => {
      const i = e.target.dataset?.i;
      if (i !== undefined) showMedia({ url: images[i].file, type: 'image', caption: creditLine(images[i]) });
    });
  }

  await drawCheckins(view.querySelector('#checkin-list'), ctx, checkins);

  // 背景随滚动变暗变模糊
  window.onscroll = () => setScrollShade(window.scrollY / (window.innerHeight * 0.6));

  swipeNav(view, nb);
  miniMap(view.querySelector('#mini'), [site], { visited: ctx.visited, zoom: 12 }).catch(() => {});
}

export function creditLine(im) {
  if (!im) return '';
  const lic = im.licenseUrl ? `<a href="${esc(im.licenseUrl)}" target="_blank" rel="noopener">${esc(im.license)}</a>` : esc(im.license ?? '');
  const src = im.source ? ` · <a href="${esc(im.source)}" target="_blank" rel="noopener">来源</a>` : '';
  return `图片：${esc(im.author || '佚名')} · ${lic}${src}`;
}

export async function drawCheckins(box, ctx, checkins) {
  if (!checkins.length) return;
  const parts = [];
  const mediaById = new Map();
  for (const c of checkins) {
    const media = await ctx.store.mediaFor(c);
    for (const m of media) mediaById.set(m.id, m);
    parts.push(`<div class="checkin" data-checkin="${c.id}">
      <div class="when"><span>${esc(c.date)}</span><a class="icon-btn" href="#/checkin/edit/${c.id}" aria-label="修改">✎ 修改</a></div>
      ${c.companions ? `<div class="small muted">同行：${esc(c.companions)}</div>` : ''}
      ${media.length ? `<div class="thumbs">${media.map((m) => thumbHtml(m)).join('')}</div>` : ''}
      ${c.note ? `<div class="note">${esc(c.note)}</div>` : ''}
    </div>`);
  }
  box.innerHTML = parts.join('');
  box.querySelectorAll('.thumb').forEach((el) => {
    const m = mediaById.get(el.dataset.media);
    const url = blobUrl(m.blob);
    if (m.type === 'video') {
      el.insertAdjacentHTML('afterbegin', `<video src="${url}#t=0.1" muted playsinline preload="metadata"></video>`);
    } else {
      el.insertAdjacentHTML('afterbegin', `<img src="${url}" alt="">`);
    }
    el.onclick = () => showMedia({ url, type: m.type });
  });
}

export function thumbHtml(m) {
  return `<button class="thumb" data-media="${m.id}" aria-label="${m.type === 'video' ? '播放视频' : '查看照片'}">${m.type === 'video' ? '<span class="play">▶</span>' : ''}</button>`;
}
