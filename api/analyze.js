// POST {kind: "slip"|"offer", mediaType, data (base64)} -> {fields}
// Claude reads the document and returns the numbers as JSON. The file is not stored anywhere.
// The lapse checks run in the browser (public/checks.js) so people can correct any number and recheck.
import { allow } from "./_lib/store.js";

const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5";
const TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_B64 = 4_000_000; // ~3 MB file; Vercel caps request bodies at 4.5 MB

const SLIP = `Read this Indian salary slip (payslip). Return ONLY a JSON object, monthly amounts in rupees as plain numbers (no commas), null when not shown:
{"month": string|null, "city": string|null, "earnings": {"basic": n, "da": n, "hra": n, "special": n, "conveyance": n, "lta": n, "medical": n, "overtime": n, "commission": n, "other": [{"name": string, "amount": n}]},
 "gross": n, "deductions": {"pf": n, "vpf": n, "esi": n, "pt": n, "lwf": n, "tds": n, "other": [{"name": string, "amount": n}]}, "net": n, "employerPF": n}
Rules: use the current month's column, not year-to-date. "Special allowance", "flexible allowance" and similar go in special. "Professional tax"/"P.Tax" is pt. "Provident fund"/"EPF"/"PF" is pf; voluntary PF is vpf. Income tax/TDS is tds. Do not include names, PAN, UAN, bank or account numbers anywhere.`;

const OFFER = `Read this Indian job offer or appointment letter, including any salary annexure. Return ONLY a JSON object, ANNUAL amounts in rupees as plain numbers, null when not shown:
{"designation": string|null, "city": string|null, "industryGuess": "FMCG"|"E-commerce"|"BFSI"|"Other"|null, "annualCTC": n, "fixed": n, "variable": n, "joiningBonus": n, "esopValue": n,
 "basic": n, "hra": n, "special": n, "otherExcluded": n, "employerPF": n, "gratuity": n, "insurance": n, "noticeDays": n, "probationMonths": n,
 "clauses": [{"type": "clawback"|"bond"|"noncompete"|"variableConditions", "text": string}]}
Rules: if the letter gives monthly figures, multiply by 12. otherExcluded = conveyance + LTA + other reimbursements. "Performance bonus"/"variable pay" is variable. Only list clauses that are actually present, quoting at most 25 words each. Do not include the candidate's or company's name, or any ID numbers.`;

export default async function handler(req, res) {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ error: "Use POST" }); }
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  const { kind, mediaType, data } = body || {};
  if (!["slip", "offer"].includes(kind)) return res.status(400).json({ error: "kind must be slip or offer" });
  if (!TYPES.includes(mediaType)) return res.status(400).json({ error: "Upload a photo (JPG, PNG) or a PDF." });
  if (typeof data !== "string" || !data.length) return res.status(400).json({ error: "The file is empty." });
  if (data.length > MAX_B64) return res.status(413).json({ error: "The file is too large. Use a file under 3 MB, or a screenshot of the salary section." });

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(503).json({ error: "Reading documents isn't available right now. Type the numbers in the boxes instead." });
  if (!(await allow(req, "analyze", 20))) return res.status(429).json({ error: "You've checked a lot of documents today. Please try again tomorrow." });

  const doc = mediaType === "application/pdf"
    ? { type: "document", source: { type: "base64", media_type: mediaType, data } }
    : { type: "image", source: { type: "base64", media_type: mediaType, data } };
  try {
    const r = await (globalThis.__claudeFetch || fetch)("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: MODEL, max_tokens: 1500, messages: [{ role: "user", content: [doc, { type: "text", text: kind === "slip" ? SLIP : OFFER }] }] }),
    });
    if (!r.ok) throw new Error(`Claude API ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const out = await r.json();
    const text = (out.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
    const fields = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
    return res.status(200).json({ fields });
  } catch (e) {
    console.error("analyze failed:", e.message);
    return res.status(502).json({ error: "We couldn't read that document. Try a clearer photo, or type the numbers in the boxes." });
  }
}
