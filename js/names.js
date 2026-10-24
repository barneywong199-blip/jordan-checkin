// 地名一律用当地的英文名 + 阿拉伯文名；中文名只放在详情页的介绍里。

import { esc } from './ui.js';

// 列表和图钉用的简称：去掉括号里的补充说明，例如 “Lot's Cave (Deir Ain Abata…)” → “Lot's Cave”
export function shortEn(p) {
  const s = p.name.en.replace(/\s*[（(][^）)]*[）)]\s*/g, ' ').replace(/\s+/g, ' ').trim();
  return s || p.name.en;
}

// 英文 + 阿拉伯文两行（阿拉伯文由右到左）
export function nameLines(p, { short = true } = {}) {
  return `<span class="n-en">${esc(short ? shortEn(p) : p.name.en)}</span><span class="n-ar" lang="ar" dir="rtl">${esc(p.name.ar)}</span>`;
}

// 地图图钉：阿拉伯文在上、英文简称在下
export const pinName = (p) => `<span class="n-ar pin-ar" lang="ar" dir="rtl">${esc(p.name.ar)}</span><span class="n-en pin-en">${esc(shortEn(p))}</span>`;

// 一行纯文字，用在标题、提示等
export const plainName = (p) => `${shortEn(p)} · ${p.name.ar}`;
