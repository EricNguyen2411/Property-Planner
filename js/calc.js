// calc.js
// Mortgage repayment math and the reverse affordability solver.

const RatesModule = typeof require !== "undefined" ? require("./rates.js") : window.PropRates;

// ---------------------------------------------------------------------------
// Mortgage repayments
// ---------------------------------------------------------------------------

const FREQUENCIES = {
  monthly: 12,
  fortnightly: 26,
  weekly: 52,
};

// Standard amortising principal & interest repayment per period.
function repaymentPI(loanAmount, annualRatePct, termYears, frequency) {
  const n = FREQUENCIES[frequency];
  const periods = termYears * n;
  const periodRate = annualRatePct / 100 / n;
  if (periodRate === 0) return loanAmount / periods;
  const factor = Math.pow(1 + periodRate, periods);
  return (loanAmount * periodRate * factor) / (factor - 1);
}

function repaymentIO(loanAmount, annualRatePct, frequency) {
  const n = FREQUENCIES[frequency];
  return (loanAmount * (annualRatePct / 100)) / n;
}

// Full repayment summary, including totals and payoff timing, optionally
// with extra repayments per period (P&I only  -  extra repayments don't apply
// to interest-only loans in this model).
function mortgageSummary({
  loanAmount,
  annualRatePct,
  termYears,
  frequency = "monthly",
  repaymentType = "PI", // "PI" | "IO"
  extraPerPeriod = 0,
  offsetBalance = 0,
}) {
  const n = FREQUENCIES[frequency];
  const periodRate = annualRatePct / 100 / n;

  if (repaymentType === "IO") {
    const repayment = repaymentIO(loanAmount, annualRatePct, frequency);
    const totalInterestOverTerm = repayment * n * termYears; // IO never reduces principal
    return {
      repaymentPerPeriod: repayment,
      totalInterest: totalInterestOverTerm,
      totalPaid: totalInterestOverTerm, // principal still owed at end, not "paid off"
      payoffPeriods: null,
      payoffYears: null,
      note: "Interest-only: principal is not reduced. Loan balance remains $" + Math.round(loanAmount).toLocaleString() + " at the end of the IO period.",
    };
  }

  const baseRepayment = repaymentPI(loanAmount, annualRatePct, termYears, frequency);
  const repaymentPerPeriod = baseRepayment + extraPerPeriod;

  // Simulate period-by-period to account for extra repayments + offset (offset
  // reduces the *interest-bearing* balance, not the loan balance itself).
  let balance = loanAmount;
  let totalInterest = 0;
  let periods = 0;
  const maxPeriods = termYears * n * 3; // safety cap against infinite loops
  while (balance > 0.01 && periods < maxPeriods) {
    const interestBearingBalance = Math.max(balance - offsetBalance, 0);
    const interest = interestBearingBalance * periodRate;
    totalInterest += interest;
    const principalPaid = repaymentPerPeriod - interest;
    balance -= principalPaid;
    periods++;
    if (principalPaid <= 0) {
      // Repayment doesn't even cover interest  -  loan never pays off.
      return {
        repaymentPerPeriod: baseRepayment,
        totalInterest: null,
        totalPaid: null,
        payoffPeriods: null,
        payoffYears: null,
        note: "This repayment amount doesn't cover the interest charged  -  the loan would never be paid off. Increase the repayment or check the rate.",
      };
    }
  }

  return {
    repaymentPerPeriod: baseRepayment,
    extraPerPeriod,
    totalInterest: Math.round(totalInterest),
    totalPaid: Math.round(loanAmount + totalInterest),
    payoffPeriods: periods,
    payoffYears: Math.round((periods / n) * 10) / 10,
    note: null,
  };
}

// ---------------------------------------------------------------------------
// Upfront cost breakdown for a given property price
// ---------------------------------------------------------------------------

function upfrontCosts({
  state,
  price,
  isFirstHomeBuyer,
  loanAmount,
  lmiWaived,
  otherCostsOverrides = {},
}) {
  const duty = RatesModule.stampDuty(state, price, isFirstHomeBuyer);
  const lmi = RatesModule.estimateLMI(loanAmount, price, lmiWaived);
  const otherCosts = { ...RatesModule.DEFAULT_UPFRONT_COSTS, ...otherCostsOverrides };
  const otherCostsTotal = Object.values(otherCosts).reduce((a, b) => a + Number(b || 0), 0);
  const deposit = Math.max(price - loanAmount, 0);
  const totalCashRequired = deposit + duty + otherCostsTotal + lmi;

  return {
    price,
    loanAmount,
    deposit,
    stampDuty: duty,
    lmi,
    otherCosts,
    otherCostsTotal,
    totalCashRequired,
    lvr: loanAmount / price,
  };
}

