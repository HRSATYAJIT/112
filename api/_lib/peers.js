// Peer salary data: cited report rows + approved anonymised user submissions + rows the admin adds.
import { redis, storeConfigured } from "./store.js";

const RANDSTAD = {
  name: "Randstad India, Annual Salary Trends Report 2024-25, p.50 (Sales & business development)",
  url: "https://info.randstad.in/hubfs/Thought%20leadership%20reports/Annual%20salary%20trends%20report%202024-%2025.pdf",
  year: "2024-25",
};
const CITIES = ["Ahmedabad", "Bengaluru", "Chennai", "Hyderabad", "Kolkata", "Mumbai", "Delhi-NCR", "Pune"];
// Average annual CTC in INR lakh, [Middle 6-14 yrs, Senior 15+ yrs] per city, as printed.
const TABLE = {
  BFSI: [[16.61, 31.89], [22.84, 43.73], [14.62, 28.37], [16.43, 30.42], [14.47, 30.11], [17.96, 37.99], [15.22, 27.86], [17.36, 31.49]],
  FMCG: [[17.66, 33.90], [13.63, 25.75], [14.27, 27.32], [12.56, 22.93], [12.29, 23.03], [14.76, 31.22], [14.52, 26.21], [13.99, 25.38]],
  "E-commerce": [[18.19, 34.93], [15.49, 29.26], [11.98, 22.93], [15.81, 29.27], [15.24, 28.56], [18.80, 39.75], [18.07, 32.63], [14.47, 25.89]],
};
export const INDUSTRIES = ["FMCG", "E-commerce", "BFSI"];
export const LEVELS = { Middle: "6–14 years", Senior: "15+ years" };

export const SEED = Object.entries(TABLE).flatMap(([industry, rows]) =>
  rows.flatMap(([mid, sen], i) => [
    { id: `r-${industry}-${CITIES[i]}-M`, industry, function: "Sales & business development", level: "Middle", city: CITIES[i], ctcLakh: mid, kind: "report", source: RANDSTAD },
    { id: `r-${industry}-${CITIES[i]}-S`, industry, function: "Sales & business development", level: "Senior", city: CITIES[i], ctcLakh: sen, kind: "report", source: RANDSTAD },
  ]));

const KEY = "peers"; // hash: id -> JSON

export async function allRows({ includePending = false } = {}) {
  let extra = [];
  if (storeConfigured()) {
    try {
      const flat = (await redis("HGETALL", KEY)) || [];
      for (let i = 1; i < flat.length; i += 2) {
        try { extra.push(JSON.parse(flat[i])); } catch {}
      }
    } catch (e) { console.error("peers read failed:", e.message); }
  }
  if (!includePending) extra = extra.filter((r) => r.status === "approved");
  return [...SEED, ...extra];
}

export async function saveRow(row) {
  await redis("HSET", KEY, row.id, JSON.stringify(row));
  return row;
}

export async function getRow(id) {
  const v = await redis("HGET", KEY, id);
  return v ? JSON.parse(v) : null;
}

export async function deleteRow(id) {
  return redis("HDEL", KEY, id);
}

// Validate and anonymise a submission. Only these fields are ever kept.
export function cleanSubmission(b) {
  const errors = [];
  const industry = INDUSTRIES.includes(b.industry) ? b.industry : null;
  if (!industry) errors.push("Choose FMCG, E-commerce or BFSI.");
  const years = Number(b.years);
  if (!Number.isFinite(years) || years < 0 || years > 45) errors.push("Enter your years of experience.");
  const ctcLakh = Math.round(Number(b.ctcLakh) * 100) / 100;
  if (!Number.isFinite(ctcLakh) || ctcLakh < 8 || ctcLakh > 500) errors.push("CTC must be ₹8 lakh or more.");
  const city = CITIES.includes(b.city) ? b.city : "Other";
  const fn = String(b.function || "").replace(/[<>]/g, "").trim().slice(0, 60);
  if (!fn) errors.push("Enter your function, e.g. Sales, Finance, Marketing.");
  const basicPct = Number(b.basicPct);
  const fixedPct = Number(b.fixedPct);
  if (!b.consent) errors.push("Tick the box to agree to share.");
  return {
    errors,
    row: {
      industry, function: fn, city, ctcLakh,
      level: years >= 15 ? "Senior" : years >= 6 ? "Middle" : "Junior",
      years: Math.round(years),
      basicPct: Number.isFinite(basicPct) && basicPct > 0 && basicPct <= 100 ? Math.round(basicPct) : null,
      fixedPct: Number.isFinite(fixedPct) && fixedPct > 0 && fixedPct <= 100 ? Math.round(fixedPct) : null,
      kind: "user", source: { name: "Shared anonymously by a CTCfix user", year: String(new Date().getFullYear()) },
    },
  };
}

export { CITIES };
