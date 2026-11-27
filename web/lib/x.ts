/* eslint-disable @typescript-eslint/no-explicit-any */
import crypto from "node:crypto";

// Minimal X API client using OAuth 1.0a user context (posts as @PurpleDinosTO).
const API = "https://api.x.com";

function creds() {
  const c = {
    key: process.env.X_API_KEY,
    secret: process.env.X_API_SECRET,
    token: process.env.X_ACCESS_TOKEN,
    tokenSecret: process.env.X_ACCESS_TOKEN_SECRET,
  };
  const missing = Object.entries(c).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) throw new Error(`Missing X credentials: ${missing.join(", ")}`);
  return c as Record<keyof typeof c, string>;
}

const enc = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (ch) => "%" + ch.charCodeAt(0).toString(16).toUpperCase());

function oauthHeader(method: string, url: string, query: Record<string, string> = {}) {
  const c = creds();
  const oauth: Record<string, string> = {
    oauth_consumer_key: c.key,
    oauth_nonce: crypto.randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_token: c.token,
    oauth_version: "1.0",
  };
  const params = { ...query, ...oauth };
  const paramStr = Object.keys(params).sort().map((k) => `${enc(k)}=${enc(params[k])}`).join("&");
  const base = [method.toUpperCase(), enc(url), enc(paramStr)].join("&");
  const signingKey = `${enc(c.secret)}&${enc(c.tokenSecret)}`;
  oauth.oauth_signature = crypto.createHmac("sha1", signingKey).update(base).digest("base64");
  return "OAuth " + Object.keys(oauth).sort().map((k) => `${enc(k)}="${enc(oauth[k])}"`).join(", ");
}

export async function xMe() {
  const url = `${API}/2/users/me`;
  const res = await fetch(url, { headers: { Authorization: oauthHeader("GET", url) } });
  const body: any = await res.json().catch(() => ({}));
  return { status: res.status, accessLevel: res.headers.get("x-access-level"), body };
}

export async function xPost(text: string, mediaIds?: string[]) {
  const url = `${API}/2/tweets`;
  const payload: any = { text };
  if (mediaIds?.length) payload.media = { media_ids: mediaIds };
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: oauthHeader("POST", url), "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`X post failed ${res.status}: ${JSON.stringify(body).slice(0, 300)}`);
  return body?.data as { id: string; text: string };
}
