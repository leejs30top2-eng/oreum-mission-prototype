/* 오프라인 캐시: 전시장 와이파이가 불안정해도 앱이 열리도록. 파일을 바꾸면 VERSION을 올린다. */
const VERSION = 'oreum-proto-v2';
const FILES = [
  './', 'index.html', 'css/app.css?v=2', 'js/app.js?v=2', 'manifest.webmanifest',
  'fonts/Pretendard-Regular.woff2', 'fonts/Pretendard-Medium.woff2', 'fonts/Pretendard-SemiBold.woff2',
  'fonts/NanumSquareRoundEB.woff2', 'fonts/Syncopate-Bold.ttf',
  'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png',
  'assets/activity/chev-l.svg',
  'assets/activity/chev-r.svg',
  'assets/activity/chev-sm.svg',
  'assets/activity/hedgehog.png',
  'assets/activity/legend-today.svg',
  'assets/activity/photo.svg',
  'assets/activity/tab-activity.svg',
  'assets/activity/tab-home.svg',
  'assets/activity/today.svg',
  'assets/camera/battery.svg',
  'assets/camera/cell.svg',
  'assets/camera/corner-l.svg',
  'assets/camera/corner-r.svg',
  'assets/camera/flip-bg.svg',
  'assets/camera/flip.svg',
  'assets/camera/mascot.png',
  'assets/camera/sample.jpg',
  'assets/camera/shutter.svg',
  'assets/camera/wifi.svg',
  'assets/camera/x.svg',
  'assets/done/line.svg',
  'assets/done/mascot.png',
  'assets/done/x.svg',
  'assets/home/battery.svg',
  'assets/home/bed.svg',
  'assets/home/bg.jpg',
  'assets/home/cell.svg',
  'assets/home/char.png',
  'assets/home/check1.svg',
  'assets/home/check2.svg',
  'assets/home/dot-empty32.svg',
  'assets/home/dot-empty33.svg',
  'assets/home/hanger.svg',
  'assets/home/mission-circle.svg',
  'assets/home/peek.png',
  'assets/home/shadow.svg',
  'assets/home/symbol-round.svg',
  'assets/home/symbol.svg',
  'assets/home/tab-activity.svg',
  'assets/home/tab-chapter.svg',
  'assets/home/tab-home.svg',
  'assets/home/tab-my.svg',
  'assets/home/tab-reward.svg',
  'assets/home/today-dot.png',
  'assets/home/wifi.svg',
  'assets/loading/eye.svg',
  'assets/loading/mascot.png',
  'assets/loading/ring.svg',
  'assets/sheet/arrow.svg',
  'assets/sheet/tab-activity.svg',
  'assets/sheet/tab-home.svg',
  'assets/streak/mascot-crop.png'
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const isPage = e.request.mode === 'navigate';
  if (isPage) {   // 페이지는 네트워크 우선 → 실패하면 캐시
    e.respondWith(fetch(e.request).then((r) => { caches.open(VERSION).then((c) => c.put('./', r.clone())); return r; })
      .catch(() => caches.match('./')));
    return;
  }
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request)));
});
