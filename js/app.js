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
  // Screen navigation — a generalized switcher, since most screens are no
  // longer reached via a direct tab-bar button (only Home and More are).
  // Afford/Invest/Costs/Journey are reached via Home's story cards;
  // Mortgage/Compare/Rates are reached via the More menu.
  // ---------------------------------------------------------------------
  const tabButtons = document.querySelectorAll(".tab-btn");
  const screens = document.querySelectorAll(".screen");
  const HOME_GROUP = ["home", "afford", "invest", "costs", "journey"];
  const MORE_GROUP = ["more", "mortgage", "compare", "savings", "rates"];

  function switchToScreen(screenId) {
    screens.forEach((s) => s.classList.remove("active"));
    const target = document.getElementById("screen-" + screenId);
    if (target) target.classList.add("active");
    tabButtons.forEach((b) => {
      const group = b.dataset.tab === "home" ? HOME_GROUP : MORE_GROUP;
      b.classList.toggle("active", group.includes(screenId));
    });
    window.scrollTo(0, 0);
  }

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => switchToScreen(btn.dataset.tab));
  });

  document.querySelectorAll("[data-back-home]").forEach((btn) => {
    btn.addEventListener("click", () => switchToScreen("home"));
  });
  document.querySelectorAll("[data-back-more]").forEach((btn) => {
    btn.addEventListener("click", () => switchToScreen("more"));
  });
  document.querySelectorAll("[data-goto]").forEach((row) => {
    row.addEventListener("click", () => switchToScreen(row.dataset.goto));
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
  const SHARED_STATE_TARGETS = ["af", "co", "jy"]; // cp intentionally excluded — different properties

  function renderStateSheetList() {
    stateSheetList.innerHTML = "";
    STATES.forEach((code) => {
      const opt = document.createElement("div");
      opt.className = "sheet-option";
      opt.textContent = `${code} — ${R.STATE_NAMES[code]}`;
      opt.addEventListener("click", () => {
        selectedState[activeStateTarget] = code;
        document.getElementById(activeStateTarget + "-state-value").innerHTML = `${code} <span class="chevron">›</span>`;
        if (SHARED_STATE_TARGETS.includes(activeStateTarget)) {
          SHARED_STATE_TARGETS.forEach((t) => {
            if (t === activeStateTarget) return;
            selectedState[t] = code;
            const valEl = document.getElementById(t + "-state-value");
            if (valEl) valEl.innerHTML = `${code} <span class="chevron">›</span>`;
          });
        }
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
  document.getElementById("jy-state-row").addEventListener("click", () => openSheet("jy"));
  document.getElementById("cp-state-row").addEventListener("click", () => openSheet("cp"));

  // ---------------------------------------------------------------------
  // Shared property fields — price, deposit %, loan amount and interest
  // rate stay in sync live across Invest, Costs, Journey (Property 1) and
  // Mortgage, so there's no mismatch as you move between screens, whether
  // or not you use the "Continue" buttons. Price/deposit%/loan are a
  // three-variable relationship — editing any one recomputes the other
  // two consistently. State/territory syncs the same way (handled above,
  // inside the state picker) across every screen except Compare, which is
  // deliberately independent since each saved entry is a different property.
  // ---------------------------------------------------------------------
  const SHARED_PRICE_FIELDS = ["co-price", "jy-price1"];
  const SHARED_DEPOSIT_PCT_FIELDS = ["jy-deposit1"];
  const SHARED_LOAN_FIELDS = ["co-loan", "mg-loan"];
  const SHARED_RATE_FIELDS = ["in-rate", "jy-rate1", "mg-rate", "bp-rate"];

  let sharedProperty = { price: null, depositPct: null, loanAmount: null, rate: null };

  function saveSharedProperty() {
    try { localStorage.setItem("property-planner-shared-v1", JSON.stringify(sharedProperty)); } catch (e) {}
  }
  function loadSharedProperty() {
    try {
      const raw = localStorage.getItem("property-planner-shared-v1");
      if (raw) sharedProperty = JSON.parse(raw);
    } catch (e) { /* ignore malformed state */ }
  }

  function propagateShared(sourceId) {
    SHARED_PRICE_FIELDS.forEach((id) => {
      if (id === sourceId || sharedProperty.price == null) return;
      const el = document.getElementById(id);
      if (el) el.value = Math.round(sharedProperty.price).toLocaleString("en-AU");
    });
    SHARED_DEPOSIT_PCT_FIELDS.forEach((id) => {
      if (id === sourceId || sharedProperty.depositPct == null) return;
      const el = document.getElementById(id);
      if (el) el.value = Math.round(sharedProperty.depositPct * 100) / 100;
    });
    SHARED_LOAN_FIELDS.forEach((id) => {
      if (id === sourceId || sharedProperty.loanAmount == null) return;
      const el = document.getElementById(id);
      if (el) el.value = Math.round(sharedProperty.loanAmount).toLocaleString("en-AU");
    });
    SHARED_RATE_FIELDS.forEach((id) => {
      if (id === sourceId || sharedProperty.rate == null) return;
      const el = document.getElementById(id);
      if (el) el.value = sharedProperty.rate;
    });
    saveSharedProperty();
    saveState();
  }

  function onSharedPriceInput(sourceId) {
    const val = parseNum(document.getElementById(sourceId).value);
    if (val <= 0) return;
    sharedProperty.price = val;
    if (sharedProperty.depositPct != null) {
      sharedProperty.loanAmount = val * (1 - sharedProperty.depositPct / 100);
    } else if (sharedProperty.loanAmount != null) {
      sharedProperty.depositPct = Math.max(0, Math.min(100, (1 - sharedProperty.loanAmount / val) * 100));
    }
    propagateShared(sourceId);
  }
  function onSharedDepositPctInput(sourceId) {
    const val = parseNum(document.getElementById(sourceId).value);
    sharedProperty.depositPct = val;
    if (sharedProperty.price != null) {
      sharedProperty.loanAmount = sharedProperty.price * (1 - val / 100);
    }
    propagateShared(sourceId);
  }
  function onSharedLoanInput(sourceId) {
    const val = parseNum(document.getElementById(sourceId).value);
    if (val <= 0) return;
    sharedProperty.loanAmount = val;
    if (sharedProperty.price != null && sharedProperty.price > 0) {
      sharedProperty.depositPct = Math.max(0, Math.min(100, (1 - val / sharedProperty.price) * 100));
    }
    propagateShared(sourceId);
  }
  function onSharedRateInput(sourceId) {
    const val = parseNum(document.getElementById(sourceId).value);
    if (val <= 0) return;
    sharedProperty.rate = val;
    propagateShared(sourceId);
  }

  function wireSharedField(id, handler) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("blur", () => handler(id));
  }
  SHARED_PRICE_FIELDS.forEach((id) => wireSharedField(id, onSharedPriceInput));
  SHARED_DEPOSIT_PCT_FIELDS.forEach((id) => wireSharedField(id, onSharedDepositPctInput));
  SHARED_LOAN_FIELDS.forEach((id) => wireSharedField(id, onSharedLoanInput));
  SHARED_RATE_FIELDS.forEach((id) => wireSharedField(id, onSharedRateInput));

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

  // Buyer's agent toggle shows/hides the fee row
  document.getElementById("co-buyers-agent").addEventListener("change", (e) => {
    document.getElementById("co-buyers-agent-fee-row").classList.toggle("hidden", !e.target.checked);
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
  let lastJourneyProjection = null;
  let lastProperty2BorrowResult = null;

  document.getElementById("bp-joint").addEventListener("change", (e) => {
    document.getElementById("bp-partner-group").classList.toggle("hidden", !e.target.checked);
    saveState();
  });

  document.getElementById("bp-calc").addEventListener("click", () => {
    const grossSalaryAnnual = parseNum(document.getElementById("bp-salary").value);
    if (grossSalaryAnnual <= 0) {
      alert("Enter your gross salary first.");
      return;
    }
    const isInvestmentPurchase = document.getElementById("bp-is-investment").checked;
    const isJoint = document.getElementById("bp-joint").checked;
    const partner2Salary = parseNum(document.getElementById("bp2-salary").value);
    const result = C.borrowingPower({
      grossSalaryAnnual,
      otherIncomeAnnual: parseNum(document.getElementById("bp-other-income").value),
      isInvestmentPurchase,
      rentalIncomeWeekly: isInvestmentPurchase ? parseNum(document.getElementById("bp-rent").value) : 0,
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
      partner2: isJoint && partner2Salary > 0 ? {
        grossSalaryAnnual: partner2Salary,
        otherIncomeAnnual: parseNum(document.getElementById("bp2-other-income").value),
        hasHecsDebt: document.getElementById("bp2-hecs").checked,
      } : null,
    });
    lastBorrowingPowerResult = result;

    // Persist gross salary/other income (deliberately excluding rental — see
    // MORTGAGE_STRESS_BANDS comment), combining both incomes for a joint
    // application, so other screens can stress-test whatever loan amount
    // they're looking at against real household income.
    const combinedGrossIncome = grossSalaryAnnual + parseNum(document.getElementById("bp-other-income").value)
      + (isJoint ? partner2Salary + parseNum(document.getElementById("bp2-other-income").value) : 0);
    try {
      localStorage.setItem("property-planner-gross-income-v1", JSON.stringify({ grossAnnualIncome: combinedGrossIncome }));
    } catch (e) {}

    document.getElementById("bp-max-loan").textContent = fmt$(result.maxLoan);
    const incomeRows = [["Your net income", result.netEmploymentIncome, false]];
    if (isJoint && result.partner2NetEmploymentIncome > 0) {
      incomeRows.push(["Partner's net income", result.partner2NetEmploymentIncome, false]);
    }
    if (result.shadedRentalAnnual > 0) {
      incomeRows.push(["Shaded rental income", result.shadedRentalAnnual, false]);
    }
    document.getElementById("bp-breakdown").innerHTML =
      breakdownRows(incomeRows) +
      breakdownRows([
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
  // Compares what's left over in cash against a commonly-cited emergency
  // buffer starting point, and renders a note into the given container if
  // it falls short — separate from (and in addition to) the main status banner.
  // Live "≈ $X" readout under a percentage field, so entering e.g. 12%
  // deposit immediately shows what that actually means in dollars against
  // the current price — updates as either field is typed into, no need to
  // press Calculate first.
  function wireLiveDollarReadout(priceFieldId, pctFieldId, labelElId) {
    const priceEl = document.getElementById(priceFieldId);
    const pctEl = document.getElementById(pctFieldId);
    const labelEl = document.getElementById(labelElId);
    if (!priceEl || !pctEl || !labelEl) return;
    function update() {
      const price = parseNum(priceEl.value);
      const pct = parseNum(pctEl.value);
      labelEl.textContent = price > 0 && pct >= 0 ? `≈ ${fmt$((price * pct) / 100)}` : "";
    }
    priceEl.addEventListener("input", update);
    pctEl.addEventListener("input", update);
    update();
  }

  // Wires a "% of price" / "Flat $" mode toggle for a fee: shows/hides the
  // right input and keeps the live dollar readout in sync when in % mode.
  function wireFeeModeToggle({ modeId, priceFieldId, pctFieldId, pctRowId, flatRowId, dollarLabelId }) {
    const modeEl = document.getElementById(modeId);
    if (!modeEl) return;
    modeEl.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;
      const isFlat = btn.dataset.val === "flat";
      document.getElementById(pctRowId).classList.toggle("hidden", isFlat);
      document.getElementById(flatRowId).classList.toggle("hidden", !isFlat);
    });
    wireLiveDollarReadout(priceFieldId, pctFieldId, dollarLabelId);
  }

  function getFeeModeDollarAmount({ modeId, price, pctFieldId, flatFieldId }) {
    const mode = segVal(modeId);
    if (mode === "flat") return parseNum(document.getElementById(flatFieldId).value);
    return (price * (parseNum(document.getElementById(pctFieldId).value) || 0)) / 100;
  }

  // Compares what's left over in cash against a commonly-cited emergency
  // buffer starting point, and renders a note into the given container if
  // it falls short — separate from (and in addition to) the main status banner.
  function renderBufferNote(containerId, remainingCash) {
    const el = document.getElementById(containerId);
    if (!el) return;
    const target = R.RECOMMENDED_EMERGENCY_BUFFER;
    if (remainingCash >= target) {
      el.innerHTML = "";
      return;
    }
    const shortBy = target - Math.max(remainingCash, 0);
    el.innerHTML = `<div class="info-note"><span class="dot"></span><span>Beyond your purchase costs, financial advisors commonly suggest keeping a cash buffer of around ${fmt$(target)} for one investment property — for vacancies, rate rises or unexpected repairs. On these numbers you'd have ${fmt$(Math.max(remainingCash, 0))} left, ${fmt$(shortBy)} short of that. Consider a smaller purchase, a bigger deposit, or building this buffer before you commit.</span></div>`;
  }

  // Reads the gross income last entered on the Afford tab's borrowing-power
  // panel (if any), so other screens can stress-test a specific repayment
  // against real income without asking for it again.
  function getKnownGrossIncome() {
    try {
      const raw = localStorage.getItem("property-planner-gross-income-v1");
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed.grossAnnualIncome > 0 ? parsed.grossAnnualIncome : null;
    } catch (e) { return null; }
  }

  // Renders a mortgage-stress banner (repayment vs the 30%-of-gross-income
  // benchmark) into the given container, or a neutral prompt if no income
  // has been entered anywhere yet.
  function renderStressBanner(containerId, annualRepayment) {
    const el = document.getElementById(containerId);
    if (!el) return;
    const grossIncome = getKnownGrossIncome();
    if (!grossIncome) {
      el.innerHTML = `<div class="info-note"><span class="dot"></span><span>Enter your income on the Afford tab's "Estimate it from my income" panel to see whether this repayment fits your budget.</span></div>`;
      return;
    }
    const pct = (annualRepayment / grossIncome) * 100;
    const band = R.mortgageStressBand(pct);
    el.innerHTML = `<div class="status-banner ${band.tier}">${pct.toFixed(0)}% of your gross income — ${band.label}</div>`;
  }

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
    const afLvrBand = R.lvrBand(b.lvr * 100);
    document.getElementById("af-caption").innerHTML =
      `Based on a ${fmt$(maxLoanAmount)} loan and ${fmt$(availableCash)} in savings, in ${state} <span class="badge-pill ${afLvrBand.tier}">${(b.lvr * 100).toFixed(0)}% LVR — ${afLvrBand.label}</span>`;

    renderLedgerBar(document.getElementById("af-ledger-bar"), {
      loanAmount: b.loanAmount,
      price: b.price,
      costsTotal: b.stampDuty + b.lmi + b.otherCostsTotal,
    });

    document.getElementById("af-breakdown").innerHTML =
      breakdownRows([
        ["Maximum loan", b.loanAmount, false],
        ["Deposit / cash used", b.deposit, false],
        ["Stamp duty", -b.stampDuty, true],
        ["LMI", -b.lmi, true],
      ]) +
      breakdownRowWithCaption("Other purchase costs", -b.otherCostsTotal, OTHER_PURCHASE_COSTS_CAPTION) +
      breakdownRows([["Maximum property price", result.maxPrice, false, true]]);

    const statusEl = document.getElementById("af-status");
    if (keepCashBuffer > 0) {
      statusEl.className = "status-banner neutral";
      statusEl.textContent = `Keeping a ${fmt$(keepCashBuffer)} buffer untouched. ${fmt$(Math.max(result.remainingCash,0))} spare after all costs.`;
    } else {
      statusEl.className = "status-banner positive";
      statusEl.textContent = `${fmt$(Math.max(result.remainingCash, 0))} left over in savings after all upfront costs.`;
    }
    renderBufferNote("af-buffer-note", result.remainingCash);

    if (!suppressDashboardUpdate) {
      dashboardSummary.afford = { headline: fmt$(result.maxPrice), sub: `${fmt$(maxLoanAmount)} loan + ${fmt$(availableCash)} savings, in ${state}` };
      saveDashboardSummary();
      renderHomeCards();
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

  // Single breakdown row with a small caption line under the label,
  // explaining what a composite/catch-all figure actually includes.
  function breakdownRowWithCaption(label, amount, caption, isTotal) {
    const cls = isTotal ? "breakdown-row total" : "breakdown-row";
    const amtCls = amount < 0 ? "amount negative" : "amount";
    return `<div class="${cls}"><span>${linkTerms(label)}<div class="breakdown-row-caption">${caption}</div></span><span class="${amtCls} tabular">${fmt$signed(amount)}</span></div>`;
  }

  const OTHER_PURCHASE_COSTS_CAPTION = "Conveyancing, building &amp; pest inspection, loan fees, registration &amp; moving costs";
  const MISC_FEES_CAPTION = "Catch-all for anything not itemised elsewhere — e.g. connection fees or last-minute adjustments";

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

  function runMortgageCalc(showAlertIfEmpty) {
    const loanAmount = parseNum(document.getElementById("mg-loan").value);
    const annualRatePct = parseNum(document.getElementById("mg-rate").value) || 6;
    const termYears = parseNum(document.getElementById("mg-term").value) || 30;
    const repaymentType = segVal("mg-type");
    const frequency = segVal("mg-freq");
    const extraPerPeriod = parseNum(document.getElementById("mg-extra").value);
    const offsetBalance = parseNum(document.getElementById("mg-offset").value);

    if (loanAmount <= 0) {
      if (showAlertIfEmpty) alert("Enter a loan amount first.");
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

    const annualRepayment = (result.repaymentPerPeriod + (result.extraPerPeriod || 0)) * C.FREQUENCIES[frequency];
    renderStressBanner("mg-stress-banner", annualRepayment);

    document.getElementById("mg-results").classList.remove("hidden");
    saveState();
  }

  document.getElementById("mg-calc").addEventListener("click", () => runMortgageCalc(true));

  // Quick lookup: recalculates live as you type the loan amount, rate or
  // term — no need to press Calculate just to see the repayment.
  ["mg-loan", "mg-rate", "mg-term"].forEach((id) => {
    document.getElementById(id).addEventListener("input", () => runMortgageCalc(false));
  });
  document.querySelectorAll("#mg-type, #mg-freq").forEach((seg) => {
    seg.addEventListener("click", () => runMortgageCalc(false));
  });

  // ---------------------------------------------------------------------
  // COSTS tab (merged with investment analysis — see "Is this an investment?" toggle)
  // ---------------------------------------------------------------------
  let lastCostsResult = null;
  let lastInvestResult = null;
  let activeScenario = "lower";

  function toggleInvestmentMode() {
    const isInvestment = document.getElementById("co-is-investment").checked;
    document.getElementById("co-investment-inputs").classList.toggle("hidden", !isInvestment);
    document.getElementById("co-noninvestment-inputs").classList.toggle("hidden", isInvestment);
  }
  document.getElementById("co-is-investment").addEventListener("change", () => {
    toggleInvestmentMode();
    saveState();
  });

  document.getElementById("in-scenario-toggle").addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    document.querySelectorAll("#in-scenario-toggle button").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    activeScenario = btn.dataset.val;
    if (lastInvestResult) renderInvestScenario();
  });

  document.getElementById("co-capital-toggle").addEventListener("click", () => {
    const el = document.getElementById("co-breakdown");
    const btn = document.getElementById("co-capital-toggle");
    const isHidden = el.classList.contains("hidden");
    el.classList.toggle("hidden", !isHidden);
    btn.textContent = isHidden ? "Hide calculation ⌄" : "Show calculation ›";
  });

  document.getElementById("co-calc").addEventListener("click", () => {
    const price = parseNum(document.getElementById("co-price").value);
    const loanAmount = parseNum(document.getElementById("co-loan").value);
    const availableCash = parseNum(document.getElementById("co-cash").value);
    const state = selectedState.co;
    const isFirstHomeBuyer = document.getElementById("co-fhb").checked;
    const lmiWaived = isFirstHomeBuyer && document.getElementById("co-lmi-waived").checked;
    const buyersAgentFee = document.getElementById("co-buyers-agent").checked
      ? getFeeModeDollarAmount({ modeId: "co-buyers-agent-mode", price, pctFieldId: "co-buyers-agent-pct", flatFieldId: "co-buyers-agent-flat" })
      : 0;
    const renovationCost = parseNum(document.getElementById("in-reno").value);
    const D = R.DEFAULT_INVESTMENT;
    const miscFees = parseNum(document.getElementById("in-misc").value) || D.miscFees;
    const isInvestment = document.getElementById("co-is-investment").checked;

    if (price <= 0) {
      alert("Enter a property price first.");
      return;
    }

    let totalCashRequired, breakdownRowsHtml, lvrFraction, headline, sub;

    if (isInvestment) {
      const depositPct = price > 0 ? Math.max(0, (1 - loanAmount / price) * 100) : 20;
      const result = C.investmentAnalysis({
        price,
        depositPct,
        state,
        annualRatePct: parseNum(document.getElementById("in-rate").value) || 6.5,
        loanTermYears: parseNum(document.getElementById("in-term").value) || 30,
        offsetBalance: parseNum(document.getElementById("in-offset").value),
        renovationCost,
        miscFees,
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
        buyersAgentFee,
      });
      lastInvestResult = result;
      totalCashRequired = result.totalCapitalRequired;
      lvrFraction = result.loanAmount / result.price;

      const capitalRows = [
        ["Deposit", result.deposit, false],
        ["Stamp duty", -result.stampDuty, true],
        ["LMI", -result.lmi, true],
      ];
      if (buyersAgentFee > 0) capitalRows.push(["Buyer's agent fee", -buyersAgentFee, true]);
      if (result.renovationCost > 0) capitalRows.push(["Renovation", -result.renovationCost, true]);
      let html = breakdownRows(capitalRows);
      if (result.miscFees > 0) html += breakdownRowWithCaption("Misc fees", -result.miscFees, MISC_FEES_CAPTION);
      html += breakdownRowWithCaption("Other purchase costs", -(result.otherUpfrontTotal - buyersAgentFee), OTHER_PURCHASE_COSTS_CAPTION);
      html += breakdownRows([["Total cash required", result.totalCapitalRequired, false, true]]);
      breakdownRowsHtml = html;

      document.getElementById("in-tag-lower").textContent = `${fmt$(result.lower.rentWeekly)}/wk`;
      document.getElementById("in-tag-higher").textContent = `${fmt$(result.higher.rentWeekly)}/wk`;
      document.getElementById("in-growth-breakdown").innerHTML = breakdownRows([
        ["Purchase price today", result.price, false],
        [`5-year estimate (${result.growth.cagr}% p.a.)`, result.growth.value5yr, false],
        [`10-year estimate (${result.growth.cagr}% p.a.)`, result.growth.value10yr, false, true],
      ]);
      renderInvestScenario();
      document.getElementById("co-investment-results").classList.remove("hidden");
      document.getElementById("co-ongoing-results").classList.add("hidden");

      const s = result[activeScenario];
      const verdict = s.cashflowBeforeTaxAnnual >= 0 ? "Positively geared" : "Costs you out of pocket";
      headline = fmt$(totalCashRequired);
      sub = `${s.yieldPct.toFixed(2)}% yield · ${verdict}`;
    } else {
      const b = C.upfrontCosts({ state, price, isFirstHomeBuyer, loanAmount, lmiWaived, buyersAgentFee, renovationCost, miscFees });
      lastCostsResult = { price, loanAmount, state, isFirstHomeBuyer, lmiWaived, availableCash };
      totalCashRequired = b.totalCashRequired;
      lvrFraction = b.lvr;

      const rows = [
        ["Deposit", b.deposit, false],
        ["Stamp duty", -b.stampDuty, true],
        ["LMI", -b.lmi, true],
      ];
      if (buyersAgentFee > 0) rows.push(["Buyer's agent fee", -buyersAgentFee, true]);
      if (renovationCost > 0) rows.push(["Renovation", -renovationCost, true]);
      let html = breakdownRows(rows);
      if (miscFees > 0) html += breakdownRowWithCaption("Misc fees", -miscFees, MISC_FEES_CAPTION);
      html += breakdownRowWithCaption("Other purchase costs", -(b.otherCostsTotal - buyersAgentFee), OTHER_PURCHASE_COSTS_CAPTION);
      html += breakdownRows([["Total cash required", b.totalCashRequired, false, true]]);
      breakdownRowsHtml = html;

      document.getElementById("co-investment-results").classList.add("hidden");
      document.getElementById("co-ongoing-results").classList.remove("hidden");
      document.getElementById("co-ongoing-breakdown").classList.add("hidden");

      headline = fmt$(totalCashRequired);
      sub = `Total cash needed for a ${fmt$(price)} property, in ${state}`;
    }

    document.getElementById("co-total").textContent = fmt$(totalCashRequired);
    const coLvrBand = R.lvrBand(lvrFraction * 100);
    document.getElementById("co-caption").innerHTML = `on top of your loan <span class="badge-pill ${coLvrBand.tier}">${(lvrFraction * 100).toFixed(0)}% LVR — ${coLvrBand.label}</span>`;
    document.getElementById("co-breakdown").innerHTML = breakdownRowsHtml;

    const statusEl = document.getElementById("co-status");
    if (availableCash > 0) {
      const surplus = availableCash - totalCashRequired;
      const stillAffordable = surplus >= 0;
      if (stillAffordable) {
        statusEl.className = "status-banner positive";
        statusEl.textContent = `✅ You can afford this — ${fmt$(surplus)} left over.`;
      } else {
        statusEl.className = "status-banner negative";
        statusEl.textContent = `❌ You're short by ${fmt$(-surplus)}.`;
      }
      document.getElementById("co-status-wrap").classList.remove("hidden");
      if (stillAffordable) {
        renderBufferNote("co-buffer-note", surplus);
      } else {
        document.getElementById("co-buffer-note").innerHTML = "";
      }
    } else {
      document.getElementById("co-status-wrap").classList.add("hidden");
      document.getElementById("co-buffer-note").innerHTML = "";
    }

    document.getElementById("co-results").classList.remove("hidden");

    if (!suppressDashboardUpdate) {
      dashboardSummary.property = { headline, sub };
      saveDashboardSummary();
      renderHomeCards();
    }

    saveState();
  });

  document.getElementById("co-ongoing-calc").addEventListener("click", () => {
    if (!lastCostsResult) return;
    const council = parseNum(document.getElementById("co-ong-council").value) || R.DEFAULT_ONGOING_MONTHLY.councilRates;
    const water = parseNum(document.getElementById("co-ong-water").value) || R.DEFAULT_ONGOING_MONTHLY.waterRates;
    const insurance = parseNum(document.getElementById("co-ong-insurance").value) || R.DEFAULT_ONGOING_MONTHLY.homeInsurance;
    const strata = parseNum(document.getElementById("co-ong-strata").value);
    const maintenance = parseNum(document.getElementById("co-ong-maint").value) || R.DEFAULT_ONGOING_MONTHLY.maintenance;

    const rateInput = parseNum(document.getElementById("in-rate").value) || 6;
    const termInput = parseNum(document.getElementById("in-term").value) || 30;
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

  function renderInvestScenario() {
    const s = lastInvestResult[activeScenario];
    const r = lastInvestResult;

    const band = R.yieldBand(s.yieldPct);
    document.getElementById("in-yield-breakdown").innerHTML =
      breakdownRows([["Gross rent (annual)", s.grossRentAnnual, false]]) +
      `<div class="breakdown-row total"><span class="term-link" data-term="yield">Yield on purchase</span><span class="amount tabular">${s.yieldPct.toFixed(2)}% <span class="badge-pill ${band.tier}">${band.label}</span></span></div>`;

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
  // EXIT ESTIMATE (inside the merged Property tab, investment mode) —
  // capital gains tax on eventual sale
  // ---------------------------------------------------------------------
  document.getElementById("ex-calc").addEventListener("click", () => {
    if (!lastInvestResult) {
      alert("Calculate the investment cashflow above first.");
      return;
    }
    const price = parseNum(document.getElementById("co-price").value);
    const loanAmount = parseNum(document.getElementById("co-loan").value);
    const depositPct = price > 0 ? Math.max(0, (1 - loanAmount / price) * 100) : 20;
    const annualRatePct = parseNum(document.getElementById("in-rate").value) || 6.5;
    const loanTermYears = parseNum(document.getElementById("in-term").value) || 30;
    const isNewBuild = segVal("in-property-type") === "new";
    const taxRatePct = parseNum(document.getElementById("in-tax-rate").value) || 32.5;

    const result = C.exitEstimate({
      price,
      depositPct,
      annualRatePct,
      loanTermYears,
      stampDuty: lastInvestResult.stampDuty,
      otherAcquisitionCosts: lastInvestResult.otherUpfrontTotal,
      growthCagrPct: parseNum(document.getElementById("in-growth").value) || 5,
      yearsHeld: parseNum(document.getElementById("ex-years").value) || 10,
      agentCommissionPct: parseNum(document.getElementById("ex-commission").value) || 2.5,
      legalMarketingFlat: parseNum(document.getElementById("ex-legal").value) || 1500,
      taxRatePct,
      assumedCpiPct: parseNum(document.getElementById("ex-cpi").value) || 2.5,
      isNewBuild,
    });

    document.getElementById("ex-net-proceeds").textContent = fmt$(result.netProceedsAfterSaleLoanAndTax);
    document.getElementById("ex-caption").textContent = `Selling at ${fmt$(result.salePrice)} after ${document.getElementById("ex-years").value || 10} years`;

    document.getElementById("ex-breakdown").innerHTML = breakdownRows([
      ["Estimated sale price", result.salePrice, false],
      ["Selling costs", -result.sellingCostsTotal, true],
      ["Remaining loan balance", -result.loanBalanceAtSale, true],
      ["Capital gains tax", -result.cgtPayable, true],
      ["Net proceeds", result.netProceedsAfterSaleLoanAndTax, false, true],
    ]);

    const methodNote = isNewBuild
      ? `As a new build, you can choose the cheaper method when you sell — on these numbers that's the ${result.methodUsed} method: ${fmt$(result.cgtPayable)} in CGT.`
      : `As an established property bought now, gains from 1 July 2027 are locked into the indexation method: ${fmt$(result.cgtPayable)} in CGT, using a ${document.getElementById("ex-cpi").value || 2.5}% inflation assumption and a 30% minimum tax rate on the real gain.`;
    document.getElementById("ex-method-note").textContent = methodNote;

    document.getElementById("ex-results").classList.remove("hidden");
    saveState();
  });

  // ---------------------------------------------------------------------
  // JOURNEY tab
  // ---------------------------------------------------------------------
  // Property 2 borrowing capacity estimator — reuses the same joint
  // borrowing-power engine as the Afford tab, crediting Property 1's
  // projected rent at that year as additional serviceable income.
  const jy2ToggleRow = document.getElementById("jy2-borrow-toggle-row");
  const jy2Panel = document.getElementById("jy2-borrow-panel");
  const jy2Chevron = document.getElementById("jy2-borrow-chevron");
  jy2ToggleRow.addEventListener("click", () => {
    const isHidden = jy2Panel.classList.contains("hidden");
    jy2Panel.classList.toggle("hidden");
    jy2Chevron.textContent = isHidden ? "⌄" : "›";
  });
  document.getElementById("jy2-joint").addEventListener("change", (e) => {
    document.getElementById("jy2-partner-row").classList.toggle("hidden", !e.target.checked);
    saveState();
  });
  document.getElementById("jy2-rent-credit").addEventListener("change", saveState);

  document.getElementById("jy2-borrow-calc").addEventListener("click", () => {
    const salary = parseNum(document.getElementById("jy2-salary").value);
    if (salary <= 0) {
      alert("Enter your projected salary first.");
      return;
    }
    const isJoint = document.getElementById("jy2-joint").checked;
    const partnerSalary = parseNum(document.getElementById("jy2-partner-salary").value);
    const useRentCredit = document.getElementById("jy2-rent-credit").checked;
    const rentShade = parseNum(document.getElementById("jy2-rent-shade").value) || 70;

    // Project Property 1's rent forward to the purchase year, using the
    // journey's own rent figures if already calculated, else the raw inputs.
    const yearsUntil = parseNum(document.getElementById("jy-years").value) || 5;
    const rentWeekly1 = parseNum(document.getElementById("jy-rent1").value) || 0;
    const rentGrowth1 = parseNum(document.getElementById("jy-rent-growth1").value) || 0;
    const projectedRentWeekly = rentWeekly1 * Math.pow(1 + rentGrowth1 / 100, yearsUntil);

    const result = C.borrowingPower({
      grossSalaryAnnual: salary,
      isInvestmentPurchase: false,
      rentalIncomeWeekly: useRentCredit ? projectedRentWeekly : 0,
      rentalIncomeShadePct: rentShade,
      hasHecsDebt: false,
      dependents: 0,
      livingExpensesMonthly: null,
      creditCardLimitsTotal: 0,
      personalLoanMonthly: 0,
      otherLoanRepaymentsMonthly: 0,
      existingLoanBalancesTotal: 0,
      annualRatePct: parseNum(document.getElementById("jy-rate1").value) || 6.5,
      termYears: 30,
      partner2: isJoint && partnerSalary > 0 ? { grossSalaryAnnual: partnerSalary, otherIncomeAnnual: 0, hasHecsDebt: false } : null,
    });
    // Rental income doesn't run through investmentAnalysis here (this is a
    // quick capacity estimate, not full serviceability) — add it as rough
    // shaded income on top by re-deriving surplus with it credited.
    lastProperty2BorrowResult = result;

    document.getElementById("jy2-max-loan").textContent = fmt$(result.maxLoan);
    const rows = [["Your net income", result.netEmploymentIncome, false]];
    if (isJoint && result.partner2NetEmploymentIncome > 0) rows.push(["Partner's net income", result.partner2NetEmploymentIncome, false]);
    if (useRentCredit && projectedRentWeekly > 0) rows.push([`Property 1 rent credit (${rentShade}% of ${fmt$(projectedRentWeekly)}/wk)`, projectedRentWeekly * 52 * (rentShade / 100), false]);
    rows.push(["Living expenses", -result.livingExpenses * 12, true]);
    document.getElementById("jy2-borrow-breakdown").innerHTML = breakdownRows(rows);
    document.getElementById("jy2-borrow-results").classList.remove("hidden");
  });

  document.getElementById("jy2-borrow-use").addEventListener("click", () => {
    if (!lastProperty2BorrowResult) return;
    document.getElementById("jy-loan2").value = lastProperty2BorrowResult.maxLoan.toLocaleString("en-AU");
    saveState();
  });

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

    // 10-year projection — uses default expense assumptions (this is a
    // planning-level view, not a full itemised cost breakdown; that's what
    // the This Property tab is for) so the person only needs to enter price,
    // rent and loan terms here, not every expense line again.
    const D = R.DEFAULT_INVESTMENT;
    const rentWeekly1 = parseNum(document.getElementById("jy-rent1").value) || 0;
    const rentGrowth1 = parseNum(document.getElementById("jy-rent-growth1").value) || 0;
    const extraYou = parseNum(document.getElementById("jy-extra-you").value);
    const extraPartner = parseNum(document.getElementById("jy-extra-partner").value);
    const combinedExtra = extraYou + extraPartner;
    const rate1 = parseNum(document.getElementById("jy-rate1").value) || 6.5;
    const term1 = parseNum(document.getElementById("jy-term1").value) || 30;
    const deposit1Pct = parseNum(document.getElementById("jy-deposit1").value) || 20;

    let fixedAnnualExpensesEst = 0;
    if (rentWeekly1 > 0) {
      const est = C.investmentAnalysis({
        price: price1, depositPct: deposit1Pct, state: selectedState.jy, annualRatePct: rate1, loanTermYears: term1,
        offsetBalance: 0, renovationCost: 0, miscFees: 0,
        buildingInsuranceAnnual: D.buildingInsuranceAnnual, landlordInsuranceAnnual: D.landlordInsuranceAnnual,
        propertyMgmtPct: D.propertyMgmtPct, leasingFeeAnnual: D.leasingFeeAnnual, vacancyWeeks: D.vacancyWeeks,
        landTaxAnnual: D.landTaxAnnual, stratLeviesMonthly: D.stratLeviesMonthly, maintenanceMonthly: D.maintenanceMonthly,
        otherExpensesAnnual: D.otherExpensesAnnual, lowerRentWeekly: rentWeekly1, higherRentWeekly: rentWeekly1,
        taxRatePct: D.taxRatePct, depreciationAnnual: 0, growthCagrPct: parseNum(document.getElementById("jy-growth1").value) || 6,
        negativeGearingQuarantined: false, buyersAgentFee: 0,
      });
      fixedAnnualExpensesEst = est.fixedAnnualExpenses;
    }

    const projection = C.tenYearProjection({
      price: price1, depositPct: deposit1Pct, annualRatePct: rate1, termYears: term1,
      growthCagrPct: parseNum(document.getElementById("jy-growth1").value) || 6,
      rentWeekly: rentWeekly1, rentGrowthPct: rentGrowth1,
      combinedMonthlyContribution: combinedExtra, fixedAnnualExpenses: fixedAnnualExpensesEst,
    });
    lastJourneyProjection = projection;

    const milestoneYears = [5, 7, 10];
    document.getElementById("jy-projection-cards").innerHTML = milestoneYears.map((yr) => {
      const row = projection.years[yr];
      return `
        <div class="compare-card">
          <div class="compare-card-header">
            <div class="compare-card-title">Year ${yr}</div>
          </div>
          <div class="compare-grid">
            <div><div class="compare-stat-label">Property value</div><div class="compare-stat-value">${fmt$(row.propertyValue)}</div></div>
            <div><div class="compare-stat-label">Loan balance</div><div class="compare-stat-value">${fmt$(row.loanBalanceMin)}</div></div>
            <div><div class="compare-stat-label">Usable equity</div><div class="compare-stat-value positive">${fmt$(row.usableEquity)}</div></div>
            <div><div class="compare-stat-label">Weekly rent</div><div class="compare-stat-value">${fmt$(row.weeklyRent)}</div></div>
          </div>
        </div>`;
    }).join("");

    if (combinedExtra > 0) {
      document.getElementById("jy-extra-repay-summary").innerHTML = `
        <div class="info-note">
          <span class="dot"></span>
          <span>Paying ${fmt$(combinedExtra)}/month combined (vs the ${fmt$(projection.minRepaymentMonthly)} minimum) would pay off Property 1's loan in about <strong>${projection.payoffYearsExtra.toFixed(1)} years</strong> instead of ${term1}, saving roughly <strong>${fmt$(projection.interestSaved)}</strong> in interest.</span>
        </div>`;
    } else {
      document.getElementById("jy-extra-repay-summary").innerHTML = "";
    }

    document.getElementById("jy-deposit2").textContent = fmt$(y.totalDepositAvailable);

    const p2 = result.property2;
    const p2LvrBand = R.lvrBand(p2.breakdown.lvr * 100);
    document.getElementById("jy-property2-breakdown").innerHTML =
      breakdownRows([
        ["Usable equity from Property 1", y.usableEquity, false],
        ["Additional savings", y.additionalSavingsByThen, false],
        ["Borrowing capacity (entered)", p2.breakdown.loanAmount, false],
        ["Stamp duty", -p2.breakdown.stampDuty, true],
        ["LMI", -p2.breakdown.lmi, true],
      ]) +
      breakdownRowWithCaption("Other purchase costs", -p2.breakdown.otherCostsTotal, OTHER_PURCHASE_COSTS_CAPTION) +
      breakdownRows([["Maximum price for Property 2", p2.maxPrice, false, true]]) +
      `<div class="breakdown-row"><span>Loan-to-value ratio</span><span class="amount"><span class="badge-pill ${p2LvrBand.tier}">${(p2.breakdown.lvr * 100).toFixed(0)}% LVR — ${p2LvrBand.label}</span></span></div>`;
    renderBufferNote("jy-buffer-note", p2.remainingCash);

    // Sell vs Keep — compares selling Property 1 outright at Year N against
    // the equity-release approach already computed above, at the same year.
    document.getElementById("jy-sellkeep-year").textContent = y.years;
    const isNewBuild1 = false; // Journey's Property 1 doesn't collect this — established is the conservative default for CGT
    const sellResult = C.exitEstimate({
      price: price1, depositPct: deposit1Pct, annualRatePct: rate1, loanTermYears: term1,
      stampDuty: R.stampDuty(selectedState.jy, price1, false), otherAcquisitionCosts: 4650,
      growthCagrPct: parseNum(document.getElementById("jy-growth1").value) || 6, yearsHeld: y.years,
      agentCommissionPct: 2.5, legalMarketingFlat: 1500, taxRatePct: D.taxRatePct, assumedCpiPct: 2.5,
      isNewBuild: isNewBuild1,
    });
    const nextStampDuty = R.stampDuty(selectedState.jy, p2.maxPrice, false);
    const sellAvailableDeposit = Math.max(sellResult.netProceedsAfterSaleLoanAndTax - nextStampDuty, 0);
    document.getElementById("jy-sell-breakdown").innerHTML = breakdownRows([
      ["Estimated sale price", sellResult.salePrice, false],
      ["Selling costs", -sellResult.sellingCostsTotal, true],
      ["Remaining loan", -sellResult.loanBalanceAtSale, true],
      ["Capital gains tax", -sellResult.cgtPayable, true],
      ["Net proceeds", sellResult.netProceedsAfterSaleLoanAndTax, false],
      [`Stamp duty on Property 2 (${selectedState.jy})`, -nextStampDuty, true],
      ["Available for Property 2 deposit", sellAvailableDeposit, false, true],
    ]);

    document.getElementById("jy-keep-breakdown").innerHTML = breakdownRows([
      [`Property 1 value at Year ${y.years}`, y.value, false],
      ["Remaining loan", -y.loanBalance, true],
      [`Usable equity released (${document.getElementById("jy-equity-lvr").value || 80}% LVR)`, y.usableEquity, false],
      ["Plus additional savings", y.additionalSavingsByThen, false],
      ["Available for Property 2 deposit", y.totalDepositAvailable, false, true],
    ]);

    const verdictEl = document.getElementById("jy-sellkeep-verdict");
    const kept1FutureValue = price1 * Math.pow(1 + (parseNum(document.getElementById("jy-growth1").value) || 6) / 100, 10);
    const keepCombinedWealthYr10 = (kept1FutureValue - C.loanBalanceAfterYears(result.property1.loan, rate1, term1, 10)) + p2.maxPrice;
    const sellCombinedWealthYr10 = p2.maxPrice; // no Property 1 left, just whatever Property 2 becomes
    verdictEl.className = "status-banner neutral";
    verdictEl.textContent = sellAvailableDeposit > y.totalDepositAvailable
      ? `Selling gives you ${fmt$(sellAvailableDeposit - y.totalDepositAvailable)} more deposit right now — but keeping means you'd still own Property 1, which by Year 10 could be worth roughly ${fmt$(kept1FutureValue)} in its own right. There's no single right answer here — it depends how much you value the bigger deposit now against staying invested.`
      : `Keeping gives you ${fmt$(y.totalDepositAvailable - sellAvailableDeposit)} more deposit than selling would, plus you keep Property 1 itself. Selling only wins here if you specifically want to be free of the investment loan and management.`;

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

    if (!suppressDashboardUpdate) {
      dashboardSummary.journey = { headline: fmt$(p2.maxPrice), sub: `Max price for Property 2, in ${y.years} years` };
      saveDashboardSummary();
      renderHomeCards();
    }

    saveState();
  });

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
        const yieldBand = R.yieldBand(s.yieldPct);
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
              <div><div class="compare-stat-label">Yield</div><div class="compare-stat-value ${yieldBand.tier}">${s.yieldPct.toFixed(2)}%</div></div>
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
  // SAVINGS GOAL tab
  // ---------------------------------------------------------------------
  function updateSavingsTargetHint() {
    const price = parseNum(document.getElementById("co-price").value);
    const loan = parseNum(document.getElementById("co-loan").value);
    const hintEl = document.getElementById("sg-target-hint");
    if (!hintEl) return;
    if (price > 0 && loan >= 0 && loan <= price) {
      hintEl.innerHTML = `Based on This Property: ${fmt$(price - loan)} <span class="term-link" data-sg-use-implied>— use this</span>`;
    } else {
      hintEl.textContent = "";
    }
  }
  document.getElementById("screen-savings").addEventListener("click", (e) => {
    if (e.target.closest("[data-sg-use-implied]")) {
      const price = parseNum(document.getElementById("co-price").value);
      const loan = parseNum(document.getElementById("co-loan").value);
      document.getElementById("sg-target").value = Math.round(price - loan).toLocaleString("en-AU");
    }
  });

  document.getElementById("sg-calc").addEventListener("click", () => {
    const currentSavings = parseNum(document.getElementById("sg-current").value);
    const targetDeposit = parseNum(document.getElementById("sg-target").value);
    const monthlyAmount = parseNum(document.getElementById("sg-monthly").value);
    const annualInterestRatePct = parseNum(document.getElementById("sg-rate").value) || 0;
    const targetDateStr = document.getElementById("sg-target-date").value; // "YYYY-MM"

    if (targetDeposit <= 0) {
      alert("Enter a target deposit first.");
      return;
    }

    const now = new Date();
    let monthsUntilTarget = 0;
    if (targetDateStr) {
      const [ty, tm] = targetDateStr.split("-").map(Number);
      monthsUntilTarget = (ty - now.getFullYear()) * 12 + (tm - (now.getMonth() + 1));
    }

    const result = C.savingsGoalPlan({
      currentSavings, targetDeposit, monthlyAmount,
      monthsUntilTarget: monthsUntilTarget > 0 ? monthsUntilTarget : 0,
      annualInterestRatePct,
    });

    // Direction A: given the monthly amount, when will they get there?
    if (monthlyAmount > 0 && result.monthsToGoal != null) {
      const wholeMonths = Math.ceil(result.monthsToGoal);
      const reachDate = new Date(now.getFullYear(), now.getMonth() + wholeMonths, 1);
      const dateLabel = reachDate.toLocaleDateString("en-AU", { month: "long", year: "numeric" });
      document.getElementById("sg-months-result").textContent = wholeMonths <= 0 ? "Already there" : `${wholeMonths} ${wholeMonths === 1 ? "month" : "months"}`;
      document.getElementById("sg-months-caption").textContent = wholeMonths <= 0
        ? `Your current savings already meet the target.`
        : `Saving ${fmt$(monthlyAmount)}/month — you'd reach ${fmt$(targetDeposit)} around ${dateLabel}.`;
    } else {
      document.getElementById("sg-months-result").textContent = "—";
      document.getElementById("sg-months-caption").textContent = "Enter a monthly savings amount above.";
    }

    // Direction B: given the target date, how much per month is needed?
    if (monthsUntilTarget > 0 && result.requiredMonthly != null) {
      document.getElementById("sg-required-result").textContent = fmt$(result.requiredMonthly) + "/mo";
      document.getElementById("sg-required-caption").textContent =
        `To reach ${fmt$(targetDeposit)} in ${monthsUntilTarget} ${monthsUntilTarget === 1 ? "month" : "months"}, save ${fmt$(result.requiredMonthly)} every month.`;
    } else {
      document.getElementById("sg-required-result").textContent = "—";
      document.getElementById("sg-required-caption").textContent = "Pick a target month above.";
    }

    document.getElementById("sg-results").classList.remove("hidden");
    saveState();
  });

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
      movingCosts: "Moving costs",
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
      .join("") +
      `<div class="row"><span class="row-label"><span class="term-link" data-term="buyersAgent">Buyer's agent fee</span></span><span class="row-value">${R.DEFAULT_BUYERS_AGENT_PCT}% (if used)</span></div>`;

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
    "in-rate", "in-term", "in-offset",
    "in-reno", "in-misc", "in-bldg-ins", "in-ll-ins", "in-mgmt-pct",
    "in-leasing", "in-vacancy", "in-land-tax", "in-strata", "in-maint",
    "in-other-exp", "in-rent-low", "in-rent-high", "in-tax-rate",
    "in-depreciation", "in-growth",
  ];
  const BP_FIELD_IDS = [
    "bp-salary", "bp-other-income", "bp-rent", "bp-rent-shade", "bp-dependents",
    "bp-living", "bp-cc-limit", "bp-personal-loan", "bp-other-loan",
    "bp-existing-balances", "bp-rate", "bp-term",
    "bp2-salary", "bp2-other-income",
  ];
  const JY_FIELD_IDS = [
    "jy-price1", "jy-deposit1", "jy-rate1", "jy-term1", "jy-growth1",
    "jy-years", "jy-equity-lvr", "jy-savings", "jy-loan2",
    "jy-rent1", "jy-rent-growth1", "jy-extra-you", "jy-extra-partner",
    "jy2-salary", "jy2-partner-salary", "jy2-rent-shade",
  ];
  const CP_FIELD_IDS = ["cp-label", "cp-price", "cp-deposit-pct", "cp-rent", "cp-rate"];
  const CO_FIELD_IDS = ["co-price", "co-loan", "co-cash", "co-buyers-agent-pct", "co-buyers-agent-flat"];

  function saveState() {
    try {
      const invVals = {};
      INVEST_FIELD_IDS.forEach((id) => { invVals[id] = document.getElementById(id).value; });
      const bpVals = {};
      BP_FIELD_IDS.forEach((id) => { bpVals[id] = document.getElementById(id).value; });
      const jyVals = {};
      JY_FIELD_IDS.forEach((id) => { jyVals[id] = document.getElementById(id).value; });
      const cpVals = {};
      CP_FIELD_IDS.forEach((id) => { cpVals[id] = document.getElementById(id).value; });
      const coVals = {};
      CO_FIELD_IDS.forEach((id) => { coVals[id] = document.getElementById(id).value; });

      const state = {
        af: {
          loan: document.getElementById("af-loan").value,
          cash: document.getElementById("af-cash").value,
          buffer: document.getElementById("af-buffer").value,
          state: selectedState.af,
          fhb: document.getElementById("af-fhb").checked,
          lmiWaived: document.getElementById("af-lmi-waived").checked,
          use: segVal("af-use"),
          bp: bpVals,
          bpIsInvestment: document.getElementById("bp-is-investment").checked,
          bpHecs: document.getElementById("bp-hecs").checked,
          bpJoint: document.getElementById("bp-joint").checked,
          bp2Hecs: document.getElementById("bp2-hecs").checked,
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
          ...coVals,
          state: selectedState.co,
          fhb: document.getElementById("co-fhb").checked,
          lmiWaived: document.getElementById("co-lmi-waived").checked,
          buyersAgent: document.getElementById("co-buyers-agent").checked,
          buyersAgentMode: segVal("co-buyers-agent-mode"),
          isInvestment: document.getElementById("co-is-investment").checked,
        },
        in: {
          ...invVals,
          propertyType: segVal("in-property-type"),
        },
        jy: { ...jyVals, state: selectedState.jy },
        cp: { ...cpVals, state: selectedState.cp },
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
        setSeg("af-use", s.af.use);
        if (s.af.bp) BP_FIELD_IDS.forEach((id) => setIfPresent(id, s.af.bp[id]));
        if (s.af.bpIsInvestment !== undefined) {
          document.getElementById("bp-is-investment").checked = !!s.af.bpIsInvestment;
          document.getElementById("bp-rent-row").classList.toggle("hidden", !s.af.bpIsInvestment);
          document.getElementById("bp-rent-shade-row").classList.toggle("hidden", !s.af.bpIsInvestment);
        }
        if (s.af.bpHecs !== undefined) document.getElementById("bp-hecs").checked = !!s.af.bpHecs;
        if (s.af.bpJoint !== undefined) {
          document.getElementById("bp-joint").checked = !!s.af.bpJoint;
          document.getElementById("bp-partner-group").classList.toggle("hidden", !s.af.bpJoint);
        }
        if (s.af.bp2Hecs !== undefined) document.getElementById("bp2-hecs").checked = !!s.af.bp2Hecs;
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
        CO_FIELD_IDS.forEach((id) => setIfPresent(id, s.co[id]));
        selectedState.co = s.co.state || "NSW";
        document.getElementById("co-state-value").innerHTML = `${selectedState.co} <span class="chevron">›</span>`;
        document.getElementById("co-fhb").checked = !!s.co.fhb;
        document.getElementById("co-lmi-waived").checked = !!s.co.lmiWaived;
        document.getElementById("co-lmi-waived-row").classList.toggle("hidden", !s.co.fhb);
        document.getElementById("co-buyers-agent").checked = !!s.co.buyersAgent;
        document.getElementById("co-buyers-agent-fee-row").classList.toggle("hidden", !s.co.buyersAgent);
        setSeg("co-buyers-agent-mode", s.co.buyersAgentMode);
        const coFlat = s.co.buyersAgentMode === "flat";
        document.getElementById("co-buyers-agent-pct-row").classList.toggle("hidden", coFlat);
        document.getElementById("co-buyers-agent-flat-row").classList.toggle("hidden", !coFlat);
        document.getElementById("co-is-investment").checked = !!s.co.isInvestment;
      }
      if (s.in) {
        INVEST_FIELD_IDS.forEach((id) => setIfPresent(id, s.in[id]));
        setSeg("in-property-type", s.in.propertyType);
      }
      if (s.jy) {
        JY_FIELD_IDS.forEach((id) => setIfPresent(id, s.jy[id]));
        selectedState.jy = s.jy.state || "NSW";
        document.getElementById("jy-state-value").innerHTML = `${selectedState.jy} <span class="chevron">›</span>`;
      }
      if (s.cp) {
        CP_FIELD_IDS.forEach((id) => setIfPresent(id, s.cp[id]));
        selectedState.cp = s.cp.state || "NSW";
        document.getElementById("cp-state-value").innerHTML = `${selectedState.cp} <span class="chevron">›</span>`;
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
  // Welcome overlay (first run only, re-openable from the Home dashboard)
  // ---------------------------------------------------------------------
  const welcomeOverlay = document.getElementById("welcome-overlay");
  function openWelcome() { welcomeOverlay.classList.add("open"); }
  function closeWelcome() {
    welcomeOverlay.classList.remove("open");
    try { localStorage.setItem("property-planner-welcome-seen", "1"); } catch (e) {}
  }
  document.getElementById("welcome-dismiss").addEventListener("click", closeWelcome);
  const showWelcomeAgainBtn = document.getElementById("show-welcome-again");
  if (showWelcomeAgainBtn) showWelcomeAgainBtn.addEventListener("click", openWelcome);
  const goToHomeBtn = document.getElementById("go-to-home-plan");
  if (goToHomeBtn) goToHomeBtn.addEventListener("click", () => switchToScreen("home"));
  const welcomeStartBtn = document.getElementById("welcome-start-guided");
  if (welcomeStartBtn) {
    welcomeStartBtn.addEventListener("click", () => {
      closeWelcome();
      switchToScreen("home");
    });
  }

  // ---------------------------------------------------------------------
  // Story chain — carries the computed numbers forward automatically when
  // moving from one step to the next, so the person never has to re-type
  // the same price into multiple screens. Continue buttons are always
  // visible once a step's results are calculated (this IS the app's normal
  // flow now, not an optional "guided mode").
  // ---------------------------------------------------------------------
  document.getElementById("af-guided-continue").addEventListener("click", () => {
    const price = parseNum(document.getElementById("af-max-price").textContent);
    document.getElementById("co-price").value = price.toLocaleString("en-AU");
    onSharedPriceInput("co-price");
    switchToScreen("costs");
    document.getElementById("co-calc").click();
  });

  document.getElementById("co-guided-continue").addEventListener("click", () => {
    switchToScreen("journey");
    document.getElementById("jy-calc").click();
  });

  document.getElementById("jy-guided-continue").addEventListener("click", () => {
    switchToScreen("home");
  });

  // ---------------------------------------------------------------------
  // Home dashboard — a persistent summary of what's been calculated so
  // far, doubling as the starting point (shows "start here" prompts) and
  // the finishing point (shows every headline number in one place).
  // ---------------------------------------------------------------------
  let dashboardSummary = { afford: null, property: null, journey: null };
  let suppressDashboardUpdate = true; // true only during the very first auto-run on load

  function saveDashboardSummary() {
    try { localStorage.setItem("property-planner-dashboard-v1", JSON.stringify(dashboardSummary)); } catch (e) {}
  }
  function loadDashboardSummary() {
    try {
      const raw = localStorage.getItem("property-planner-dashboard-v1");
      if (raw) dashboardSummary = JSON.parse(raw);
    } catch (e) { /* ignore malformed state */ }
  }

  const STORY_STEPS = [
    { key: "afford", screen: "afford", title: "What can you afford?", desc: "Your borrowing power and maximum purchase price." },
    { key: "property", screen: "costs", title: "This property", desc: "Full cost breakdown — plus yield and cashflow if it's an investment." },
    { key: "journey", screen: "journey", title: "The long game", desc: "When you could buy a home to live in, afterward." },
  ];

  function renderHomeCards() {
    const container = document.getElementById("home-cards");
    container.innerHTML = STORY_STEPS.map((step, i) => {
      const data = dashboardSummary[step.key];
      const done = !!data;
      let resultHtml;
      if (done) {
        resultHtml = `
          <div class="story-card-result">
            <div>
              <div class="story-card-result-value tabular">${data.headline}</div>
              <div class="story-card-result-label">${data.sub}</div>
            </div>
            <div class="story-card-edit">Review →</div>
          </div>`;
      } else {
        resultHtml = `<div class="story-card-cta">Start this step →</div>`;
      }
      return `
        <div class="story-card ${done ? "done" : ""}" data-goto="${step.screen}">
          <div class="story-card-header">
            <div class="story-card-number">${done ? "✓" : i + 1}</div>
            <div class="story-card-body">
              <div class="story-card-title">${step.title}</div>
              <div class="story-card-desc">${step.desc}</div>
            </div>
          </div>
          ${resultHtml}
        </div>`;
    }).join("");
    container.querySelectorAll("[data-goto]").forEach((card) => {
      card.addEventListener("click", () => {
        const screen = card.dataset.goto;
        switchToScreen(screen);
        // First-ever visit to Afford: open the borrowing-power panel to
        // guide the very first action, mirroring what a broker would ask first.
        if (screen === "afford" && !dashboardSummary.afford) {
          document.getElementById("af-borrow-panel").classList.remove("hidden");
          bpChevron.textContent = "⌄";
        }
      });
    });

    const allDone = STORY_STEPS.every((s) => dashboardSummary[s.key]);
    document.getElementById("home-subtitle").textContent = allDone
      ? "Here's your full picture. Tap any card to review or update it."
      : "Work through these in order — each one builds on the last. Tap any card to start or review it.";
  }

  // Live dollar readouts for every deposit % field
  wireLiveDollarReadout("jy-price1", "jy-deposit1", "jy-deposit-dollar");
  wireLiveDollarReadout("cp-price", "cp-deposit-pct", "cp-deposit-dollar");

  // Shows the deposit $ and % implied by price - loan, under the loan field
  function updateCoDepositImplied() {
    const price = parseNum(document.getElementById("co-price").value);
    const loan = parseNum(document.getElementById("co-loan").value);
    const el = document.getElementById("co-deposit-implied");
    if (!el) return;
    if (price > 0 && loan >= 0 && loan <= price) {
      const deposit = price - loan;
      el.textContent = `Deposit: ${fmt$(deposit)} (${((deposit / price) * 100).toFixed(0)}%)`;
    } else {
      el.textContent = "";
    }
  }
  document.getElementById("co-price").addEventListener("input", updateCoDepositImplied);
  document.getElementById("co-loan").addEventListener("input", updateCoDepositImplied);
  updateCoDepositImplied();

  document.getElementById("co-price").addEventListener("input", updateSavingsTargetHint);
  document.getElementById("co-loan").addEventListener("input", updateSavingsTargetHint);
  updateSavingsTargetHint();

  // Buyer's agent fee mode toggles (% of price vs flat $)
  wireFeeModeToggle({
    modeId: "co-buyers-agent-mode", priceFieldId: "co-price", pctFieldId: "co-buyers-agent-pct",
    pctRowId: "co-buyers-agent-pct-row", flatRowId: "co-buyers-agent-flat-row", dollarLabelId: "co-buyers-agent-dollar",
  });

  restoreState();
  loadDashboardSummary();
  renderHomeCards();
  toggleInvestmentMode();

  // Establish a coherent baseline across every screen before the first
  // auto-run: if this browser already has a shared-property baseline
  // saved, push it into every field (so a reload doesn't reintroduce a
  // mismatch); otherwise seed the baseline from the Property tab's current
  // values, so price/deposit/loan/rate agree everywhere from the very
  // first load rather than each tab showing its own unrelated default.
  loadSharedProperty();
  if (sharedProperty.price == null && sharedProperty.loanAmount == null) {
    onSharedPriceInput("co-price");
    onSharedLoanInput("co-loan");
    onSharedRateInput("in-rate");
  } else {
    propagateShared(null);
  }

  try {
    if (!localStorage.getItem("property-planner-welcome-seen")) openWelcome();
  } catch (e) { /* storage unavailable - skip first-run welcome */ }

  // Auto-run each calculator once on load so the pre-filled example is
  // immediately useful — the person can see real numbers straight away and
  // just override price/loan amount rather than needing to press Calculate
  // before anything appears. Dashboard cards stay "not started" through
  // this pass (suppressDashboardUpdate) — a brand-new user shouldn't see
  // every step marked done just because of placeholder defaults, though a
  // returning user's already-saved dashboard summary (loaded further up)
  // is untouched by this flag either way.
  document.getElementById("af-calc").click();
  document.getElementById("mg-calc").click();
  document.getElementById("co-calc").click();
  document.getElementById("jy-calc").click();
  suppressDashboardUpdate = false;

  // ---------------------------------------------------------------------
  // Register service worker
  // ---------------------------------------------------------------------
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("service-worker.js").catch(() => {});
    });
  }
})();
