const CACHE_NAME = 'papier-app-v1';

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
    // Minimaler Fetch-Handler, damit die PWA-Installationskriterien erfüllt sind
    event.respondWith(fetch(event.request).catch(() => new Response('Offline')));
});
