/* Letter facts + standard template. Shared by the browser (live preview, offline fallback)
 * and the API (fallback when Claude is unavailable). Loaded as a classic script in the browser;
 * imported for its side effect in Node. */
(function () {
  function sanitise(s, max) {
    return String(s == null ? "" : s).replace(/[<>]/g, "").slice(0, max || 300).trim();
  }

  function facts(body) {
    const t = body.terms;
    return {
      letterType: t.letterType,
      company: { name: sanitise(body.company.name), address: sanitise(body.company.address),
        signatory: sanitise(body.company.signatoryName) + ", " + sanitise(body.company.signatoryTitle) },
      employee: { name: sanitise(body.employee.name), designation: sanitise(body.employee.designation),
        joiningDate: sanitise(body.employee.joiningDate), location: sanitise(body.employee.location) },
      state: sanitise(body.stateName),
      employmentType: t.employmentType,
      endDate: t.employmentType === "fixed-term" ? sanitise(t.endDate) : null,
      probationMonths: t.probationMonths,
      noticeDays: t.noticeDays,
      pfCovered: !!body.pfCovered,
      esiCovered: !!body.esiCovered,
      gratuityInCTC: !!body.gratuityInCTC,
      extraTerms: sanitise(t.extraTerms, 800),
    };
  }

  function templateDraft(body) {
    const f = facts(body);
    const offer = f.letterType === "offer";
    const first = f.employee.name.split(" ")[0] || f.employee.name;
    const clauses = [
      { heading: "Appointment", text: (offer ? "We are pleased to offer you" : "We are pleased to confirm your appointment to") +
        " the position of " + f.employee.designation + " with " + f.company.name +
        (f.employmentType === "fixed-term" ? ", on a fixed-term basis ending on " + f.endDate : "") + "." },
      { heading: "Date of joining and place of work", text: "Your date of joining is " + f.employee.joiningDate +
        ". Your place of work will be " + f.employee.location + ", " + f.state + "." },
      { heading: "Compensation", text: "Your annual cost to company and its components are set out in Annexure A. Compensation is subject to deductions required by law." },
    ];
    if (f.probationMonths > 0) clauses.push({ heading: "Probation", text: "You will be on probation for " + f.probationMonths +
      " month" + (f.probationMonths === 1 ? "" : "s") + " from your date of joining. Your employment will be confirmed in writing on satisfactory completion." });
    const stat = [f.pfCovered && "Provident Fund", f.esiCovered && "Employees' State Insurance", "gratuity"].filter(Boolean);
    const statText = stat.length > 1 ? stat.slice(0, -1).join(", ") + " and " + stat[stat.length - 1] : stat[0];
    clauses.push({ heading: "Statutory benefits", text: "You will be covered for " + statText + " as per applicable law." +
      (f.employmentType === "fixed-term" ? " As a fixed-term employee you receive benefits on par with permanent employees in the same role, including gratuity after one year of service, as provided under the Code on Social Security, 2020." : "") });
    clauses.push({ heading: "Notice period", text: "Either party may end this employment by giving " + f.noticeDays +
      " days' written notice or salary in lieu of notice" + (f.probationMonths > 0 ? ", after confirmation" : "") + "." });
    clauses.push({ heading: "Confidentiality", text: "You will keep confidential all information about " + f.company.name + ", its clients and its business, during and after your employment." });
    clauses.push({ heading: "Code of conduct", text: "You will follow the company's policies and code of conduct as updated from time to time." });
    if (f.extraTerms) clauses.push({ heading: "Additional terms", text: f.extraTerms });
    return {
      subject: offer ? "Offer of employment: " + f.employee.designation : "Letter of appointment: " + f.employee.designation,
      salutation: "Dear " + first + ",",
      opening: offer ? "Following our discussions, we are happy to make you this offer on the terms below." : "We are pleased to confirm your appointment on the terms below.",
      clauses: clauses,
      closing: offer ? "Please sign and return a copy of this letter to confirm your acceptance. We look forward to working with you." : "We welcome you to the team and wish you success in your role.",
    };
  }

  globalThis.PayKitLetter = { sanitise: sanitise, facts: facts, templateDraft: templateDraft };
})();
