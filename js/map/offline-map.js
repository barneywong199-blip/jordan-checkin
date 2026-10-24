// 离线地图文件（jordan.pmtiles，约 100 MB）的下载与读取。
// 文件切成 4 MB 一块存进 IndexedDB；地图要哪一段就读哪几块，不会整份载入内存（iPhone 上更稳）。
// 也不需要服务器支持“断点续传”（HTTP Range），Mac 上的简易服务器也能用。

const DB_NAME = 'jordan-map';
export const CHUNK = 4 * 1024 * 1024;

const req = (r) => new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
const done = (tx) => new Promise((resolve, reject) => {
  tx.oncomplete = () => resolve();
  tx.onerror = () => reject(tx.error);
  tx.onabort = () => reject(tx.error ?? new Error('存储空间不足，无法保存离线地图'));
});

export async function openMapDB(idb = globalThis.indexedDB) {
  const open = idb.open(DB_NAME, 1);
  open.onupgradeneeded = () => {
    open.result.createObjectStore('chunks');
    open.result.createObjectStore('meta');
  };
  return req(open);
}

export async function storedInfo(db) {
  return (await req(db.transaction('meta').objectStore('meta').get('file'))) ?? null;
}

// 已存好、且版本相同，就不用重新下载
export async function isReady(db, version) {
  const info = await storedInfo(db);
  return Boolean(info?.complete && info.version === version);
}

// 下载并分块保存。onProgress(已下载字节, 总字节)
export async function downloadMap(db, url, version, { fetchFn = fetch, onProgress = () => {} } = {}) {
  const res = await fetchFn(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('离线地图下载失败（' + res.status + '）');
  const total = Number(res.headers.get('content-length')) || 0;
  {
    const tx = db.transaction(['chunks', 'meta'], 'readwrite');
    tx.objectStore('chunks').clear();
    tx.objectStore('meta').put({ version, complete: false }, 'file');
    await done(tx);
  }
  const reader = res.body.getReader();
  let parts = [];
  let partBytes = 0;
  let index = 0;
  let loaded = 0;
  const flush = async () => {
    if (!partBytes) return;
    const blob = new Blob(parts);
    parts = [];
    partBytes = 0;
    const tx = db.transaction('chunks', 'readwrite');
    tx.objectStore('chunks').put(blob, index++);
    await done(tx);
  };
  for (;;) {
    const { value, done: end } = await reader.read();
    if (end) break;
    let bytes = value;
    // 刚好按 4 MB 切块，读取时才能直接算出在哪一块
    while (bytes.length) {
      const room = CHUNK - partBytes;
      const piece = bytes.length > room ? bytes.subarray(0, room) : bytes;
      parts.push(piece.slice());
      partBytes += piece.length;
      bytes = bytes.length > room ? bytes.subarray(room) : new Uint8Array(0);
      if (partBytes === CHUNK) await flush();
    }
    loaded += value.length;
    onProgress(loaded, total);
  }
  await flush();
  if (total && loaded !== total) throw new Error('离线地图下载不完整，请重试');
  const tx = db.transaction('meta', 'readwrite');
  tx.objectStore('meta').put({ version, complete: true, size: loaded, chunks: index }, 'file');
  await done(tx);
  return { size: loaded, chunks: index };
}

// 给 pmtiles 用的读取来源：按需读几块拼出要的那一段
export class ChunkedSource {
  constructor(db, key = 'jordan.pmtiles') {
    this.db = db;
    this.key = key;
    this.cache = new Map(); // 最近读过的块，避免重复读
  }

  getKey() { return this.key; }

  async chunk(i) {
    if (this.cache.has(i)) return this.cache.get(i);
    const blob = await req(this.db.transaction('chunks').objectStore('chunks').get(i));
    if (!blob) throw new Error('离线地图资料缺失，请到“备份”页重新下载地图');
    this.cache.set(i, blob);
    if (this.cache.size > 8) this.cache.delete(this.cache.keys().next().value);
    return blob;
  }

  async getBytes(offset, length) {
    const out = new Uint8Array(length);
    let pos = 0;
    while (pos < length) {
      const abs = offset + pos;
      const i = Math.floor(abs / CHUNK);
      const start = abs - i * CHUNK;
      const blob = await this.chunk(i);
      const end = Math.min(blob.size, start + (length - pos));
      if (end <= start) break; // 读到文件结尾
      const buf = new Uint8Array(await blob.slice(start, end).arrayBuffer());
      out.set(buf, pos);
      pos += buf.length;
    }
    return { data: pos === length ? out.buffer : out.slice(0, pos).buffer };
  }
}

export async function clearMap(db) {
  const tx = db.transaction(['chunks', 'meta'], 'readwrite');
  tx.objectStore('chunks').clear();
  tx.objectStore('meta').clear();
  await done(tx);
}
