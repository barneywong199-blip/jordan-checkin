// 美食人气依据的显示文字。

export function formatCount(n) {
  if (n == null) return null;
  if (n >= 10000) return `${(n / 10000).toFixed(n >= 100000 ? 0 : 1).replace(/\.0$/, '')} 万`;
  return n.toLocaleString('zh-CN');
}

// 例如 “IG 12 万粉丝 · Google 4.6 分（1.8 万条评价）”；都没有就返回 ''
export function popularityLine(p) {
  const pop = p.popularity;
  if (!pop) return '';
  const parts = [];
  const f = formatCount(pop.instagram?.followers);
  if (f) parts.push(`IG ${f}粉丝`);
  const g = pop.google;
  if (g?.rating) parts.push(`Google ${g.rating} 分${g.reviews ? `（${formatCount(g.reviews)}条评价）` : ''}`);
  return parts.join(' · ');
}

// 探店清单的排名分数：Google 评分 × 评价数（取对数，避免几万条评价的店一家独大）为主，Instagram 粉丝为辅。
// 查不到的数字当作“普通”：评分 4.0、评价 100 条、粉丝 0。
export function popularityScore(p) {
  const g = p.popularity?.google ?? {};
  const rating = g.rating ?? 4.0;
  const reviews = g.reviews ?? 100;
  const followers = p.popularity?.instagram?.followers ?? 0;
  return rating * Math.log10(reviews + 10) + 0.3 * Math.log10(followers + 10);
}

// 探店清单分两组：吃（餐厅、小吃、甜点、咖啡馆）和休闲放松（土耳其浴、海滩、观景、体验等）
export const EAT_TYPES = ['餐厅', '街头小吃', '甜点', '咖啡馆'];
export const isEat = (p) => EAT_TYPES.includes(p.type);

// 按分数从高到低；同分按英文名
export function rankFood(places) {
  return [...places].sort((a, b) => popularityScore(b) - popularityScore(a) || a.name.en.localeCompare(b.name.en));
}
