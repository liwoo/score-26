/** Register the service worker (idempotent; no-op when unsupported). */
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* registration failures shouldn't break the app */
    })
  })
}

const ASKED_KEY = 'score26:notif-asked'

export function notificationsSupported() {
  return typeof Notification !== 'undefined'
}

export function notificationPermission(): NotificationPermission | 'unsupported' {
  return notificationsSupported() ? Notification.permission : 'unsupported'
}

/**
 * Ask for notification permission, at most once automatically. Must be called
 * from a user gesture (browsers ignore/penalise otherwise). Pass force=true to
 * re-ask from an explicit toggle. Returns the resulting permission.
 */
export async function requestNotifications(
  force = false,
): Promise<NotificationPermission | 'unsupported'> {
  if (!notificationsSupported()) return 'unsupported'
  if (Notification.permission !== 'default') return Notification.permission
  if (!force && localStorage.getItem(ASKED_KEY)) return Notification.permission

  localStorage.setItem(ASKED_KEY, '1')
  try {
    return await Notification.requestPermission()
  } catch {
    return Notification.permission
  }
}
