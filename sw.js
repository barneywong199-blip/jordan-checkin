// 离线功能：第一次打开时把整个 App（含景点资料和图片）存进手机，之后不联网也能用。
// VERSION 由 tools/build.mjs 按文件内容自动更新；内容一变，手机下次联网打开时就会更新。
const VERSION = '6160642b3671';
const CACHE = 'jordan-checkin-' + VERSION;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const res = await fetch('precache.json', { cache: 'no-store' });
    const files = await res.json();
    const cache = await caches.open(CACHE);
    // 分批下载，避免一次发出上百个请求
    for (let i = 0; i < files.length; i += 12) {
      await cache.addAll(files.slice(i, i + 12).map((f) => new Request(f, { cache: 'reload' })));
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith('jordan-checkin-') && key !== CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const url = new URL(req.url);
    url.hash = '';
    const hit = await cache.match(req.mode === 'navigate' ? './' : url.href, { ignoreSearch: true });
    if (hit) return hit;
    try {
      return await fetch(req);
    } catch (err) {
      if (req.mode === 'navigate') return (await cache.match('./')) ?? Response.error();
      throw err;
    }
  })());
});
