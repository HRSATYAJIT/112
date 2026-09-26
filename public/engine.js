/* Labour Code Pay Kit — calculation engine (framework-free, runs in browser and Node).
 * Rates verified as of 26 Sep 2026. Every statutory number lives in RULES so it can be
 * updated in one place (later: served from the backend).
 */
const RULES = {
  asOf: "26 Sep 2026",
  pf: { rate: 0.12, wageCeiling: 15000, adminRate: 0.005, edliRate: 0.005, edliCeiling: 15000 },
  esi: { employee: 0.0075, employer: 0.0325, grossCeiling: 21000 },
  gratuity: { daysPerYear: 15, divisor: 26 },          // monthly provision = wages * 15/26/12
  bonus: { wageCeiling: 21000, calcCeiling: 7000, minRate: 0.0833 },
  code: { exclusionCap: 0.5 },
  states: {
    KA: {
      name: "Karnataka",
      pt: { type: "monthly", slabs: [{ upTo: 24999, amt: 0 }, { upTo: Infinity, amt: 200, feb: 300 }] },
      lwf: { employee: 50, employer: 100, per: "year", months: ["Dec"] },
    },
    MH: {
      name: "Maharashtra",
      pt: {
        type: "monthly",
        byGender: {
          M: [{ upTo: 7500, amt: 0 }, { upTo: 10000, amt: 175 }, { upTo: Infinity, amt: 200, feb: 300 }],
          F: [{ upTo: 25000, amt: 0 }, { upTo: Infinity, amt: 200, feb: 300 }],
        },
      },
      lwf: { employee: 25, employer: 75, per: "half-year", months: ["Jun", "Dec"] },
    },
    TG: {
      name: "Telangana",
      pt: { type: "monthly", slabs: [{ upTo: 15000, amt: 0 }, { upTo: 20000, amt: 150 }, { upTo: Infinity, amt: 200 }] },
      lwf: { employee: 2, employer: 5, per: "year", months: ["Jan"] },
    },
    HR: {
      name: "Haryana",
      pt: { type: "none" },
      lwf: { rate: 0.002, employeeCap: 35, employerMultiple: 2, per: "month" },
    },
    TN: {
      name: "Tamil Nadu",
      pt: {
        type: "halfYearly", // Greater Chennai Corporation slabs, on half-yearly salary
        slabs: [
          { upTo: 21000, amt: 0 }, { upTo: 30000, amt: 180 }, { upTo: 45000, amt: 425 },
          { upTo: 60000, amt: 930 }, { upTo: 75000, amt: 1025 }, { upTo: Infinity, amt: 1250 },
        ],
      },
      lwf: { employee: 20, employer: 40, per: "year", months: ["Dec"] },
    },
  },
};

const r0 = (x) => Math.round(x);

function slab(slabs, amount) {
  return slabs.find((s) => amount <= s.upTo);
}

function professionalTax(stateCode, gross, gender) {
  const pt = RULES.states[stateCode].pt;
  if (pt.type === "none") return { monthly: 0, feb: 0, annual: 0, note: "No professional tax in this state" };
  if (pt.type === "halfYearly") {
    const s = slab(pt.slabs, gross * 6);
    return { monthly: s.amt / 6, feb: s.amt / 6, annual: s.amt * 2, halfYearly: s.amt,
      note: (s.amt ? `₹${s.amt} per half-year, deducted in Sep & Mar` : "Nil at this salary") + " (Greater Chennai Corporation slabs; other local bodies may differ)" };
  }
  const slabs = pt.byGender ? pt.byGender[gender] : pt.slabs;
  const s = slab(slabs, gross);
  const feb = s.feb ?? s.amt;
  return { monthly: s.amt, feb, annual: s.amt * 11 + feb,
    note: s.amt ? (feb !== s.amt ? `₹${s.amt}/month, ₹${feb} in February` : `₹${s.amt}/month`) : "Nil at this salary" };
}

function labourWelfare(stateCode, gross) {
  const l = RULES.states[stateCode].lwf;
  if (l.per === "month") {
    const emp = Math.min(r0(gross * l.rate), l.employeeCap);
    return { employeeAnnual: emp * 12, employerAnnual: emp * l.employerMultiple * 12,
      note: `₹${emp} employee + ₹${emp * l.employerMultiple} employer, every month` };
  }
  const times = l.per === "half-year" ? 2 : 1;
  return { employeeAnnual: l.employee * times, employerAnnual: l.employer * times,
    note: `₹${l.employee} employee + ₹${l.employer} employer per ${l.per} (${l.months.join(" & ")})` };
}

