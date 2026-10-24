// 景点资料校验：规格见 docs/资料格式.md。返回错误信息数组，空数组表示通过。

import { SITE_CATEGORY_IDS } from './categories.js';

const REGION_IDS = ['amman', 'north', 'deadsea', 'madaba', 'south', 'east'];
const nonEmpty = (v) => typeof v === 'string' && v.trim().length > 0;

export function validateSite(site, eraIds) {
  const errors = [];
  const need = (cond, msg) => { if (!cond) errors.push(`${site?.id ?? '(无 id)'}: ${msg}`); };

  need(typeof site?.id === 'string' && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(site.id), 'id 必须是小写英文加连字符');
  need(nonEmpty(site?.name?.zh) && nonEmpty(site?.name?.en) && nonEmpty(site?.name?.ar), '中英阿名称都要有');
  need(eraIds.includes(site?.era), `年代 era 无效：${site?.era}`);
  need(Array.isArray(site?.otherEras) && site.otherEras.every((e) => eraIds.includes(e)), 'otherEras 必须是有效年代数组');
  need(nonEmpty(site?.year), '缺 year');
  need(REGION_IDS.includes(site?.region), `地区 region 无效：${site?.region}`);
  need(nonEmpty(site?.area), '缺 area');
  need(nonEmpty(site?.areaLocal?.en) && nonEmpty(site?.areaLocal?.ar), '地点栏 areaLocal 要有英文和阿拉伯文');
  const { lat, lng } = site?.coords ?? {};
  // 约旦大致范围：北纬 29–33.5，东经 34.8–39.5
  need(typeof lat === 'number' && typeof lng === 'number' && lat > 29 && lat < 33.5 && lng > 34.8 && lng < 39.5, '坐标缺失或不在约旦范围内');
  need(site?.wiki === null || nonEmpty(site?.wiki), 'wiki 要填条目标题或 null');
  need(nonEmpty(site?.summary), '缺简介 summary');
  need(Array.isArray(site?.history) && site.history.length >= 2 && site.history.every(nonEmpty), '历史 history 至少 2 段');
  const b = site?.bible;
  need(b && ['direct', 'timeline'].includes(b.type), 'bible.type 必须是 direct 或 timeline');
  need(b && nonEmpty(b.text), '缺 bible.text');
  need(b && Array.isArray(b.refs), 'bible.refs 必须是数组');
  if (b?.type === 'direct') {
    need(b.refs.length > 0 && b.refs.every((r) => nonEmpty(r.ref) && nonEmpty(r.note)), 'direct 类型要有经文出处 refs（ref + note）');
  }
  const t = site?.ticket;
  need(t && nonEmpty(t.foreign) && nonEmpty(t.local), '门票 foreign / local 都要填（查不到写“未查到”）');
  need(t && [true, false, null].includes(t.jordanPass), 'ticket.jordanPass 必须是 true / false / null');
  need(t && /^\d{4}-\d{2}$/.test(t.checked ?? ''), 'ticket.checked 格式为 YYYY-MM');
  need(site?.hours === undefined || site.hours === null || nonEmpty(site.hours), 'hours 要么是文字，要么是 null');
  need(Array.isArray(site?.sources) && site.sources.length > 0 && site.sources.every((u) => /^https?:\/\//.test(u)), '至少一个资料来源网址');
  need(SITE_CATEGORY_IDS.includes(site?.category), `主要类别 category 无效：${site?.category}`);
  need(Array.isArray(site?.tags) && site.tags.every((t) => SITE_CATEGORY_IDS.includes(t) && t !== site.category), 'tags 必须是有效类别数组，且不重复主类别');
  if (site?.category === 'hike' || site?.tags?.includes('hike')) errors.push(...validateHike(site));
  return errors;
}

export function validateHike(site) {
  const h = site.hike;
  const errors = [];
  const need = (cond, msg) => { if (!cond) errors.push(`${site.id}: 徒步资料 ${msg}`); };
  need(h && typeof h === 'object', '缺 hike');
  if (!h) return errors;
  need(typeof h.lengthKm === 'number' && h.lengthKm > 0, 'lengthKm 要是正数');
  need(nonEmpty(h.hours), '缺 hours');
  need(['易', '中', '难'].includes(h.difficulty), 'difficulty 只能是 易 / 中 / 难');
  need(nonEmpty(h.season), '缺 season');
  need(['必须请向导', '建议请向导', '可自行前往'].includes(h.guide), 'guide 取值不对');
  need(h.permit === null || nonEmpty(h.permit), 'permit 要么是文字，要么是 null');
  const { lat, lng } = h.start ?? {};
  need(typeof lat === 'number' && typeof lng === 'number' && lat > 29 && lat < 33.5 && lng > 34.8 && lng < 39.5, '起点坐标缺失或不在约旦');
  need(h.osmRelation === null || Number.isInteger(h.osmRelation), 'osmRelation 要是整数或 null');
  need(h.osmRelations === undefined || (Array.isArray(h.osmRelations) && h.osmRelations.every(Number.isInteger)), 'osmRelations 要是整数数组（由几段拼成的路线）');
  return errors;
}

const FOOD_TYPES = ['餐厅', '街头小吃', '甜点', '咖啡馆', '土耳其浴', '海滩', '观景', '体验', '其他'];

export function validatePlace(p) {
  const errors = [];
  const need = (cond, msg) => { if (!cond) errors.push(`${p?.id ?? '(无 id)'}: ${msg}`); };
  need(typeof p?.id === 'string' && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(p.id), 'id 必须是小写英文加连字符');
  need(nonEmpty(p?.name?.zh) && nonEmpty(p?.name?.en), '中英文名称都要有');
  need(p?.category === 'food', 'category 必须是 food');
  need(FOOD_TYPES.includes(p?.type), `type 无效：${p?.type}`);
  need(REGION_IDS.includes(p?.region), `地区 region 无效：${p?.region}`);
  need(nonEmpty(p?.area), '缺 area');
  need(nonEmpty(p?.areaLocal?.en) && nonEmpty(p?.areaLocal?.ar), '地点栏 areaLocal 要有英文和阿拉伯文');
  const { lat, lng } = p?.coords ?? {};
  need(typeof lat === 'number' && typeof lng === 'number' && lat > 29 && lat < 33.5 && lng > 34.8 && lng < 39.5, '坐标缺失或不在约旦范围内');
  need(nonEmpty(p?.why), '缺推荐理由 why');
  need(Array.isArray(p?.signature) && p.signature.length > 0 && p.signature.every(nonEmpty), '招牌菜 signature 至少一项');
  need(nonEmpty(p?.price), '缺价位 price（查不到写“未查到”）');
  need(p?.hours === null || nonEmpty(p?.hours), 'hours 要么是文字，要么是 null');
  need(nonEmpty(p?.address), '缺地址 address');
  need(p?.wiki === null || nonEmpty(p?.wiki), 'wiki 要填条目标题或 null');
  need(/^\d{4}-\d{2}$/.test(p?.checked ?? ''), 'checked 格式为 YYYY-MM');
  need(Array.isArray(p?.sources) && p.sources.length > 0 && p.sources.every((u) => /^https?:\/\//.test(u)), '至少一个资料来源网址');
  if (p?.popularity !== undefined) errors.push(...validatePopularity(p));
  return errors;
}

// 人气依据：Instagram 粉丝数 + Google 评分与评价数（数字必须是查到的，查不到写 null）
export function validatePopularity(p) {
  const pop = p.popularity;
  const errors = [];
  const need = (cond, msg) => { if (!cond) errors.push(`${p.id}: 人气资料 ${msg}`); };
  need(pop && typeof pop === 'object', 'popularity 要是对象');
  if (!pop) return errors;
  const ig = pop.instagram;
  need(ig === null || ig === undefined || (typeof ig === 'object' && (ig.followers === null || (Number.isInteger(ig.followers) && ig.followers >= 0)) && (ig.handle === null || /^@[\w.]+$/.test(ig.handle ?? ''))), 'instagram.followers 要是整数或 null，handle 形如 @name');
  const g = pop.google;
  need(g === null || g === undefined || (typeof g === 'object' && (g.rating === null || (typeof g.rating === 'number' && g.rating >= 1 && g.rating <= 5)) && (g.reviews === null || (Number.isInteger(g.reviews) && g.reviews >= 0))), 'google.rating 要在 1–5，reviews 要是整数，或 null');
  need(/^\d{4}-\d{2}$/.test(pop.checked ?? ''), 'checked 格式为 YYYY-MM');
  return errors;
}

export function validateAll(sites, eras, places = []) {
  const eraIds = eras.map((e) => e.id);
  const errors = [...sites.flatMap((s) => validateSite(s, eraIds)), ...places.flatMap(validatePlace)];
  const seen = new Set();
  for (const s of [...sites, ...places]) {
    if (seen.has(s.id)) errors.push(`${s.id}: id 重复`);
    seen.add(s.id);
  }
  return errors;
}
