// Tests for the employee features: slip/offer checks, peer list, sharing, admin review, compare, analyze.
import assert from "node:assert/strict";
await import("../public/engine.js");
await import("../public/checks.js");
const { checkSlip, checkOffer } = globalThis.CTCfixChecks;
const titles = (list) => list.map((x) => `${x.level}:${x.title}`);

// --- Salary slip checks
const good = { state: "KA", gender: "M", month: "September",
  earnings: { basic: 25000, hra: 10000, special: 15000 }, gross: 50000,
  deductions: { pf: 1800, pt: 200 }, net: 48000 };
let r = checkSlip(good);
assert.ok(r.every((x) => x.level !== "bad" && x.level !== "warn"), titles(r).join(" | "));

r = checkSlip({ ...good, earnings: { basic: 8000, hra: 20000, conveyance: 5000, special: 17000 } });
assert.ok(titles(r).some((t) => t.startsWith("bad:Allowances are above")), "flags 50% rule");
assert.ok(titles(r).some((t) => t.includes("Basic is")), "flags low basic");

r = checkSlip({ ...good, deductions: { pt: 200 }, net: 49800 });
assert.ok(titles(r).some((t) => t === "warn:No PF deducted"), "no PF above ceiling is a warn");
r = checkSlip({ state: "MH", gender: "M", earnings: { basic: 9000, hra: 3600, special: 5400 }, gross: 18000, deductions: { pt: 200 }, net: 17800 });
assert.ok(titles(r).includes("bad:No PF deducted"));
assert.ok(titles(r).includes("bad:ESI missing"));
r = checkSlip({ state: "HR", earnings: { basic: 30000, hra: 12000, special: 18000 }, gross: 60000, deductions: { pf: 1800, pt: 200 }, net: 58000 });
assert.ok(titles(r).includes("bad:Professional tax deducted in Haryana"));
r = checkSlip({ ...good, deductions: { pf: 1800, pt: 300 }, net: 47900 });
assert.ok(titles(r).includes("bad:Professional tax is too high"), "KA PT 300 outside Feb");
r = checkSlip({ ...good, month: "February 2027", deductions: { pf: 1800, pt: 300 }, net: 47900 });
assert.ok(titles(r).includes("ok:Professional tax is correct"), "KA PT 300 in Feb is right");
r = checkSlip({ ...good, gross: 52000 });
assert.ok(titles(r).includes("warn:Earnings don't add up to gross"));
r = checkSlip({ ...good, net: 40000 });
assert.ok(titles(r).includes("warn:Net pay doesn't match"));
r = checkSlip({ ...good, deductions: { pf: 1000, pt: 200 }, net: 48800 });
assert.ok(titles(r).includes("warn:PF looks lower than it should be"));

// --- Offer checks
r = checkOffer({ annualCTC: 1800000, fixed: 1400000, variable: 400000, basic: 700000, hra: 350000, employerPF: 21600, gratuity: 33660, state: "KA", noticeDays: 90,
  clauses: [{ type: "clawback", text: "Repay joining bonus if you leave within 12 months" }] });
const t = titles(r);
assert.ok(t.some((x) => x.startsWith("info:Estimated take-home")));
assert.ok(t.some((x) => x.startsWith("warn:Variable pay is")));
assert.ok(t.includes("info:Gratuity is counted in your CTC"));
assert.ok(t.includes("ok:Structure meets the 50% wage rule"));
assert.ok(t.includes("warn:Joining bonus clawback"));
assert.equal(checkOffer({}).length, 1);

// --- Peer list, sharing, admin review and compare, with an in-memory Redis
const mem = new Map(); const hash = new Map();
globalThis.__redisFetch = async (url, init) => {
  const [cmd, ...a] = JSON.parse(init.body); let result = null;
  if (cmd === "HSET") { hash.set(a[1], a[2]); result = 1; }
  else if (cmd === "HGET") result = hash.get(a[1]) ?? null;
  else if (cmd === "HDEL") result = hash.delete(a[1]) ? 1 : 0;
  else if (cmd === "HGETALL") result = [...hash.entries()].flat();
  else if (cmd === "INCR") { mem.set(a[0], (mem.get(a[0]) || 0) + 1); result = mem.get(a[0]); }
  else if (cmd === "EXPIRE") result = 1;
  return { json: async () => ({ result }) };
};
process.env.KV_REST_API_URL = "https://mock"; process.env.KV_REST_API_TOKEN = "t";
process.env.CODE_SECRET = "s"; process.env.ADMIN_KEY = "adm";
const { default: peers } = await import("../api/peers.js");
const { default: adminPeers } = await import("../api/admin-peers.js");
const { default: compareApi } = await import("../api/compare.js");
const { default: analyze } = await import("../api/analyze.js");
const { issueCode } = await import("../api/_lib/codes.js");
const call = (h, req) => new Promise((resolve) => {
  const res = { setHeader() {}, status(c) { this.code = c; return this; }, json(o) { resolve({ code: this.code, body: o }); } };
  h({ headers: { "x-forwarded-for": "1.2.3.4" }, ...req }, res);
});

