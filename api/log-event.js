// Forwards user events to the Google Sheets webhook
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const webhookUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
  if (!webhookUrl) {
    // Silently no-op if not configured yet
    return res.status(200).json({ ok: true, logged: false, reason: "not_configured" });
  }

  try {
    const fetchRes = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body || {}),
      redirect: "follow",
    });
    const text = await fetchRes.text();
    return res.status(200).json({ ok: true, logged: true, response: text });
  } catch (e) {
    console.error("Log event error:", e);
    return res.status(200).json({ ok: false, error: e.message });
  }
}
