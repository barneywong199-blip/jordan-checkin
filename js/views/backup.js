// 页面 6：备份与设置；图片版权说明

import { exportBackup, importBackup, readBackup } from '../backup.js';
import { esc, setBackground, toast, choose, formatBytes } from '../ui.js';
import { creditLine } from './site.js';
import { openMapDB, storedInfo } from '../map/offline-map.js';

const fmtDate = (ms) => (ms ? new Date(ms).toLocaleString('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }) : '从未备份');

export async function renderBackup(view, ctx) {
  setBackground(null, { blurred: true });
  const usage = await ctx.store.mediaUsage();
  const last = await ctx.store.getMeta('lastBackupAt');
  const persisted = (await navigator.storage?.persisted?.().catch(() => null)) ?? null;
  const est = await navigator.storage?.estimate?.().catch(() => null);

  view.innerHTML = `
    <header class="page-head"><h1>备份与设置</h1></header>
    <section class="glass card">
      <div class="card-label">💾 存储</div>
      <dl class="kv">
        <dt>打卡记录</dt><dd id="n-checkins">${ctx.checkins.length} 条</dd>
        <dt>照片视频</dt><dd id="n-media">${usage.count} 个 · ${formatBytes(usage.bytes)}</dd>
        <dt>上次备份</dt><dd id="last-backup">${esc(fmtDate(last))}</dd>
        ${est?.quota ? `<dt>可用空间</dt><dd>约 ${formatBytes(Math.max(0, est.quota - est.usage))}</dd>` : ''}
        <dt>长期保存</dt><dd>${persisted === true ? '已开启' : persisted === false ? '未开启（请从主屏幕图标打开 App）' : '—'}</dd>
      </dl>
      <p class="small muted" style="margin-top:10px">资料只存在这台设备上，不会上传。换手机、删 App 或清除 Safari 资料前，一定要先备份。</p>
    </section>

    <section class="glass card">
      <div class="card-label">⬆️ 导出备份</div>
      <p class="small muted">生成一个 .zip 文件，包含全部打卡记录、照片和视频。iPhone 上会出现分享菜单，选“隔空投送（AirDrop）”传到 Mac；也可以存到“文件”App。</p>
      <button class="btn primary block" id="export">导出备份</button>
    </section>

    <section class="glass card">
      <div class="card-label">⬇️ 导入备份</div>
      <p class="small muted">在 Mac 或新手机上，选之前导出的 .zip 文件恢复资料。导入前会先告诉你备份里有什么，再让你选择怎么处理。</p>
      <label class="btn block" for="import-file">选择备份文件…</label>
      <input type="file" id="import-file" accept=".zip,application/zip" hidden>
    </section>

    <section class="glass card">
      <div class="card-label">ℹ️ 关于</div>
      <p class="small">景点与遗迹 ${ctx.data.sites.length} 个 · 美食与休闲 ${ctx.data.places.length} 家 · 年代 ${ctx.data.eras.length} 个。票价、开放时间会变动，出发前请再核实。</p>
      <p class="small" id="map-info">离线地图：读取中…</p>
      <p class="small muted">地图 © OpenStreetMap contributors（ODbL）· Protomaps · 地形 AWS Terrain Tiles；徒步路线 © OpenStreetMap。</p>
      <p class="small">“导航”“谷歌地图”按钮会打开 Google Maps，没信号时打不开：出发前请在 Google Maps App 里下载约旦离线地图。</p>
      <a class="btn block" href="#/credits">资料来源与图片版权</a>
    </section>`;

  showMapInfo(view.querySelector('#map-info'));

  const exportBtn = view.querySelector('#export');
  exportBtn.onclick = async () => {
    if (!ctx.checkins.length) { toast('还没有打卡记录，不需要备份'); return; }
    exportBtn.disabled = true;
    exportBtn.textContent = '正在打包…';
    try {
      const { blob, filename, counts } = await exportBackup(ctx.store);
      const file = new File([blob], filename, { type: 'application/zip' });
      let ok = false;
      if (navigator.canShare?.({ files: [file] })) {
        // iPhone 要求“分享”必须紧跟在一次点击之后，打包可能要几秒，所以再请用户点一下
        const go = await choose({
          title: '备份已准备好',
          html: `${counts.checkins} 条记录、${counts.media} 个照片视频，共 ${formatBytes(blob.size)}。<br>点“分享”，再选“隔空投送”或“存储到文件”。`,
          buttons: [{ label: '取消', value: false }, { label: '分享', value: true, kind: 'primary' }],
        });
        if (go) try {
          await navigator.share({ files: [file], title: filename });
          ok = true;
        } catch (err) {
          if (err.name !== 'AbortError') throw err;
        }
      } else {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(file);
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
        ok = true;
      }
      if (ok) {
        await ctx.store.setMeta('lastBackupAt', Date.now());
        view.querySelector('#last-backup').textContent = fmtDate(Date.now());
        toast(`已导出：${counts.checkins} 条记录、${counts.media} 个照片视频`);
      }
    } catch (err) {
      console.error(err);
      toast('导出失败：' + err.message, 5000);
    } finally {
      exportBtn.disabled = false;
      exportBtn.textContent = '导出备份';
    }
  };

  view.querySelector('#import-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const { manifest } = await readBackup(file);
      const n = manifest.checkins.length;
      const m = manifest.media.length;
      const local = ctx.checkins.length;
      const info = `备份时间：${esc(fmtDate(Date.parse(manifest.exportedAt)))}<br>备份里有 <b>${n}</b> 条打卡、<b>${m}</b> 个照片视频。`;
      const mode = local === 0
        ? await choose({ title: '导入这份备份？', html: info, buttons: [{ label: '取消', value: null }, { label: '导入', value: 'merge', kind: 'primary' }] })
        : await choose({
          title: '这台设备上已经有资料',
          html: `${info}<br>这台设备上现有 <b>${local}</b> 条打卡。<br><br><b>合并</b>：保留两边的记录（同一条以备份为准）。<br><b>全部替换</b>：先删掉这台设备上的全部打卡，再导入。`,
          buttons: [{ label: '取消', value: null }, { label: '合并', value: 'merge', kind: 'primary' }, { label: '全部替换', value: 'replace', kind: 'danger' }],
        });
      if (!mode) return;
      toast('正在导入…');
      const r = await importBackup(ctx.store, file, mode);
      await ctx.refreshCheckins();
      toast(`导入完成：${r.checkins} 条记录、${r.media} 个照片视频`);
      renderBackup(view, ctx);
    } catch (err) {
      console.error(err);
      toast('导入失败：' + err.message, 5000);
    }
  });
}

