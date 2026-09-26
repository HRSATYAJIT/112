// POST {industry, years, city, ctcLakh, function?} with header x-access-code -> comparison
// Paid feature: any valid plan (Individual, SME, CA) unlocks it.
import { verifyCode } from "./_lib/codes.js";
import { allRows, INDUSTRIES } from "./_lib/peers.js";

const median = (a) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const quant = (a, q) => { const s = [...a].sort((x, y) => x - y); const i = (s.length - 1) * q; const lo = Math.floor(i); return s[lo] + (s[Math.ceil(i)] - s[lo]) * (i - lo); };
const r2 = (x) => Math.round(x * 100) / 100;

export function compare(rows, input) {
  const { industry, city } = input;
  const years = Number(input.years), you = Number(input.ctcLakh);
  const level = years >= 15 ? "Senior" : years >= 6 ? "Middle" : "Junior";
  const fn = String(input.function || "").toLowerCase();
  const report = rows.filter((r) => r.kind === "report" && r.industry === industry && r.level === level);
  const people = rows.filter((r) => r.kind !== "report" && r.industry === industry && r.level === level);
  const out = { industry, level, city, you, report: null, cityRow: null, people: null, notes: [] };

  if (level === "Junior") out.notes.push("Report data covers 6+ years of experience. With under 6 years, compare against shared offers only.");
  if (report.length) {
    const vals = report.map((r) => r.ctcLakh);
    const cityRow = report.find((r) => r.city === city) || null;
    out.report = {
      source: report[0].source, function: report[0].function,
      min: Math.min(...vals), max: Math.max(...vals), median: r2(median(vals)),
      cities: report.map((r) => ({ city: r.city, ctcLakh: r.ctcLakh })).sort((a, b) => a.ctcLakh - b.ctcLakh),
      aboveCities: vals.filter((v) => you > v).length, totalCities: vals.length,
    };
    if (cityRow) out.cityRow = { city: cityRow.city, ctcLakh: cityRow.ctcLakh, diffPct: r2(((you - cityRow.ctcLakh) / cityRow.ctcLakh) * 100) };
    if (fn && !/sales|business dev|\bbd\b/.test(fn)) out.notes.push(`The report figures are for sales and business development roles. Treat them as a reference point for ${input.function}.`);
  }
  const sameFn = fn ? people.filter((p) => String(p.function).toLowerCase().includes(fn.split(/\s+/)[0])) : [];
  const pool = sameFn.length >= 3 ? sameFn : people;
  if (pool.length >= 3) {
    const v = pool.map((p) => p.ctcLakh);
    out.people = { count: pool.length, sameFunction: pool === sameFn, p25: r2(quant(v, 0.25)), median: r2(median(v)), p75: r2(quant(v, 0.75)),
      basicMedian: (() => { const b = pool.map((p) => p.basicPct).filter(Boolean); return b.length >= 3 ? median(b) : null; })() };
  } else {
    out.notes.push(pool.length ? `${pool.length} shared offer${pool.length === 1 ? "" : "s"} so far for ${industry} at this level. We show shared-offer figures once there are 3.` : `No shared offers yet for ${industry} at this level. Report figures are shown above.`);
  }
  const target = out.cityRow ? out.cityRow.ctcLakh : out.report ? out.report.median : out.people ? out.people.median : null;
  if (target && you < target * 0.95) out.ask = `Peers in similar ${industry} roles earn about ₹${target} lakh. Could you revise the offer closer to ₹${target} lakh?`;
  return out;
}

export default async function handler(req, res) {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ error: "Use POST" }); }
  const access = verifyCode(process.env.CODE_SECRET, req.headers?.["x-access-code"]);
  if (!access.valid) return res.status(402).json({ error: access.reason, locked: true });
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  const b = body || {};
  if (!INDUSTRIES.includes(b.industry)) return res.status(400).json({ error: "Choose FMCG, E-commerce or BFSI." });
  if (!(Number(b.ctcLakh) > 0)) return res.status(400).json({ error: "Enter your CTC in lakh." });
  if (!(Number(b.years) >= 0)) return res.status(400).json({ error: "Enter your years of experience." });
  return res.status(200).json(compare(await allRows(), b));
}
