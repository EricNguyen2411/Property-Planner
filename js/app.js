(function () {
  "use strict";

  const R = window.PropRates;
  const C = window.PropCalc;
  const STATES = Object.keys(R.STATE_NAMES);

  // ---------------------------------------------------------------------
  // Number formatting helpers
  // ---------------------------------------------------------------------
  const fmt$ = (n) => "$" + Math.round(n).toLocaleString("en-AU");
  const fmt$signed = (n) => (n < 0 ? "-$" : "$") + Math.round(Math.abs(n)).toLocaleString("en-AU");
  const parseNum = (val) => {
    if (val === null || val === undefined) return 0;
    const n = parseFloat(String(val).replace(/[^0-9.\-]/g, ""));
    return isNaN(n) ? 0 : n;
  };

  function attachThousandsFormatting(input) {
    input.addEventListener("blur", () => {
      const n = parseNum(input.value);
      input.value = n ? n.toLocaleString("en-AU") : "";
      saveState();
    });
    input.addEventListener("focus", () => {
      const n = parseNum(input.value);
      input.value = n ? String(n) : "";
      input.select(); // select-all on focus so typing replaces rather than appends
    });
  }

  // Same select-all-on-focus behaviour for decimal fields (rate, %, years),
  // which don't get thousands formatting but have the same "prefilled value,
  // tap and type" risk of appending instead of replacing.
  function attachSelectOnFocus(input) {
    input.addEventListener("focus", () => input.select());
  }

  // ---------------------------------------------------------------------
  // Theme (light / dark / system)
  // ---------------------------------------------------------------------
  const THEME_KEY = "property-planner-theme";
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)");

  function applyTheme(mode) {
    const isDark = mode === "dark" || (mode === "system" && systemDark.matches);
    if (isDark) {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  }

  function getThemeMode() {
    try { return localStorage.getItem(THEME_KEY) || "system"; } catch (e) { return "system"; }
  }

  function setThemeMode(mode) {
    try { localStorage.setItem(THEME_KEY, mode); } catch (e) {}
    applyTheme(mode);
  }

  const themePicker = document.getElementById("theme-picker");
  const savedMode = getThemeMode();
  themePicker.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b.dataset.val === savedMode));
  applyTheme(savedMode);

  themePicker.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    setThemeMode(btn.dataset.val);
  });

  systemDark.addEventListener("change", () => {
    if (getThemeMode() === "system") applyTheme("system");
  });

  // ---------------------------------------------------------------------
  // Tab navigation
  // ---------------------------------------------------------------------
  const tabButtons = document.querySelectorAll(".tab-btn");
  const screens = document.querySelectorAll(".screen");
  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabButtons.forEach((b) => b.classList.remove("active"));
      screens.forEach((s) => s.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById("screen-" + btn.dataset.tab).classList.add("active");
      window.scrollTo(0, 0);
    });
  });

  // ---------------------------------------------------------------------
  // Segmented controls (generic)
  // ---------------------------------------------------------------------
  document.querySelectorAll(".segmented").forEach((seg) => {
    seg.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;
      seg.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      saveState();
    });
  });
  function segVal(id) {
    return document.querySelector(`#${id} button.active`).dataset.val;
  }

  // ---------------------------------------------------------------------
  // State picker sheet (shared between Afford + Costs tabs)
  // ---------------------------------------------------------------------
  const sheetBackdrop = document.getElementById("sheet-backdrop");
  const stateSheet = document.getElementById("state-sheet");
  const stateSheetList = document.getElementById("state-sheet-list");
  let activeStateTarget = null; // 'af', 'co', 'in', 'jy' or 'cp'
  let selectedState = { af: "NSW", co: "NSW", in: "NSW", jy: "NSW", cp: "NSW" };

  function renderStateSheetList() {
    stateSheetList.innerHTML = "";
    STATES.forEach((code) => {
      const opt = document.createElement("div");
      opt.className = "sheet-option";
      opt.textContent = `${code} — ${R.STATE_NAMES[code]}`;
      opt.addEventListener("click", () => {
        selectedState[activeStateTarget] = code;
        document.getElementById(activeStateTarget + "-state-value").innerHTML = `${code} <span class="chevron">›</span>`;
        closeSheet();
        saveState();
      });
      stateSheetList.appendChild(opt);
    });
  }
  renderStateSheetList();

  function openSheet(target) {
    activeStateTarget = target;
    sheetBackdrop.classList.add("open");
    stateSheet.classList.add("open");
  }
  function closeSheet() {
    sheetBackdrop.classList.remove("open");
    stateSheet.classList.remove("open");
  }
  sheetBackdrop.addEventListener("click", closeSheet);
  document.getElementById("af-state-row").addEventListener("click", () => openSheet("af"));
  document.getElementById("co-state-row").addEventListener("click", () => openSheet("co"));
  document.getElementById("in-state-row").addEventListener("click", () => openSheet("in"));
  document.getElementById("jy-state-row").addEventListener("click", () => openSheet("jy"));
  document.getElementById("cp-state-row").addEventListener("click", () => openSheet("cp"));

  // ---------------------------------------------------------------------
  // Glossary sheet — opens for any tap on a .term-link, anywhere in the app,
  // including inside dynamically-rendered breakdown tables (event delegation).
  // ---------------------------------------------------------------------
  const glossaryBackdrop = document.getElementById("glossary-backdrop");
  const glossarySheet = document.getElementById("glossary-sheet");

  function openGlossaryTerm(key) {
    const entry = window.PropGlossary && window.PropGlossary[key];
    if (!entry) return;
    document.getElementById("glossary-sheet-title").textContent = entry.term;
    document.getElementById("glossary-sheet-full").textContent = entry.full !== entry.term ? entry.full : "";
    document.getElementById("glossary-sheet-def").textContent = entry.definition;
    glossaryBackdrop.classList.add("open");
    glossarySheet.classList.add("open");
  }
  function closeGlossarySheet() {
    glossaryBackdrop.classList.remove("open");
    glossarySheet.classList.remove("open");
  }
  glossaryBackdrop.addEventListener("click", closeGlossarySheet);

  document.addEventListener("click", (e) => {
    const link = e.target.closest(".term-link");
    if (link && link.dataset.term) {
      openGlossaryTerm(link.dataset.term);
    }
  });

  // FHB toggle shows/hides "no LMI" row
  document.getElementById("af-fhb").addEventListener("change", (e) => {
    document.getElementById("af-lmi-waived-row").classList.toggle("hidden", !e.target.checked);
    saveState();
  });
  document.getElementById("co-fhb").addEventListener("change", (e) => {
    document.getElementById("co-lmi-waived-row").classList.toggle("hidden", !e.target.checked);
    saveState();
  });

  // ---------------------------------------------------------------------
  // Ledger bar renderer (signature element)
  // loanAmount + cashUsed = price, with a cost "bite" notch between them
  // representing costs that ate into the buying power.
  // ---------------------------------------------------------------------
  function renderLedgerBar(barEl, { loanAmount, price, costsTotal }) {
    const cashUsed = Math.max(price - loanAmount, 0);
    const total = loanAmount + cashUsed;
    const loanPct = total ? (loanAmount / total) * 100 : 0;
    const cashPct = total ? (cashUsed / total) * 100 : 0;
    // costs notch is drawn as a thin marker at the loan/cash boundary,
    // width proportional to costs relative to total buying power (visual only)
    const costsPct = total ? Math.min((costsTotal / (total + costsTotal)) * 100, 14) : 0;

    barEl.innerHTML = `
      <div class="ledger-seg loan" style="width:${loanPct}%"></div>
      <div class="ledger-seg cash" style="width:${cashPct}%"></div>
      <div class="ledger-notch" style="left:${loanPct}%; width:${costsPct}%"></div>
    `;
  }

  // ---------------------------------------------------------------------
  // BORROWING POWER panel (inside Afford tab)
  // ---------------------------------------------------------------------
  const bpToggleRow = document.getElementById("af-borrow-toggle-row");
  const bpPanel = document.getElementById("af-borrow-panel");
  const bpChevron = document.getElementById("af-borrow-chevron");
  bpToggleRow.addEventListener("click", () => {
    const isHidden = bpPanel.classList.contains("hidden");
    bpPanel.classList.toggle("hidden");
    bpChevron.textContent = isHidden ? "⌄" : "›";
  });

  document.getElementById("bp-is-investment").addEventListener("change", (e) => {
    document.getElementById("bp-rent-row").classList.toggle("hidden", !e.target.checked);
    document.getElementById("bp-rent-shade-row").classList.toggle("hidden", !e.target.checked);
  });

  let lastBorrowingPowerResult = null;

  document.getElementById("bp-calc").addEventListener("click", () => {
    const grossSalaryAnnual = parseNum(document.getElementById("bp-salary").value);
    if (grossSalaryAnnual <= 0) {
      alert("Enter your gross salary first.");
      return;
    }
    const isInvestmentPurchase = document.getElementById("bp-is-investment").checked;
    const result = C.borrowingPower({
      grossSalaryAnnual,
      otherIncomeAnnual: parseNum(document.getElementById("bp-other-income").value),
      isInvestmentPurchase,
      rentalIncomeWeekly: parseNum(document.getElementById("bp-rent").value),
      rentalIncomeShadePct: parseNum(document.getElementById("bp-rent-shade").value) || 80,
      hasHecsDebt: document.getElementById("bp-hecs").checked,
      dependents: parseNum(document.getElementById("bp-dependents").value),
      livingExpensesMonthly: parseNum(document.getElementById("bp-living").value) || null,
      creditCardLimitsTotal: parseNum(document.getElementById("bp-cc-limit").value),
      personalLoanMonthly: parseNum(document.getElementById("bp-personal-loan").value),
      otherLoanRepaymentsMonthly: parseNum(document.getElementById("bp-other-loan").value),
      existingLoanBalancesTotal: parseNum(document.getElementById("bp-existing-balances").value),
      annualRatePct: parseNum(document.getElementById("bp-rate").value) || 6.5,
      termYears: parseNum(document.getElementById("bp-term").value) || 30,
    });
    lastBorrowingPowerResult = result;

    document.getElementById("bp-max-loan").textContent = fmt$(result.maxLoan);
    document.getElementById("bp-breakdown").innerHTML =
      breakdownRows([
        ["Net income (incl. shaded rent)", result.netAnnualIncomeTotal, false],
        ["Living expenses", -result.livingExpenses * 12, true],
        ["Existing debt commitments", -result.totalDebtCommitmentsMonthly * 12, true],
      ]) +
      `<div class="breakdown-row" style="color:var(--ink-faint); font-size:12.5px;"><span>Assessed at ${result.assessedRatePct.toFixed(2)}% p.a. (rate + 3% buffer)</span><span></span></div>`;

    const dtiStatus = document.getElementById("bp-dti-status");
    if (result.dtiExceedsSix) {
      dtiStatus.className = "status-banner neutral";
      dtiStatus.textContent = `Debt-to-income ratio ~${result.dti.toFixed(1)}x — at or above the 6x threshold lenders scrutinise closely.`;
      dtiStatus.classList.remove("hidden");
    } else {
      dtiStatus.classList.add("hidden");
    }

    document.getElementById("bp-results").classList.remove("hidden");
  });

  document.getElementById("bp-use").addEventListener("click", () => {
    if (!lastBorrowingPowerResult) return;
    document.getElementById("af-loan").value = lastBorrowingPowerResult.maxLoan.toLocaleString("en-AU");
    if (document.getElementById("bp-is-investment").checked) {
      document.querySelectorAll("#af-use button").forEach((b) => b.classList.toggle("active", b.dataset.val === "investor"));
    }
    document.getElementById("af-calc").click();
    document.getElementById("af-borrow-panel").classList.add("hidden");
    bpChevron.textContent = "›";
    document.getElementById("af-loan").scrollIntoView({ behavior: "smooth", block: "center" });
  });

  // ---------------------------------------------------------------------
  // AFFORD tab
  // ---------------------------------------------------------------------
  document.getElementById("af-calc").addEventListener("click", () => {
    const maxLoanAmount = parseNum(document.getElementById("af-loan").value);
    const availableCash = parseNum(document.getElementById("af-cash").value);
    const keepCashBuffer = parseNum(document.getElementById("af-buffer").value);
    const state = selectedState.af;
    const isFirstHomeBuyer = document.getElementById("af-fhb").checked;
    const lmiWaived = isFirstHomeBuyer && document.getElementById("af-lmi-waived").checked;

    if (maxLoanAmount <= 0 && availableCash <= 0) {
      alert("Enter your maximum loan amount and available savings first.");
      return;
    }

    const result = C.solveMaxPropertyPrice({
      maxLoanAmount,
      availableCash,
      state,
      isFirstHomeBuyer,
      lmiWaived,
      keepCashBuffer,
    });

    const b = result.breakdown;
    document.getElementById("af-max-price").textContent = fmt$(result.maxPrice);
    document.getElementById("af-caption").textContent =
      `Based on a ${fmt$(maxLoanAmount)} loan and ${fmt$(availableCash)} in savings, in ${state}`;

    renderLedgerBar(document.getElementById("af-ledger-bar"), {
      loanAmount: b.loanAmount,
      price: b.price,
      costsTotal: b.stampDuty + b.lmi + b.otherCostsTotal,
    });

    document.getElementById("af-breakdown").innerHTML = breakdownRows([
      ["Maximum loan", b.loanAmount, false],
      ["Deposit / cash used", b.deposit, false],
      ["Stamp duty", -b.stampDuty, true],
      ["LMI", -b.lmi, true],
      ["Other purchase costs", -b.otherCostsTotal, true],
      ["Maximum property price", result.maxPrice, false, true],
    ]);

    const statusEl = document.getElementById("af-status");
    if (keepCashBuffer > 0) {
      statusEl.className = "status-banner neutral";
      statusEl.textContent = `Keeping a ${fmt$(keepCashBuffer)} buffer untouched. ${fmt$(Math.max(result.remainingCash,0))} spare after all costs.`;
    } else {
      statusEl.className = "status-banner positive";
      statusEl.textContent = `${fmt$(Math.max(result.remainingCash, 0))} left over in savings after all upfront costs.`;
    }

    document.getElementById("af-results").classList.remove("hidden");
    saveState();
  });

  // Auto-links known jargon words/phrases inside a breakdown row's label to
  // their glossary entry, so every generated table teaches as it's read.
  const GLOSSARY_EXACT_LABELS = {
    "Stamp duty": "stampDuty",
    "LMI": "lmi",
    "Property management": "propertyMgmt",
    "Vacancy allowance": "vacancy",
    "Depreciation": "depreciation",
    "Yield on purchase": "yield",
    "Usable equity": "equity",
  };
  function linkTerms(label) {
    if (GLOSSARY_EXACT_LABELS[label]) {
      return `<span class="term-link" data-term="${GLOSSARY_EXACT_LABELS[label]}">${label}</span>`;
    }
    let out = label;
    const substringRules = [
      ["negative gearing", "negativeGearing"],
      ["quarantined", "negativeGearing"],
      ["(P&I)", "piVsIo", "P&I"], // 3rd item = the exact text to wrap, if different from the match
      ["Usable equity", "equity"],
      ["LVR", "lvr"],
    ];
    for (const [needle, termKey, wrapText] of substringRules) {
      if (out.includes(needle) && !out.includes('data-term=')) {
        const text = wrapText || needle;
        out = out.replace(text, `<span class="term-link" data-term="${termKey}">${text}</span>`);
      }
    }
    return out;
  }

  function breakdownRows(rows) {
    return rows
      .map(([label, amount, isCost, isTotal]) => {
        const cls = isTotal ? "breakdown-row total" : "breakdown-row";
        const amtCls = amount < 0 ? "amount negative" : "amount";
        return `<div class="${cls}"><span>${linkTerms(label)}</span><span class="${amtCls} tabular">${fmt$signed(amount)}</span></div>`;
      })
      .join("");
  }

  // ---------------------------------------------------------------------
  // MORTGAGE tab
  // ---------------------------------------------------------------------
  function renderStressTest(loanAmount, actualRate, termYears, frequency, repaymentType, freqLabel) {
    const deltas = [-1, 0, 1, 2, 3];
    const rows = deltas.map((delta) => {
      const rate = Math.max(actualRate + delta, 0.1);
      const r = C.mortgageSummary({ loanAmount, annualRatePct: rate, termYears, frequency, repaymentType });
      const repayment = r.repaymentPerPeriod;
      const label = delta === 0 ? `${rate.toFixed(2)}% (your rate)` : delta === 3 ? `${rate.toFixed(2)}% (bank's stress test)` : `${rate.toFixed(2)}%`;
      return [label, repayment, false, delta === 0];
    });
    document.getElementById("mg-stress-test").innerHTML = breakdownRows(rows);
  }

  document.getElementById("mg-calc").addEventListener("click", () => {
    const loanAmount = parseNum(document.getElementById("mg-loan").value);
    const annualRatePct = parseNum(document.getElementById("mg-rate").value) || 6;
    const termYears = parseNum(document.getElementById("mg-term").value) || 30;
    const repaymentType = segVal("mg-type");
    const frequency = segVal("mg-freq");
    const extraPerPeriod = parseNum(document.getElementById("mg-extra").value);
    const offsetBalance = parseNum(document.getElementById("mg-offset").value);

    if (loanAmount <= 0) {
      alert("Enter a loan amount first.");
      return;
    }

    const result = C.mortgageSummary({
      loanAmount, annualRatePct, termYears, frequency, repaymentType, extraPerPeriod, offsetBalance,
    });

    const freqLabel = { weekly: "Weekly", fortnightly: "Fortnightly", monthly: "Monthly" }[frequency];
    document.getElementById("mg-hero-label").textContent = `${freqLabel} repayment`;
    document.getElementById("mg-repayment").textContent = fmt$(result.repaymentPerPeriod + (result.extraPerPeriod || 0));

    if (result.note && result.totalInterest === null) {
      document.getElementById("mg-caption").textContent = result.note;
      document.getElementById("mg-breakdown").innerHTML = "";
    } else if (repaymentType === "IO") {
      document.getElementById("mg-caption").textContent = `Interest-only over ${termYears} years at ${annualRatePct}% p.a.`;
      document.getElementById("mg-breakdown").innerHTML = breakdownRows([
        ["Loan amount (unchanged)", loanAmount, false],
        ["Total interest over term", -result.totalInterest, true, true],
      ]);
    } else {
      const years = Math.floor(result.payoffYears);
      const months = Math.round((result.payoffYears - years) * 12);
      document.getElementById("mg-caption").textContent =
        `${annualRatePct}% p.a. over ${termYears} years` + (extraPerPeriod > 0 || offsetBalance > 0 ? " — with your extras applied" : "");
      const rows = [
        ["Loan amount", loanAmount, false],
        ["Total interest", -result.totalInterest, true],
        ["Total amount paid", result.totalPaid, false],
        ["Payoff time", null, false],
      ];
      let html = breakdownRows(rows.slice(0, 3));
      html += `<div class="breakdown-row total"><span>Payoff time</span><span class="amount">${years} yr ${months} mo</span></div>`;
      document.getElementById("mg-breakdown").innerHTML = html;
    }

    renderStressTest(loanAmount, annualRatePct, termYears, frequency, repaymentType, freqLabel);

    document.getElementById("mg-results").classList.remove("hidden");
    saveState();
  });

  // ---------------------------------------------------------------------
  // COSTS tab
  // ---------------------------------------------------------------------
  let lastCostsResult = null;

  document.getElementById("co-calc").addEventListener("click", () => {
    const price = parseNum(document.getElementById("co-price").value);
    const loanAmount = parseNum(document.getElementById("co-loan").value);
    const availableCash = parseNum(document.getElementById("co-cash").value);
    const state = selectedState.co;
    const isFirstHomeBuyer = document.getElementById("co-fhb").checked;
    const lmiWaived = isFirstHomeBuyer && document.getElementById("co-lmi-waived").checked;

    if (price <= 0) {
      alert("Enter a property price first.");
      return;
    }

    const b = C.upfrontCosts({ state, price, isFirstHomeBuyer, loanAmount, lmiWaived });
    lastCostsResult = { price, loanAmount, state, isFirstHomeBuyer, lmiWaived, availableCash };

    document.getElementById("co-total").textContent = fmt$(b.totalCashRequired);
    document.getElementById("co-breakdown").innerHTML = breakdownRows([
      ["Deposit", b.deposit, false],
      ["Stamp duty", -b.stampDuty, true],
      ["LMI", -b.lmi, true],
      ["Other purchase costs", -b.otherCostsTotal, true],
      ["Total cash required", b.totalCashRequired, false, true],
    ]);

    const statusEl = document.getElementById("co-status");
    if (availableCash > 0) {
      const afford = C.canAfford({ propertyPrice: price, maxLoanAmount: loanAmount, availableCash, state, isFirstHomeBuyer, lmiWaived });
      if (afford.affordable) {
        statusEl.className = "status-banner positive";
        statusEl.textContent = `✅ You can afford this — ${fmt$(afford.surplus)} left over.`;
      } else {
        statusEl.className = "status-banner negative";
        statusEl.textContent = `❌ You're short by ${fmt$(afford.shortfall)}.`;
      }
      document.getElementById("co-status-wrap").classList.remove("hidden");
    } else {
      document.getElementById("co-status-wrap").classList.add("hidden");
    }

    document.getElementById("co-ongoing-breakdown").classList.add("hidden");
    document.getElementById("co-results").classList.remove("hidden");
    saveState();
  });

  document.getElementById("co-ongoing-calc").addEventListener("click", () => {
    if (!lastCostsResult) return;
    const council = parseNum(document.getElementById("co-ong-council").value) || R.DEFAULT_ONGOING_MONTHLY.councilRates;
    const water = parseNum(document.getElementById("co-ong-water").value) || R.DEFAULT_ONGOING_MONTHLY.waterRates;
    const insurance = parseNum(document.getElementById("co-ong-insurance").value) || R.DEFAULT_ONGOING_MONTHLY.homeInsurance;
    const strata = parseNum(document.getElementById("co-ong-strata").value);
    const maintenance = parseNum(document.getElementById("co-ong-maint").value) || R.DEFAULT_ONGOING_MONTHLY.maintenance;

    // Assume a typical mortgage (6% p.a., 30yr, P&I, monthly) unless the
    // person has already calculated one on the Mortgage tab with this loan.
    const rateInput = parseNum(document.getElementById("mg-rate").value) || 6;
    const termInput = parseNum(document.getElementById("mg-term").value) || 30;
    const mortgage = C.mortgageSummary({
      loanAmount: lastCostsResult.loanAmount,
      annualRatePct: rateInput,
      termYears: termInput,
      frequency: "monthly",
      repaymentType: "PI",
    });

    const total = mortgage.repaymentPerPeriod + council + water + insurance + strata + maintenance;
    document.getElementById("co-ongoing-breakdown").innerHTML = breakdownRows([
      [`Mortgage (${rateInput}% p.a., ${termInput}yr)`, mortgage.repaymentPerPeriod, false],
      ["Council rates", council, false],
      ["Water rates", water, false],
      ["Home insurance", insurance, false],
      ["Strata / body corp", strata, false],
      ["Maintenance", maintenance, false],
      ["Real monthly housing cost", total, false, true],
    ]);
    document.getElementById("co-ongoing-breakdown").classList.remove("hidden");
  });

  // ---------------------------------------------------------------------
  // INVEST tab
  // ---------------------------------------------------------------------
  let lastInvestResult = null;
  let activeScenario = "lower";

  document.getElementById("in-scenario-toggle").addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    document.querySelectorAll("#in-scenario-toggle button").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    activeScenario = btn.dataset.val;
    if (lastInvestResult) renderInvestScenario();
  });

  document.getElementById("in-calc").addEventListener("click", () => {
    const price = parseNum(document.getElementById("in-price").value);
    if (price <= 0) {
      alert("Enter a purchase price first.");
      return;
    }
    const D = R.DEFAULT_INVESTMENT;
    const result = C.investmentAnalysis({
      price,
      depositPct: parseNum(document.getElementById("in-deposit-pct").value) || 20,
      state: selectedState.in,
      annualRatePct: parseNum(document.getElementById("in-rate").value) || 6.5,
      loanTermYears: parseNum(document.getElementById("in-term").value) || 30,
      offsetBalance: parseNum(document.getElementById("in-offset").value),
      renovationCost: parseNum(document.getElementById("in-reno").value),
      miscFees: parseNum(document.getElementById("in-misc").value) || D.miscFees,
      buildingInsuranceAnnual: parseNum(document.getElementById("in-bldg-ins").value) || D.buildingInsuranceAnnual,
      landlordInsuranceAnnual: parseNum(document.getElementById("in-ll-ins").value) || D.landlordInsuranceAnnual,
      propertyMgmtPct: document.getElementById("in-mgmt-pct").value !== "" ? parseNum(document.getElementById("in-mgmt-pct").value) : D.propertyMgmtPct,
      leasingFeeAnnual: parseNum(document.getElementById("in-leasing").value) || D.leasingFeeAnnual,
      vacancyWeeks: document.getElementById("in-vacancy").value !== "" ? parseNum(document.getElementById("in-vacancy").value) : D.vacancyWeeks,
      landTaxAnnual: parseNum(document.getElementById("in-land-tax").value),
      stratLeviesMonthly: parseNum(document.getElementById("in-strata").value),
      maintenanceMonthly: document.getElementById("in-maint").value !== "" ? parseNum(document.getElementById("in-maint").value) : D.maintenanceMonthly,
      otherExpensesAnnual: document.getElementById("in-other-exp").value !== "" ? parseNum(document.getElementById("in-other-exp").value) : D.otherExpensesAnnual,
      lowerRentWeekly: parseNum(document.getElementById("in-rent-low").value) || 500,
      higherRentWeekly: parseNum(document.getElementById("in-rent-high").value) || 550,
      taxRatePct: document.getElementById("in-tax-rate").value !== "" ? parseNum(document.getElementById("in-tax-rate").value) : D.taxRatePct,
      depreciationAnnual: parseNum(document.getElementById("in-depreciation").value),
      growthCagrPct: parseNum(document.getElementById("in-growth").value) || D.growthCagrPct,
      negativeGearingQuarantined: segVal("in-property-type") === "established",
    });

    lastInvestResult = result;
    document.getElementById("in-capital").textContent = fmt$(result.totalCapitalRequired);
    document.getElementById("in-tag-lower").textContent = `${fmt$(result.lower.rentWeekly)}/wk`;
    document.getElementById("in-tag-higher").textContent = `${fmt$(result.higher.rentWeekly)}/wk`;

    document.getElementById("in-growth-breakdown").innerHTML = breakdownRows([
      ["Purchase price today", result.price, false],
      [`5-year estimate (${result.growth.cagr}% p.a.)`, result.growth.value5yr, false],
      [`10-year estimate (${result.growth.cagr}% p.a.)`, result.growth.value10yr, false, true],
    ]);

    renderInvestScenario();
    document.getElementById("in-results").classList.remove("hidden");
    saveState();
  });

  function renderInvestScenario() {
    const s = lastInvestResult[activeScenario];
    const r = lastInvestResult;

    document.getElementById("in-yield-breakdown").innerHTML =
      breakdownRows([["Gross rent (annual)", s.grossRentAnnual, false]]) +
      `<div class="breakdown-row total"><span>Yield on purchase</span><span class="amount tabular">${s.yieldPct.toFixed(2)}%</span></div>`;

    document.getElementById("in-before-tax-breakdown").innerHTML = breakdownRows([
      ["Gross rent", s.grossRentAnnual, false],
      ["Property management", -s.propertyMgmtAnnual, true],
      ["Vacancy allowance", -s.vacancyCost, true],
      ["Other ongoing expenses", -r.fixedAnnualExpenses, true],
      ["Loan repayments (P&I)", -r.repaymentAnnual, true],
      ["Cashflow before tax (annual)", s.cashflowBeforeTaxAnnual, false, true],
    ]);
    const btStatus = document.getElementById("in-before-tax-status");
    if (s.cashflowBeforeTaxAnnual >= 0) {
      btStatus.className = "status-banner positive";
      btStatus.textContent = `+${fmt$(s.cashflowBeforeTaxAnnual / 52)}/wk · +${fmt$(s.cashflowBeforeTaxAnnual / 12)}/mo positively geared`;
    } else {
      btStatus.className = "status-banner negative";
      btStatus.textContent = `${fmt$signed(s.cashflowBeforeTaxAnnual / 52)}/wk · ${fmt$signed(s.cashflowBeforeTaxAnnual / 12)}/mo out of pocket`;
    }

    const afterTaxRows = [
      ["Cashflow before tax", s.cashflowBeforeTaxAnnual, false],
      [s.taxableIncome < 0 ? "Tax refund (negative gearing)" : "Extra tax payable", s.taxEffectAnnual, s.taxEffectAnnual < 0],
    ];
    if (s.carriedForwardLoss > 0) {
      afterTaxRows.push(["Loss carried forward (quarantined)", s.carriedForwardLoss, false]);
    }
    afterTaxRows.push(["Cashflow after tax (annual)", s.cashflowAfterTaxAnnual, false, true]);
    document.getElementById("in-after-tax-breakdown").innerHTML = breakdownRows(afterTaxRows);
    const atStatus = document.getElementById("in-after-tax-status");
    if (s.cashflowAfterTaxAnnual >= 0) {
      atStatus.className = "status-banner positive";
      atStatus.textContent = `+${fmt$(s.cashflowAfterTaxAnnual / 52)}/wk · +${fmt$(s.cashflowAfterTaxAnnual / 12)}/mo after tax`;
    } else {
      atStatus.className = "status-banner negative";
      atStatus.textContent = `${fmt$signed(s.cashflowAfterTaxAnnual / 52)}/wk · ${fmt$signed(s.cashflowAfterTaxAnnual / 12)}/mo after tax`;
    }
  }

  // ---------------------------------------------------------------------
  // JOURNEY tab
  // ---------------------------------------------------------------------
  document.getElementById("jy-calc").addEventListener("click", () => {
    const price1 = parseNum(document.getElementById("jy-price1").value);
    if (price1 <= 0) {
      alert("Enter a purchase price for Property 1 first.");
      return;
    }
    const result = C.investmentThenHomeJourney({
      price1,
      depositPct1: parseNum(document.getElementById("jy-deposit1").value) || 20,
      annualRatePct1: parseNum(document.getElementById("jy-rate1").value) || 6.5,
      termYears1: parseNum(document.getElementById("jy-term1").value) || 30,
      growthCagrPct1: parseNum(document.getElementById("jy-growth1").value) || 6,
      yearsUntilProperty2: parseNum(document.getElementById("jy-years").value) || 5,
      equityReleaseLVRPct: parseNum(document.getElementById("jy-equity-lvr").value) || 80,
      additionalSavingsByThen: parseNum(document.getElementById("jy-savings").value),
      property2State: selectedState.jy,
      property2MaxLoan: parseNum(document.getElementById("jy-loan2").value),
      property2IsFirstHomeBuyer: false, // conservative default — see FHB impact panel
    });

    const y = result.atYearN;
    document.getElementById("jy-property1-breakdown").innerHTML = breakdownRows([
      ["Purchase price today", result.property1.price, false],
      [`Estimated value in ${y.years} years`, y.value, false],
      ["Remaining loan balance", -y.loanBalance, true],
      [`Usable equity (at ${document.getElementById("jy-equity-lvr").value || 80}% LVR)`, y.usableEquity, false, true],
    ]);

    document.getElementById("jy-deposit2").textContent = fmt$(y.totalDepositAvailable);

    const p2 = result.property2;
    document.getElementById("jy-property2-breakdown").innerHTML = breakdownRows([
      ["Usable equity from Property 1", y.usableEquity, false],
      ["Additional savings", y.additionalSavingsByThen, false],
      ["Borrowing capacity (entered)", p2.breakdown.loanAmount, false],
      ["Stamp duty", -p2.breakdown.stampDuty, true],
      ["LMI", -p2.breakdown.lmi, true],
      ["Other purchase costs", -p2.breakdown.otherCostsTotal, true],
      ["Maximum price for Property 2", p2.maxPrice, false, true],
    ]);

    const fhb = R.RENTVESTING_FHB_IMPACT[selectedState.jy];
    const warningEl = document.getElementById("jy-fhb-warning");
    if (fhb.retainsEligibility === false) {
      warningEl.textContent = `In ${selectedState.jy}, buying the investment property first will likely cost you first-home stamp duty relief on Property 2.`;
    } else if (fhb.retainsEligibility === true) {
      warningEl.textContent = `In ${selectedState.jy}, you may still qualify for first-home stamp duty relief on Property 2 despite owning an investment property first.`;
    } else {
      warningEl.textContent = `In ${selectedState.jy}, it's not clear-cut whether you'll retain first-home stamp duty relief on Property 2 — confirm before relying on it.`;
    }
    document.getElementById("jy-fhb-detail").textContent =
      fhb.note + " Separately, the federal First Home Guarantee (5% deposit, no LMI) is gone for Property 2 regardless of state, the moment Property 1 settles — this calculator already assumes standard (non-concession) duty and no LMI waiver for Property 2 to reflect that.";

    document.getElementById("jy-results").classList.remove("hidden");
    saveState();
  });

  // ---------------------------------------------------------------------
  // ---------------------------------------------------------------------
  // COMPARE tab
  // ---------------------------------------------------------------------
  const COMPARE_KEY = "property-planner-compare-v1";
  let compareList = [];

  function loadCompareList() {
    try {
      const raw = localStorage.getItem(COMPARE_KEY);
      compareList = raw ? JSON.parse(raw) : [];
    } catch (e) { compareList = []; }
  }
  function saveCompareList() {
    try { localStorage.setItem(COMPARE_KEY, JSON.stringify(compareList)); } catch (e) {}
  }

  function computeCompareSnapshot(entry) {
    const D = R.DEFAULT_INVESTMENT;
    return C.investmentAnalysis({
      price: entry.price,
      depositPct: entry.depositPct,
      state: entry.state,
      annualRatePct: entry.rate,
      loanTermYears: 30,
      offsetBalance: 0,
      renovationCost: 0,
      miscFees: D.miscFees,
      buildingInsuranceAnnual: D.buildingInsuranceAnnual,
      landlordInsuranceAnnual: D.landlordInsuranceAnnual,
      propertyMgmtPct: D.propertyMgmtPct,
      leasingFeeAnnual: D.leasingFeeAnnual,
      vacancyWeeks: D.vacancyWeeks,
      landTaxAnnual: D.landTaxAnnual,
      stratLeviesMonthly: D.stratLeviesMonthly,
      maintenanceMonthly: D.maintenanceMonthly,
      otherExpensesAnnual: D.otherExpensesAnnual,
      lowerRentWeekly: entry.rentWeekly,
      higherRentWeekly: entry.rentWeekly,
      taxRatePct: D.taxRatePct,
      depreciationAnnual: D.depreciationAnnual,
      growthCagrPct: D.growthCagrPct,
      negativeGearingQuarantined: true,
    });
  }

  function renderCompareList() {
    const listEl = document.getElementById("cp-list");
    if (compareList.length === 0) {
      listEl.innerHTML = '<div class="compare-empty">No properties saved yet. Add one above to start comparing.</div>';
      return;
    }
    const snapshots = compareList.map((entry) => ({ entry, result: computeCompareSnapshot(entry) }));
    const bestCashflow = Math.max(...snapshots.map((s) => s.result.lower.cashflowBeforeTaxWeekly));

    listEl.innerHTML = snapshots
      .map(({ entry, result }) => {
        const s = result.lower;
        const isBest = s.cashflowBeforeTaxWeekly === bestCashflow && compareList.length > 1;
        const cfCls = s.cashflowBeforeTaxWeekly >= 0 ? "positive" : "negative";
        return `
          <div class="compare-card ${isBest ? "best" : ""}">
            <div class="compare-card-header">
              <div>
                <div class="compare-card-title">${entry.label || "Untitled property"}</div>
                <div class="compare-card-sub">${entry.state} · ${fmt$(entry.price)} · ${fmt$(entry.rentWeekly)}/wk rent</div>
              </div>
              ${isBest ? '<span class="compare-best-badge">BEST CASHFLOW</span>' : ""}
              <button class="compare-remove" data-remove-id="${entry.id}">×</button>
            </div>
            <div class="compare-grid">
              <div><div class="compare-stat-label">Deposit</div><div class="compare-stat-value">${fmt$(result.deposit)}</div></div>
              <div><div class="compare-stat-label">Total cash required</div><div class="compare-stat-value">${fmt$(result.totalCapitalRequired)}</div></div>
              <div><div class="compare-stat-label">Yield</div><div class="compare-stat-value">${s.yieldPct.toFixed(2)}%</div></div>
              <div><div class="compare-stat-label">Cashflow before tax</div><div class="compare-stat-value ${cfCls}">${fmt$signed(s.cashflowBeforeTaxWeekly)}/wk</div></div>
            </div>
          </div>`;
      })
      .join("");

    listEl.querySelectorAll("[data-remove-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        compareList = compareList.filter((e) => e.id !== btn.dataset.removeId);
        saveCompareList();
        renderCompareList();
      });
    });
  }

  document.getElementById("cp-add").addEventListener("click", () => {
    const price = parseNum(document.getElementById("cp-price").value);
    const rentWeekly = parseNum(document.getElementById("cp-rent").value);
    if (price <= 0 || rentWeekly <= 0) {
      alert("Enter a price and expected rent first.");
      return;
    }
    compareList.push({
      id: "cmp-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
      label: document.getElementById("cp-label").value.trim(),
      price,
      depositPct: parseNum(document.getElementById("cp-deposit-pct").value) || 20,
      rentWeekly,
      state: selectedState.cp,
      rate: parseNum(document.getElementById("cp-rate").value) || 6.5,
    });
    if (compareList.length > 6) compareList = compareList.slice(compareList.length - 6);
    saveCompareList();
    renderCompareList();
    document.getElementById("cp-label").value = "";
    document.getElementById("cp-price").value = "";
    document.getElementById("cp-rent").value = "";
  });

  loadCompareList();
  renderCompareList();

  // ---------------------------------------------------------------------
  // RATES tab
  // ---------------------------------------------------------------------
  function renderRatesTab() {
    const upfrontLabels = {
      conveyancing: '<span class="term-link" data-term="conveyancing">Conveyancing</span> / legal',
      buildingPestInspection: "Building & pest inspection",
      loanApplicationFee: "Loan application fee",
      mortgageRegistrationFee: "Mortgage registration",
      transferRegistrationFee: "Transfer registration",
      titleSearchAndOther: "Title search & other",
    };
    const upfrontEl = document.getElementById("rates-upfront");
    upfrontEl.innerHTML = Object.entries(R.DEFAULT_UPFRONT_COSTS)
      .map(([key, val]) => `
        <div class="row">
          <span class="row-label">${upfrontLabels[key] || key}</span>
          <div class="row-input-prefix"><span>$</span><input class="row-input" inputmode="numeric" data-cost-key="${key}" value="${val.toLocaleString("en-AU")}"></div>
        </div>`)
      .join("");
    upfrontEl.querySelectorAll("input").forEach((inp) => attachThousandsFormatting(inp));

    const fhbEl = document.getElementById("rates-fhb");
    fhbEl.innerHTML = STATES.map((code) => {
      const c = R.FHB_CONCESSIONS[code];
      return `<div class="row" style="display:block;">
        <div class="row-label" style="margin-bottom:3px;">${code} — ${R.STATE_NAMES[code]}</div>
        <div class="row-sublabel">${c.note}</div>
      </div>`;
    }).join("");

    const investLabels = {
      buildingInsuranceAnnual: ["Building insurance", "/yr"],
      landlordInsuranceAnnual: ["Landlord insurance", "/yr"],
      propertyMgmtPct: ["Property management", "%"],
      leasingFeeAnnual: ["Leasing fee", "/yr"],
      vacancyWeeks: ["Vacancy allowance", "wks"],
      maintenanceMonthly: ["Maintenance", "/mo"],
      otherExpensesAnnual: ["Other expenses", "/yr"],
      miscFees: ["Misc fees (upfront)", ""],
      taxRatePct: ["Marginal tax rate", "%"],
      growthCagrPct: ["Growth rate (CAGR)", "%"],
    };
    const investEl = document.getElementById("rates-invest");
    investEl.innerHTML = Object.entries(investLabels)
      .map(([key, [label, suffix]]) => {
        const val = R.DEFAULT_INVESTMENT[key];
        const display = suffix === "%" || suffix === "wks" ? val : val.toLocaleString("en-AU");
        return `<div class="row"><span class="row-label">${label}</span><span class="row-value">${suffix === "" ? "$" + display : display + (suffix ? " " + suffix : "")}</span></div>`;
      })
      .join("");

    const glossaryEl = document.getElementById("rates-glossary");
    glossaryEl.innerHTML = Object.entries(window.PropGlossary)
      .sort((a, b) => a[1].term.localeCompare(b[1].term))
      .map(([key, entry]) => `
        <div class="glossary-row term-link" data-term="${key}">
          <div>
            <div class="glossary-row-term">${entry.term}</div>
            ${entry.full !== entry.term ? `<div class="glossary-row-full">${entry.full}</div>` : ""}
          </div>
          <span class="chevron">›</span>
        </div>`)
      .join("");

    document.getElementById("rates-verified-date").textContent = R.RATES_LAST_VERIFIED;
  }
  renderRatesTab();

  // ---------------------------------------------------------------------
  // Persistence (local only — this is a personal calculator, no sync)
  // ---------------------------------------------------------------------
  const INVEST_FIELD_IDS = [
    "in-price", "in-deposit-pct", "in-rate", "in-term", "in-offset",
    "in-reno", "in-misc", "in-bldg-ins", "in-ll-ins", "in-mgmt-pct",
    "in-leasing", "in-vacancy", "in-land-tax", "in-strata", "in-maint",
    "in-other-exp", "in-rent-low", "in-rent-high", "in-tax-rate",
    "in-depreciation", "in-growth",
  ];

  function saveState() {
    try {
      const state = {
        af: {
          loan: document.getElementById("af-loan").value,
          cash: document.getElementById("af-cash").value,
          buffer: document.getElementById("af-buffer").value,
          state: selectedState.af,
          fhb: document.getElementById("af-fhb").checked,
          lmiWaived: document.getElementById("af-lmi-waived").checked,
        },
        mg: {
          loan: document.getElementById("mg-loan").value,
          rate: document.getElementById("mg-rate").value,
          term: document.getElementById("mg-term").value,
          type: segVal("mg-type"),
          freq: segVal("mg-freq"),
          extra: document.getElementById("mg-extra").value,
          offset: document.getElementById("mg-offset").value,
        },
        co: {
          price: document.getElementById("co-price").value,
          loan: document.getElementById("co-loan").value,
          cash: document.getElementById("co-cash").value,
          state: selectedState.co,
          fhb: document.getElementById("co-fhb").checked,
          lmiWaived: document.getElementById("co-lmi-waived").checked,
        },
        in: (() => {
          const vals = {};
          INVEST_FIELD_IDS.forEach((id) => { vals[id] = document.getElementById(id).value; });
          vals.state = selectedState.in;
          return vals;
        })(),
      };
      localStorage.setItem("property-planner-state-v1", JSON.stringify(state));
    } catch (e) { /* storage unavailable - ignore */ }
  }

  function restoreState() {
    try {
      const raw = localStorage.getItem("property-planner-state-v1");
      if (!raw) return;
      const s = JSON.parse(raw);
      // Only overwrite a field's HTML-default value if we actually have a
      // saved value for it — an empty saved string should never blank out
      // the pre-filled defaults now baked into the page.
      const setIfPresent = (id, val) => {
        if (val) document.getElementById(id).value = val;
      };
      if (s.af) {
        setIfPresent("af-loan", s.af.loan);
        setIfPresent("af-cash", s.af.cash);
        setIfPresent("af-buffer", s.af.buffer);
        selectedState.af = s.af.state || "NSW";
        document.getElementById("af-state-value").innerHTML = `${selectedState.af} <span class="chevron">›</span>`;
        document.getElementById("af-fhb").checked = !!s.af.fhb;
        document.getElementById("af-lmi-waived").checked = !!s.af.lmiWaived;
        document.getElementById("af-lmi-waived-row").classList.toggle("hidden", !s.af.fhb);
      }
      if (s.mg) {
        setIfPresent("mg-loan", s.mg.loan);
        setIfPresent("mg-rate", s.mg.rate);
        setIfPresent("mg-term", s.mg.term);
        setIfPresent("mg-extra", s.mg.extra);
        setIfPresent("mg-offset", s.mg.offset);
        setSeg("mg-type", s.mg.type);
        setSeg("mg-freq", s.mg.freq);
      }
      if (s.co) {
        setIfPresent("co-price", s.co.price);
        setIfPresent("co-loan", s.co.loan);
        setIfPresent("co-cash", s.co.cash);
        selectedState.co = s.co.state || "NSW";
        document.getElementById("co-state-value").innerHTML = `${selectedState.co} <span class="chevron">›</span>`;
        document.getElementById("co-fhb").checked = !!s.co.fhb;
        document.getElementById("co-lmi-waived").checked = !!s.co.lmiWaived;
        document.getElementById("co-lmi-waived-row").classList.toggle("hidden", !s.co.fhb);
      }
      if (s.in) {
        INVEST_FIELD_IDS.forEach((id) => setIfPresent(id, s.in[id]));
        selectedState.in = s.in.state || "NSW";
        document.getElementById("in-state-value").innerHTML = `${selectedState.in} <span class="chevron">›</span>`;
      }
    } catch (e) { /* ignore malformed state */ }
  }
  function setSeg(id, val) {
    if (!val) return;
    const seg = document.getElementById(id);
    seg.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b.dataset.val === val));
  }

  // Format all number inputs with thousands separators on blur
  document.querySelectorAll('input[inputmode="numeric"]').forEach((inp) => {
    if (!inp.hasAttribute("data-cost-key")) attachThousandsFormatting(inp);
  });
  document.querySelectorAll('input[inputmode="decimal"]').forEach((inp) => {
    inp.addEventListener("blur", saveState);
    attachSelectOnFocus(inp);
  });
  document.querySelectorAll('.switch input').forEach((inp) => inp.addEventListener("change", saveState));

  // ---------------------------------------------------------------------
  // Welcome overlay (first run only, re-openable from Rates tab)
  // ---------------------------------------------------------------------
  const welcomeOverlay = document.getElementById("welcome-overlay");
  function openWelcome() { welcomeOverlay.classList.add("open"); }
  function closeWelcome() {
    welcomeOverlay.classList.remove("open");
    try { localStorage.setItem("property-planner-welcome-seen", "1"); } catch (e) {}
  }
  document.getElementById("welcome-dismiss").addEventListener("click", closeWelcome);
  document.getElementById("show-welcome-again").addEventListener("click", openWelcome);

  // ---------------------------------------------------------------------
  // Guided walkthrough — chains Afford → Invest → Costs → Journey, carrying
  // the computed numbers forward automatically at each step, so the person
  // never has to re-type the same price into multiple tabs.
  // ---------------------------------------------------------------------
  const GUIDED_STEPS = [
    { tab: "afford", label: "Step 1 of 4 · Affordability" },
    { tab: "invest", label: "Step 2 of 4 · Does it stack up?" },
    { tab: "costs", label: "Step 3 of 4 · Real cash needed" },
    { tab: "journey", label: "Step 4 of 4 · The long game" },
  ];
  let guidedActive = false;
  let guidedStepIndex = 0;

  function switchToTab(tabName) {
    const btn = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);
    if (btn) btn.click();
  }

  function updateGuidedBanner() {
    const banner = document.getElementById("guided-banner");
    if (!guidedActive) {
      banner.classList.add("hidden");
      document.body.classList.remove("guided-mode");
      return;
    }
    const step = GUIDED_STEPS[guidedStepIndex];
    document.getElementById("guided-banner-label").textContent = step.label;
    document.getElementById("guided-progress-fill").style.width = `${((guidedStepIndex + 1) / GUIDED_STEPS.length) * 100}%`;
    banner.classList.remove("hidden");
    document.body.classList.add("guided-mode");
  }

  function setGuidedButtonsVisible(visible) {
    ["af-guided-continue", "in-guided-continue", "co-guided-continue", "jy-guided-continue"].forEach((id) => {
      document.getElementById(id).classList.toggle("hidden", !visible);
    });
  }

  function startGuidedWalkthrough() {
    guidedActive = true;
    guidedStepIndex = 0;
    closeWelcome();
    setGuidedButtonsVisible(true);
    updateGuidedBanner();
    switchToTab("afford");
    document.getElementById("af-borrow-panel").classList.remove("hidden");
    bpChevron.textContent = "⌄";
    document.getElementById("af-calc").click();
    window.scrollTo(0, 0);
  }

  function exitGuidedMode() {
    guidedActive = false;
    setGuidedButtonsVisible(false);
    updateGuidedBanner();
  }

  document.getElementById("welcome-start-guided").addEventListener("click", startGuidedWalkthrough);
  document.getElementById("show-guided-again").addEventListener("click", startGuidedWalkthrough);
  document.getElementById("guided-exit").addEventListener("click", exitGuidedMode);

  document.getElementById("af-guided-continue").addEventListener("click", () => {
    const price = parseNum(document.getElementById("af-max-price").textContent);
    document.getElementById("in-price").value = price.toLocaleString("en-AU");
    guidedStepIndex = 1;
    updateGuidedBanner();
    switchToTab("invest");
    document.getElementById("in-calc").click();
    window.scrollTo(0, 0);
  });

  document.getElementById("in-guided-continue").addEventListener("click", () => {
    const price = parseNum(document.getElementById("in-price").value);
    document.getElementById("co-price").value = price.toLocaleString("en-AU");
    if (lastInvestResult) {
      document.getElementById("co-loan").value = Math.round(lastInvestResult.loanAmount).toLocaleString("en-AU");
    }
    guidedStepIndex = 2;
    updateGuidedBanner();
    switchToTab("costs");
    document.getElementById("co-calc").click();
    window.scrollTo(0, 0);
  });

  document.getElementById("co-guided-continue").addEventListener("click", () => {
    const price = parseNum(document.getElementById("co-price").value);
    const depositPct = parseNum(document.getElementById("in-deposit-pct").value) || 20;
    document.getElementById("jy-price1").value = price.toLocaleString("en-AU");
    document.getElementById("jy-deposit1").value = depositPct;
    guidedStepIndex = 3;
    updateGuidedBanner();
    switchToTab("journey");
    document.getElementById("jy-calc").click();
    window.scrollTo(0, 0);
  });

  document.getElementById("jy-guided-continue").addEventListener("click", () => {
    exitGuidedMode();
    window.scrollTo(0, 0);
  });

  restoreState();

  try {
    if (!localStorage.getItem("property-planner-welcome-seen")) openWelcome();
  } catch (e) { /* storage unavailable - skip first-run welcome */ }

  // Auto-run each calculator once on load so the pre-filled example is
  // immediately useful — the person can see real numbers straight away and
  // just override price/loan amount rather than needing to press Calculate
  // before anything appears.
  document.getElementById("af-calc").click();
  document.getElementById("mg-calc").click();
  document.getElementById("co-calc").click();
  document.getElementById("in-calc").click();
  document.getElementById("jy-calc").click();

  // ---------------------------------------------------------------------
  // Register service worker
  // ---------------------------------------------------------------------
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("service-worker.js").catch(() => {});
    });
  }
})();
