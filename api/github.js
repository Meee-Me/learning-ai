// "Connect GitHub" without pasting a token (GitHub's device sign-in).
// GitHub's sign-in endpoints can't be called from a web page, so the page goes through here.
// Nothing is stored: the access token is handed straight back to the browser.
// The client id is the public id of a GitHub OAuth app with "Enable Device Flow" ticked.
// It comes from GITHUB_CLIENT_ID, or from the page (the owner pastes it into Max once). It is not a secret.
const BUILT_IN = process.env.GITHUB_CLIENT_ID || "";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "GET") return res.status(200).json({ enabled: !!BUILT_IN });
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST." });
  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const given = String(body.client_id || "").trim();
  const CLIENT_ID = BUILT_IN || (/^[A-Za-z0-9.]{16,40}$/.test(given) ? given : "");
  if (!CLIENT_ID) return res.status(400).json({ error: "That doesn't look like a GitHub Client ID. It starts with Ov23 and has letters and numbers only." });
  const call = async (url, params) => {
    const r = await fetch(url, { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify(params) });
    return r.json().catch(() => ({}));
  };
  try {
    if (body.action === "start") {
      const d = await call("https://github.com/login/device/code", { client_id: CLIENT_ID, scope: "repo" });
      if (!d.user_code) return res.status(502).json({ error: d.error === "device_flow_disabled" ? "Tick Enable Device Flow in the GitHub app's settings, save, and try again." : d.error === "Not Found" || /client/i.test(d.error_description || d.error || "") ? "GitHub doesn't know that Client ID. Copy it again from the app's page." : d.error_description || "GitHub didn't start the sign-in. Check the Client ID and that Enable Device Flow is ticked." });
      return res.status(200).json({ user_code: d.user_code, verification_uri: d.verification_uri, device_code: d.device_code, interval: d.interval || 5, expires_in: d.expires_in || 900 });
    }
    if (body.action === "poll") {
      const d = await call("https://github.com/login/oauth/access_token", { client_id: CLIENT_ID, device_code: String(body.device_code || ""), grant_type: "urn:ietf:params:oauth:grant-type:device_code" });
      return res.status(200).json({ access_token: d.access_token || "", error: d.error || "", interval: d.interval || 0 });
    }
  } catch {
    return res.status(502).json({ error: "Couldn't reach GitHub." });
  }
  return res.status(400).json({ error: "Unknown action." });
}
