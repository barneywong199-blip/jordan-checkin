// 各页面共用的卡片样式。

import { esc } from '../ui.js';
import { regionName } from '../data.js';
import { shortEn } from '../names.js';

export function bibleBadge(site) {
  if (site.bible.type === 'direct') {
    const first = site.bible.refs[0]?.ref ?? '圣经';
    return `<span class="badge-bible">📖 ${esc(first.split(/[ :：]/)[0])}</span>`;
  }
  return '<span class="badge-time">📖 时间对照</span>';
}

export function siteCard(site, ctx) {
  const img = ctx.hero(site);
  const visited = ctx.visited.has(site.id);
  return `<a class="site-card" href="#/site/${site.id}" data-site="${site.id}"
      ${img ? `style="background-image:url('${esc(img)}')"` : ''}>
    <div class="main">
      <div class="zh">${esc(shortEn(site))}</div>
      <div class="en" lang="ar" dir="rtl">${esc(site.name.ar)}</div>
      <div class="meta">${esc(regionName(site.region))} · ${bibleBadge(site)}</div>
    </div>
    <div class="side">
      <div class="status" aria-label="${visited ? '已打卡' : '未打卡'}">${visited ? '✅' : '⬜'}</div>
      <div class="year">${esc(site.year)}</div>
    </div>
  </a>`;
}
