// Engine regression test: every structure must tie out to the CTC exactly.
await import("../public/engine.js");
const { calculate } = globalThis.PayKit;

let n = 0, bad = 0;
for (const state of ["KA", "MH", "TG", "HR", "TN"])
  for (const gender of ["M", "F"])
    for (const pfMode of ["capped", "uncapped", "none"])
      for (const gratuityInCTC of [true, false])
        for (let c = 60000; c <= 6000000; c += 3917) {
          n++;
          const r = calculate({ state, annualCTC: c, gender, pfMode, gratuityInCTC });
          const m = r.monthly, a = r.annual;
          const ok =
            m.gross + m.erPF + m.erESI + m.gratuity === Math.round(c / 12) &&
            m.basic + m.hra + m.special === m.gross &&
            a.ctc === c && a.basic + a.hra + a.special === a.gross &&
            m.special >= 0 && m.net > 0 &&
            r.esiOn === m.gross <= 21000 &&
            r.exclusionPct <= 0.5;
          if (!ok && ++bad < 5) console.log("FAIL", { state, gender, pfMode, gratuityInCTC, c, m });
        }
console.log(`engine: ${n} cases, ${bad} failures`);
if (bad) process.exit(1);