async function showMapInfo(el) {
  try {
    const meta = await (await fetch('map/map.json')).json();
    const info = await storedInfo(await openMapDB());
    const ready = info?.complete && info.version === meta.version;
    el.textContent = `离线地图：${formatBytes(meta.size)}，版本 ${meta.version}，${ready ? '已存在这台设备上 ✅' : '尚未下载（打开地图页时会自动下载）'}`;
  } catch {
    el.textContent = '离线地图：无法读取资料';
  }
}

export function renderCredits(view, ctx) {
  setBackground(null, { blurred: true });
  const rows = ctx.data.sites.map((s) => {
    const imgs = ctx.images(s.id);
    return `<section class="glass card">
      <div class="card-label">${esc(s.name.en)} · <span lang="ar" dir="rtl">${esc(s.name.ar)}</span></div>
      ${imgs.length ? imgs.map((im) => `<p class="small">${creditLine(im)}</p>`).join('') : '<p class="small muted">没有图片</p>'}
    </section>`;
  }).join('');
  view.innerHTML = `
    <div class="detail-top"><a class="icon-btn" href="#/backup">‹ 备份</a></div>
    <header class="page-head"><h1>资料来源与图片版权</h1>
      <div class="sub">景点图片来自维基共享资源（Wikimedia Commons），按各自授权使用；文字资料来源列在每个景点详情页底部。</div></header>
    ${rows}`;
}
