/* CTCfix checks for employees: finds lapses in a salary slip or an offer.
 * Pure functions over plain numbers, so the same code runs in the browser (after the document is
 * read, and again whenever the person corrects a number) and in Node tests.
 * Uses the statutory rates in engine.js (load engine.js first). */
(function () {
  const R = () => (globalThis.PayKit || {}).RULES;
  const n = (x) => (Number.isFinite(+x) ? +x : 0);
  const has = (x) => x !== null && x !== undefined && x !== "" && Number.isFinite(+x);
  const inr = (x) => "₹" + Math.round(x).toLocaleString("en-IN");
  const pct = (x) => (x * 100).toFixed(1) + "%";
  const sum = (list) => (list || []).reduce((a, b) => a + n(b && b.amount), 0);

  // Monthly PT the state expects for this gross (and gender, for Maharashtra).
  function expectedPT(state, gross, gender) {
    const rules = R(); if (!rules || !rules.states[state]) return null;
    const pt = rules.states[state].pt;
    if (pt.type === "none") return { monthly: 0, note: "Haryana has no professional tax." };
    if (pt.type === "halfYearly") {
      const s = pt.slabs.find((x) => gross * 6 <= x.upTo);
      return { monthly: s.amt / 6, halfYearly: s.amt, note: `₹${s.amt} per half-year (Chennai slabs), usually deducted twice a year.` };
    }
    const slabs = pt.byGender ? pt.byGender[gender || "M"] : pt.slabs;
    const s = slabs.find((x) => gross <= x.upTo);
    return { monthly: s.amt, feb: s.feb ?? s.amt, note: s.feb ? `₹${s.amt} a month, ₹${s.feb} in February.` : `₹${s.amt} a month.` };
  }

  // Amounts HR commonly shows that the Code on Wages excludes from "wages".
  function excludedParts(e) {
    return n(e.hra) + n(e.conveyance) + n(e.lta) + n(e.overtime) + n(e.commission);
  }

  /* slip: { state, gender, month (e.g. "February"), earnings: {basic, da, hra, special, conveyance, lta,
     medical, overtime, commission, other:[{name, amount}]}, gross, deductions: {pf, vpf, esi, pt, lwf, tds,
     other:[{name, amount}]}, net, employerPF } — monthly rupees. */
  function checkSlip(slip) {
    const out = [];
    const e = slip.earnings || {}, d = slip.deductions || {};
    const rules = R();
    const basicDA = n(e.basic) + n(e.da);
    const listed = basicDA + n(e.hra) + n(e.special) + n(e.conveyance) + n(e.lta) + n(e.medical) + n(e.overtime) + n(e.commission) + sum(e.other);
    const gross = has(slip.gross) ? n(slip.gross) : listed;
    const dedTotal = n(d.pf) + n(d.vpf) + n(d.esi) + n(d.pt) + n(d.lwf) + n(d.tds) + sum(d.other);

    if (!gross) return [{ level: "info", title: "We couldn't find your salary figures", detail: "Type your basic, HRA and other amounts in the boxes below and we'll check them." }];

    // 1. Arithmetic
    if (has(slip.gross) && Math.abs(listed - gross) > 5) {
      out.push({ level: "warn", title: "Earnings don't add up to gross",
        detail: `The components add up to ${inr(listed)}, but gross pay shows ${inr(gross)}. A component may be missing from the slip, or there is an error.`,
        ask: `My salary slip components total ${inr(listed)} but gross shows ${inr(gross)}. Could you explain the difference?` });
    }
    if (has(slip.net) && Math.abs(gross - dedTotal - n(slip.net)) > 5) {
      out.push({ level: "warn", title: "Net pay doesn't match",
        detail: `Gross ${inr(gross)} minus deductions ${inr(dedTotal)} is ${inr(gross - dedTotal)}, but your net pay shows ${inr(slip.net)}.`,
        ask: `My net pay is ${inr(slip.net)} but gross minus deductions comes to ${inr(gross - dedTotal)}. Could you check this month's slip?` });
    }

    // 2. New Labour Code 50% wage rule
    if (basicDA > 0 && rules) {
      const erPF = has(slip.employerPF) ? n(slip.employerPF) : n(d.pf);
      const total = gross + erPF;
      const excl = excludedParts(e) + erPF;
      const share = excl / total;
      if (share > rules.code.exclusionCap + 0.005) {
        out.push({ level: "bad", title: "Allowances are above the 50% limit",
          detail: `HRA, conveyance and similar allowances plus employer PF are ${pct(share)} of your pay. The new Labour Codes (in force since 21 November 2025) cap them at 50%. The excess ${inr(excl - 0.5 * total)} a month should count as wages, which raises your gratuity and possibly your PF.`,
          ask: `Under the Code on Wages, excluded allowances above 50% of remuneration count as wages. Mine are ${pct(share)}. Is my gratuity and PF being calculated on the revised wage?` });
      } else {
        out.push({ level: "ok", title: "Within the 50% wage rule", detail: `Excluded allowances are ${pct(share)} of your pay, under the 50% limit.` });
      }
      if (basicDA / gross < 0.35) {
        out.push({ level: "info", title: `Basic is ${pct(basicDA / gross)} of gross`,
          detail: "A low basic keeps PF and gratuity small. Many employers are moving basic to about 50% of pay under the new Codes. It lowers take-home slightly but raises your retirement savings." });
      }
    }

    // 3. Provident Fund
    if (rules && basicDA > 0) {
      const capped = Math.round(rules.pf.rate * Math.min(basicDA, rules.pf.wageCeiling));
      const pf = n(d.pf);
      if (!pf) {
        out.push({ level: basicDA <= rules.pf.wageCeiling ? "bad" : "warn", title: "No PF deducted",
          detail: basicDA <= rules.pf.wageCeiling
            ? `Your basic + DA is ${inr(basicDA)}, within ₹15,000, so PF is compulsory: ${inr(capped)} a month from you and the same from your employer.`
            : "PF is optional only if you opted out when you first joined with basic above ₹15,000. If you didn't sign Form 11 opting out, PF should be deducted.",
          ask: "My slip shows no PF deduction. Am I enrolled in EPF, and do you have my UAN?" });
      } else if (pf + 2 < capped) {
        out.push({ level: "warn", title: "PF looks lower than it should be",
          detail: `12% of basic + DA (up to ₹15,000) is ${inr(capped)}, but ${inr(pf)} was deducted.`,
          ask: `PF deducted is ${inr(pf)}, while 12% of my basic + DA (capped at ₹15,000) is ${inr(capped)}. Could you check the PF wage used?` });
      } else {
        out.push({ level: "ok", title: "PF deducted correctly", detail: `${inr(pf)} deducted. At least ${inr(capped)} is required.` + (n(d.vpf) ? ` Plus ${inr(d.vpf)} voluntary PF.` : "") });
      }
    }

    // 4. ESI
    if (rules) {
      const esi = n(d.esi), exp = Math.ceil(rules.esi.employee * gross);
      if (gross <= rules.esi.grossCeiling) {
        if (!esi) out.push({ level: "bad", title: "ESI missing",
          detail: `Your gross is ${inr(gross)}, within ₹21,000, so ESI should apply: ${inr(exp)} a month from you and 3.25% from your employer. ESI gives you and your family free medical care.`,
          ask: "My gross is within the ESI limit but no ESI is deducted. Am I registered under ESIC? Please share my IP number." });
        else if (Math.abs(esi - exp) > 2) out.push({ level: "warn", title: "ESI amount looks off", detail: `0.75% of ${inr(gross)} is ${inr(exp)}, but ${inr(esi)} was deducted.` });
        else out.push({ level: "ok", title: "ESI deducted correctly", detail: `${inr(esi)} at 0.75% of gross.` });
      } else if (esi) {
        out.push({ level: "info", title: "ESI deducted above ₹21,000",
          detail: "This is allowed only until the end of the current ESI contribution period (April–September or October–March) if your pay crossed ₹21,000 during it. After that it should stop." });
      }
    }

    // 5. Professional tax
    if (slip.state) {
      const exp = expectedPT(slip.state, gross, slip.gender);
      const pt = n(d.pt), isFeb = /feb/i.test(slip.month || "");
      if (exp) {
        if (slip.state === "HR" && pt) out.push({ level: "bad", title: "Professional tax deducted in Haryana", detail: `Haryana has no professional tax, but ${inr(pt)} was deducted.`, ask: `Haryana has no professional tax. Why is ${inr(pt)} deducted as PT on my slip?` });
        else if (slip.state === "TN") out.push({ level: "info", title: "Tamil Nadu professional tax", detail: exp.note + (pt ? ` This month shows ${inr(pt)}.` : "") });
        else {
          const want = isFeb && exp.feb != null ? exp.feb : exp.monthly;
          if (Math.abs(pt - want) > 1) out.push({ level: pt > want ? "bad" : "warn", title: pt > want ? "Professional tax is too high" : "Professional tax looks low",
            detail: `At your gross of ${inr(gross)}, the ${R().states[slip.state].name} rate is ${exp.note} Your slip shows ${inr(pt)}.`,
            ask: `My professional tax is ${inr(pt)}, but the ${R().states[slip.state].name} slab for my salary is ${inr(want)}. Could you check?` });
          else out.push({ level: "ok", title: "Professional tax is correct", detail: exp.note });
        }
      }
    }
    return out;
  }

  /* offer: annual rupees. { annualCTC, fixed, variable, joiningBonus, basic, hra, special, otherAllowances,
     employerPF, gratuity, insurance, esopValue, state, gender, noticeDays, probationMonths,
     clauses: [{type, text}] } */
  function checkOffer(o) {
    const out = [];
    const rules = R();
    const ctc = n(o.annualCTC);
    if (!ctc) return [{ level: "info", title: "We couldn't find the CTC", detail: "Type the total CTC and the main components below and we'll check them." }];
    const variable = n(o.variable), bonus = n(o.joiningBonus), esop = n(o.esopValue);
    const erPF = n(o.employerPF), grat = n(o.gratuity), ins = n(o.insurance);
    const fixed = has(o.fixed) && n(o.fixed) ? n(o.fixed) : ctc - variable - bonus - esop;
    const cashGross = fixed - erPF - grat - ins;   // what reaches salary before deductions

    // Take-home estimate
    if (cashGross > 0 && rules) {
      const basic = n(o.basic);
      const eePF = basic ? Math.round(rules.pf.rate * Math.min(basic / 12, rules.pf.wageCeiling)) : (erPF ? Math.round(erPF / 12) : 0);
      const pt = o.state ? (expectedPT(o.state, cashGross / 12, o.gender) || { monthly: 0 }).monthly : 0;
      const monthly = cashGross / 12 - eePF - pt;
      out.push({ level: "info", title: `Estimated take-home: ${inr(monthly)} a month`,
        detail: `Before income tax. Your CTC of ${inr(ctc)} includes ${[variable && "variable pay " + inr(variable), bonus && "joining bonus " + inr(bonus), esop && "ESOPs " + inr(esop), erPF && "employer PF " + inr(erPF), grat && "gratuity " + inr(grat), ins && "insurance " + inr(ins)].filter(Boolean).join(", ") || "items"} that don't come to you as monthly salary.` });
    }

    const nonCash = variable + bonus + esop + erPF + grat + ins;
    if (nonCash / ctc > 0.25) out.push({ level: "warn", title: `${pct(nonCash / ctc)} of the CTC isn't fixed monthly pay`,
      detail: "Variable pay, bonuses, ESOPs and employer contributions make the CTC look bigger than your salary. Compare offers on fixed pay.",
      ask: "Could you confirm my fixed annual pay and the monthly in-hand amount before tax?" });
    if (variable / ctc > 0.2) out.push({ level: "warn", title: `Variable pay is ${pct(variable / ctc)} of CTC`,
      detail: "Ask how it's decided and what was actually paid out last year. Many companies pay only part of the target.",
      ask: "What percentage of target variable pay was paid out in the last two years?" });

    if (grat) out.push({ level: "info", title: "Gratuity is counted in your CTC",
      detail: "You get gratuity only when you leave, after 5 years (or after 1 year if you're a fixed-term employee under the Code on Social Security). It isn't part of your yearly pay." });

    // 50% wage rule, if a breakdown is given
    if (n(o.basic) && rules) {
      const total = cashGross + erPF;
      const excl = n(o.hra) + n(o.otherExcluded) + erPF;
      const share = excl / total;
      if (share > 0.505) out.push({ level: "bad", title: "Allowances are above the 50% limit",
        detail: `HRA and similar allowances plus employer PF are ${pct(share)} of pay. The new Labour Codes cap them at 50%. Expect this structure to be revised, which can lower take-home.`,
        ask: "Is this salary structure compliant with the 50% wage rule under the Code on Wages? Could it change after I join?" });
      else out.push({ level: "ok", title: "Structure meets the 50% wage rule", detail: `Excluded allowances are ${pct(share)} of pay.` });
    }

    if (n(o.noticeDays) > 90) out.push({ level: "warn", title: `Notice period is ${n(o.noticeDays)} days`, detail: "Longer than the usual 30–90 days. It can make your next move harder.", ask: "Can the notice period be reduced to 60 days?" });

    (o.clauses || []).forEach((c) => {
      const map = {
        clawback: ["Joining bonus clawback", "You may have to repay the joining bonus if you leave early. Check the period and whether it's pro-rated."],
        bond: ["Service bond or training cost recovery", "You may owe money if you leave before a set date. Courts often limit these, but negotiate before signing."],
        noncompete: ["Non-compete clause", "Restrictions after you leave are generally not enforceable in India under Section 27 of the Contract Act, but confidentiality obligations are."],
        variableConditions: ["Conditions on variable pay", "Check what you must achieve and whether you must be on the rolls on the payout date."],
      };
      const m = map[c.type];
      if (m) out.push({ level: "warn", title: m[0], detail: m[1] + (c.text ? ` The offer says: "${String(c.text).slice(0, 160)}"` : "") });
    });
    return out;
  }

  // Map "years of experience" to the report's levels.
  function levelFor(years) {
    const y = n(years);
    if (y >= 15) return "Senior";
    if (y >= 6) return "Middle";
    return "Junior";
  }

  globalThis.CTCfixChecks = { checkSlip, checkOffer, expectedPT, levelFor };
})();
