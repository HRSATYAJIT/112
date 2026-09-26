// Admin: review shared offers and add verified rows.
// POST {adminKey, action: "list"} -> {pending, approved}
// POST {adminKey, action: "approve"|"reject", id}
// POST {adminKey, action: "add", row: {industry, function, years, city, ctcLakh, sourceName}}
import { randomBytes } from "node:crypto";
import { safeEqual } from "./_lib/codes.js";
import { storeConfigured } from "./_lib/store.js";
import { allRows, getRow, saveRow, deleteRow, cleanSubmission } from "./_lib/peers.js";

export default async function handler(req, res) {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ error: "Use POST" }); }
  let b = req.body;
  if (typeof b === "string") { try { b = JSON.parse(b); } catch { b = {}; } }
  b = b || {};
  if (!process.env.ADMIN_KEY || !safeEqual(b.adminKey, process.env.ADMIN_KEY)) return res.status(401).json({ error: "Wrong admin key." });
  if (!storeConfigured()) return res.status(503).json({ error: "Storage isn't connected. In Vercel: Storage → Upstash for Redis → Connect to project 112, then redeploy." });

  if (b.action === "list") {
    const rows = (await allRows({ includePending: true })).filter((r) => r.kind !== "report");
    return res.status(200).json({ pending: rows.filter((r) => r.status === "pending"), approved: rows.filter((r) => r.status === "approved") });
  }
  if (b.action === "approve" || b.action === "reject") {
    const row = await getRow(String(b.id || ""));
    if (!row) return res.status(404).json({ error: "Not found." });
    if (b.action === "reject") { await deleteRow(row.id); return res.status(200).json({ ok: true }); }
    await saveRow({ ...row, status: "approved", approvedAt: new Date().toISOString() });
    return res.status(200).json({ ok: true });
  }
  if (b.action === "add") {
    const { errors, row } = cleanSubmission({ ...(b.row || {}), consent: true });
    if (errors.length) return res.status(400).json({ error: errors.join(" ") });
    const source = String(b.row?.sourceName || "").replace(/[<>]/g, "").trim().slice(0, 140) || "CTCfix research";
    await saveRow({ ...row, id: "a-" + randomBytes(6).toString("hex"), kind: "ctcfix", source: { name: source, year: String(new Date().getFullYear()) }, status: "approved", approvedAt: new Date().toISOString() });
    return res.status(200).json({ ok: true });
  }
  return res.status(400).json({ error: "Unknown action." });
}
