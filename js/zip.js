// 最小的 zip 读写（store 模式，不压缩）。照片和视频本身已压缩，再压缩没有意义。
// 按 Blob 分块计算 CRC32，不会把大视频整个读进内存。单个备份上限 4 GB（zip32 限制）。

const CHUNK = 4 * 1024 * 1024;
const LIMIT = 0xffffffff;

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export async function crc32(blob) {
  let crc = 0xffffffff;
  for (let pos = 0; pos < blob.size; pos += CHUNK) {
    const bytes = new Uint8Array(await blob.slice(pos, pos + CHUNK).arrayBuffer());
    for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
  const day = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

// entries: [{ name, blob }]，name 用 UTF-8。
export async function createZip(entries, now = new Date()) {
  const enc = new TextEncoder();
  const { time, day } = dosDateTime(now);
  const parts = [];
  const central = [];
  let offset = 0;

  for (const { name, blob } of entries) {
    const nameBytes = enc.encode(name);
    const crc = await crc32(blob);
    const size = blob.size;
    if (offset + 30 + nameBytes.length + size > LIMIT) throw new Error('备份超过 4 GB，暂时无法导出');

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true); // 文件名是 UTF-8
    local.setUint16(8, 0, true); // store
    local.setUint16(10, time, true);
    local.setUint16(12, day, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, size, true);
    local.setUint32(22, size, true);
    local.setUint16(26, nameBytes.length, true);
    local.setUint16(28, 0, true);
    parts.push(local.buffer, nameBytes, blob);

    const cen = new DataView(new ArrayBuffer(46));
    cen.setUint32(0, 0x02014b50, true);
    cen.setUint16(4, 20, true);
    cen.setUint16(6, 20, true);
    cen.setUint16(8, 0x0800, true);
    cen.setUint16(10, 0, true);
    cen.setUint16(12, time, true);
    cen.setUint16(14, day, true);
    cen.setUint32(16, crc, true);
    cen.setUint32(20, size, true);
    cen.setUint32(24, size, true);
    cen.setUint16(28, nameBytes.length, true);
    cen.setUint32(42, offset, true);
    central.push(cen.buffer, nameBytes);

    offset += 30 + nameBytes.length + size;
  }

  const centralSize = central.reduce((n, p) => n + p.byteLength, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, end.buffer], { type: 'application/zip' });
}

// 返回 [{ name, size, blob }]；blob 是原文件的切片，不复制数据。
export async function readZip(file) {
  const tailSize = Math.min(file.size, 22 + 0xffff);
  const tail = new DataView(await file.slice(file.size - tailSize).arrayBuffer());
  let eocd = -1;
  for (let i = tail.byteLength - 22; i >= 0; i--) {
    if (tail.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('不是有效的备份文件（zip）');
  const count = tail.getUint16(eocd + 10, true);
  const cenSize = tail.getUint32(eocd + 12, true);
  const cenOffset = tail.getUint32(eocd + 16, true);
  const cen = new DataView(await file.slice(cenOffset, cenOffset + cenSize).arrayBuffer());
  const dec = new TextDecoder();
  const entries = [];
  let p = 0;
  for (let i = 0; i < count; i++) {
    if (cen.getUint32(p, true) !== 0x02014b50) throw new Error('备份文件已损坏');
    const method = cen.getUint16(p + 10, true);
    const size = cen.getUint32(p + 20, true);
    const nameLen = cen.getUint16(p + 28, true);
    const extraLen = cen.getUint16(p + 30, true);
    const commentLen = cen.getUint16(p + 32, true);
    const localOffset = cen.getUint32(p + 42, true);
    const name = dec.decode(new Uint8Array(cen.buffer, cen.byteOffset + p + 46, nameLen));
    if (method !== 0) throw new Error('备份文件格式不支持（有压缩）：' + name);
    const lh = new DataView(await file.slice(localOffset, localOffset + 30).arrayBuffer());
    const dataStart = localOffset + 30 + lh.getUint16(26, true) + lh.getUint16(28, true);
    entries.push({ name, size, blob: file.slice(dataStart, dataStart + size) });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}
