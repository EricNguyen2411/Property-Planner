(function () {
  "use strict";
  const C = window.PropCalc;
  const R = window.PropRates;
  const T = window.PropTax;
  const G = window.PropGlossary;
  const STATES = Object.keys(R.STATE_NAMES);

  // ---------------------------------------------------------------------
  // Formatting helpers
  // ---------------------------------------------------------------------
  const parseNum = (val) => {
    if (val === null || val === undefined) return 0;
    const n = parseFloat(String(val).replace(/[^0-9.\-]/g, ""));
    return isNaN(n) ? 0 : n;
  };
  function fmt$(n) {
    const rounded = Math.round(n || 0);
    return (rounded < 0 ? "-$" : "$") + Math.abs(rounded).toLocaleString("en-AU");
  }
  function fmt$signed(n) {
    const rounded = Math.round(n || 0);
    return (rounded < 0 ? "-$" : "+$") + Math.abs(rounded).toLocaleString("en-AU");
  }

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
  function attachSelectOnFocus(input) {
    input.addEventListener("focus", () => input.select());
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
  function breakdownRowWithCaption(label, amount, caption, isTotal) {
    const cls = isTotal ? "breakdown-row total" : "breakdown-row";
    const amtCls = amount < 0 ? "amount negative" : "amount";
    return `<div class="${cls}"><span>${linkTerms(label)}<div class="breakdown-row-caption">${caption}</div></span><span class="${amtCls} tabular">${fmt$signed(amount)}</span></div>`;
  }
  const OTHER_PURCHASE_COSTS_CAPTION = "Conveyancing, building &amp; pest inspection, loan fees, registration &amp; moving costs";
  const MISC_FEES_CAPTION = "Catch-all for anything not itemised elsewhere — e.g. connection fees or last-minute adjustments";

  function segVal(id) {
    const active = document.querySelector(`#${id} button.active`);
    return active ? active.dataset.val : null;
  }
  function setSeg(id, val) {
    if (!val) return;
    const seg = document.getElementById(id);
    if (!seg) return;
    seg.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b.dataset.val === val));
  }
  document.querySelectorAll(".segmented").forEach((seg) => {
    seg.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;
      seg.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      saveState();
    });
  });

  // ---------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------
  const HOME_GROUP = ["home", "position", "paths", "costs", "journey"];
  const MORE_GROUP = ["more", "mortgage", "compare", "savings", "rates"];

  function switchToScreen(id) {
    document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
    const target = document.getElementById("screen-" + id);
    if (target) target.classList.add("active");
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      const isHome = btn.dataset.tab === "home" && HOME_GROUP.includes(id);
      const isMore = btn.dataset.tab === "more" && MORE_GROUP.includes(id);
      btn.classList.toggle("active", isHome || isMore);
    });
    window.scrollTo(0, 0);
  }
  document.querySelectorAll("[data-goto]").forEach((el) => {
    el.addEventListener("click", () => switchToScreen(el.dataset.goto));
  });
  document.querySelectorAll("[data-back-home]").forEach((el) => {
    el.addEventListener("click", () => switchToScreen("home"));
  });
  document.querySelectorAll("[data-back-more]").forEach((el) => {
    el.addEventListener("click", () => switchToScreen("more"));
  });
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => switchToScreen(btn.dataset.tab));
  });

  // ---------------------------------------------------------------------
  // Welcome overlay
  // ---------------------------------------------------------------------
  const welcomeOverlay = document.getElementById("welcome-overlay");
  function closeWelcome() {
    welcomeOverlay.classList.add("closed");
    try { localStorage.setItem("property-planner-welcome-seen", "1"); } catch (e) {}
  }
  document.getElementById("welcome-dismiss").addEventListener("click", closeWelcome);
  try {
    if (localStorage.getItem("property-planner-welcome-seen")) welcomeOverlay.classList.add("closed");
  } catch (e) {}

  // ---------------------------------------------------------------------
  // Glossary sheet
  // ---------------------------------------------------------------------
  const glossaryBackdrop = document.getElementById("glossary-backdrop");
  const glossarySheet = document.getElementById("glossary-sheet");
  function openGlossary(termKey) {
    const term = G[termKey];
    if (!term) return;
    document.getElementById("glossary-sheet-title").textContent = term.term;
    document.getElementById("glossary-sheet-full").textContent = term.full !== term.term ? term.full : "";
    document.getElementById("glossary-sheet-def").innerHTML = term.definition;
    glossaryBackdrop.classList.add("open");
    glossarySheet.classList.add("open");
  }
  function closeGlossary() {
    glossaryBackdrop.classList.remove("open");
    glossarySheet.classList.remove("open");
  }
  glossaryBackdrop.addEventListener("click", closeGlossary);
  document.body.addEventListener("click", (e) => {
    const link = e.target.closest("[data-term]");
    if (link) openGlossary(link.dataset.term);
  });
  function linkTerms(label) {
    return label; // labels built via breakdownRows already contain any term-link spans inline where needed
  }

  // ---------------------------------------------------------------------
  // State picker sheet
  // ---------------------------------------------------------------------
  const sheetBackdrop = document.getElementById("sheet-backdrop");
  const stateSheet = document.getElementById("state-sheet");
  const stateSheetList = document.getElementById("state-sheet-list");
  let activeStateTarget = null;
  let selectedState = { paths: "NSW", costs: "NSW", journey: "NSW", compare: "NSW" };
  const SHARED_STATE_TARGETS = ["paths", "costs", "journey"]; // compare intentionally excluded — different properties

  function renderStateSheetList() {
    STATES.forEach((code) => {
      const opt = document.createElement("div");
      opt.className = "sheet-option";
      opt.textContent = `${code} — ${R.STATE_NAMES[code]}`;
      opt.addEventListener("click", () => {
        selectedState[activeStateTarget] = code;
        const valEl = document.getElementById(activeStateTarget + "-state-value");
        if (valEl) valEl.innerHTML = `${code} <span class="chevron">›</span>`;
        if (SHARED_STATE_TARGETS.includes(activeStateTarget)) {
          SHARED_STATE_TARGETS.forEach((t) => {
            if (t === activeStateTarget) return;
            selectedState[t] = code;
            const el = document.getElementById(t + "-state-value");
            if (el) el.innerHTML = `${code} <span class="chevron">›</span>`;
          });
        }
        closeSheet();
        saveState();
        if (typeof updateLandTaxHint === "function") updateLandTaxHint();
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
  document.getElementById("pth-target-state-row").addEventListener("click", () => openSheet("paths"));
  document.getElementById("co-state-row").addEventListener("click", () => openSheet("costs"));
  document.getElementById("jy-state-row").addEventListener("click", () => openSheet("journey"));
  document.getElementById("cp-state-row").addEventListener("click", () => openSheet("compare"));

  // ---------------------------------------------------------------------
  // Theme (light / dark / system)
  // ---------------------------------------------------------------------
  const THEME_KEY = "property-planner-theme";
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)");

  function applyTheme(mode) {
    const isDark = mode === "dark" || (mode === "system" && systemDark.matches);
    if (isDark) document.documentElement.setAttribute("data-theme", "dark");
    else document.documentElement.removeAttribute("data-theme");
  }
  function getThemeMode() {
    try { return localStorage.getItem(THEME_KEY) || "system"; } catch (e) { return "system"; }
  }
  function setThemeMode(mode) {
    try { localStorage.setItem(THEME_KEY, mode); } catch (e) {}
    applyTheme(mode);
  }

  const themePicker = document.getElementById("theme-picker");
  const savedThemeMode = getThemeMode();
  themePicker.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b.dataset.val === savedThemeMode));
  applyTheme(savedThemeMode);

  themePicker.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    themePicker.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    setThemeMode(btn.dataset.val);
  });

  systemDark.addEventListener("change", () => {
    if (getThemeMode() === "system") applyTheme("system");
  });

  // ---------------------------------------------------------------------
  // 1. YOUR POSITION — the single source of truth for income/savings/
  // borrowing power. Computed once here; every other screen reads from
  // the cached `position` object instead of asking again.
  // ---------------------------------------------------------------------
  let position = null;

  document.getElementById("pos-joint").addEventListener("change", (e) => {
    document.getElementById("pos-partner-group").classList.toggle("hidden", !e.target.checked);
    saveState();
  });

  function runPositionCalc() {
    const grossSalaryAnnual = parseNum(document.getElementById("pos-salary").value);
    if (grossSalaryAnnual <= 0) {
      alert("Enter your gross salary first.");
      return;
    }
    const isJoint = document.getElementById("pos-joint").checked;
    const partnerSalary = parseNum(document.getElementById("pos2-salary").value);
    const annualRatePct = parseNum(document.getElementById("pos-rate").value) || 6.5;
    const termYears = parseNum(document.getElementById("pos-term").value) || 30;

    const result = C.borrowingPower({
      grossSalaryAnnual,
      otherIncomeAnnual: parseNum(document.getElementById("pos-other-income").value),
      isInvestmentPurchase: false,
      rentalIncomeWeekly: 0,
      hasHecsDebt: document.getElementById("pos-hecs").checked,
      dependents: parseNum(document.getElementById("pos-dependents").value),
      livingExpensesMonthly: parseNum(document.getElementById("pos-living").value) || null,
      creditCardLimitsTotal: parseNum(document.getElementById("pos-cc-limit").value),
      personalLoanMonthly: parseNum(document.getElementById("pos-personal-loan").value),
      otherLoanRepaymentsMonthly: parseNum(document.getElementById("pos-other-loan").value),
      existingLoanBalancesTotal: parseNum(document.getElementById("pos-existing-balances").value),
      annualRatePct,
      termYears,
      partner2: isJoint && partnerSalary > 0 ? {
        grossSalaryAnnual: partnerSalary,
        otherIncomeAnnual: parseNum(document.getElementById("pos2-other-income").value),
        hasHecsDebt: document.getElementById("pos2-hecs").checked,
      } : null,
    });

    const currentSavings = parseNum(document.getElementById("pos-savings").value);
    const monthlySavings = parseNum(document.getElementById("pos-monthly-savings").value);
    const savingsRate = parseNum(document.getElementById("pos-savings-rate").value) || 0;

    position = {
      maxLoan: result.maxLoan,
      netEmploymentIncome: result.netEmploymentIncome,
      partner2NetEmploymentIncome: result.partner2NetEmploymentIncome,
      dti: result.dti,
      dtiExceedsSix: result.dtiExceedsSix,
      livingExpenses: result.livingExpenses,
      totalDebtCommitmentsMonthly: result.totalDebtCommitmentsMonthly,
      assessedRatePct: result.assessedRatePct,
      currentSavings, monthlySavings, savingsRate, annualRatePct, termYears, isJoint,
    };
    try { localStorage.setItem("property-planner-position-v1", JSON.stringify(position)); } catch (e) {}
    try { localStorage.setItem("property-planner-gross-income-v1", JSON.stringify({ grossAnnualIncome: grossSalaryAnnual + parseNum(document.getElementById("pos-other-income").value) + (isJoint ? partnerSalary + parseNum(document.getElementById("pos2-other-income").value) : 0) })); } catch (e) {}

    document.getElementById("pos-max-loan").textContent = fmt$(result.maxLoan);
    document.getElementById("pos-caption").textContent = `Assessed at ${result.assessedRatePct.toFixed(2)}% p.a. (rate + 3% APRA buffer)`;

    const incomeRows = [["Your net income", result.netEmploymentIncome, false]];
    if (isJoint && result.partner2NetEmploymentIncome > 0) incomeRows.push(["Partner's net income", result.partner2NetEmploymentIncome, false]);
    document.getElementById("pos-breakdown").innerHTML =
      breakdownRows(incomeRows) +
      breakdownRows([
        ["Living expenses", -result.livingExpenses * 12, true],
        ["Existing debt commitments", -result.totalDebtCommitmentsMonthly * 12, true],
      ]);

    const dtiStatus = document.getElementById("pos-dti-status");
    if (result.dtiExceedsSix) {
      dtiStatus.className = "status-banner neutral";
      dtiStatus.textContent = `Debt-to-income ratio ~${result.dti.toFixed(1)}x — at or above the 6x threshold lenders scrutinise closely.`;
      dtiStatus.classList.remove("hidden");
    } else {
      dtiStatus.classList.add("hidden");
    }

    document.getElementById("pos-results").classList.remove("hidden");

    if (!suppressDashboardUpdate) {
      dashboardSummary.position = { headline: fmt$(result.maxLoan), sub: `Combined borrowing power${isJoint ? " (joint)" : ""}` };
      saveDashboardSummary();
      renderHomeCards();
    }
    saveState();
  }
  document.getElementById("pos-calc").addEventListener("click", runPositionCalc);
  document.getElementById("pos-guided-continue").addEventListener("click", () => {
    switchToScreen("paths");
  });

  // ---------------------------------------------------------------------
  // 2. COMPARE YOUR PATHS — reads borrowing capacity and savings straight
  // from the `position` object computed on the previous screen. No
  // duplicate entry.
  // ---------------------------------------------------------------------
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
  wireLiveDollarReadout("pth-price1", "pth-deposit1", "pth-deposit1-dollar");

  function requirePosition() {
    if (position) return true;
    if (confirm("You haven't calculated Your Position yet. Go there now?")) switchToScreen("position");
    return false;
  }

  document.getElementById("pth-calc").addEventListener("click", () => {
    if (!requirePosition()) return;
    const targetPriceNow = parseNum(document.getElementById("pth-target-price").value);
    const targetGrowthPct = parseNum(document.getElementById("pth-target-growth").value) || 0;
    const targetState = selectedState.paths;
    const buffer = parseNum(document.getElementById("pth-buffer").value);

    if (targetPriceNow <= 0) {
      alert("Enter a target home price first.");
      return;
    }

    const borrowCapacity = position.maxLoan;
    const currentSavings = position.currentSavings;
    const monthlySavings = position.monthlySavings;
    const savingsRate = position.savingsRate;

    // --- Path 1: buy directly ---
    const s1 = C.directPurchaseTimeline({
      targetPriceNow, targetGrowthPct, currentSavings, monthlySavingsRate: monthlySavings,
      savingsInterestRatePct: savingsRate, combinedBorrowingCapacity: borrowCapacity,
      state: targetState, isFirstHomeBuyer: false, maxYearsToCheck: 15,
    });
    const pc1 = document.getElementById("pth-card-1");
    const pt1 = document.getElementById("pth1-title");
    const pd1 = document.getElementById("pth1-desc");
    pc1.classList.remove("done");
    if (s1.achievableAtYear === 0) {
      pc1.classList.add("done");
      pt1.textContent = "Achievable now";
      pd1.textContent = `Your combined savings and borrowing capacity already cover a ${fmt$(targetPriceNow)} home in ${targetState}.`;
    } else if (s1.achievableAtYear != null) {
      pt1.textContent = `Achievable in about ${s1.achievableAtYear} year${s1.achievableAtYear === 1 ? "" : "s"}`;
      pd1.textContent = `By then the target will have grown to roughly ${fmt$(s1.years[s1.achievableAtYear].targetPrice)}, and your savings should cover the ${fmt$(s1.years[s1.achievableAtYear].requiredCash)} needed.`;
    } else {
      pt1.textContent = `Not achievable within ${s1.maxYearsToCheck} years`;
      pd1.textContent = s1.gapTrend === "widening"
        ? `The target is growing faster than you can save toward it — the gap is ${fmt$(-s1.years[s1.years.length - 1].shortfallOrSurplus)} and widening. Saving harder alone won't close it; a higher income or a different target/timeframe would.`
        : `The gap is narrowing (currently ${fmt$(-s1.years[s1.years.length - 1].shortfallOrSurplus)}) but not fast enough to close within ${s1.maxYearsToCheck} years at this rate.`;
    }

    // --- Path 2: one investment property first ---
    const price1 = parseNum(document.getElementById("pth-price1").value);
    const deposit1Pct = parseNum(document.getElementById("pth-deposit1").value) || 20;
    const growth1 = parseNum(document.getElementById("pth-growth1").value) || 6;
    const yearsUntil = parseNum(document.getElementById("pth-years").value) || 5;
    const equityLvr = parseNum(document.getElementById("pth-equity-lvr").value) || 80;
    const rate = position.annualRatePct;
    const term = position.termYears;

    const s2Journey = C.investmentThenHomeJourney({
      price1, depositPct1: deposit1Pct, annualRatePct1: rate, termYears1: term, growthCagrPct1: growth1,
      yearsUntilProperty2: yearsUntil, equityReleaseLVRPct: equityLvr,
      additionalSavingsByThen: currentSavings + monthlySavings * 12 * yearsUntil,
      property2State: targetState, property2MaxLoan: borrowCapacity, property2IsFirstHomeBuyer: false,
    });
    const targetAtYear = targetPriceNow * Math.pow(1 + targetGrowthPct / 100, yearsUntil);
    const pc2 = document.getElementById("pth-card-2");
    const pt2 = document.getElementById("pth2-title");
    const pd2 = document.getElementById("pth2-desc");
    pc2.classList.remove("done");
    const s2Achievable = s2Journey.property2.maxPrice >= targetAtYear;
    if (s2Achievable) pc2.classList.add("done");
    pt2.textContent = s2Achievable ? `On track by Year ${yearsUntil}` : `Short by ${fmt$(targetAtYear - s2Journey.property2.maxPrice)} at Year ${yearsUntil}`;
    pd2.textContent = `Buying Property 1 (${fmt$(price1)}) now, releasing equity in Year ${yearsUntil}, gets you to ${fmt$(s2Journey.property2.maxPrice)} — against a target that will have grown to roughly ${fmt$(targetAtYear)}.`;

    // --- Path 3: two investment properties first ---
    const price2 = parseNum(document.getElementById("pth-price2").value);
    const deposit2Pct = parseNum(document.getElementById("pth-deposit2").value) || 20;
    const growth2 = parseNum(document.getElementById("pth-growth2").value) || 8;

    const s3 = C.twoPropertyJourney({
      propertyA: { price: price1, depositPct: deposit1Pct, annualRatePct: rate, termYears: term, growthCagrPct: growth1 },
      propertyB: { price: price2, depositPct: deposit2Pct, annualRatePct: rate, termYears: term, growthCagrPct: growth2 },
      yearsUntilTarget: yearsUntil, equityReleaseLVRPct: equityLvr,
      additionalSavingsByThen: currentSavings + monthlySavings * 12 * yearsUntil,
      targetState, targetMaxLoan: borrowCapacity, targetIsFirstHomeBuyer: false,
    });
    const pc3 = document.getElementById("pth-card-3");
    const pt3 = document.getElementById("pth3-title");
    const pd3 = document.getElementById("pth3-desc");
    pc3.classList.remove("done");
    const s3Achievable = s3.target.maxPrice >= targetAtYear;
    if (s3Achievable) pc3.classList.add("done");
    pt3.textContent = s3Achievable ? `On track by Year ${yearsUntil}` : `Short by ${fmt$(targetAtYear - s3.target.maxPrice)} at Year ${yearsUntil}`;
    pd3.textContent = `Two properties (${fmt$(price1)} + ${fmt$(price2)}) release a combined ${fmt$(s3.combinedUsableEquity)} in equity by Year ${yearsUntil}, getting you to ${fmt$(s3.target.maxPrice)}.`;

    const depositA = price1 * (deposit1Pct / 100);
    const depositBAmount = price2 * (deposit2Pct / 100);
    const combinedDeposits = depositA + depositBAmount;
    const bufferCheckEl = document.getElementById("pth3-buffer-check");
    const leftoverBuffer = currentSavings - combinedDeposits;
    if (leftoverBuffer >= buffer) {
      bufferCheckEl.textContent = `${fmt$(leftoverBuffer)} left after both deposits — clears your ${fmt$(buffer)} buffer`;
      bufferCheckEl.style.color = "var(--positive)";
    } else {
      bufferCheckEl.textContent = `Only ${fmt$(Math.max(leftoverBuffer, 0))} left after both deposits — below your ${fmt$(buffer)} buffer target`;
      bufferCheckEl.style.color = "var(--negative)";
    }

    const verdictEl = document.getElementById("pth-recommendation");
    verdictEl.className = "status-banner neutral";
    if (s1.achievableAtYear === 0) {
      verdictEl.textContent = "Path 1 already works — you can likely buy your target home directly, without needing an investment property first.";
    } else if (leftoverBuffer < buffer && s3Achievable) {
      verdictEl.textContent = `Path 3 gets there fastest, but it leaves your buffer thin (${fmt$(Math.max(leftoverBuffer, 0))} vs your ${fmt$(buffer)} target) — two loans and two tenancies at once is real risk. Path 2 is the steadier starting point; you can revisit a second property once the first has a year or so of track record and your buffer has rebuilt.`;
    } else if (s2Achievable) {
      verdictEl.textContent = "Path 2 — one investment property first — gets you to your target home by the year you've set, without the extra risk of running two loans at once.";
    } else if (s3Achievable) {
      verdictEl.textContent = "Path 2 alone falls short by your target year, but adding a second investment property (Path 3) closes the gap — as long as your buffer holds up.";
    } else {
      verdictEl.textContent = "None of the three quite get there by your target year on these numbers — try a longer timeframe, a lower target price, or growing your borrowing capacity, and recalculate.";
    }

    // Propagate Property 1's details forward to the Long-Term Plan screen
    document.getElementById("jy-price1").value = price1.toLocaleString("en-AU");
    document.getElementById("jy-deposit1").value = deposit1Pct;
    document.getElementById("jy-rate1").value = rate;
    document.getElementById("jy-term1").value = term;
    document.getElementById("jy-growth1").value = growth1;
    document.getElementById("jy-years").value = yearsUntil;
    document.getElementById("jy-equity-lvr").value = equityLvr;
    document.getElementById("jy-savings").value = Math.round(monthlySavings * 12 * yearsUntil).toLocaleString("en-AU");
    document.getElementById("jy-loan2").value = Math.round(borrowCapacity).toLocaleString("en-AU");
    selectedState.journey = targetState;
    document.getElementById("jy-state-value").innerHTML = `${targetState} <span class="chevron">›</span>`;

    document.getElementById("pth-results").classList.remove("hidden");

    if (!suppressDashboardUpdate) {
      dashboardSummary.paths = {
        headline: s1.achievableAtYear === 0 ? "Buy directly" : s2Achievable ? "One investment first" : s3Achievable ? "Two investments" : "Needs adjusting",
        sub: `Target ${fmt$(targetPriceNow)} in ${targetState}`,
      };
      saveDashboardSummary();
      renderHomeCards();
    }
    saveState();
  });

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

  // Reads the gross income last calculated on Your Position (if any), so
  // other screens can stress-test a specific repayment against real income
  // without asking for it again.
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
      el.innerHTML = `<div class="info-note"><span class="dot"></span><span>Calculate Your Position first to see whether this repayment fits your budget.</span></div>`;
      return;
    }
    const pct = (annualRepayment / grossIncome) * 100;
    const band = R.mortgageStressBand(pct);
    el.innerHTML = `<div class="status-banner ${band.tier}">${pct.toFixed(0)}% of your gross income — ${band.label}</div>`;
  }

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
    const state = selectedState.costs;
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

    // Suggest parking leftover cash (beyond the recommended buffer) in the
    // offset account, since that directly reduces the interest you pay —
    // rather than leaving it sitting idle uncounted.
    const offsetSuggestEl = document.getElementById("co-offset-suggest");
    if (offsetSuggestEl) {
      const currentOffset = parseNum(document.getElementById("in-offset").value);
      const leftover = availableCash > 0 ? availableCash - totalCashRequired - R.RECOMMENDED_EMERGENCY_BUFFER : 0;
      if (isInvestment && leftover > 1000 && currentOffset < leftover) {
        offsetSuggestEl.innerHTML = `<div class="info-note"><span class="dot"></span><span>You'd have ${fmt$(leftover + R.RECOMMENDED_EMERGENCY_BUFFER)} left over beyond your purchase costs. Beyond a ${fmt$(R.RECOMMENDED_EMERGENCY_BUFFER)} buffer, parking the rest — ${fmt$(leftover)} — in your <span class="term-link" data-term="offset">offset account</span> reduces the interest you pay without locking it away. <span class="term-link" data-co-use-offset>Set offset to ${fmt$(leftover)}</span></span></div>`;
      } else {
        offsetSuggestEl.innerHTML = "";
      }
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
      : `As an established property bought now, your gain is time-apportioned: roughly ${result.monthsPreCutover} month${result.monthsPreCutover === 1 ? "" : "s"} of it (before 1 July 2027) still gets the old 50% discount — ${fmt$(result.cgtPreCutover)} in CGT — and the remaining ${result.monthsPostCutover} month${result.monthsPostCutover === 1 ? "" : "s"} uses the new indexation method with a 30% minimum rate — ${fmt$(result.cgtPostCutover)} in CGT. Total: ${fmt$(result.cgtPayable)}.`;
    document.getElementById("ex-method-note").textContent = methodNote;

    document.getElementById("ex-results").classList.remove("hidden");
    saveState();
  });

  // ---------------------------------------------------------------------

  // First home buyer toggle shows/hides the First Home Guarantee (LMI-waived) row
  document.getElementById("co-fhb").addEventListener("change", (e) => {
    document.getElementById("co-lmi-waived-row").classList.toggle("hidden", !e.target.checked);
    saveState();
  });

  // Buyer's agent toggle shows/hides the fee row
  document.getElementById("co-buyers-agent").addEventListener("change", (e) => {
    document.getElementById("co-buyers-agent-fee-row").classList.toggle("hidden", !e.target.checked);
    saveState();
  });

  // Buyer's agent fee mode toggle (% of price vs flat $)
  wireFeeModeToggle({
    modeId: "co-buyers-agent-mode", priceFieldId: "co-price", pctFieldId: "co-buyers-agent-pct",
    pctRowId: "co-buyers-agent-pct-row", flatRowId: "co-buyers-agent-flat-row", dollarLabelId: "co-buyers-agent-dollar",
  });

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

  // Land tax threshold awareness — land value is roughly estimated as 60%
  // of the purchase price. This only indicates whether land tax likely
  // applies at all, since progressive rates above the threshold vary too
  // much by state to responsibly compute an exact dollar figure here.
  function updateLandTaxHint() {
    const hintEl = document.getElementById("in-land-tax-hint");
    if (!hintEl) return;
    const price = parseNum(document.getElementById("co-price").value);
    const state = selectedState.costs;
    const threshold = R.LAND_TAX_THRESHOLD[state];
    if (!price || threshold == null) {
      hintEl.textContent = threshold === null ? `${state} doesn't levy a broad land tax.` : "";
      return;
    }
    const estimatedLandValue = price * 0.6;
    hintEl.textContent = estimatedLandValue < threshold
      ? `Likely $0 — estimated land value (${fmt$(estimatedLandValue)}) is under ${state}'s ${fmt$(threshold)} threshold.`
      : `Estimated land value (${fmt$(estimatedLandValue)}) is above ${state}'s ${fmt$(threshold)} threshold — you may owe land tax. Check with the state revenue office or your accountant for the actual amount.`;
  }
  document.getElementById("co-price").addEventListener("input", updateLandTaxHint);
  updateLandTaxHint();

  document.getElementById("co-results").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-co-use-offset]");
    if (!btn) return;
    const amount = parseNum(btn.textContent);
    document.getElementById("in-offset").value = Math.round(amount).toLocaleString("en-AU");
    saveState();
  });

  // Pre-fill "This Property"'s cash/loan from Your Position the first time
  // you arrive there, so you're not re-typing numbers already established —
  // still fully editable, since checking a specific listing may use only
  // part of your capacity.
  let costsPrefilledFromPosition = false;

  let lastJourneyProjection = null;
  document.getElementById("jy-calc").addEventListener("click", () => {
    const price1 = parseNum(document.getElementById("jy-price1").value);
    if (price1 <= 0) {
      alert("Enter a purchase price for Property 1 first.");
      return;
    }
    // Property 2's borrowing capacity comes from Your Position (pre-filled
    // via Compare Your Paths), optionally topped up with a credit for
    // Property 1's projected rent at the purchase year — lenders typically
    // credit around 70% of rental income toward serviceability.
    const yearsUntilP2 = parseNum(document.getElementById("jy-years").value) || 5;
    const rentWeekly1ForCredit = parseNum(document.getElementById("jy-rent1").value);
    const rentGrowth1ForCredit = parseNum(document.getElementById("jy-rent-growth1").value) || 0;
    let property2MaxLoan = parseNum(document.getElementById("jy-loan2").value);
    if (document.getElementById("jy-rent-credit").checked && position && rentWeekly1ForCredit > 0) {
      const projectedRentWeekly = rentWeekly1ForCredit * Math.pow(1 + rentGrowth1ForCredit / 100, yearsUntilP2);
      const shadedRentAnnual = projectedRentWeekly * 52 * 0.7;
      // Extra capacity a lender would add for this shaded rental income,
      // at the same assessed rate/term used for the rest of the position.
      const extraCapacity = C.maxLoanFromRepayment(shadedRentAnnual / 12, position.assessedRatePct, position.termYears);
      property2MaxLoan += extraCapacity;
    }
    const result = C.investmentThenHomeJourney({
      price1,
      depositPct1: parseNum(document.getElementById("jy-deposit1").value) || 20,
      annualRatePct1: parseNum(document.getElementById("jy-rate1").value) || 6.5,
      termYears1: parseNum(document.getElementById("jy-term1").value) || 30,
      growthCagrPct1: parseNum(document.getElementById("jy-growth1").value) || 6,
      yearsUntilProperty2: yearsUntilP2,
      equityReleaseLVRPct: parseNum(document.getElementById("jy-equity-lvr").value) || 80,
      additionalSavingsByThen: parseNum(document.getElementById("jy-savings").value),
      property2State: selectedState.journey,
      property2MaxLoan,
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
        price: price1, depositPct: deposit1Pct, state: selectedState.journey, annualRatePct: rate1, loanTermYears: term1,
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
      stampDuty: R.stampDuty(selectedState.journey, price1, false), otherAcquisitionCosts: 4650,
      growthCagrPct: parseNum(document.getElementById("jy-growth1").value) || 6, yearsHeld: y.years,
      agentCommissionPct: 2.5, legalMarketingFlat: 1500, taxRatePct: D.taxRatePct, assumedCpiPct: 2.5,
      isNewBuild: isNewBuild1,
    });
    const nextStampDuty = R.stampDuty(selectedState.journey, p2.maxPrice, false);
    const sellAvailableDeposit = Math.max(sellResult.netProceedsAfterSaleLoanAndTax - nextStampDuty, 0);
    document.getElementById("jy-sell-breakdown").innerHTML = breakdownRows([
      ["Estimated sale price", sellResult.salePrice, false],
      ["Selling costs", -sellResult.sellingCostsTotal, true],
      ["Remaining loan", -sellResult.loanBalanceAtSale, true],
      ["Capital gains tax", -sellResult.cgtPayable, true],
      ["Net proceeds", sellResult.netProceedsAfterSaleLoanAndTax, false],
      [`Stamp duty on Property 2 (${selectedState.journey})`, -nextStampDuty, true],
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

    const fhb = R.RENTVESTING_FHB_IMPACT[selectedState.journey];
    const warningEl = document.getElementById("jy-fhb-warning");
    if (fhb.retainsEligibility === false) {
      warningEl.textContent = `In ${selectedState.journey}, buying the investment property first will likely cost you first-home stamp duty relief on Property 2.`;
    } else if (fhb.retainsEligibility === true) {
      warningEl.textContent = `In ${selectedState.journey}, you may still qualify for first-home stamp duty relief on Property 2 despite owning an investment property first.`;
    } else {
      warningEl.textContent = `In ${selectedState.journey}, it's not clear-cut whether you'll retain first-home stamp duty relief on Property 2 — confirm before relying on it.`;
    }
    document.getElementById("jy-fhb-detail").textContent =
      fhb.note + " Separately, the federal First Home Guarantee (5% deposit, no LMI) is gone for Property 2 regardless of state, the moment Property 1 settles — this calculator already assumes standard (non-concession) duty and no LMI waiver for Property 2 to reflect that.";

    document.getElementById("jy-results").classList.remove("hidden");

    if (!suppressDashboardUpdate) {
      dashboardSummary.plan = { headline: fmt$(p2.maxPrice), sub: `Max price for Property 2, in ${y.years} years` };
      saveDashboardSummary();
      renderHomeCards();
    }

    saveState();
  });

  wireLiveDollarReadout("jy-price1", "jy-deposit1", "jy-deposit-dollar");
  wireLiveDollarReadout("cp-price", "cp-deposit-pct", "cp-deposit-dollar");

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
      state: selectedState.compare,
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

  // ---------------------------------------------------------------------
  // Persistence (local only — no sync, no account)
  // ---------------------------------------------------------------------
  const POS_FIELD_IDS = [
    "pos-salary", "pos-other-income", "pos2-salary", "pos2-other-income",
    "pos-dependents", "pos-living", "pos-cc-limit", "pos-personal-loan",
    "pos-other-loan", "pos-existing-balances", "pos-savings", "pos-monthly-savings",
    "pos-savings-rate", "pos-rate", "pos-term",
  ];
  const PTH_FIELD_IDS = [
    "pth-target-price", "pth-target-growth", "pth-price1", "pth-deposit1", "pth-growth1",
    "pth-price2", "pth-deposit2", "pth-growth2", "pth-years", "pth-equity-lvr", "pth-buffer",
  ];
  const CO_FIELD_IDS = ["co-price", "co-loan", "co-cash", "co-buyers-agent-pct", "co-buyers-agent-flat"];
  const INVEST_FIELD_IDS = [
    "in-rate", "in-term", "in-offset", "in-reno", "in-misc", "in-bldg-ins", "in-ll-ins", "in-mgmt-pct",
    "in-leasing", "in-vacancy", "in-land-tax", "in-strata", "in-maint", "in-other-exp",
    "in-rent-low", "in-rent-high", "in-tax-rate", "in-depreciation", "in-growth",
  ];
  const JY_FIELD_IDS = [
    "jy-price1", "jy-deposit1", "jy-rate1", "jy-term1", "jy-growth1", "jy-rent1", "jy-rent-growth1",
    "jy-extra-you", "jy-extra-partner", "jy-years", "jy-equity-lvr", "jy-savings", "jy-loan2",
  ];
  const MG_FIELD_IDS = ["mg-loan", "mg-rate", "mg-term", "mg-extra", "mg-offset"];
  const CP_FIELD_IDS = ["cp-label", "cp-price", "cp-deposit-pct", "cp-rent", "cp-rate"];
  const SG_FIELD_IDS = ["sg-current", "sg-target", "sg-rate", "sg-monthly", "sg-target-date"];

  function saveState() {
    try {
      const vals = (ids) => { const o = {}; ids.forEach((id) => { const el = document.getElementById(id); if (el) o[id] = el.value; }); return o; };

      const state = {
        pos: {
          ...vals(POS_FIELD_IDS),
          hecs: document.getElementById("pos-hecs").checked,
          joint: document.getElementById("pos-joint").checked,
          pos2Hecs: document.getElementById("pos2-hecs").checked,
        },
        pth: { ...vals(PTH_FIELD_IDS), state: selectedState.paths },
        co: {
          ...vals(CO_FIELD_IDS), ...vals(INVEST_FIELD_IDS),
          state: selectedState.costs,
          fhb: document.getElementById("co-fhb").checked,
          lmiWaived: document.getElementById("co-lmi-waived").checked,
          buyersAgent: document.getElementById("co-buyers-agent").checked,
          buyersAgentMode: segVal("co-buyers-agent-mode"),
          isInvestment: document.getElementById("co-is-investment").checked,
          propertyType: segVal("in-property-type"),
          ongCouncil: document.getElementById("co-ong-council").value,
          ongWater: document.getElementById("co-ong-water").value,
          ongInsurance: document.getElementById("co-ong-insurance").value,
          ongStrata: document.getElementById("co-ong-strata").value,
          ongMaint: document.getElementById("co-ong-maint").value,
        },
        jy: {
          ...vals(JY_FIELD_IDS),
          state: selectedState.journey,
          rentCredit: document.getElementById("jy-rent-credit").checked,
        },
        mg: { ...vals(MG_FIELD_IDS), type: segVal("mg-type"), freq: segVal("mg-freq") },
        cp: { ...vals(CP_FIELD_IDS), state: selectedState.compare },
        sg: vals(SG_FIELD_IDS),
      };
      localStorage.setItem("property-planner-state-v1", JSON.stringify(state));
    } catch (e) { /* storage unavailable — ignore */ }
  }

  function restoreState() {
    try {
      const raw = localStorage.getItem("property-planner-state-v1");
      if (!raw) return;
      const s = JSON.parse(raw);
      const setIfPresent = (id, val) => { if (val) { const el = document.getElementById(id); if (el) el.value = val; } };
      const setAll = (ids, obj) => { if (!obj) return; ids.forEach((id) => setIfPresent(id, obj[id])); };

      if (s.pos) {
        setAll(POS_FIELD_IDS, s.pos);
        document.getElementById("pos-hecs").checked = !!s.pos.hecs;
        document.getElementById("pos-joint").checked = !!s.pos.joint;
        document.getElementById("pos-partner-group").classList.toggle("hidden", !s.pos.joint);
        document.getElementById("pos2-hecs").checked = !!s.pos.pos2Hecs;
      }
      if (s.pth) {
        setAll(PTH_FIELD_IDS, s.pth);
        selectedState.paths = s.pth.state || "NSW";
        document.getElementById("pth-target-state-value").innerHTML = `${selectedState.paths} <span class="chevron">›</span>`;
      }
      if (s.co) {
        setAll(CO_FIELD_IDS, s.co);
        setAll(INVEST_FIELD_IDS, s.co);
        selectedState.costs = s.co.state || "NSW";
        document.getElementById("co-state-value").innerHTML = `${selectedState.costs} <span class="chevron">›</span>`;
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
        setSeg("in-property-type", s.co.propertyType);
        setIfPresent("co-ong-council", s.co.ongCouncil);
        setIfPresent("co-ong-water", s.co.ongWater);
        setIfPresent("co-ong-insurance", s.co.ongInsurance);
        setIfPresent("co-ong-strata", s.co.ongStrata);
        setIfPresent("co-ong-maint", s.co.ongMaint);
      }
      if (s.jy) {
        setAll(JY_FIELD_IDS, s.jy);
        selectedState.journey = s.jy.state || "NSW";
        document.getElementById("jy-state-value").innerHTML = `${selectedState.journey} <span class="chevron">›</span>`;
        if (s.jy.rentCredit !== undefined) document.getElementById("jy-rent-credit").checked = !!s.jy.rentCredit;
      }
      if (s.mg) {
        setAll(MG_FIELD_IDS, s.mg);
        setSeg("mg-type", s.mg.type);
        setSeg("mg-freq", s.mg.freq);
      }
      if (s.cp) {
        setAll(CP_FIELD_IDS, s.cp);
        selectedState.compare = s.cp.state || "NSW";
        document.getElementById("cp-state-value").innerHTML = `${selectedState.compare} <span class="chevron">›</span>`;
      }
      if (s.sg) setAll(SG_FIELD_IDS, s.sg);

      try {
        const savedPosition = localStorage.getItem("property-planner-position-v1");
        if (savedPosition) position = JSON.parse(savedPosition);
      } catch (e) {}
    } catch (e) { /* ignore malformed state */ }
  }

  // ---------------------------------------------------------------------
  // Home dashboard — 4 steps, in order
  // ---------------------------------------------------------------------
  let dashboardSummary = { position: null, paths: null, property: null, plan: null };
  let suppressDashboardUpdate = true;

  function loadDashboardSummary() {
    try {
      const raw = localStorage.getItem("property-planner-dashboard-v1");
      if (raw) dashboardSummary = { ...dashboardSummary, ...JSON.parse(raw) };
    } catch (e) {}
  }
  function saveDashboardSummary() {
    try { localStorage.setItem("property-planner-dashboard-v1", JSON.stringify(dashboardSummary)); } catch (e) {}
  }

  const STORY_STEPS = [
    { key: "position", screen: "position", title: "Your position", desc: "Income, savings and combined borrowing power — entered once." },
    { key: "paths", screen: "paths", title: "Compare your paths", desc: "Buy directly, or via one or two investment properties first." },
    { key: "property", screen: "costs", title: "This property", desc: "Full cost breakdown — plus yield and cashflow if it's an investment." },
    { key: "plan", screen: "journey", title: "Long-term plan", desc: "A 10-year projection, sell-vs-keep, and target-home serviceability." },
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
      card.addEventListener("click", () => switchToScreen(card.dataset.goto));
    });

    const allDone = STORY_STEPS.every((s) => dashboardSummary[s.key]);
    document.getElementById("home-subtitle").textContent = allDone
      ? "Here's your full picture. Tap any card to review or update it."
      : "Work through these in order — each one builds on the last. Tap any card to start or review it.";
  }

  // Format all number inputs with thousands separators on blur, and give
  // decimal/switch inputs the same reliable blur-saves/focus-selects
  // behaviour. This is the critical wiring that makes every input field
  // actually work correctly — without it, focus doesn't select existing
  // text (so typing appends instead of replacing) and most fields never
  // persist individually.
  document.querySelectorAll('input[inputmode="numeric"]').forEach((inp) => {
    if (!inp.hasAttribute("data-cost-key")) attachThousandsFormatting(inp);
  });
  document.querySelectorAll('input[inputmode="decimal"]').forEach((inp) => {
    inp.addEventListener("blur", saveState);
    attachSelectOnFocus(inp);
  });
  document.querySelectorAll(".switch input").forEach((inp) => inp.addEventListener("change", saveState));

  document.getElementById("pth-guided-continue").addEventListener("click", () => switchToScreen("costs"));
  document.getElementById("co-guided-continue").addEventListener("click", () => switchToScreen("journey"));
  document.getElementById("jy-guided-continue").addEventListener("click", () => switchToScreen("home"));

  // ---------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------
  restoreState();
  loadDashboardSummary();
  renderHomeCards();
  toggleInvestmentMode();

  // Pre-fill "This Property"'s cash/loan from Your Position the first
  // time it's visited, since checking a specific listing usually starts
  // from your real capacity — still fully editable afterward.
  document.querySelector('[data-goto="costs"]').addEventListener("click", () => {
    if (costsPrefilledFromPosition || !position) return;
    const priceEl = document.getElementById("co-price");
    const loanEl = document.getElementById("co-loan");
    const cashEl = document.getElementById("co-cash");
    if (parseNum(cashEl.value) === parseNum(cashEl.defaultValue || "150,000")) {
      cashEl.value = Math.round(position.currentSavings).toLocaleString("en-AU");
    }
    if (parseNum(loanEl.value) === parseNum(loanEl.defaultValue || "600,000")) {
      loanEl.value = Math.round(position.maxLoan).toLocaleString("en-AU");
    }
    costsPrefilledFromPosition = true;
    updateCoDepositImplied();
    updateLandTaxHint();
  });

  // Auto-run calculations on load so returning users see their numbers
  // immediately rather than an empty screen, without touching the
  // dashboard summary while doing so (suppressDashboardUpdate guards that).
  if (parseNum(document.getElementById("pos-salary").value) > 0) runPositionCalc();
  document.getElementById("mg-calc") && document.getElementById("mg-loan").value && runMortgageCalc(false);
  document.getElementById("co-calc").click();
  if (parseNum(document.getElementById("jy-price1").value) > 0) document.getElementById("jy-calc").click();
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
