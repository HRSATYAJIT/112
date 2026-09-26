// Signed access codes. No database: a code carries its plan and expiry, and an HMAC signature
// made with CODE_SECRET proves we issued it. Format: CTCFIX-<P><YYMM>-<RAND4>-<SIG8>
//   P = S (SME plan) or C (CA plan); YYMM = last month the code is valid.
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const PLANS = { S: "SME", C: "CA" };
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I to avoid misreads over WhatsApp

function sign(secret, body) {
  return createHmac("sha256", secret).update(body).digest("hex").slice(0, 8).toUpperCase();
}

function rand4() {
  return Array.from(randomBytes(4), (b) => ALPHABET[b % ALPHABET.length]).join("");
}

// months: 1 = valid to the end of the current month + 1 full month (so a code issued on the 26th
// still gets a full month). Returns the code and its last valid day.
export function issueCode(secret, plan, months, now = new Date()) {
  if (!secret) throw new Error("CODE_SECRET is not set");
  if (!PLANS[plan]) throw new Error("plan must be S or C");
  if (!Number.isInteger(months) || months < 1 || months > 24) throw new Error("months must be 1 to 24");
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + months, 1));
  const yymm = String(end.getUTCFullYear()).slice(2) + String(end.getUTCMonth() + 1).padStart(2, "0");
  const body = `${plan}${yymm}-${rand4()}`;
  return { code: `CTCFIX-${body}-${sign(secret, body)}`, ...describe(plan, yymm) };
}

function describe(plan, yymm) {
  const y = 2000 + Number(yymm.slice(0, 2)), m = Number(yymm.slice(2));
  const last = new Date(Date.UTC(y, m, 0)); // day 0 of next month = last day of this month
  return { plan: PLANS[plan], validUntil: last.toISOString().slice(0, 10) };
}

export function verifyCode(secret, input, now = new Date()) {
  if (!secret) return { valid: false, reason: "Access codes are not set up on the server yet." };
  const code = String(input || "").trim().toUpperCase().replace(/\s+/g, "");
  const m = /^CTCFIX-([SC])(\d{4})-([A-Z0-9]{4})-([0-9A-F]{8})$/.exec(code);
  if (!m) return { valid: false, reason: "That doesn't look like a CTCfix code. It starts with CTCFIX-." };
  const [, plan, yymm, rnd, sig] = m;
  const expected = Buffer.from(sign(secret, `${plan}${yymm}-${rnd}`));
  if (!timingSafeEqual(expected, Buffer.from(sig))) return { valid: false, reason: "This code isn't valid. Check it against the one we sent you." };
  const info = describe(plan, yymm);
  const today = now.toISOString().slice(0, 10);
  if (today > info.validUntil) return { valid: false, expired: true, reason: `This code expired on ${info.validUntil}. Renew on the pricing page.`, ...info };
  return { valid: true, ...info };
}

export function safeEqual(a, b) {
  const x = Buffer.from(String(a || "")), y = Buffer.from(String(b || ""));
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y);
}