/* Build one structure for a given gross. basicRule:
 *   {type:"code"}           -> Basic = 50% of total remuneration (gross + employer PF): new-code compliant
 *   {type:"pctGross", pct}  -> Basic = pct of gross (legacy structure, for comparison)
 */
function structureForGross(G, o) {
  const pfOn = o.pfMode !== "none";
  const hraPct = o.metro ? 0.5 : 0.4;
  let basic;
  if (o.basicRule.type === "code") {
    // basic = 0.5 * (G + erPF), erPF = 12% of pfBase(basic). Solve directly.
    const uncappedBasic = 0.5 * G / (1 - 0.5 * RULES.pf.rate * (pfOn ? 1 : 0));
    if (!pfOn) basic = 0.5 * G;
    else if (o.pfMode === "uncapped" || uncappedBasic <= RULES.pf.wageCeiling) basic = uncappedBasic;
    else basic = 0.5 * (G + RULES.pf.rate * RULES.pf.wageCeiling);
  } else {
    basic = o.basicRule.pct * G;
  }
  basic = Math.min(basic, G);
  let hra = hraPct * basic;
  let special = G - basic - hra;
  if (special < 0) { hra = G - basic; special = 0; }

  const pfBase = !pfOn ? 0 : o.pfMode === "uncapped" ? basic : Math.min(basic, RULES.pf.wageCeiling);
  const erPF = RULES.pf.rate * pfBase;
  const totalRem = G + erPF;
  const exclusions = hra + erPF;                    // HRA and employer PF are excluded items
  const addBack = Math.max(0, exclusions - RULES.code.exclusionCap * totalRem);
  const codeWages = basic + special + addBack;       // "wages" under Code on Wages s.2(y)
  const gratuityBase = o.basicRule.type === "code" ? codeWages : basic;
  const gratuity = o.gratuityInCTC ? gratuityBase * RULES.gratuity.daysPerYear / RULES.gratuity.divisor / 12 : 0;
  return { basic, hra, special, pfBase, erPF, totalRem, exclusions, addBack, codeWages, gratuityBase, gratuity };
}

function solveGross(M, o, esiOn) {
  let G = M * 0.9;
  for (let i = 0; i < 200; i++) {
    const s = structureForGross(G, o);
    const esiEr = esiOn ? RULES.esi.employer * G : 0;
    const next = M - s.erPF - s.gratuity - esiEr;
    if (Math.abs(next - G) < 1e-6) { G = next; break; }
    G = next;
  }
  return G;
}

