// 详情页、足迹页里的小地图。离开页面时要 remove()，释放显卡资源。

import { createMap, maplibregl } from '../map/basemap.js';
import { category } from '../categories.js';
import { pinName } from '../names.js';

const live = new Set();

export function removeMiniMaps() {
  for (const m of live) m.remove();
  live.clear();
}

function pinEl(place, visited) {
  const c = category(place.category);
  const el = document.createElement('div');
  el.className = 'pin named static';
  el.style.setProperty('--c', c.color);
  el.innerHTML = `<span class="dot">${c.icon}${visited ? '<i class="ok">✓</i>' : ''}</span><span class="lbl">${pinName(place)}</span>`;
  return el;
}

// places：要标出的地点；只有一个时置中放大，多个时缩放到全部看得见
export async function miniMap(container, places, { visited = new Set(), zoom = 11, interactive = false } = {}) {
  const m = await createMap(container, { interactive, attributionControl: { compact: true } });
  live.add(m);
  await new Promise((r) => (m.loaded() ? r() : m.once('load', r)));
  for (const p of places) {
    new maplibregl.Marker({ element: pinEl(p, visited.has(p.id)), anchor: 'left', offset: [-14, 0] }).setLngLat([p.coords.lng, p.coords.lat]).addTo(m);
  }
  if (places.length === 1) {
    m.jumpTo({ center: [places[0].coords.lng, places[0].coords.lat], zoom });
  } else if (places.length > 1) {
    const b = new maplibregl.LngLatBounds();
    for (const p of places) b.extend([p.coords.lng, p.coords.lat]);
    m.fitBounds(b, { padding: 40, maxZoom: 12, duration: 0 });
  }
  return m;
}
