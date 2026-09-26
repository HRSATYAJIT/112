// GET  -> {rows, sharing}      read-only peer list (cited report rows + approved submissions)
// POST {industry, function, years, city, ctcLakh, basicPct?, fixedPct?, consent} -> queued for review
import { randomBytes } from "node:crypto";
import { allRows, saveRow, cleanSubmission } from "./_lib/peers.js";
import { storeConfigured, allow } from "./_lib/store.js";

export default async function handler(req, res) {
  if (req.method === "GET") {
    const rows = await allRows();
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    return res.status(200).json({ rows, sharing: storeConfigured() });
  }
  if (req.method !== "POST") { res.setHeader("Allow", "GET, POST"); return res.status(405).json({ error: "Use GET or POST" }); }
  if (!storeConfigured()) return res.status(503).json({ error: "Sharing opens soon. Thanks for offering." });
  if (!(await allow(req, "share", 5))) return res.status(429).json({ error: "Thanks, we already have your submission for today." });
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  const { errors, row } = cleanSubmission(body || {});
  if (errors.length) return res.status(400).json({ error: errors.join(" ") });
  const saved = await saveRow({ ...row, id: "u-" + randomBytes(6).toString("hex"), status: "pending", submittedAt: new Date().toISOString() });
  return res.status(200).json({ ok: true, id: saved.id, message: "Thank you. Your anonymised offer will appear once we've reviewed it." });
}
