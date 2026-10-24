// 地图上的 7 类图钉。景点有一个主要类别（决定图钉样式）和若干次要类别（用于筛选）。

export const CATEGORIES = [
  { id: 'bible', name: '圣经遗迹', short: '圣经', icon: '📖', color: '#f2c14e' },
  { id: 'history', name: '历史遗迹', short: '历史', icon: '🏛', color: '#e8875a' },
  { id: 'reserve', name: '自然保护区', short: '保护区', icon: '🌿', color: '#4cc38a' },
  { id: 'park', name: '国家公园', short: '国家公园', icon: '🌳', color: '#8bd450' },
  { id: 'hike', name: '徒步景点', short: '徒步', icon: '🥾', color: '#5ab4f0' },
  { id: 'attraction', name: '其他景点', short: '景点', icon: '📍', color: '#b18cf0' },
  { id: 'food', name: '美食与休闲', short: '美食', icon: '🍽', color: '#ff7aa8' },
];

export const CATEGORY_IDS = CATEGORIES.map((c) => c.id);
export const SITE_CATEGORY_IDS = CATEGORY_IDS.filter((id) => id !== 'food');
const byId = new Map(CATEGORIES.map((c) => [c.id, c]));
export const category = (id) => byId.get(id);

// 一个地点属于哪些类别：主类别 + 次要类别 + 圣经直接关联自动算“圣经遗迹”
export function categoriesOf(place) {
  const set = new Set([place.category, ...(place.tags ?? [])]);
  if (place.bible?.type === 'direct') set.add('bible');
  return set;
}

// 依显示顺序排好的类别清单（主类别排第一）
export function categoryList(place) {
  const set = categoriesOf(place);
  return [place.category, ...CATEGORY_IDS.filter((id) => id !== place.category && set.has(id))].map(category);
}

// selected 为空集合 = 全部
export function matchesCategories(place, selected) {
  if (!selected || selected.size === 0) return true;
  const set = categoriesOf(place);
  for (const id of selected) if (set.has(id)) return true;
  return false;
}
