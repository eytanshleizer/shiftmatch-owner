// Fire-and-forget event logger. Never blocks UI on failure.
export async function logEvent(type, event, data) {
  try {
    await fetch("/api/log-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, event, data }),
      keepalive: true,
    });
  } catch (e) {
    console.debug("Log event failed:", e?.message);
  }
}
