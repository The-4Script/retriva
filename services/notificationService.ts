// notificationService.ts
//
// Thin wrapper around the browser's Notification API + a Service Worker so
// Retriva can pop OS-level notifications (outside the tab) instead of the
// in-app Toast/NotificationCenter alone.
//
// Design goals for this module specifically:
//  - Never touches Firestore, the Express API, or any other backend
//    connection — it is purely a presentation layer on top of data the
//    caller already has, so it cannot break existing backend calls.
//  - New-message notifications are grouped per chat via a stable `tag`
//    (WhatsApp-style): repeated messages from the same chat update a single
//    OS notification instead of stacking new ones.
//  - Fails silently/gracefully wherever the browser doesn't support a
//    feature (no Notification API, no Service Worker, permission denied).

export type NotificationClickPayload =
  | { type: 'message'; chatId: string }
  | { type: 'match' };

let swRegistration: ServiceWorkerRegistration | null = null;
const clickListeners = new Set<(payload: NotificationClickPayload) => void>();

const emitClick = (payload: any) => {
  clickListeners.forEach((cb) => {
    try {
      cb(payload);
    } catch (e) {
      console.warn('Retriva: notification click listener failed', e);
    }
  });
};

export const isNotificationSupported = (): boolean =>
  typeof window !== 'undefined' && 'Notification' in window;

export const getPermission = (): NotificationPermission | 'unsupported' => {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission;
};

/**
 * Registers the service worker used to display OS-level notifications and
 * wires up click routing. Safe to call multiple times (e.g. on every app
 * mount); safe to fail silently — showNotification() falls back to the
 * plain Notification constructor if no registration is available.
 */
export const initNotificationService = async (): Promise<void> => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  try {
    swRegistration = await navigator.serviceWorker.register('/sw.js');
  } catch (e) {
    console.warn('Retriva: service worker registration failed; notifications will use a page-level fallback', e);
  }

  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'NOTIFICATION_CLICK') {
      emitClick(event.data.payload || {});
    }
  });
};

/** Subscribe to notification clicks (from either the SW path or the fallback path). Returns an unsubscribe fn. */
export const onNotificationClick = (
  callback: (payload: NotificationClickPayload) => void
): (() => void) => {
  clickListeners.add(callback);
  return () => clickListeners.delete(callback);
};

/**
 * Must be called from inside a real user gesture (a click handler) — most
 * browsers ignore or silently deny permission prompts fired without one.
 */
export const requestNotificationPermission = async (): Promise<NotificationPermission | 'unsupported'> => {
  if (!isNotificationSupported()) return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch {
    // Safari's older callback-style API
    return new Promise((resolve) => {
      // @ts-ignore - legacy signature
      Notification.requestPermission(resolve);
    });
  }
};

interface ShowOptions {
  tag: string;
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: NotificationClickPayload;
  renotify?: boolean;
  silent?: boolean;
}

const showViaBestAvailableChannel = async (opts: ShowOptions) => {
  if (getPermission() !== 'granted') return;

  const { tag, title, body, icon = '/logo-icon.png', badge = '/favicon.png', data, renotify = true, silent } = opts;

  try {
    const reg =
      swRegistration ||
      (('serviceWorker' in navigator) ? await navigator.serviceWorker.ready.catch(() => null) : null);

    if (reg && 'showNotification' in reg) {
      await reg.showNotification(title, { body, icon, badge, tag, renotify, data, silent });
      return;
    }
  } catch (e) {
    console.warn('Retriva: showNotification via service worker failed, falling back', e);
  }

  // Fallback for contexts without an active Service Worker registration.
  // (renotify/badge aren't supported on the plain constructor — that's fine,
  // grouping still works via `tag`.)
  try {
    const notif = new Notification(title, { body, icon, tag, data, silent });
    notif.onclick = () => {
      window.focus();
      emitClick(data || {});
      notif.close();
    };
  } catch (e) {
    console.warn('Retriva: unable to display notification', e);
  }
};

const truncate = (s: string, max = 90) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

// Tracks the highest unread count we've already surfaced a notification for,
// per chat — so duplicate/replayed Firestore snapshots for the same message
// don't re-trigger an alert. Reset via clearChatNotificationState() whenever
// the user actually opens that chat.
const lastNotifiedCountByChat = new Map<string, number>();

/**
 * Shows (or updates, WhatsApp-style) a single grouped notification for a
 * chat. Multiple messages from the same chat coalesce into one OS
 * notification via a stable tag instead of piling up.
 */
export const notifyNewMessage = (opts: {
  chatId: string;
  chatTitle: string;
  senderName: string;
  messageText: string;
  unreadCount: number;
}): void => {
  const { chatId, chatTitle, senderName, messageText, unreadCount } = opts;

  const already = lastNotifiedCountByChat.get(chatId) || 0;
  if (unreadCount <= already) return; // Nothing new to surface.
  lastNotifiedCountByChat.set(chatId, unreadCount);

  const preview = truncate(messageText || 'Sent a new message');
  const body = unreadCount > 1 ? `${unreadCount} new messages · ${senderName}: ${preview}` : `${senderName}: ${preview}`;

  showViaBestAvailableChannel({
    tag: `retriva-chat-${chatId}`,
    title: chatTitle,
    body,
    renotify: true,
    data: { type: 'message', chatId },
  });
};

/** Call when the user opens a chat so its grouped notification (if any) is dismissed and its counter resets. */
export const clearChatNotificationState = (chatId: string): void => {
  lastNotifiedCountByChat.delete(chatId);

  const reg = swRegistration;
  if (reg && 'getNotifications' in reg) {
    reg
      .getNotifications({ tag: `retriva-chat-${chatId}` })
      .then((list) => list.forEach((n) => n.close()))
      .catch(() => {});
  }
};

/** One-shot alert for a newly-found potential match. `matchKey` should be unique per match so different matches don't overwrite each other. */
export const notifyMatch = (opts: { matchKey: string; title: string; body: string }): void => {
  showViaBestAvailableChannel({
    tag: `retriva-match-${opts.matchKey}`,
    title: opts.title,
    body: opts.body,
    renotify: false,
    data: { type: 'match' },
  });
};
