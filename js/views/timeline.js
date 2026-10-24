// 页面 1：时间线（首页）

import { groupByEra } from '../data.js';
import { filterSites } from '../search.js';
import { needsBackupReminder } from '../stats.js';
import { esc, setBackground } from '../ui.js';
import { siteCard } from './common.js';

export async function renderTimeline(view, ctx) {
  const { sites, eras } = ctx.data;
  const state = ctx.timelineState;
  const petra = ctx.siteById.get('petra');
  setBackground(petra ? ctx.hero(petra) : null, { blurred: true });

  const remind = needsBackupReminder({
    hasCheckins: ctx.checkins.length > 0,
    lastBackupAt: await ctx.store.getMeta('lastBackupAt'),
    firstCheckinAt: await ctx.store.getMeta('firstCheckinAt'),
  });

  view.innerHTML = `
    <header class="page-head">
      <h1>约旦打卡</h1>
      <div class="sub" id="progress">已打卡 ${ctx.visited.size} / ${sites.length}</div>
    </header>
    ${remind ? '<div class="banner" id="backup-banner">⚠️ 已经超过 30 天没有备份打卡资料了。<a href="#/backup">现在备份</a></div>' : ''}
    <input class="search" id="q" type="search" placeholder="🔍 搜索景点（中文 / English / عربي）" value="${esc(state.query)}" autocomplete="off">
    <div class="seg" role="tablist">
      ${[['all', '全部'], ['visited', '已去'], ['unvisited', '未去']].map(([v, l]) =>
        `<button data-status="${v}" class="${state.status === v ? 'on' : ''}" role="tab">${l}</button>`).join('')}
    </div>
    <div class="glass era-strip" id="era-strip"></div>
    <div id="list"></div>`;

  const list = view.querySelector('#list');
  const strip = view.querySelector('#era-strip');

  const draw = () => {
    const shown = filterSites(sites, { query: state.query, status: state.status, visited: ctx.visited });
    const groups = groupByEra(shown, eras);
    strip.innerHTML = groups.map(({ era, sites: s }) => `
      <button class="era-chip ${s.length ? '' : 'empty'}" data-era="${era.id}">
        <span class="c">${esc(era.range.replace(/^约/, ''))}</span>
        <span class="n">${s.length}</span>
        <span class="t">${esc(era.name.split('：')[0])}</span>
      </button>`).join('');
    const nonEmpty = groups.filter((g) => g.sites.length);
    list.innerHTML = nonEmpty.length
      ? nonEmpty.map(({ era, sites: s }) => `
        <section>
          <div class="glass era-head" id="era-${era.id}">
            <h2>${esc(era.name)}</h2>
            <div class="range">${esc(era.range)} · ${s.length} 个景点 <a class="map-link" href="#/map?era=${era.id}">🗺 在地图上看</a></div>
            <div class="bible clamp" title="点击展开"><b>📖 同时期圣经：</b>${esc(era.bible)}</div>
          </div>
          ${s.map((site) => siteCard(site, ctx)).join('')}
        </section>`).join('')
      : '<div class="empty-note">没有找到符合的景点</div>';
  };
  draw();

  view.querySelector('#q').addEventListener('input', (e) => { state.query = e.target.value; draw(); });
  view.querySelectorAll('[data-status]').forEach((b) => b.addEventListener('click', () => {
    state.status = b.dataset.status;
    view.querySelectorAll('[data-status]').forEach((x) => x.classList.toggle('on', x === b));
    draw();
  }));
  strip.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-era]');
    const target = chip && document.getElementById('era-' + chip.dataset.era);
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  list.addEventListener('click', (e) => {
    const b = e.target.closest('.bible');
    if (b) b.classList.toggle('clamp');
  });
}
