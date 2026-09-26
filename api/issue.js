// Admin only. POST {adminKey, plan: "S"|"C", months, customer} -> {code, plan, validUntil}
// ADMIN_KEY and CODE_SECRET are set in Vercel environment variables.
import { issueCode, safeEqual } from "./_lib/codes.js";

export default function handler(req, res) {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ error: "Use POST" }); }
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  if (!process.env.ADMIN_KEY || !process.env.CODE_SECRET) {
    return res.status(503).json({ error: "Set ADMIN_KEY and CODE_SECRET in Vercel, then redeploy." });
  }
  if (!safeEqual(body?.adminKey, process.env.ADMIN_KEY)) return res.status(401).json({ error: "Wrong admin key." });
  try {
    const out = issueCode(process.env.CODE_SECRET, body.plan, Number(body.months));
    console.log("issued", out.plan, out.validUntil, String(body.customer || "").slice(0, 80));
    return res.status(200).json(out);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
}