function calculate(input) {
  const o = {
    state: input.state || "KA",
    annualCTC: Number(input.annualCTC) || 0,
    gender: input.gender || "M",
    metro: input.metro ?? true,
    pfMode: input.pfMode || "capped",
    gratuityInCTC: input.gratuityInCTC ?? true,
    basicRule: input.basicRule || { type: "code" },
  };
  const M = o.annualCTC / 12;
  let G = solveGross(M, o, false);
  let esiOn = false;
  if (G <= RULES.esi.grossCeiling) { esiOn = true; G = solveGross(M, o, true); }

  const s = structureForGross(G, o);
  const basic = r0(s.basic), hra = r0(s.hra);
  let gross = r0(G);
  let special = gross - basic - hra;
  const erPF = r0(s.erPF), eePF = r0(RULES.pf.rate * s.pfBase);
  let gratuity = r0(s.gratuity);
  // ESI contributions round up to the next rupee; absorb rounding in Special Allowance so CTC ties out exactly.
  const esiEr = (g) => (esiOn ? Math.ceil(RULES.esi.employer * g) : 0);
  const target = r0(M);
  for (let i = 0; i < 5; i++) {
    const d = target - (gross + erPF + esiEr(gross) + gratuity);
    if (d === 0) break;
    gross += d; special += d;
  }
  gratuity += target - (gross + erPF + esiEr(gross) + gratuity); // residual ₹1 from ESI round-up
  const erESI = esiEr(gross);
  const eeESI = esiOn ? Math.ceil(RULES.esi.employee * gross) : 0;
  const ctcMonthly = gross + erPF + erESI + gratuity;
  const pt = professionalTax(o.state, gross, o.gender);
  const lwf = labourWelfare(o.state, gross);
  const ptRegular = r0(pt.monthly);
  const netMonthly = gross - eePF - eeESI - ptRegular;
  const yearAdj = o.annualCTC - ctcMonthly * 12; // CTC not divisible by 12: settle in annual Special Allowance
  const netAnnual = (gross * 12 + yearAdj) - eePF * 12 - eeESI * 12 - pt.annual - lwf.employeeAnnual;

  const pfOn = o.pfMode !== "none";
  const outside = {
    pfAdmin: pfOn ? r0(RULES.pf.adminRate * s.pfBase) : 0,
    edli: pfOn ? r0(RULES.pf.edliRate * Math.min(s.pfBase, RULES.pf.edliCeiling)) : 0,
    lwfEmployerAnnual: lwf.employerAnnual,
  };

  const exclPct = s.exclusions / s.totalRem;
  const checks = [
    { id: "wage50", ok: s.addBack < 1,
      title: "50% wage rule",
      detail: `Excluded pay (HRA + employer PF) is ${(exclPct * 100).toFixed(1)}% of total pay; the limit is 50%.` +
        (s.addBack >= 1 ? ` ₹${r0(s.addBack).toLocaleString("en-IN")}/month is added back to wages.` : "") },
    { id: "esi", ok: true, info: true, title: esiOn ? "ESI applies" : "ESI not applicable",
      detail: esiOn ? `Gross ₹${gross.toLocaleString("en-IN")} is within the ₹21,000 limit: 0.75% employee, 3.25% employer.`
                    : `Gross is above ₹21,000, so ESI does not apply.` },
    { id: "pf", ok: true, info: true, title: pfOn ? "Provident Fund" : "PF not included",
      detail: pfOn ? `12% each on ₹${r0(s.pfBase).toLocaleString("en-IN")}` + (o.pfMode === "capped" && s.basic > RULES.pf.wageCeiling ? " (statutory ceiling of ₹15,000)." : ".")
                   : "Only valid if the establishment is not covered under EPF." },
    { id: "gratuity", ok: true, info: true, title: "Gratuity base uses Code wages",
      detail: `Gratuity is 15/26 of ₹${r0(s.codeWages).toLocaleString("en-IN")} per year of service. Fixed-term staff qualify after 1 year.` },
    { id: "bonus", ok: true, warn: s.codeWages <= RULES.bonus.wageCeiling, info: s.codeWages > RULES.bonus.wageCeiling,
      title: s.codeWages > RULES.bonus.wageCeiling ? "Statutory bonus not applicable" : "Statutory bonus applies",
      detail: s.codeWages > RULES.bonus.wageCeiling ? "Wages exceed ₹21,000/month."
        : "Wages are within ₹21,000/month: minimum 8.33% bonus on the higher of ₹7,000 or minimum wage. It is not included in this CTC." },
    { id: "minwage", ok: true, info: true, title: "Check minimum wage",
      detail: `Confirm Basic + DA of ₹${basic.toLocaleString("en-IN")} meets the ${RULES.states[o.state].name} minimum wage for this role's schedule and zone.` },
  ];

  return {
    input: o, stateName: RULES.states[o.state].name, esiOn,
    monthly: { basic, hra, special, gross, erPF, erESI, gratuity, ctc: ctcMonthly, eePF, eeESI, pt: ptRegular, net: netMonthly },
    annual: {
      basic: basic * 12, hra: hra * 12, special: special * 12 + yearAdj, gross: gross * 12 + yearAdj, erPF: erPF * 12, erESI: erESI * 12,
      gratuity: gratuity * 12, ctc: ctcMonthly * 12 + yearAdj, eePF: eePF * 12, eeESI: eeESI * 12, pt: pt.annual,
      lwf: lwf.employeeAnnual, net: netAnnual,
    },
    pt, lwf, outside, checks,
    codeWages: r0(s.codeWages), exclusionPct: exclPct, roundingDiff: yearAdj,
  };
}

// Browser: loaded as a classic script, so these are globals. Node tests: imported for this side effect.
globalThis.PayKit = { RULES, calculate, professionalTax, labourWelfare };
