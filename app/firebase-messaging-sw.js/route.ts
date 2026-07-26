const worker = String.raw`
const FALLBACK = "/dashboard";
const SAFE_PATH = /^\/(?:dashboard|teacher(?:\/|$)|course(?:\?|$)|t\/[a-z0-9-]+(?:\/|$))/i;

function safeUrl(value) {
  if (typeof value !== "string" || value.length > 500 || !SAFE_PATH.test(value)) return FALLBACK;
  try {
    const parsed = new URL(value, self.location.origin);
    return parsed.origin === self.location.origin ? parsed.pathname + parsed.search + parsed.hash : FALLBACK;
  } catch {
    return FALLBACK;
  }
}

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload = {};
  try { payload = event.data.json(); } catch { payload = { data: { body: event.data.text() } }; }
  const data = payload.data || {};
  const notification = payload.notification || {};
  const title = notification.title || data.title || "Skoola";
  const body = notification.body || data.body || "لديك إشعار جديد";
  const url = safeUrl(data.url || data.link || FALLBACK);
  event.waitUntil(self.registration.showNotification(title, {
    body,
    icon: "/skoola-logo.png",
    badge: "/favicon.svg",
    dir: "rtl",
    lang: "ar",
    tag: data.notificationId || data.tag || undefined,
    renotify: Boolean(data.notificationId || data.tag),
    data: { url },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const route = safeUrl(event.notification && event.notification.data && event.notification.data.url);
  event.waitUntil((async () => {
    const windows = await clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if ("focus" in client) {
        await client.focus();
        if ("navigate" in client) await client.navigate(route);
        return;
      }
    }
    if (clients.openWindow) await clients.openWindow(route);
  })());
});
`;

export function GET() {
  return new Response(worker, {
    headers: {
      "content-type": "application/javascript; charset=utf-8",
      "cache-control": "no-store, max-age=0",
      "service-worker-allowed": "/",
      "x-content-type-options": "nosniff",
    },
  });
}
