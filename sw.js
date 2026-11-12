// 앱 파일(index.html, app.js 등)을 수정하면 버전을 올려야 폰에 새 버전이 반영됨
const VERSION = "v2";
const SHELL = `shell-${VERSION}`;
const AUDIO = "audio-v1";
const SHELL_FILES = [
  "./", "index.html", "app.css", "app.js", "manifest.webmanifest",
  "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k.startsWith("shell-") && k !== SHELL).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // 스크립트 데이터: 네트워크 우선 (새 스크립트 바로 반영), 오프라인이면 캐시
  if (url.pathname.endsWith("/scripts.json")) {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(SHELL).then(c => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req))
    );
    return;
  }

  // 녹음 파일: 항상 네트워크 (Range 요청 때문에 캐시하지 않음)
  if (url.pathname.includes("/audio/")) return;

  // 앱 셸: 캐시 우선
  e.respondWith(caches.match(req).then(hit => hit || fetch(req)));
});
