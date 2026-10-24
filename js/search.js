// 中英阿三语搜索 + 已去 / 未去筛选。

import { matchesCategories } from './categories.js';

// 阿拉伯文：去掉元音符号和拉长符，统一几种 alef、ta marbuta、alef maqsura 的写法。
export function normalize(text) {
  return String(text ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // 拉丁字母的重音符号
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/^al-|\bel-|\bal-/g, '')
    .replace(/[\s\-'’‘·.,()]/g, '');
}

export function matchSite(site, query) {
  const q = normalize(query);
  if (!q) return true;
  const fields = [site.name.zh, site.name.en, site.name.ar ?? '', site.area, site.areaLocal?.en ?? '', site.areaLocal?.ar ?? ''];
  return fields.some((f) => normalize(f).includes(q));
}

// status: 'all' | 'visited' | 'unvisited'
export function filterSites(sites, { query = '', status = 'all', visited = new Set() } = {}) {
  return sites.filter((s) => {
    if (status === 'visited' && !visited.has(s.id)) return false;
    if (status === 'unvisited' && visited.has(s.id)) return false;
    return matchSite(s, query);
  });
}

// 地图 / 附近用的组合筛选：搜索 + 类别多选 + 年代 + 已去 / 未去。
// 年代：主要年代或“也涉及”的年代符合就算；选了年代时，美食与休闲（没有年代）不显示。
export function filterPlaces(list, { query = '', cats = new Set(), era = null, status = 'all', visited = new Set() } = {}) {
  return list.filter((p) => {
    if (status === 'visited' && !visited.has(p.id)) return false;
    if (status === 'unvisited' && visited.has(p.id)) return false;
    if (era && p.era !== era && !(p.otherEras ?? []).includes(era)) return false;
    if (!matchesCategories(p, cats)) return false;
    return matchSite(p, query);
  });
}
