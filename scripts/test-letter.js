// Letter API tests: validation, template fallback, Claude path with a mocked API, and the no-numbers guard.
import handler, { validate, templateDraft, draftWithClaude, checkDraft } from "../api/letter.js";
import assert from "node:assert/strict";
import { issueCode } from "../api/_lib/codes.js";

const good = {
  company: { name: "Kaveri Foods Pvt Ltd", address: "12 Mysore Road, Bengaluru 560098", signatoryName: "Anita Rao", signatoryTitle: "Director" },
  employee: { name: "Ravi Kumar", designation: "Sales Executive", joiningDate: "1 October 2026", location: "Bengaluru" },
  terms: { letterType: "offer", employmentType: "fixed-term", endDate: "30 September 2027", probationMonths: 3, noticeDays: 30, extraTerms: "" },
  annualCTC: 480000, stateName: "Karnataka", pfCovered: true, esiCovered: false, gratuityInCTC: true,
};

assert.deepEqual(validate(good), []);
assert.ok(validate({}).length >= 8, "empty body lists every missing field");
assert.ok(validate({ ...good, terms: { ...good.terms, endDate: "" } }).some((e) => e.includes("endDate")));

const t = templateDraft(good);
assert.match(t.clauses[0].text, /fixed-term basis ending on 30 September 2027/);
assert.ok(t.clauses.some((c) => c.heading === "Probation"));
assert.ok(t.clauses.find((c) => c.heading === "Statutory benefits").text.includes("gratuity after one year"));
checkDraft(t); // template itself must pass the guard

assert.throws(() => checkDraft({ ...t, opening: "Your CTC is ₹4,80,000." }), /salary figures/);
assert.throws(() => checkDraft({ ...t, opening: "Your salary is Rs 40000." }), /salary figures/);

// Claude path with a mocked fetch
const mockDraft = { subject: "Offer of employment", salutation: "Dear Ravi,", opening: "Hello", clauses: [{ heading: "Appointment", text: "x" }], closing: "Thanks" };
const mockFetch = async (url, init) => {
  const req = JSON.parse(init.body);
  assert.equal(init.headers["anthropic-version"], "2023-06-01");
  assert.ok(req.system.includes("Never write any rupee amount"));
  assert.ok(!req.messages[0].content.includes("480000"), "CTC is never sent to the model");
  return { ok: true, json: async () => ({ content: [{ type: "text", text: "```json\n" + JSON.stringify(mockDraft) + "\n```" }] }) };
};
assert.equal((await draftWithClaude(good, "test-key", mockFetch)).subject, "Offer of employment");

// Handler: no key -> template
delete process.env.ANTHROPIC_API_KEY;
process.env.CODE_SECRET = "letter-test-secret";
const accessCode = issueCode(process.env.CODE_SECRET, "S", 1).code;
const call = (method, body) => new Promise((resolve) => {
  const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(o) { resolve({ code: this.code, body: o }); } };
  handler({ method, body, headers: { "x-access-code": accessCode } }, res);
});
let r = await call("POST", good);
assert.equal(r.code, 200); assert.equal(r.body.source, "template");
r = await call("POST", { company: {} });
assert.equal(r.code, 400); assert.ok(r.body.details.length);
r = await call("GET");
assert.equal(r.code, 405);

console.log("letter: all tests passed");
