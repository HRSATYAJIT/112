// Offer / appointment letter drafting.
// Claude writes the prose only. Every rupee figure comes from the calculation engine and is
// rendered by the frontend as Annexure A, so the model never states salary numbers.

import "../public/letter-template.js";

const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5";
const API_URL = "https://api.anthropic.com/v1/messages";

const REQUIRED = {
  company: ["name", "address", "signatoryName", "signatoryTitle"],
  employee: ["name", "designation", "joiningDate", "location"],
};

export function validate(body) {
  const errors = [];
  if (!body || typeof body !== "object") return ["Send the letter details as JSON."];
  for (const [group, keys] of Object.entries(REQUIRED)) {
    for (const k of keys) {
      const v = body[group]?.[k];
      if (typeof v !== "string" || !v.trim()) errors.push(`${group}.${k} is required`);
      else if (v.length > 300) errors.push(`${group}.${k} is too long`);
    }
  }
  const t = body.terms || {};
  if (!["offer", "appointment"].includes(t.letterType)) errors.push("terms.letterType must be offer or appointment");
  if (!["permanent", "fixed-term"].includes(t.employmentType)) errors.push("terms.employmentType must be permanent or fixed-term");
  if (t.employmentType === "fixed-term" && !t.endDate) errors.push("terms.endDate is required for fixed-term employment");
  for (const k of ["probationMonths", "noticeDays"]) {
    if (!Number.isInteger(t[k]) || t[k] < 0 || t[k] > 365) errors.push(`terms.${k} must be a whole number between 0 and 365`);
  }
  if (!Number.isFinite(body.annualCTC) || body.annualCTC <= 0) errors.push("annualCTC is required");
  if (!body.stateName) errors.push("stateName is required");
  return errors;
}

const SYSTEM = `You draft employment letters for small Indian employers.
Write clear, formal Indian business English. Plain and specific, no flowery language.
Output ONLY a JSON object with this shape:
{"subject": string, "salutation": string, "opening": string, "clauses": [{"heading": string, "text": string}], "closing": string}
Rules:
- Never write any rupee amount, percentage of salary, or number relating to pay. Refer to "the compensation set out in Annexure A" instead.
- Use only the facts supplied. Do not invent benefits, bonuses, leave counts, working hours, policies, or statutory claims that are not in the facts.
- You may state that PF, ESI and gratuity apply "as per applicable law" only when the facts say they apply.
- Fixed-term employees: state the end date and that they receive benefits on par with permanent employees in the same role, including gratuity after one year, as the Code on Social Security, 2020 provides.
- Clauses to include, in this order: Appointment, Date of joining and place of work, Compensation, Probation (omit if probation is 0), Statutory benefits, Notice period, Confidentiality, Code of conduct, and one clause per item in extraTerms if any.
- An offer letter asks the candidate to confirm acceptance by signing a copy. An appointment letter confirms employment.
- Keep each clause under 90 words.`;

export async function draftWithClaude(body, apiKey, fetchImpl = fetch) {
  const res = await fetchImpl(API_URL, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2000,
      system: SYSTEM,
      messages: [{ role: "user", content: `Facts:\n${JSON.stringify(facts(body), null, 2)}` }],
    }),
  });
  if (!res.ok) throw new Error(`Claude API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
  const json = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
  return checkDraft(json);
}

// Reject drafts that break the no-numbers rule or the shape.
export function checkDraft(d) {
  if (!d || typeof d.subject !== "string" || !Array.isArray(d.clauses) || !d.clauses.length) throw new Error("Draft has the wrong shape");
  const all = [d.subject, d.opening, d.closing, ...d.clauses.map((c) => `${c.heading} ${c.text}`)].join(" ");
  if (/₹|\bRs\.?\s?\d|\bINR\b|\blakh|\bcrore/i.test(all)) throw new Error("Draft contains salary figures");
  return {
    subject: String(d.subject), salutation: String(d.salutation || "Dear Candidate,"),
    opening: String(d.opening || ""), closing: String(d.closing || ""),
    clauses: d.clauses.map((c) => ({ heading: String(c.heading), text: String(c.text) })),
  };
}

// Deterministic template lives in public/letter-template.js so the browser preview and the API
// fallback produce the same letter.
export const templateDraft = (body) => globalThis.PayKitLetter.templateDraft(body);
const facts = (body) => globalThis.PayKitLetter.facts(body);

export default async function handler(req, res) {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ error: "Use POST" }); }
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = null; } }
  const errors = validate(body);
  if (errors.length) return res.status(400).json({ error: "Some details are missing or invalid", details: errors });

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(200).json({ source: "template", draft: templateDraft(body) });
  try {
    return res.status(200).json({ source: "claude", draft: await draftWithClaude(body, key) });
  } catch (e) {
    console.error("letter draft failed:", e.message);
    return res.status(200).json({ source: "template", note: "AI drafting was unavailable, so the standard template was used.", draft: templateDraft(body) });
  }
}
