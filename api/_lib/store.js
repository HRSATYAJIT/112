// Tiny Upstash Redis REST client (no npm dependency). Vercel's Upstash integration sets
// KV_REST_API_URL / KV_REST_API_TOKEN (or UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN).
// Everything that needs storage degrades gracefully when it isn't configured.

export function storeConfigured() {
  return !!((process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL) &&
            (process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN));
}

export async function redis(...command) {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error("storage-not-configured");
  const res = await (globalThis.__redisFetch || fetch)(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(command.map(String)),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.result;
}

// Per-IP daily limit. Returns true when the call is allowed. Without storage, always allows.
export async function allow(req, bucket, perDay) {
  if (!storeConfigured()) return true;
  const ip = String(req.headers?.["x-forwarded-for"] || "unknown").split(",")[0].trim();
  const key = `rl:${bucket}:${ip}:${new Date().toISOString().slice(0, 10)}`;
  try {
    const count = await redis("INCR", key);
    if (count === 1) await redis("EXPIRE", key, 90000);
    return count <= perDay;
  } catch { return true; }
}
