// POST {code} -> {valid, plan, validUntil} or {valid:false, reason}
import { verifyCode } from "./_lib/codes.js";

export default function handler(req, res) {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ error: "Use POST" }); }
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  const result = verifyCode(process.env.CODE_SECRET, body?.code);
  return res.status(result.valid ? 200 : 400).json(result);
}
