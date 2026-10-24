// 建立离线底图（MapLibre + Protomaps 的 OpenStreetMap 矢量地图）。

import * as maplibregl from '../../vendor/maplibre-gl.mjs';
import { openMapDB, isReady, downloadMap, ChunkedSource } from './offline-map.js';

export { maplibregl };

const abs = (p) => new URL(p, document.baseURI).href;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[data-src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src;
    s.dataset.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error('载入失败：' + src));
    document.head.appendChild(s);
  });
}

let ready = null;
// 只做一次：载入函式库、确认地图文件已存好、登记读取来源
export function prepareMap({ onProgress } = {}) {
  ready ??= (async () => {
    await Promise.all([loadScript('vendor/pmtiles.js'), loadScript('vendor/basemaps.js')]);
    if (!document.querySelector('link[data-maplibre]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'vendor/maplibre-gl.css';
      link.dataset.maplibre = '1';
      document.head.appendChild(link);
    }
    const meta = await (await fetch('map/map.json')).json();
    const db = await openMapDB();
    if (!(await isReady(db, meta.version))) {
      await downloadMap(db, 'map/' + meta.file, meta.version, { onProgress });
    }
    const protocol = new window.pmtiles.Protocol();
    maplibregl.addProtocol('pmtiles', protocol.tile);
    protocol.add(new window.pmtiles.PMTiles(new ChunkedSource(db, meta.file)));
    return meta;
  })().catch((err) => { ready = null; throw err; });
  return ready;
}

// 配色：在 Protomaps 深色主题上调成与 App 相配的深蓝灰
function flavor() {
  const f = window.basemaps.namedFlavor('dark');
  return {
    ...f,
    background: '#0f1526',
    earth: '#1a2133',
    water: '#0d2a45',
    park_a: '#1d3326',
    park_b: '#1d3326',
    wood_a: '#1c3124',
    wood_b: '#1c3124',
    sand: '#2a2a2b',
    buildings: '#262d40',
    highway: '#5a6276',
    major: '#454d60',
    minor_a: '#353c4e',
    minor_b: '#353c4e',
    city_label: '#e8ecf5',
    city_label_halo: '#0f1526',
    state_label: '#8d97ad',
    country_label: '#b8c2d8',
  };
}

// 山体阴影：把高程资料画成立体山形，佩特拉、瓦迪拉姆、死海裂谷一看就懂
function withHillshade(layers) {
  const hill = {
    id: 'hillshade',
    type: 'hillshade',
    source: 'terrain',
    paint: {
      // 高程资料只到第 10 级，放得越大越模糊，所以放大后减淡
      'hillshade-exaggeration': ['interpolate', ['linear'], ['zoom'], 5, 0.6, 10, 0.5, 12, 0.25, 14, 0.08],
      'hillshade-shadow-color': '#05070d',
      'hillshade-highlight-color': '#6a7390',
      'hillshade-accent-color': '#0b0f1a',
      'hillshade-illumination-direction': 315,
    },
  };
  const at = layers.findIndex((l) => /^roads|^water/.test(l.id));
  return at < 0 ? [...layers, hill] : [...layers.slice(0, at), hill, ...layers.slice(at)];
}

export function mapStyle(meta) {
  return {
    version: 8,
    glyphs: abs('map/fonts/') + '{fontstack}/{range}.pbf',
    sprite: abs('map/sprites/dark'),
    sources: {
      protomaps: {
        type: 'vector',
        url: 'pmtiles://' + meta.file,
        attribution: '<a href="https://www.openstreetmap.org/copyright" target="_blank">© OpenStreetMap</a> · <a href="https://protomaps.com" target="_blank">Protomaps</a>',
      },
      terrain: {
        type: 'raster-dem',
        tiles: [abs('map/terrain/') + '{z}/{x}/{y}.png'],
        encoding: 'terrarium',
        tileSize: 256,
        maxzoom: 10,
        bounds: [34.85, 29.15, 39.35, 33.4],
        attribution: '地形：<a href="https://registry.opendata.aws/terrain-tiles/" target="_blank">Terrain Tiles</a>',
      },
    },
    layers: withHillshade(window.basemaps.layers('protomaps', flavor(), { lang: 'en' })),
  };
}

// 约旦全国范围
export const JORDAN_BOUNDS = [[34.9, 29.18], [39.3, 33.38]];

export async function createMap(container, { onProgress, ...options } = {}) {
  const meta = await prepareMap({ onProgress });
  const map = new maplibregl.Map({
    container,
    style: mapStyle(meta),
    bounds: JORDAN_BOUNDS,
    maxBounds: [[33.5, 28.3], [40.8, 34.2]],
    maxZoom: 17,
    attributionControl: { compact: true },
    dragRotate: false,
    pitchWithRotate: false,
    ...options,
  });
  map.touchZoomRotate.disableRotation();
  return map;
}
