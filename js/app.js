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
  let activeStateTarget = null; // 'af', 'co', 'in' or 'jy'
  let selectedState = { af: "NSW", co: "NSW", in: "NSW", jy: "NSW" };

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

  function breakdownRows(rows) {
    return rows
      .map(([label, amount, isCost, isTotal]) => {
        const cls = isTotal ? "breakdown-row total" : "breakdown-row";
        const amtCls = amount < 0 ? "amount negative" : "amount";
        return `<div class="${cls}"><span>${label}</span><span class="${amtCls} tabular">${fmt$signed(amount)}</span></div>`;
      })
      .join("");
  }

  // ---------------------------------------------------------------------
  // MORTGAGE tab
  // ---------------------------------------------------------------------
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
  // RATES tab
  // ---------------------------------------------------------------------
  function renderRatesTab() {
    const upfrontLabels = {
      conveyancing: "Conveyancing / legal",
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

  restoreState();

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