// ---------------------------------------------------------------------------
// Reverse affordability solver
//
// Given a maximum loan amount and available cash, find the maximum property
// price such that:
//   loanAmount + availableCash >= price + stampDuty(price) + otherCosts + lmi(loanAmount, price)
//
// Costs (stamp duty, LMI) are themselves functions of price/LVR, so this is
// solved by binary search over price rather than a closed-form formula.
// ---------------------------------------------------------------------------

function solveMaxPropertyPrice({
  maxLoanAmount,
  availableCash,
  state,
  isFirstHomeBuyer,
  lmiWaived,
  otherCostsOverrides = {},
  keepCashBuffer = 0,
}) {
  const usableCash = Math.max(availableCash - keepCashBuffer, 0);
  const otherCosts = { ...RatesModule.DEFAULT_UPFRONT_COSTS, ...otherCostsOverrides };
  const otherCostsTotal = Object.values(otherCosts).reduce((a, b) => a + Number(b || 0), 0);

  // cashNeeded(price) = deposit + stampDuty + otherCosts + lmi
  // where deposit = max(price - maxLoanAmount, 0)
  function cashNeededAt(price) {
    const loanUsed = Math.min(maxLoanAmount, price);
    const deposit = Math.max(price - maxLoanAmount, 0);
    const duty = RatesModule.stampDuty(state, price, isFirstHomeBuyer);
    const lmi = RatesModule.estimateLMI(loanUsed, price, lmiWaived);
    return deposit + duty + otherCostsTotal + lmi;
  }

  // Binary search for the largest price where cashNeededAt(price) <= usableCash.
  let lo = 0;
  let hi = maxLoanAmount + usableCash + 500000; // generous upper bound; costs only add, so this over-brackets
  // Ensure hi is actually infeasible (cash needed > usable) to bracket correctly.
  while (cashNeededAt(hi) <= usableCash && hi < 100000000) {
    hi *= 1.5;
  }

  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (cashNeededAt(mid) <= usableCash) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  const maxPrice = Math.floor(lo / 100) * 100; // round down to nearest $100, stay conservative
  const breakdown = upfrontCosts({
    state,
    price: maxPrice,
    isFirstHomeBuyer,
    loanAmount: Math.min(maxLoanAmount, maxPrice),
    lmiWaived,
    otherCostsOverrides,
  });
  const remainingCash = availableCash - breakdown.totalCashRequired;

  return {
    maxPrice,
    breakdown,
    remainingCash,
    keepCashBuffer,
  };
}

// "Can I afford this specific property?" check
function canAfford({
  propertyPrice,
  maxLoanAmount,
  availableCash,
  state,
  isFirstHomeBuyer,
  lmiWaived,
  otherCostsOverrides = {},
}) {
  const loanUsed = Math.min(maxLoanAmount, propertyPrice);
  const breakdown = upfrontCosts({
    state,
    price: propertyPrice,
    isFirstHomeBuyer,
    loanAmount: loanUsed,
    lmiWaived,
    otherCostsOverrides,
  });
  const shortfall = breakdown.totalCashRequired - availableCash;
  return {
    affordable: shortfall <= 0,
    shortfall: Math.max(shortfall, 0),
    surplus: Math.max(-shortfall, 0),
    breakdown,
  };
}

// Interest paid in the first 12 months of a P&I loan (accounting for offset),
// used to separate the tax-deductible interest portion of a repayment from
// the non-deductible principal portion for investment cashflow-after-tax.
function firstYearInterest({ loanAmount, annualRatePct, termYears, offsetBalance = 0 }) {
  const n = 12; // monthly
  const periodRate = annualRatePct / 100 / n;
  const repayment = repaymentPI(loanAmount, annualRatePct, termYears, "monthly");
  let balance = loanAmount;
  let interestSum = 0;
  for (let i = 0; i < 12; i++) {
    const interestBearingBalance = Math.max(balance - offsetBalance, 0);
    const interest = interestBearingBalance * periodRate;
    interestSum += interest;
    const principalPaid = repayment - interest;
    balance = Math.max(balance - principalPaid, 0);
  }
  return interestSum;
}

// ---------------------------------------------------------------------------
// Investment property analysis
//
// Mirrors the structure of a typical buyers-agency cashflow worksheet:
// capital required -> ongoing expenses -> rental income comparables -> yield
// -> cashflow before tax -> cashflow after tax.
//
// Tax treatment: only the INTEREST portion of a P&I repayment is deductible
// (not principal), and vacancy is treated as lost income rather than a
// deductible expense. Cashflow before tax still subtracts the full P&I
// repayment (it's a real cash cost), matching how these worksheets present
// what actually leaves your bank account each year.
// ---------------------------------------------------------------------------

