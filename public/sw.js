// public/sw.js
// ============================================
// VOXA SERVICE WORKER — DEBUG BUILD
// ============================================

console.log("[sw.js] loaded");

self.addEventListener("install", () => {
  console.log("[sw.js] install");
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  console.log("[sw.js] activate");
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  console.log("[sw.js] ========== PUSH RECEIVED ==========");
  console.log("[sw.js] event.data exists:", !!event.data);

  let payload = {};
  try {
    if (event.data) {
      const text = event.data.text();
      console.log("[sw.js] raw text:", text);
      try {
        payload = JSON.parse(text);
      } catch (e) {
        console.error("[sw.js] JSON parse error:", e);
        payload = { body: text };
      }
    }
  } catch (e) {
    console.error("[sw.js] data read error:", e);
  }

  console.log("[sw.js] parsed payload:", payload);

  const title = payload.title || "VOXA";
  const body = payload.body || "New notification";

  const options = {
    body,
    icon: "/icon.png",
    badge: "/icon.png",
    requireInteraction: true,
    data: {
      callId: payload.callId || null,
      url: payload.url || "/app",
    },
  };

  console.log("[sw.js] showing notification with options:", options);

  event.waitUntil(
    self.registration
      .showNotification(title, options)
      .then(() => {
        console.log("[sw.js] ====== NOTIFICATION SHOWN ======");
      })
      .catch((err) => {
        console.error("[sw.js] showNotification FAILED:", err);
      }),
  );
});

self.addEventListener("notificationclick", (event) => {
  console.log("[sw.js] notificationclick", event.action);
  event.notification.close();

  const callId = event.notification.data?.callId;
  const url = callId
    ? `/app/call/${callId}`
    : event.notification.data?.url || "/app";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if (client.url.includes(self.location.origin)) {
            client.focus();
            client.navigate(url);
            return;
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(url);
        }
      }),
  );
});