// 页面 2b：美食与休闲详情（样式同景点详情，没有历史和圣经）

import { mapUrl, regionName, areaName } from '../data.js';
import { categoryList } from '../categories.js';
import { esc, setBackground, setScrollShade, showMedia } from '../ui.js';
import { creditLine, drawCheckins, swipeNav, neighborsOf } from './site.js';
import { miniMap } from './minimap.js';
import { popularityLine } from '../popularity.js';

export async function renderPlace(view, ctx, id) {
  const p = ctx.byId.get(id);
  if (!p || p.category !== 'food') { location.replace('#/map'); return; }
  const images = ctx.images(id);
  const checkins = await ctx.store.listBySite(id);
  const nb = neighborsOf(ctx, id);
  setBackground(images[0]?.file ?? null, { blurred: !images.length });

  view.innerHTML = `
    <div class="detail-top">
      <button class="icon-btn" id="back" aria-label="返回">‹ 返回</button>
      <div class="row">
        <a class="icon-btn" ${nb.prev ? `href="${nb.href(nb.prev)}"` : 'disabled'} aria-label="上一个">‹</a>
        <a class="icon-btn" ${nb.next ? `href="${nb.href(nb.next)}"` : 'disabled'} aria-label="下一个">›</a>
      </div>
    </div>
    <header class="hero">
      <div class="zh">${esc(p.name.en)}</div>
      <div class="ar" lang="ar" dir="rtl">${esc(p.name.ar)}</div>
      <div class="year long">${esc(p.type)} · ${esc(p.price)}</div>
      <div class="era">${categoryList(p).map((c) => `${c.icon} ${esc(c.name)}`).join(' · ')} · ${checkins.length ? `✅ 已打卡 ${checkins.length} 次` : '⬜ 未打卡'}</div>
    </header>
    ${images.length ? `<section class="glass card"><div class="card-label">🖼 图片</div>
      <div class="gallery" id="gallery">${images.map((im, i) => `<img src="${esc(im.file)}" alt="" data-i="${i}" loading="lazy">`).join('')}</div>
      <div class="credit">${creditLine(images[0])}</div></section>` : ''}
    <section class="glass card" id="card-why"><div class="card-label">🍽 推荐理由</div>
      <p class="zh-name">中文名：${esc(p.name.zh)}</p>
      ${popularityLine(p) ? `<p class="pop" id="pop">🔥 ${esc(popularityLine(p))}<br><span class="tiny">人气资料查询于 ${esc(p.popularity.checked)}${p.popularity.instagram?.handle ? ` · Instagram ${esc(p.popularity.instagram.handle)}` : ''}</span></p>` : ''}
      <p>${esc(p.why)}</p>
      ${p.since ? `<p class="small muted">开业：${esc(p.since)}</p>` : ''}</section>
    <section class="glass card" id="card-signature"><div class="card-label">⭐ 招牌菜 / 特色</div>
      <ul class="refs">${p.signature.map((s) => `<li>${esc(s)}</li>`).join('')}</ul></section>
    <section class="glass card" id="card-info"><div class="card-label">📍 地址与营业</div>
      <dl class="kv">
        <dt>价位</dt><dd>${esc(p.price)}</dd>
        <dt>营业时间</dt><dd>${esc(p.hours ?? '未查到')}</dd>
        <dt>地址</dt><dd>${esc(p.address)}</dd>
        <dt>地区</dt><dd id="area">${esc(areaName(p).en)}<br><span lang="ar" dir="rtl">${esc(areaName(p).ar)}</span><br><span class="small muted">${esc(regionName(p.region))}</span></dd>
      </dl>
      <p class="tiny" style="margin-top:8px">资料查询于 ${esc(p.checked)}。餐厅变动快，出发前请再确认。</p>
      <div class="minimap" id="mini"></div>
      <div class="row" style="margin-top:10px">
        <a class="btn" href="#/map?focus=${p.id}" style="flex:1">🗺 在地图上看</a>
        <a class="btn" href="${mapUrl(p)}" target="_blank" rel="noopener" style="flex:1" id="map-link">🧭 谷歌地图</a>
      </div>
    </section>
    <section class="glass card" id="card-checkins"><div class="card-label">👣 我的打卡</div>
      <a class="btn primary block" href="#/checkin/new/${p.id}" id="add-checkin">＋ 打卡 / 写记录</a>
      <div id="checkin-list">${checkins.length ? '' : '<p class="small muted" style="margin-top:10px">还没有打卡记录。</p>'}</div></section>
    <section class="glass card"><div class="card-label">🔗 资料来源</div>
      <ol class="sources">${p.sources.map((u) => `<li><a href="${esc(u)}" target="_blank" rel="noopener">${esc(u)}</a></li>`).join('')}</ol></section>`;

  view.querySelector('#back').onclick = () => { if (history.length > 1) history.back(); else location.hash = '#/map'; };
  view.querySelector('#gallery')?.addEventListener('click', (e) => {
    const i = e.target.dataset?.i;
    if (i !== undefined) showMedia({ url: images[i].file, type: 'image', caption: creditLine(images[i]) });
  });
  await drawCheckins(view.querySelector('#checkin-list'), ctx, checkins);
  window.onscroll = () => setScrollShade(window.scrollY / (window.innerHeight * 0.6));
  swipeNav(view, nb);
  miniMap(view.querySelector('#mini'), [p], { visited: ctx.visited, zoom: 14 }).catch(() => {});
}
