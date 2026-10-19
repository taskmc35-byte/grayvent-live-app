// Service worker: rende l'app e i manuali consultabili anche senza rete.
const CACHE = 'grayvent-v1';
const MANUALI = ['manuale-giocatore', 'creazione-personaggio', 'manuale-misteri', 'incantesimi-miracoli', 'manuale-ambientazione']
  .map((m) => `manuali/${m}.pdf`);

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', 'index.html', 'pdf.worker.min.mjs', ...MANUALI])).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  // dati del database: sempre dalla rete
  if (url.hostname.endsWith('supabase.co')) return;
  // manuali e file statici: prima la cache, poi la rete
  if (url.pathname.includes('/manuali/') || url.pathname.endsWith('.mjs') || url.pathname.includes('/assets/') || url.hostname.includes('fonts.g')) {
    e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return res;
    })));
    return;
  }
  // pagina: prima la rete, se offline la copia salvata
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put('index.html', copy)); return res; })
      .catch(() => caches.match('index.html')));
  }
});
