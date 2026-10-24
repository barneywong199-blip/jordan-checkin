// 距离与方向（用于“附近”页和地图）。

const R = 6371.0088; // 地球平均半径（公里）
const rad = (d) => (d * Math.PI) / 180;

// 两点间的大圆距离（公里），a、b 为 { lat, lng }
export function distanceKm(a, b) {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

// 从 a 看 b 的方位角，0 = 正北，90 = 正东
export function bearing(a, b) {
  const y = Math.sin(rad(b.lng - a.lng)) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lng - a.lng));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

const ARROWS = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];
const NAMES = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];
const sector = (deg) => Math.round(deg / 45) % 8;
export const arrowFor = (deg) => ARROWS[sector(deg)];
export const directionName = (deg) => NAMES[sector(deg)];

export function formatDistance(km) {
  if (km < 1) return `${Math.max(10, Math.round((km * 1000) / 10) * 10)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

// 按离 me 的距离排序，附上 distance / bearing；radiusKm 为 null 表示不限
export function nearby(places, me, radiusKm = null) {
  return places
    .map((p) => ({ place: p, distance: distanceKm(me, p.coords), bearing: bearing(me, p.coords) }))
    .filter((x) => radiusKm == null || x.distance <= radiusKm)
    .sort((a, b) => a.distance - b.distance);
}

// 位置移动超过 minMeters 才需要重新排序，避免列表一直跳
export function movedEnough(prev, next, minMeters = 50) {
  if (!prev) return true;
  return distanceKm(prev, next) * 1000 >= minMeters;
}
