// 景点资料：读取、排序、分组。纯函数为主，方便在 Node 里测试。

export const REGIONS = [
  { id: 'amman', name: '安曼与萨尔特', en: 'Amman & As-Salt', ar: 'عمّان والسلط', hint: '安曼、萨尔特、伊拉克埃米尔' },
  { id: 'north', name: '北部', en: 'North Jordan', ar: 'شمال الأردن', hint: '杰拉什、阿杰隆、伊尔比德、乌姆盖斯' },
  { id: 'deadsea', name: '死海与约旦河谷', en: 'Dead Sea & Jordan Valley', ar: 'البحر الميت ووادي الأردن', hint: '受洗处、死海、穆吉布' },
  { id: 'madaba', name: '马达巴与国王大道', en: "Madaba & King's Highway", ar: 'مأدبا والطريق الملوكي', hint: '马达巴、尼波山、马盖耳斯、卡拉克' },
  { id: 'south', name: '南部', en: 'South Jordan', ar: 'جنوب الأردن', hint: '佩特拉、达纳、瓦迪拉姆、亚喀巴' },
  { id: 'east', name: '东部沙漠城堡', en: 'Eastern Desert Castles', ar: 'قصور البادية الشرقية', hint: '阿姆拉、哈拉纳、阿兹拉克、乌姆吉马尔' },
];

export async function loadData(fetchFn = fetch, base = './data/') {
  const get = async (f, optional = false) => {
    // 可选文件（美食、徒步路线）读不到也照常启动，断网时浏览器会直接报网络错误
    const res = await fetchFn(base + f).catch((err) => { if (optional) return { ok: false }; throw err; });
    if (!res.ok) {
      if (optional) return null;
      throw new Error('读取资料失败：' + f);
    }
    return res.json();
  };
  const [eras, sites, credits, places, trails] = await Promise.all([
    get('eras.json'), get('sites.json'), get('credits.json'), get('places.json', true), get('trails.geojson', true),
  ]);
  return {
    eras,
    sites: sortByTimeline(sites, eras),
    places: places ?? [],
    trails: trails ?? { type: 'FeatureCollection', features: [] },
    credits,
  };
}

// 按年代顺序排列；同一年代内保持资料原有顺序（资料按时间先后撰写）。
export function sortByTimeline(sites, eras) {
  const order = new Map(eras.map((e) => [e.id, e.order]));
  return sites
    .map((s, i) => ({ s, i }))
    .sort((a, b) => (order.get(a.s.era) ?? 99) - (order.get(b.s.era) ?? 99) || a.i - b.i)
    .map((x) => x.s);
}

export function groupByEra(sites, eras) {
  const sorted = [...eras].sort((a, b) => a.order - b.order);
  return sorted.map((era) => ({ era, sites: sites.filter((s) => s.era === era.id) }));
}

export function groupByRegion(sites) {
  return REGIONS.map((region) => ({ region, sites: sites.filter((s) => s.region === region.id) }));
}

// 同一年代里的上一个 / 下一个景点，用于详情页左右滑动。
export function eraNeighbors(sites, siteId) {
  const site = sites.find((s) => s.id === siteId);
  if (!site) return null;
  const list = sites.filter((s) => s.era === site.era);
  const index = list.findIndex((s) => s.id === siteId);
  return {
    list,
    index,
    prev: index > 0 ? list[index - 1] : null,
    next: index < list.length - 1 ? list[index + 1] : null,
  };
}

export function mapUrl(site) {
  const { lat, lng } = site.coords;
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

// 地区名用英文 + 阿拉伯文
export function regionName(id) {
  const r = REGIONS.find((x) => x.id === id);
  return r ? `${r.en} · ${r.ar}` : id;
}

// 地点栏：英文 + 阿拉伯文（资料里的 areaLocal）
export function areaName(p) {
  return p.areaLocal ? { en: p.areaLocal.en, ar: p.areaLocal.ar } : { en: p.area, ar: '' };
}
