// 打卡记录存储（IndexedDB）。资料只存在这台设备上。
// checkins: { id, siteId, date, note, companions, mediaIds, createdAt, updatedAt }
// media:    { id, checkinId, type: 'image'|'video', mime, name, size, blob }
// meta:     { key, value }

const DB_NAME = 'jordan-checkin';
const DB_VERSION = 1;

const req = (r) => new Promise((resolve, reject) => {
  r.onsuccess = () => resolve(r.result);
  r.onerror = () => reject(r.error);
});
const done = (tx) => new Promise((resolve, reject) => {
  tx.oncomplete = () => resolve();
  tx.onerror = () => reject(tx.error);
  tx.onabort = () => reject(tx.error ?? new Error('写入被中止（可能是存储空间不足）'));
});

export function newId(prefix) {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now().toString(36)}-${rand}`;
}

export function mediaType(mime) {
  return String(mime).startsWith('video/') ? 'video' : 'image';
}

export async function openStore(idb = globalThis.indexedDB, name = DB_NAME) {
  const open = idb.open(name, DB_VERSION);
  open.onupgradeneeded = () => {
    const db = open.result;
    const c = db.createObjectStore('checkins', { keyPath: 'id' });
    c.createIndex('siteId', 'siteId');
    const m = db.createObjectStore('media', { keyPath: 'id' });
    m.createIndex('checkinId', 'checkinId');
    db.createObjectStore('meta', { keyPath: 'key' });
  };
  const db = await req(open);
  return new Store(db);
}

class Store {
  constructor(db) { this.db = db; }

  close() { this.db.close(); }

  async listCheckins() {
    return req(this.db.transaction('checkins').objectStore('checkins').getAll());
  }

  async listBySite(siteId) {
    const list = await req(this.db.transaction('checkins').objectStore('checkins').index('siteId').getAll(siteId));
    return list.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  }

  async getCheckin(id) {
    return req(this.db.transaction('checkins').objectStore('checkins').get(id));
  }

  async getMedia(id) {
    return req(this.db.transaction('media').objectStore('media').get(id));
  }

  async mediaFor(checkin) {
    const list = await Promise.all(checkin.mediaIds.map((id) => this.getMedia(id)));
    return list.filter(Boolean);
  }

  // files: File / Blob 数组（含 name、type）
  async addCheckin({ siteId, date, note = '', companions = '', files = [] }, now = Date.now()) {
    const id = newId('c');
    const media = files.map((f) => toMedia(f, id));
    const checkin = { id, siteId, date, note, companions, mediaIds: media.map((m) => m.id), createdAt: now, updatedAt: now };
    const tx = this.db.transaction(['checkins', 'media', 'meta'], 'readwrite');
    tx.objectStore('checkins').put(checkin);
    for (const m of media) tx.objectStore('media').put(m);
    const meta = tx.objectStore('meta');
    const first = await req(meta.get('firstCheckinAt'));
    if (!first) meta.put({ key: 'firstCheckinAt', value: now });
    await done(tx);
    return checkin;
  }

  // patch: { date, note, companions }；addFiles 新增文件；removeMediaIds 要删掉的媒体
  async updateCheckin(id, { patch = {}, addFiles = [], removeMediaIds = [] } = {}, now = Date.now()) {
    const tx = this.db.transaction(['checkins', 'media'], 'readwrite');
    const store = tx.objectStore('checkins');
    const old = await req(store.get(id));
    if (!old) throw new Error('找不到这条打卡记录');
    const added = addFiles.map((f) => toMedia(f, id));
    const remove = new Set(removeMediaIds);
    const updated = {
      ...old,
      ...pick(patch, ['date', 'note', 'companions']),
      mediaIds: [...old.mediaIds.filter((m) => !remove.has(m)), ...added.map((m) => m.id)],
      updatedAt: now,
    };
    store.put(updated);
    for (const m of added) tx.objectStore('media').put(m);
    for (const mid of remove) tx.objectStore('media').delete(mid);
    await done(tx);
    return updated;
  }

  async deleteCheckin(id) {
    const tx = this.db.transaction(['checkins', 'media'], 'readwrite');
    const old = await req(tx.objectStore('checkins').get(id));
    if (old) {
      for (const mid of old.mediaIds) tx.objectStore('media').delete(mid);
      tx.objectStore('checkins').delete(id);
    }
    await done(tx);
  }

  async getMeta(key) {
    const row = await req(this.db.transaction('meta').objectStore('meta').get(key));
    return row?.value ?? null;
  }

  async setMeta(key, value) {
    const tx = this.db.transaction('meta', 'readwrite');
    tx.objectStore('meta').put({ key, value });
    await done(tx);
  }

  async mediaUsage() {
    const all = await req(this.db.transaction('media').objectStore('media').getAll());
    return { count: all.length, bytes: all.reduce((n, m) => n + (m.size ?? m.blob?.size ?? 0), 0) };
  }

  async allMedia() {
    return req(this.db.transaction('media').objectStore('media').getAll());
  }

  // 导入用：整批写入原样的记录（保留 id 和时间）。
  async putRaw({ checkins = [], media = [] }) {
    const tx = this.db.transaction(['checkins', 'media'], 'readwrite');
    for (const c of checkins) tx.objectStore('checkins').put(c);
    for (const m of media) tx.objectStore('media').put(m);
    await done(tx);
  }

  async clearAll() {
    const tx = this.db.transaction(['checkins', 'media', 'meta'], 'readwrite');
    for (const s of ['checkins', 'media', 'meta']) tx.objectStore(s).clear();
    await done(tx);
  }
}

function toMedia(file, checkinId) {
  const mime = file.type || 'application/octet-stream';
  return { id: newId('m'), checkinId, type: mediaType(mime), mime, name: file.name ?? '', size: file.size, blob: file };
}

function pick(obj, keys) {
  return Object.fromEntries(keys.filter((k) => obj[k] !== undefined).map((k) => [k, obj[k]]));
}
