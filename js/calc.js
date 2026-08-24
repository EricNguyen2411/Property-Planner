// calc.js
// Mortgage repayment math and the reverse affordability solver.

const RatesModule = typeof require !== "undefined" ? require("./rates.js") : window.PropRates;
const TaxModule = typeof require !== "undefined" ? require("./tax.js") : window.PropTax;

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
  buyersAgentFee = 0,
}) {
  const duty = RatesModule.stampDuty(state, price, isFirstHomeBuyer);
  const lmi = RatesModule.estimateLMI(loanAmount, price, lmiWaived);
  const otherCosts = { ...RatesModule.DEFAULT_UPFRONT_COSTS, ...otherCostsOverrides };
  const otherCostsTotal = Object.values(otherCosts).reduce((a, b) => a + Number(b || 0), 0) + buyersAgentFee;
  const deposit = Math.max(price - loanAmount, 0);
  const totalCashRequired = deposit + duty + otherCostsTotal + lmi;

  return {
    price,
    loanAmount,
    deposit,
    stampDuty: duty,
    lmi,
    otherCosts,
    buyersAgentFee,
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
  negativeGearingQuarantined = false, // true for an established property bought now: from FY2027-28,
                                        // losses can't offset salary — see the 2026 Budget reform
  buyersAgentFee = 0,
}) {
  const deposit = price * (depositPct / 100);
  const loanAmount = price - deposit;
  const duty = RatesModule.stampDuty(state, price, false); // investment: no FHB concession
  const lmi = RatesModule.estimateLMI(loanAmount, price, false);
  const otherUpfront = { ...RatesModule.DEFAULT_UPFRONT_COSTS, ...otherUpfrontOverrides };
  const otherUpfrontTotal = Object.values(otherUpfront).reduce((a, b) => a + Number(b || 0), 0) + buyersAgentFee;
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

    // From FY2027-28, a loss on an established property bought after the 2026
    // Budget can only offset other rental/capital-gains income, not salary —
    // it's quarantined and carried forward rather than refunded now. A taxable
    // PROFIT is unaffected either way; only the loss-offset direction changes.
    const lossIsQuarantined = negativeGearingQuarantined && taxableIncome < 0;
    const taxEffectAnnual = lossIsQuarantined ? 0 : -taxableIncome * (taxRatePct / 100);
    const carriedForwardLoss = lossIsQuarantined ? -taxableIncome : 0;
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
      carriedForwardLoss,
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

// Invert the P&I repayment formula: given a monthly amount available for
// repayments, find the loan size that produces exactly that repayment.
function maxLoanFromRepayment(monthlyRepayment, annualRatePct, termYears) {
  if (monthlyRepayment <= 0) return 0;
  const periodRate = annualRatePct / 100 / 12;
  const n = termYears * 12;
  if (periodRate === 0) return monthlyRepayment * n;
  return (monthlyRepayment * (1 - Math.pow(1 + periodRate, -n))) / periodRate;
}

// ---------------------------------------------------------------------------
// Borrowing power (serviceability) estimate
//
// Mirrors the real structure lenders use: assessed income (with shading on
// bonus/overtime and rental income) minus tax minus living expenses minus
// existing debt commitments minus HECS, tested against the proposed loan at
// the actual rate PLUS the APRA serviceability buffer — not the real rate.
//
// This is a simplification of real bank serviceability models (every lender's
// calculator differs), not a substitute for a formal pre-approval.
// ---------------------------------------------------------------------------

const APRA_SERVICEABILITY_BUFFER_PCT = 3;

function borrowingPower({
  grossSalaryAnnual,
  otherIncomeAnnual = 0,
  otherIncomeShadePct = 80,
  isInvestmentPurchase = false,
  rentalIncomeWeekly = 0,
  rentalIncomeShadePct = 80,
  hasHecsDebt = false,
  dependents = 0,
  livingExpensesMonthly, // if omitted, uses the simplified default
  creditCardLimitsTotal = 0,
  personalLoanMonthly = 0,
  otherLoanRepaymentsMonthly = 0,
  existingLoanBalancesTotal = 0, // optional, for the DTI check only
  annualRatePct,
  termYears,
}) {
  const shadedOtherIncome = otherIncomeAnnual * (otherIncomeShadePct / 100);
  const taxableEmploymentIncome = grossSalaryAnnual + shadedOtherIncome;

  const netEmploymentIncome = TaxModule.netAnnualIncome(taxableEmploymentIncome, hasHecsDebt);

  const shadedRentalAnnual = isInvestmentPurchase ? rentalIncomeWeekly * 52 * (rentalIncomeShadePct / 100) : 0;

  const netAnnualIncomeTotal = netEmploymentIncome + shadedRentalAnnual;
  const netMonthlyIncome = netAnnualIncomeTotal / 12;

  const livingExpenses = livingExpensesMonthly != null && livingExpensesMonthly > 0
    ? livingExpensesMonthly
    : TaxModule.simplifiedLivingExpenseMonthly(dependents);

  const creditCardMonthlyCommitment = creditCardLimitsTotal * 0.03; // 3% of limit/month, regardless of balance
  const totalDebtCommitmentsMonthly = creditCardMonthlyCommitment + personalLoanMonthly + otherLoanRepaymentsMonthly;

  const netMonthlySurplus = netMonthlyIncome - livingExpenses - totalDebtCommitmentsMonthly;

  const assessedRatePct = annualRatePct + APRA_SERVICEABILITY_BUFFER_PCT;
  const maxLoan = Math.max(maxLoanFromRepayment(Math.max(netMonthlySurplus, 0), assessedRatePct, termYears), 0);

  const grossAnnualIncome = grossSalaryAnnual + otherIncomeAnnual + (isInvestmentPurchase ? rentalIncomeWeekly * 52 : 0);
  const dti = grossAnnualIncome > 0 ? (existingLoanBalancesTotal + maxLoan) / grossAnnualIncome : 0;

  return {
    taxableEmploymentIncome,
    netEmploymentIncome,
    shadedRentalAnnual,
    netAnnualIncomeTotal,
    netMonthlyIncome,
    livingExpenses,
    creditCardMonthlyCommitment,
    totalDebtCommitmentsMonthly,
    netMonthlySurplus,
    assessedRatePct,
    maxLoan: Math.floor(maxLoan / 100) * 100, // round down to nearest $100, stay conservative
    dti,
    dtiExceedsSix: dti >= 6,
  };
}

// Remaining loan balance after a number of years of P&I repayments.
function loanBalanceAfterYears(loanAmount, annualRatePct, termYears, yearsElapsed, frequency = "monthly") {
  const n = FREQUENCIES[frequency];
  const periodRate = annualRatePct / 100 / n;
  const repayment = repaymentPI(loanAmount, annualRatePct, termYears, frequency);
  const periodsElapsed = Math.min(yearsElapsed * n, termYears * n);
  let balance = loanAmount;
  for (let i = 0; i < periodsElapsed; i++) {
    const interest = balance * periodRate;
    balance = Math.max(balance - (repayment - interest), 0);
  }
  return balance;
}

// ---------------------------------------------------------------------------
// Investment-then-home journey: property 1 (investment, bought now) grows in
// value, some of that growth becomes usable equity via a later refinance,
// which — combined with any additional cash saved — funds the deposit on
// property 2 (a future owner-occupied home).
// ---------------------------------------------------------------------------

function investmentThenHomeJourney({
  price1,
  depositPct1,
  annualRatePct1,
  termYears1,
  growthCagrPct1,
  yearsUntilProperty2,
  equityReleaseLVRPct = 80,
  additionalSavingsByThen = 0,
  property2State,
  property2MaxLoan,
  property2IsFirstHomeBuyer = false,
}) {
  const deposit1 = price1 * (depositPct1 / 100);
  const loan1 = price1 - deposit1;
  const value1AtYearN = price1 * Math.pow(1 + growthCagrPct1 / 100, yearsUntilProperty2);
  const loanBalanceAtYearN = loanBalanceAfterYears(loan1, annualRatePct1, termYears1, yearsUntilProperty2);
  const usableEquity = Math.max(value1AtYearN * (equityReleaseLVRPct / 100) - loanBalanceAtYearN, 0);
  const totalDepositAvailable = usableEquity + additionalSavingsByThen;

  const property2 = solveMaxPropertyPrice({
    maxLoanAmount: property2MaxLoan,
    availableCash: totalDepositAvailable,
    state: property2State,
    isFirstHomeBuyer: property2IsFirstHomeBuyer,
    lmiWaived: false,
  });

  return {
    property1: { price: price1, deposit: deposit1, loan: loan1 },
    atYearN: {
      years: yearsUntilProperty2,
      value: value1AtYearN,
      loanBalance: loanBalanceAtYearN,
      equityGrown: value1AtYearN - price1,
      usableEquity,
      additionalSavingsByThen,
      totalDepositAvailable,
    },
    property2,
  };
}

// ---------------------------------------------------------------------------
// Exit / sale estimate — capital gains tax when eventually selling.
//
// From 1 July 2027, established residential properties bought after the
// 2026 Budget (7:30pm 12 May 2026) lose the 50% CGT discount: gains are
// instead taxed on an inflation-indexed cost base with a 30% MINIMUM tax
// rate on the real gain. New builds keep a choice between the old 50%
// discount and the new indexation method when sold.
//
// This deliberately shows BOTH methods as bounding estimates rather than
// trying to precisely model the pre/post-1-July-2027 split of the gain —
// that requires either a professional valuation or the ATO's apportionment
// formula, and the exact mechanics were still being finalised at the time
// this was written. Treat this as directional, not exact.
// ---------------------------------------------------------------------------

function exitEstimate({
  price,
  depositPct,
  annualRatePct,
  loanTermYears,
  stampDuty,
  otherAcquisitionCosts,
  growthCagrPct,
  yearsHeld,
  agentCommissionPct,
  legalMarketingFlat,
  taxRatePct,
  assumedCpiPct,
  isNewBuild,
}) {
  const loanAmount = price * (1 - depositPct / 100);
  const salePrice = price * Math.pow(1 + growthCagrPct / 100, yearsHeld);
  const sellingCostsTotal = salePrice * (agentCommissionPct / 100) + legalMarketingFlat;
  const costBase = price + stampDuty + otherAcquisitionCosts;

  const loanBalanceAtSale = loanBalanceAfterYears(loanAmount, annualRatePct, loanTermYears, yearsHeld);

  // Old rules: 50% discount on the nominal gain (only meaningful if held > 12 months)
  const nominalGain = salePrice - sellingCostsTotal - costBase;
  const heldOverTwelveMonths = yearsHeld >= 1;
  const taxableGainOld = nominalGain > 0 ? nominalGain * (heldOverTwelveMonths ? 0.5 : 1) : 0;
  const cgtOld = taxableGainOld * (taxRatePct / 100);

  // New rules (from 1 July 2027): indexed cost base, 30% minimum tax rate on the real gain
  const indexedCostBase = costBase * Math.pow(1 + assumedCpiPct / 100, yearsHeld);
  const indexedGain = salePrice - sellingCostsTotal - indexedCostBase;
  const effectiveRateNew = Math.max(taxRatePct / 100, 0.30);
  const cgtNew = indexedGain > 0 ? indexedGain * effectiveRateNew : 0;

  // New builds get to choose whichever is cheaper; established properties
  // bought now are locked into the new rules for any gain from 1 July 2027.
  const cgtPayable = isNewBuild ? Math.min(cgtOld, cgtNew) : cgtNew;
  const methodUsed = isNewBuild ? (cgtOld <= cgtNew ? "old (50% discount)" : "new (indexation)") : "new (indexation)";

  const netProceedsAfterSaleLoanAndTax = salePrice - sellingCostsTotal - loanBalanceAtSale - cgtPayable;

  return {
    salePrice,
    sellingCostsTotal,
    costBase,
    loanBalanceAtSale,
    nominalGain,
    cgtOld,
    indexedCostBase,
    indexedGain,
    cgtNew,
    cgtPayable,
    methodUsed,
    netProceedsAfterSaleLoanAndTax,
  };
}

const PropCalcExports = {
  mortgageSummary,
  upfrontCosts,
  solveMaxPropertyPrice,
  canAfford,
  firstYearInterest,
  investmentAnalysis,
  maxLoanFromRepayment,
  borrowingPower,
  loanBalanceAfterYears,
  investmentThenHomeJourney,
  exitEstimate,
  FREQUENCIES,
};

if (typeof module !== "undefined") {
  module.exports = PropCalcExports;
}
if (typeof window !== "undefined") {
  window.PropCalc = PropCalcExports;
}
