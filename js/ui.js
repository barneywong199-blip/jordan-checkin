// 界面小工具：转义、提示、全屏查看、确认框、背景。

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// 页面切换时释放上一页建立的照片 / 视频临时网址，避免占内存。
let objectUrls = [];
export function blobUrl(blob) {
  const url = URL.createObjectURL(blob);
  objectUrls.push(url);
  return url;
}
export function releaseUrls() {
  for (const u of objectUrls) URL.revokeObjectURL(u);
  objectUrls = [];
}

export function toast(text, ms = 2600) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', 'status');
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), ms);
}

const overlay = () => document.getElementById('overlay');

export function closeOverlay() {
  const o = overlay();
  o.hidden = true;
  o.innerHTML = '';
}

// 全屏看照片或播放视频
export function showMedia({ url, type, caption = '' }) {
  const o = overlay();
  o.innerHTML = `
    ${type === 'video' ? `<video src="${url}" controls playsinline autoplay></video>` : `<img src="${url}" alt="">`}
    <button class="icon-btn close" aria-label="关闭">✕</button>
    ${caption ? `<div class="cap">${caption}</div>` : ''}`;
  o.hidden = false;
  o.querySelector('.close').onclick = closeOverlay;
  o.onclick = (e) => { if (e.target === o) closeOverlay(); };
}

// 选择框：buttons = [{ label, value, kind }]；返回被点的 value，点外面返回 null
export function choose({ title, html = '', buttons }) {
  return new Promise((resolve) => {
    const o = overlay();
    o.innerHTML = `<div class="dialog glass" role="dialog" aria-modal="true">
      <h3>${esc(title)}</h3><div class="muted">${html}</div>
      <div class="row">${buttons.map((b, i) => `<button class="btn ${b.kind ?? ''}" data-i="${i}">${esc(b.label)}</button>`).join('')}</div>
    </div>`;
    o.hidden = false;
    const finish = (v) => { closeOverlay(); resolve(v); };
    o.querySelectorAll('[data-i]').forEach((btn) => { btn.onclick = () => finish(buttons[+btn.dataset.i].value); });
    o.onclick = (e) => { if (e.target === o) finish(null); };
  });
}

export async function confirmDanger(title, html, okLabel = '删除') {
  return (await choose({ title, html, buttons: [{ label: '取消', value: false }, { label: okLabel, value: true, kind: 'danger' }] })) === true;
}

// 背景照片：详情页清楚显示，列表页模糊
export function setBackground(url, { blurred = true } = {}) {
  const img = document.getElementById('bg-img');
  img.style.backgroundImage = url ? `url("${url}")` : '';
  document.body.classList.toggle('list-bg', blurred);
  setScrollShade(0);
}

// 详情页往下滑，背景渐渐变暗、变模糊（像天气 App）
export function setScrollShade(progress) {
  const p = Math.max(0, Math.min(1, progress));
  const shade = document.getElementById('bg-shade');
  const img = document.getElementById('bg-img');
  if (document.body.classList.contains('list-bg')) { shade.style.background = ''; img.style.filter = ''; return; }
  shade.style.background = `rgba(5, 8, 18, ${0.2 + p * 0.5})`;
  img.style.filter = p > 0.02 ? `blur(${Math.round(p * 18)}px)` : '';
}

export function formatBytes(n) {
  if (n < 1024 * 1024) return `${Math.max(0, Math.round(n / 1024))} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

export function todayISO(d = new Date()) {
  const pad = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
