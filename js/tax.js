// tax.js
// 2026-27 Australian resident individual income tax, Medicare levy, LITO and
// HECS/HELP repayment calculations. Used to estimate net (take-home) income
// for the borrowing power calculator.
//
// Figures verified against multiple independent published worked examples for
// FY2026-27 (e.g. $100k gross -> $77,480 net; $150k gross -> $110,430 net;
// $80k taxable -> $14,520 income tax; $70k taxable -> $11,520 income tax +
// $1,400 Medicare levy) — all matched exactly against the formulas below.
//
// This is a borrowing-power ESTIMATE, not a tax return calculator: it doesn't
// model every offset, deduction or fringe benefit. Treat the net income
// figure as indicative.

const TAX_RATES_LAST_VERIFIED = "August 2026 (FY2026-27 rates)";

const TAX_BRACKETS_2026_27 = [
  { upTo: 18200, base: 0, rate: 0, over: 0 },
  { upTo: 45000, base: 0, rate: 0.15, over: 18200 },
  { upTo: 135000, base: 4020, rate: 0.30, over: 45000 },
  { upTo: 190000, base: 31020, rate: 0.37, over: 135000 },
  { upTo: Infinity, base: 51370, rate: 0.45, over: 190000 },
];

function incomeTax(taxableIncome) {
  if (taxableIncome <= 0) return 0;
  for (const b of TAX_BRACKETS_2026_27) {
    if (taxableIncome <= b.upTo) return b.base + b.rate * (taxableIncome - b.over);
  }
  return 0;
}

// Low Income Tax Offset — reduces tax payable, phases out above $66,667.
function lito(taxableIncome) {
  if (taxableIncome <= 37500) return 700;
  if (taxableIncome <= 45000) return Math.max(700 - (taxableIncome - 37500) * 0.05, 0);
  if (taxableIncome <= 66667) return Math.max(325 - (taxableIncome - 45000) * 0.015, 0);
  return 0;
}

// Medicare levy: 0% below $28,011, shades in to the full 2% by $35,013.
function medicareLevy(taxableIncome) {
  if (taxableIncome <= 28011) return 0;
  if (taxableIncome <= 35013) return 0.10 * (taxableIncome - 28011);
  return 0.02 * taxableIncome;
}

// HECS/HELP marginal repayment system (from 1 July 2025 onward).
function hecsRepayment(repaymentIncome) {
  if (repaymentIncome <= 69528) return 0;
  if (repaymentIncome <= 129717) return 0.15 * (repaymentIncome - 69528);
  if (repaymentIncome <= 186050) return 9028 + 0.17 * (repaymentIncome - 129717);
  return 0.10 * repaymentIncome; // flat 10% of total repayment income at the top band
}

// Net annual income after income tax, LITO, Medicare levy, and (optionally) HECS.
function netAnnualIncome(taxableIncome, hasHecsDebt) {
  const tax = Math.max(incomeTax(taxableIncome) - lito(taxableIncome), 0);
  const levy = medicareLevy(taxableIncome);
  const hecs = hasHecsDebt ? hecsRepayment(taxableIncome) : 0;
  return taxableIncome - tax - levy - hecs;
}

// Simplified living-expense starting point — NOT the real bank HEM benchmark
// (which varies by income, location and lifestyle tier and isn't public).
// Used only as a sensible default the person should override with their own figure.
function simplifiedLivingExpenseMonthly(dependents) {
  const base = 2200; // single adult, modest
  const perDependent = 500;
  return base + dependents * perDependent;
}

const TaxExports = {
  incomeTax,
  lito,
  medicareLevy,
  hecsRepayment,
  netAnnualIncome,
  simplifiedLivingExpenseMonthly,
  TAX_RATES_LAST_VERIFIED,
};

if (typeof module !== "undefined") module.exports = TaxExports;
if (typeof window !== "undefined") window.PropTax = TaxExports;
