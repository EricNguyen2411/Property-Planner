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
    });
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
  let activeStateTarget = null; // 'af' or 'co'
  let selectedState = { af: "NSW", co: "NSW" };

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

    document.getElementById("rates-verified-date").textContent = R.RATES_LAST_VERIFIED;
  }
  renderRatesTab();

  // ---------------------------------------------------------------------
  // Persistence (local only — this is a personal calculator, no sync)
  // ---------------------------------------------------------------------
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
      };
      localStorage.setItem("property-planner-state-v1", JSON.stringify(state));
    } catch (e) { /* storage unavailable - ignore */ }
  }

  function restoreState() {
    try {
      const raw = localStorage.getItem("property-planner-state-v1");
      if (!raw) return;
      const s = JSON.parse(raw);
      if (s.af) {
        document.getElementById("af-loan").value = s.af.loan || "";
        document.getElementById("af-cash").value = s.af.cash || "";
        document.getElementById("af-buffer").value = s.af.buffer || "";
        selectedState.af = s.af.state || "NSW";
        document.getElementById("af-state-value").innerHTML = `${selectedState.af} <span class="chevron">›</span>`;
        document.getElementById("af-fhb").checked = !!s.af.fhb;
        document.getElementById("af-lmi-waived").checked = !!s.af.lmiWaived;
        document.getElementById("af-lmi-waived-row").classList.toggle("hidden", !s.af.fhb);
      }
      if (s.mg) {
        document.getElementById("mg-loan").value = s.mg.loan || "";
        document.getElementById("mg-rate").value = s.mg.rate || "";
        document.getElementById("mg-term").value = s.mg.term || "";
        document.getElementById("mg-extra").value = s.mg.extra || "";
        document.getElementById("mg-offset").value = s.mg.offset || "";
        setSeg("mg-type", s.mg.type);
        setSeg("mg-freq", s.mg.freq);
      }
      if (s.co) {
        document.getElementById("co-price").value = s.co.price || "";
        document.getElementById("co-loan").value = s.co.loan || "";
        document.getElementById("co-cash").value = s.co.cash || "";
        selectedState.co = s.co.state || "NSW";
        document.getElementById("co-state-value").innerHTML = `${selectedState.co} <span class="chevron">›</span>`;
        document.getElementById("co-fhb").checked = !!s.co.fhb;
        document.getElementById("co-lmi-waived").checked = !!s.co.lmiWaived;
        document.getElementById("co-lmi-waived-row").classList.toggle("hidden", !s.co.fhb);
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
  });
  document.querySelectorAll('.switch input').forEach((inp) => inp.addEventListener("change", saveState));

  restoreState();

  // ---------------------------------------------------------------------
  // Register service worker
  // ---------------------------------------------------------------------
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("service-worker.js").catch(() => {});
    });
  }
})();
