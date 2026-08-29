// Retriva service worker
//
// Its only job is to display OS-level notifications on the service worker's
// registration (required for these to work on Android Chrome, and gives
// consistent "tag" based grouping everywhere else too) and to route a click
// on one of those notifications back into an already-open Retriva tab.
//
// There is no Push API / server push here — notifications are shown by the
// page itself (see services/notificationService.ts) while Retriva is open
// in a tab, background tab, or minimized window. This file does not talk to
// Firestore or any Retriva API, so it can't break existing backend calls.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('notificationclick', (event) => {
  const notification = event.notification;
  const targetData = notification.data || {};
  notification.close();

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ('focus' in client) {
            client.postMessage({ type: 'NOTIFICATION_CLICK', payload: targetData });
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow('/');
        }
      })
  );
});
