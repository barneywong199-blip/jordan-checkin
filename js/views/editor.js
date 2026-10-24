// 页面 3：写 / 修改打卡记录

import { esc, blobUrl, confirmDanger, toast, todayISO, showMedia, formatBytes } from '../ui.js';
import { mediaType } from '../store.js';
import { shortEn } from '../names.js';

export async function renderEditor(view, ctx, { siteId, checkinId }) {
  let existing = null;
  let existingMedia = [];
  if (checkinId) {
    existing = await ctx.store.getCheckin(checkinId);
    if (!existing) { location.replace('#/timeline'); return; }
    siteId = existing.siteId;
    existingMedia = await ctx.store.mediaFor(existing);
  }
  const site = ctx.siteById.get(siteId);
  if (!site) { location.replace('#/timeline'); return; }

  const removed = new Set();
  const added = []; // File[]
  const backTo = '#/site/' + site.id;
  // 从详情页进来的，就退回去，免得“返回”时又回到编辑页
  const cameFromSite = ctx.prevHash === backTo;
  const leave = () => (cameFromSite ? history.back() : location.replace(backTo));

  view.innerHTML = `
    <div class="form-top">
      <button class="icon-btn" id="cancel">取消</button>
      <h1>${esc(shortEn(site))}${existing ? ' · 修改' : ' · 打卡'}</h1>
      <button class="icon-btn" id="save" style="background:var(--accent);color:#06203a;font-weight:600">保存</button>
    </div>
    <form class="glass card" id="form" onsubmit="return false">
      <label class="field"><span>日期</span>
        <input class="input" type="date" id="date" required value="${esc(existing?.date ?? todayISO())}"></label>
      <div class="field"><span>照片 / 视频</span>
        <label class="btn block" for="files">＋ 拍摄或从相册选</label>
        <input type="file" id="files" accept="image/*,video/*" multiple hidden>
        <div class="thumbs" id="media"></div>
        <div class="tiny" id="media-size" style="margin-top:6px"></div>
      </div>
      <label class="field"><span>心得</span>
        <textarea class="input" id="note" placeholder="写几句：看到了什么、想到了什么……">${esc(existing?.note ?? '')}</textarea></label>
      <label class="field"><span>同行者（可不填）</span>
        <input class="input" id="companions" value="${esc(existing?.companions ?? '')}" placeholder="例如：家人、朋友的名字"></label>
    </form>
    ${existing ? '<button class="btn danger block" id="delete">删除这条打卡记录</button>' : ''}`;

  const mediaBox = view.querySelector('#media');
  const drawMedia = () => {
    const items = [
      ...existingMedia.filter((m) => !removed.has(m.id)).map((m) => ({ key: m.id, blob: m.blob, type: m.type, old: true })),
      ...added.map((f, i) => ({ key: 'new-' + i, blob: f, type: mediaType(f.type), old: false, index: i })),
    ];
    mediaBox.innerHTML = items.map((it) => `<div class="thumb" data-key="${it.key}">
      ${it.type === 'video' ? '<span class="play">▶</span>' : ''}
      <button type="button" class="x" data-remove="${it.key}" aria-label="移除">✕</button></div>`).join('');
    for (const it of items) {
      const el = mediaBox.querySelector(`[data-key="${it.key}"]`);
      const url = blobUrl(it.blob);
      el.insertAdjacentHTML('afterbegin', it.type === 'video'
        ? `<video src="${url}#t=0.1" muted playsinline preload="metadata"></video>`
        : `<img src="${url}" alt="">`);
      el.onclick = (e) => { if (!e.target.closest('.x')) showMedia({ url, type: it.type }); };
    }
    const bytes = items.reduce((n, it) => n + it.blob.size, 0);
    view.querySelector('#media-size').textContent = items.length ? `${items.length} 个文件，共 ${formatBytes(bytes)}` : '';
  };
  drawMedia();

  mediaBox.addEventListener('click', (e) => {
    const key = e.target.closest('[data-remove]')?.dataset.remove;
    if (!key) return;
    if (key.startsWith('new-')) added.splice(+key.slice(4), 1);
    else removed.add(key);
    drawMedia();
  });

  view.querySelector('#files').addEventListener('change', (e) => {
    added.push(...e.target.files);
    e.target.value = '';
    drawMedia();
  });

  view.querySelector('#cancel').onclick = leave;

  const saveBtn = view.querySelector('#save');
  saveBtn.onclick = async () => {
    const date = view.querySelector('#date').value;
    if (!date) { toast('请选择日期'); return; }
    const fields = { date, note: view.querySelector('#note').value.trim(), companions: view.querySelector('#companions').value.trim() };
    saveBtn.disabled = true;
    saveBtn.textContent = '保存中…';
    try {
      if (existing) {
        await ctx.store.updateCheckin(existing.id, { patch: fields, addFiles: added, removeMediaIds: [...removed] });
      } else {
        await ctx.store.addCheckin({ siteId: site.id, ...fields, files: added });
      }
      await ctx.refreshCheckins();
      toast(existing ? '已保存修改' : '打卡成功 ✅');
      leave();
    } catch (err) {
      console.error(err);
      toast('保存失败：' + (err?.message || '可能是手机空间不足'), 5000);
      saveBtn.disabled = false;
      saveBtn.textContent = '保存';
    }
  };

  const del = view.querySelector('#delete');
  if (del) {
    del.onclick = async () => {
      const n = existingMedia.length;
      if (!(await confirmDanger('删除这条打卡记录？', `${esc(existing.date)} 的记录${n ? `和 ${n} 个照片 / 视频` : ''}会被删除，无法恢复。`))) return;
      await ctx.store.deleteCheckin(existing.id);
      await ctx.refreshCheckins();
      toast('已删除');
      leave();
    };
  }
}
