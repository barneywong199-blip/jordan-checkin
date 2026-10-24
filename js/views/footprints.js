// 页面 5：足迹（自己的打卡日记）

import { computeStats, sortCheckinsNewestFirst } from '../stats.js';
import { esc, setBackground, blobUrl } from '../ui.js';
import { miniMap } from './minimap.js';
import { placeHref } from './map.js';
import { shortEn } from '../names.js';

export async function renderFootprints(view, ctx) {
  const { eras } = ctx.data;
  const s = computeStats(ctx.all, eras, ctx.checkins);
  const list = sortCheckinsNewestFirst(ctx.checkins).filter((c) => ctx.siteById.has(c.siteId));
  const latest = list[0] && ctx.siteById.get(list[0].siteId);
  setBackground(latest ? ctx.hero(latest) : null, { blurred: true });

  view.innerHTML = `
    <header class="page-head"><h1>我的足迹</h1></header>
    <div class="stats">
      <div class="glass stat"><div class="v" id="st-visited">${s.visitedCount}</div><div class="k">已去地点 / ${s.total}</div></div>
      <div class="glass stat"><div class="v" id="st-checkins">${s.checkinCount}</div><div class="k">打卡次数</div></div>
      <div class="glass stat"><div class="v" id="st-eras">${s.erasCovered}</div><div class="k">覆盖年代 / ${s.totalEras}</div></div>
    </div>
    <a class="btn block food-entry" href="#/food" id="to-food">🍽 探店清单（按人气排名，照着顺序去吃）</a>
    ${s.visitedCount ? '<section class="glass card"><div class="card-label">🗺 足迹地图</div><div class="minimap tall" id="foot-map"></div></section>' : ''}
    <div id="feet">${list.length ? '' : '<div class="empty-note">还没有打卡。到景点详情页点“＋ 打卡”开始记录。</div>'}</div>`;

  const footMap = view.querySelector('#foot-map');
  if (footMap) {
    const visitedPlaces = ctx.all.filter((p) => ctx.visited.has(p.id));
    miniMap(footMap, visitedPlaces, { visited: ctx.visited, interactive: true }).catch(() => {});
  }
  const box = view.querySelector('#feet');
  for (const c of list) {
    const site = ctx.siteById.get(c.siteId);
    const media = await ctx.store.mediaFor(c);
    const first = media.find((m) => m.type === 'image') ?? media[0];
    const hero = ctx.hero(site);
    let pic = '';
    if (first) {
      const url = blobUrl(first.blob);
      pic = first.type === 'video' ? `<video src="${url}#t=0.1" muted playsinline preload="metadata"></video>` : `<img src="${url}" alt="">`;
    }
    box.insertAdjacentHTML('beforeend', `
      <a class="glass foot" href="${placeHref(site)}" data-checkin="${c.id}">
        <div class="pic" ${!first && hero ? `style="background-image:url('${esc(hero)}')"` : ''}>${pic}</div>
        <div class="body">
          <div class="title">${esc(shortEn(site))} <span class="small muted">${esc(c.date)}</span></div>
          <div class="small muted" lang="ar" dir="rtl" style="text-align:left">${esc(site.name.ar)}</div>
          <div class="snip">${esc(c.note || (media.length ? `${media.length} 个照片 / 视频` : '（没有写心得）'))}</div>
        </div>
      </a>`);
  }
}
