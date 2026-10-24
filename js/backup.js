// 导出 / 导入备份：一个 zip，内含 backup.json（打卡记录）和 media/ 下的照片视频。

import { createZip, readZip } from './zip.js';

export const BACKUP_FORMAT = 'jordan-checkin-backup';

const EXT = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/heic': 'heic', 'image/heif': 'heif', 'image/webp': 'webp', 'image/gif': 'gif',
  'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm',
};
const extFor = (m) => EXT[m.mime] ?? (m.name.includes('.') ? m.name.split('.').pop().toLowerCase() : 'bin');

export function backupFilename(now = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `约旦打卡备份-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.zip`;
}

export async function exportBackup(store, now = new Date()) {
  const checkins = await store.listCheckins();
  const media = await store.allMedia();
  const mediaMeta = media.map(({ blob, ...m }) => ({ ...m, file: `media/${m.id}.${extFor(m)}` }));
  const manifest = {
    format: BACKUP_FORMAT,
    version: 1,
    exportedAt: now.toISOString(),
    firstCheckinAt: await store.getMeta('firstCheckinAt'),
    checkins,
    media: mediaMeta,
  };
  const entries = [
    { name: 'backup.json', blob: new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' }) },
    ...media.map((m, i) => ({ name: mediaMeta[i].file, blob: m.blob })),
  ];
  const blob = await createZip(entries, now);
  return { blob, filename: backupFilename(now), counts: { checkins: checkins.length, media: media.length } };
}

// 先读出备份内容，不写入；给界面用来显示“备份里有多少条”。
export async function readBackup(file) {
  const entries = await readZip(file);
  const byName = new Map(entries.map((e) => [e.name, e]));
  const json = byName.get('backup.json');
  if (!json) throw new Error('这不是约旦打卡的备份文件');
  const manifest = JSON.parse(await json.blob.text());
  if (manifest.format !== BACKUP_FORMAT) throw new Error('这不是约旦打卡的备份文件');
  for (const m of manifest.media) {
    if (!byName.has(m.file)) throw new Error('备份文件不完整，缺少：' + m.file);
  }
  return { manifest, byName };
}

// mode: 'merge'（按 id 合并，备份里的同一条记录覆盖本机的）| 'replace'（先清空本机）
export async function importBackup(store, file, mode = 'merge') {
  const { manifest, byName } = await readBackup(file);
  if (mode === 'replace') await store.clearAll();
  const media = [];
  for (const { file: path, ...m } of manifest.media) {
    const entry = byName.get(path);
    // 带上正确类型的切片；写进 IndexedDB 时浏览器会复制内容，不用先整个读进内存
    const blob = entry.blob.slice(0, entry.blob.size, m.mime);
    media.push({ ...m, blob });
  }
  if (mode === 'merge') {
    // 同一条打卡在本机被删掉的照片，导入后以备份为准：先删本机旧的媒体
    for (const c of manifest.checkins) {
      const local = await store.getCheckin(c.id);
      if (local) await store.deleteCheckin(c.id);
    }
  }
  await store.putRaw({ checkins: manifest.checkins, media });
  const localFirst = await store.getMeta('firstCheckinAt');
  const candidates = [localFirst, manifest.firstCheckinAt].filter(Boolean);
  if (candidates.length) await store.setMeta('firstCheckinAt', Math.min(...candidates));
  return { checkins: manifest.checkins.length, media: media.length };
}