function investmentAnalysis({
  price,
  depositPct,
  state,
  annualRatePct,
  loanTermYears,
  offsetBalance = 0,
  renovationCost = 0,
  miscFees = 0,
  otherUpfrontOverrides = {},
  buildingInsuranceAnnual,
  landlordInsuranceAnnual,
  propertyMgmtPct,
  leasingFeeAnnual,
  vacancyWeeks,
  landTaxAnnual,
  stratLeviesMonthly,
  maintenanceMonthly,
  otherExpensesAnnual,
  lowerRentWeekly,
  higherRentWeekly,
  taxRatePct,
  depreciationAnnual,
  growthCagrPct,
}) {
  const deposit = price * (depositPct / 100);
  const loanAmount = price - deposit;
  const duty = RatesModule.stampDuty(state, price, false); // investment: no FHB concession
  const lmi = RatesModule.estimateLMI(loanAmount, price, false);
  const otherUpfront = { ...RatesModule.DEFAULT_UPFRONT_COSTS, ...otherUpfrontOverrides };
  const otherUpfrontTotal = Object.values(otherUpfront).reduce((a, b) => a + Number(b || 0), 0);
  const totalCapitalRequired = deposit + duty + lmi + otherUpfrontTotal + renovationCost + miscFees;

  const mortgage = mortgageSummary({
    loanAmount, annualRatePct, termYears: loanTermYears, frequency: "monthly", repaymentType: "PI", offsetBalance,
  });
  const repaymentAnnual = mortgage.repaymentPerPeriod * 12;
  const yr1Interest = firstYearInterest({ loanAmount, annualRatePct, termYears: loanTermYears, offsetBalance });

  const fixedAnnualExpenses =
    buildingInsuranceAnnual + landlordInsuranceAnnual + leasingFeeAnnual + landTaxAnnual +
    stratLeviesMonthly * 12 + maintenanceMonthly * 12 + otherExpensesAnnual;

  function scenario(rentWeekly) {
    const grossRentAnnual = rentWeekly * 52;
    const propertyMgmtAnnual = grossRentAnnual * (propertyMgmtPct / 100);
    const vacancyCost = vacancyWeeks * rentWeekly;
    const totalCashExpensesAnnual = fixedAnnualExpenses + propertyMgmtAnnual + vacancyCost + repaymentAnnual;
    const cashflowBeforeTaxAnnual = grossRentAnnual - totalCashExpensesAnnual;
    const yieldPct = (grossRentAnnual / price) * 100;

    const deductibleExpenses = fixedAnnualExpenses + propertyMgmtAnnual + yr1Interest + depreciationAnnual;
    const taxableIncome = grossRentAnnual - vacancyCost - deductibleExpenses;
    const taxEffectAnnual = -taxableIncome * (taxRatePct / 100); // positive = refund, negative = extra tax
    const cashflowAfterTaxAnnual = cashflowBeforeTaxAnnual + taxEffectAnnual;

    return {
      rentWeekly,
      grossRentAnnual,
      propertyMgmtAnnual,
      vacancyCost,
      totalCashExpensesAnnual,
      cashflowBeforeTaxAnnual,
      cashflowBeforeTaxWeekly: cashflowBeforeTaxAnnual / 52,
      cashflowBeforeTaxMonthly: cashflowBeforeTaxAnnual / 12,
      yieldPct,
      taxableIncome,
      taxEffectAnnual,
      cashflowAfterTaxAnnual,
      cashflowAfterTaxWeekly: cashflowAfterTaxAnnual / 52,
      cashflowAfterTaxMonthly: cashflowAfterTaxAnnual / 12,
    };
  }

  const value5yr = price * Math.pow(1 + growthCagrPct / 100, 5);
  const value10yr = price * Math.pow(1 + growthCagrPct / 100, 10);

  return {
    price, deposit, loanAmount, stampDuty: duty, lmi, otherUpfront, otherUpfrontTotal,
    renovationCost, miscFees, totalCapitalRequired,
    repaymentAnnual, repaymentMonthly: mortgage.repaymentPerPeriod, yr1Interest,
    fixedAnnualExpenses,
    lower: scenario(lowerRentWeekly),
    higher: scenario(higherRentWeekly),
    growth: { cagr: growthCagrPct, value5yr, value10yr },
  };
}

const PropCalcExports = {
  mortgageSummary,
  upfrontCosts,
  solveMaxPropertyPrice,
  canAfford,
  firstYearInterest,
  investmentAnalysis,
  FREQUENCIES,
};

if (typeof module !== "undefined") {
  module.exports = PropCalcExports;
}
if (typeof window !== "undefined") {
  window.PropCalc = PropCalcExports;
}
