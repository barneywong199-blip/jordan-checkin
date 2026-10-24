// 页面：探店清单——美食与休闲按人气排名，照着顺序去吃；打卡过的自动打勾。

import { REGIONS, areaName } from '../data.js';
import { rankFood, popularityLine, isEat } from '../popularity.js';
import { esc, setBackground } from '../ui.js';
import { nameLines } from '../names.js';

export const foodListState = { kind: 'eat', region: '', status: 'all' };

export function renderFoodList(view, ctx) {
  setBackground(null, { blurred: true });
  const st = foodListState;
  const kindOf = (p) => (isEat(p) ? 'eat' : 'relax');
  const ranked = rankFood(ctx.data.places.filter((p) => kindOf(p) === st.kind)); // 这一组的全国排名，先算好名次
  const rankOf = new Map(ranked.map((p, i) => [p.id, i + 1]));
  const regions = REGIONS.filter((r) => ranked.some((p) => p.region === r.id));

  view.innerHTML = `
    <div class="detail-top"><button class="icon-btn" id="back">‹ 返回</button><a class="icon-btn" href="#/map?cat=food">🗺 在地图上看</a></div>
    <header class="page-head"><h1>探店清单</h1>
      <div class="sub" id="food-progress"></div></header>
    <div class="seg" id="fkind">
      <button data-k="eat" class="${st.kind === 'eat' ? 'on' : ''}">🍽 吃（${ctx.data.places.filter((p) => kindOf(p) === 'eat').length}）</button>
      <button data-k="relax" class="${st.kind === 'relax' ? 'on' : ''}">🧖 休闲放松（${ctx.data.places.filter((p) => kindOf(p) === 'relax').length}）</button>
    </div>
    <div class="fchips" id="fregion">
      <button class="fchip ${st.region ? '' : 'on'}" data-r="">Jordan · الأردن</button>
      ${regions.map((r) => `<button class="fchip ${st.region === r.id ? 'on' : ''}" data-r="${r.id}">${esc(r.en)} · ${esc(r.ar)}</button>`).join('')}
    </div>
    <div class="seg" id="fstatus">
      ${[['all', '全部'], ['todo', '⬜ 还没去'], ['done', '✅ 去过']].map(([v, l]) => `<button data-s="${v}" class="${st.status === v ? 'on' : ''}">${l}</button>`).join('')}
    </div>
    <ol class="food-list" id="food-list"></ol>
    <p class="tiny" style="margin:14px 4px">排名方法：以 Google 地图的评分和评价数为主、Instagram 粉丝数为辅（评价数取对数，避免几万条评价的老店一家独大）；查不到的数字当作一般水平。资料查询于 2026-10，餐厅变动快，出发前请再确认。</p>`;

  const draw = () => {
    const list = ranked.filter((p) => (!st.region || p.region === st.region)
      && (st.status === 'all' || (st.status === 'done') === ctx.visited.has(p.id)));
    const inRegion = ranked.filter((p) => !st.region || p.region === st.region);
    const done = inRegion.filter((p) => ctx.visited.has(p.id)).length;
    // textContent 本身不会解析 HTML，不要再转义（否则 & 会显示成 &amp;）
    view.querySelector('#food-progress').textContent = `已去 ${done} / ${inRegion.length} 家 · 下一家：${inRegion.find((p) => !ctx.visited.has(p.id))?.name.en ?? '全部去过了 🎉'}`;
    ctx.navList = list.map((p) => p.id);
    view.querySelector('#food-list').innerHTML = list.map((p) => {
      const img = ctx.images(p.id)[0]?.file;
      const pop = popularityLine(p);
      return `<li><a class="glass frow ${ctx.visited.has(p.id) ? 'done' : ''}" href="#/place/${p.id}" data-id="${p.id}">
        <span class="rank">${rankOf.get(p.id)}</span>
        ${img ? `<div class="sthumb" style="background-image:url('${esc(img)}')"></div>` : '<div class="sthumb" style="--c:#ff7aa8">🍽</div>'}
        <div class="pinfo">
          <div class="pname two">${nameLines(p)}</div>
          <div class="small muted">${esc(p.name.zh)} · ${esc(p.type)} · ${esc(areaName(p).en)}</div>
          <div class="small">💰 ${esc(p.price)}</div>
          ${pop ? `<div class="small pop">🔥 ${esc(pop)}</div>` : ''}
        </div>
        <span class="fcheck" aria-label="${ctx.visited.has(p.id) ? '去过' : '还没去'}">${ctx.visited.has(p.id) ? '✅' : '⬜'}</span>
      </a></li>`;
    }).join('') || '<div class="empty-note">没有符合条件的店</div>';
  };
  draw();

  view.querySelector('#back').onclick = () => { if (history.length > 1) history.back(); else location.hash = '#/map'; };
  view.querySelector('#fkind').addEventListener('click', (e) => {
    const b = e.target.closest('[data-k]');
    if (!b || b.dataset.k === st.kind) return;
    st.kind = b.dataset.k;
    st.region = '';
    renderFoodList(view, ctx);
  });
  view.querySelector('#fregion').addEventListener('click', (e) => {
    const b = e.target.closest('[data-r]');
    if (!b) return;
    st.region = b.dataset.r;
    view.querySelectorAll('#fregion .fchip').forEach((x) => x.classList.toggle('on', x === b));
    draw();
  });
  view.querySelector('#fstatus').addEventListener('click', (e) => {
    const b = e.target.closest('[data-s]');
    if (!b) return;
    st.status = b.dataset.s;
    view.querySelectorAll('#fstatus button').forEach((x) => x.classList.toggle('on', x === b));
    draw();
  });
}