let x = await call(peers, { method: "GET" });
assert.equal(x.code, 200); assert.equal(x.body.rows.length, 48); assert.equal(x.body.sharing, true);
assert.ok(x.body.rows.every((r) => r.ctcLakh >= 8 && r.source.url));
const fm = x.body.rows.find((r) => r.industry === "FMCG" && r.city === "Bengaluru" && r.level === "Middle");
assert.equal(fm.ctcLakh, 13.63);

x = await call(peers, { method: "POST", body: { industry: "FMCG", function: "Sales", years: 8, city: "Bengaluru", ctcLakh: 5, consent: true } });
assert.equal(x.code, 400, "below 8L rejected");
x = await call(peers, { method: "POST", body: { industry: "FMCG", function: "Sales", years: 8, city: "Bengaluru", ctcLakh: 16, consent: false } });
assert.equal(x.code, 400, "no consent rejected");
for (const c of [14, 16, 18]) {
  x = await call(peers, { method: "POST", body: { industry: "FMCG", function: "Sales <b>", years: 8, city: "Bengaluru", ctcLakh: c, basicPct: 50, consent: true, name: "Ravi", company: "Acme" } });
  assert.equal(x.code, 200);
}
const stored = [...hash.values()].map((v) => JSON.parse(v));
assert.ok(stored.every((s) => !("name" in s) && !("company" in s) && !s.function.includes("<")), "anonymised and sanitised");
x = await call(peers, { method: "GET" });
assert.equal(x.body.rows.length, 48, "pending rows hidden");

x = await call(adminPeers, { method: "POST", body: { adminKey: "nope", action: "list" } });
assert.equal(x.code, 401);
x = await call(adminPeers, { method: "POST", body: { adminKey: "adm", action: "list" } });
assert.equal(x.body.pending.length, 3);
for (const p of x.body.pending) assert.equal((await call(adminPeers, { method: "POST", body: { adminKey: "adm", action: "approve", id: p.id } })).code, 200);
x = await call(adminPeers, { method: "POST", body: { adminKey: "adm", action: "add", row: { industry: "BFSI", function: "Finance", years: 10, city: "Mumbai", ctcLakh: 24, sourceName: "Satyajit's comp survey" } } });
assert.equal(x.code, 200);
x = await call(peers, { method: "GET" });
assert.equal(x.body.rows.length, 52);

x = await call(compareApi, { method: "POST", body: { industry: "FMCG", years: 8, city: "Bengaluru", ctcLakh: 12, function: "Sales" } });
assert.equal(x.code, 402, "compare needs a code");
const code = issueCode("s", "I", 1).code;
x = await call(compareApi, { method: "POST", headers: { "x-access-code": code }, body: { industry: "FMCG", years: 8, city: "Bengaluru", ctcLakh: 12, function: "Sales" } });
assert.equal(x.code, 200);
assert.equal(x.body.cityRow.ctcLakh, 13.63);
assert.equal(x.body.people.count, 3); assert.equal(x.body.people.median, 16);
assert.ok(x.body.ask.includes("13.63"));
x = await call(compareApi, { method: "POST", headers: { "x-access-code": code }, body: { industry: "BFSI", years: 20, city: "Pune", ctcLakh: 40, function: "Finance" } });
assert.equal(x.body.cityRow.ctcLakh, 31.49); assert.ok(!x.body.ask); assert.ok(x.body.notes.some((n) => n.includes("sales and business development")));

// --- Analyze (Claude mocked)
delete process.env.ANTHROPIC_API_KEY;
x = await call(analyze, { method: "POST", body: { kind: "slip", mediaType: "image/png", data: "aGk=" } });
assert.equal(x.code, 503);
process.env.ANTHROPIC_API_KEY = "k";
globalThis.__claudeFetch = async (url, init) => {
  const req = JSON.parse(init.body);
  assert.equal(req.messages[0].content[0].type, "document");
  return { ok: true, json: async () => ({ content: [{ type: "text", text: 'Here: {"annualCTC": 1800000, "fixed": 1500000}' }] }) };
};
x = await call(analyze, { method: "POST", body: { kind: "offer", mediaType: "application/pdf", data: "aGk=" } });
assert.equal(x.code, 200); assert.equal(x.body.fields.annualCTC, 1800000);
x = await call(analyze, { method: "POST", body: { kind: "offer", mediaType: "text/html", data: "aGk=" } });
assert.equal(x.code, 400);

// Individual codes can't draft business letters
const { default: letter } = await import("../api/letter.js");
x = await call(letter, { method: "POST", headers: { "x-access-code": code }, body: {} });
assert.equal(x.code, 402);

console.log("individual: all tests passed");
