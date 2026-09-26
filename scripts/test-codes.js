// Access code tests: issue/verify round trip, tampering, expiry, admin and letter gating.
import assert from "node:assert/strict";
import { issueCode, verifyCode } from "../api/_lib/codes.js";
import letter from "../api/letter.js";
import issue from "../api/issue.js";
import verify from "../api/verify.js";

const S = "test-secret-123";
const sep26 = new Date("2026-09-26T12:00:00Z");

const a = issueCode(S, "S", 1, sep26);
assert.match(a.code, /^CTCFIX-S2610-[A-Z2-9]{4}-[0-9A-F]{8}$/);
assert.equal(a.validUntil, "2026-10-31");
assert.equal(a.plan, "SME");
assert.equal(verifyCode(S, a.code, sep26).valid, true);
assert.equal(verifyCode(S, a.code.toLowerCase(), sep26).valid, true, "case-insensitive");
assert.equal(verifyCode(S, " " + a.code + " ", sep26).valid, true, "trims spaces");
assert.equal(verifyCode("other-secret", a.code, sep26).valid, false, "wrong secret");
assert.equal(verifyCode(S, a.code.replace("S2610", "S2712"), sep26).valid, false, "tampered expiry");
assert.equal(verifyCode(S, a.code.replace("CTCFIX-S", "CTCFIX-C"), sep26).valid, false, "tampered plan");
assert.equal(verifyCode(S, a.code, new Date("2026-10-31T23:00:00Z")).valid, true, "last day valid");
const exp = verifyCode(S, a.code, new Date("2026-11-01T00:30:00Z"));
assert.equal(exp.valid, false); assert.equal(exp.expired, true);
assert.equal(issueCode(S, "C", 12, sep26).validUntil, "2027-09-30");
assert.equal(verifyCode(S, "hello").valid, false);
assert.equal(verifyCode(undefined, a.code).valid, false, "no secret -> nothing unlocks");
assert.throws(() => issueCode(S, "X", 1));
assert.throws(() => issueCode(S, "S", 0));

const call = (h, req) => new Promise((resolve) => {
  const res = { setHeader() {}, status(c) { this.code = c; return this; }, json(o) { resolve({ code: this.code, body: o }); } };
  h({ headers: {}, ...req }, res);
});

process.env.CODE_SECRET = S; process.env.ADMIN_KEY = "admin-key-xyz"; delete process.env.ANTHROPIC_API_KEY;
let r = await call(issue, { method: "POST", body: { adminKey: "wrong", plan: "S", months: 1 } });
assert.equal(r.code, 401);
r = await call(issue, { method: "POST", body: { adminKey: "admin-key-xyz", plan: "C", months: 1, customer: "Test CA" } });
assert.equal(r.code, 200); const live = r.body.code;
r = await call(verify, { method: "POST", body: { code: live } });
assert.equal(r.code, 200); assert.equal(r.body.plan, "CA");
r = await call(verify, { method: "POST", body: { code: "CTCFIX-S2610-AAAA-00000000" } });
assert.equal(r.code, 400);

const letterBody = {
  company: { name: "Kaveri Foods", address: "Bengaluru", signatoryName: "Anita Rao", signatoryTitle: "Director" },
  employee: { name: "Ravi Kumar", designation: "Sales Executive", joiningDate: "12 October 2026", location: "Bengaluru" },
  terms: { letterType: "offer", employmentType: "permanent", probationMonths: 3, noticeDays: 30, extraTerms: "" },
  annualCTC: 600000, stateName: "Karnataka", pfCovered: true, esiCovered: false, gratuityInCTC: true,
};
r = await call(letter, { method: "POST", body: letterBody });
assert.equal(r.code, 402, "no code -> locked"); assert.equal(r.body.locked, true);
r = await call(letter, { method: "POST", body: letterBody, headers: { "x-access-code": live } });
assert.equal(r.code, 200); assert.equal(r.body.source, "template");

console.log("codes: all tests passed");
