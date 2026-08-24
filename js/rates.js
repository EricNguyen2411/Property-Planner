// rates.js
// Stamp duty, LMI and default cost assumptions for Australian property purchases.
//
// SOURCES & CURRENCY: Bracket schedules compiled and cross-checked against
// multiple published calculators and state revenue office guidance, verified
// against several independent worked examples (e.g. TAS $600k -> $22,498,
// ACT $600k investor -> $15,720, NT $500k -> $23,928.60, SA $500k -> $21,330
// all matched exactly). Correct as at August 2026.
//
// Stamp duty brackets, first-home-buyer thresholds and LMI premiums are set
// by state governments and lenders/insurers respectively, and change
// (sometimes every financial year, via indexation or budget announcements).
// Treat every figure in this file as INDICATIVE. All rates are editable here
// and shown with their "last verified" date in the app's Rates screen.

const RATES_LAST_VERIFIED = "August 2026";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Apply a progressive bracket schedule. Brackets: [{ upTo, base, rate, over }]
// upTo = Infinity for the top bracket. Duty = base + rate * (value - over).
function applyBrackets(value, brackets) {
  if (value <= 0) return 0;
  for (const b of brackets) {
    if (value <= b.upTo) {
      return b.base + b.rate * (value - b.over);
    }
  }
  const top = brackets[brackets.length - 1];
  return top.base + top.rate * (value - top.over);
}

// Linear taper of duty from `fullDutyAt` price down to 0 duty at `exemptUpTo`,
// used by NSW/VIC/QLD/WA-style first-home-buyer sliding concessions.
// Below exemptUpTo: $0. Between exemptUpTo and fullDutyAt: taper. Above: full duty.
function taperedFHBConcession(price, standardDuty, exemptUpTo, fullDutyAt) {
  if (price <= exemptUpTo) return 0;
  if (price >= fullDutyAt) return standardDuty;
  const fraction = (price - exemptUpTo) / (fullDutyAt - exemptUpTo);
  return Math.round(standardDuty * fraction);
}

// ---------------------------------------------------------------------------
// Stamp duty bracket schedules (standard / general rate, established property)
// ---------------------------------------------------------------------------

const STAMP_DUTY_BRACKETS = {
  NSW: [
    { upTo: 17000, base: 0, rate: 0.0125, over: 0 },
    { upTo: 36000, base: 212, rate: 0.015, over: 17000 },
    { upTo: 97000, base: 497, rate: 0.0175, over: 36000 },
    { upTo: 372000, base: 1564, rate: 0.035, over: 97000 },
    { upTo: 1240000, base: 11154, rate: 0.045, over: 372000 },
    { upTo: 3870000, base: 50254, rate: 0.055, over: 1240000 },
    { upTo: Infinity, base: 194904, rate: 0.07, over: 3870000 },
  ],
  VIC: [
    { upTo: 25000, base: 0, rate: 0.014, over: 0 },
    { upTo: 130000, base: 350, rate: 0.024, over: 25000 },
    { upTo: 960000, base: 2870, rate: 0.06, over: 130000 },
    { upTo: 2000000, base: 0, rate: 0.055, over: 0 }, // flat 5.5% of total value in this band
    { upTo: Infinity, base: 110000, rate: 0.065, over: 2000000 },
  ],
  QLD: [
    { upTo: 5000, base: 0, rate: 0, over: 0 },
    { upTo: 75000, base: 0, rate: 0.015, over: 5000 },
    { upTo: 540000, base: 1050, rate: 0.035, over: 75000 },
    { upTo: 1000000, base: 17325, rate: 0.045, over: 540000 },
    { upTo: Infinity, base: 37975, rate: 0.0575, over: 1000000 },
  ],
  WA: [
    { upTo: 120000, base: 0, rate: 0.019, over: 0 },
    { upTo: 150000, base: 2280, rate: 0.0285, over: 120000 },
    { upTo: 360000, base: 3135, rate: 0.038, over: 150000 },
    { upTo: 725000, base: 11115, rate: 0.0475, over: 360000 },
    { upTo: Infinity, base: 28453.75, rate: 0.0515, over: 725000 },
  ],
  SA: [
    { upTo: 12000, base: 0, rate: 0.01, over: 0 },
    { upTo: 30000, base: 120, rate: 0.02, over: 12000 },
    { upTo: 50000, base: 480, rate: 0.03, over: 30000 },
    { upTo: 100000, base: 1080, rate: 0.035, over: 50000 },
    { upTo: 200000, base: 2830, rate: 0.04, over: 100000 },
    { upTo: 250000, base: 6830, rate: 0.0425, over: 200000 },
    { upTo: 300000, base: 8955, rate: 0.0475, over: 250000 },
    { upTo: 500000, base: 11330, rate: 0.05, over: 300000 },
    { upTo: Infinity, base: 21330, rate: 0.055, over: 500000 },
  ],
  TAS: [
    { upTo: 3000, base: 50, rate: 0, over: 0 },
    { upTo: 25000, base: 50, rate: 0.0175, over: 3000 },
    { upTo: 75000, base: 435, rate: 0.0225, over: 25000 },
    { upTo: 200000, base: 1560, rate: 0.035, over: 75000 },
    { upTo: 375000, base: 5935, rate: 0.04, over: 200000 },
    { upTo: 725000, base: 12935, rate: 0.0425, over: 375000 },
    { upTo: Infinity, base: 27810, rate: 0.045, over: 725000 },
  ],
  ACT: [
    { upTo: 200000, base: 0, rate: 0.012, over: 0 },
    { upTo: 300000, base: 2400, rate: 0.022, over: 200000 },
    { upTo: 500000, base: 4600, rate: 0.034, over: 300000 },
    { upTo: 750000, base: 11400, rate: 0.0432, over: 500000 },
    { upTo: 1000000, base: 22200, rate: 0.059, over: 750000 },
    { upTo: 1455000, base: 36950, rate: 0.064, over: 1000000 },
    { upTo: Infinity, base: null, rate: 0.0454, over: 0, flatOfTotal: true }, // flat 4.54% of full value above $1.455M
  ],
  NT: { formula: "nt-quadratic" }, // special-cased, see stampDutyNT below
};

// NT uses a quadratic formula below $525,000, flat rates above. This is a
// genuine feature of the real system, not a smoothing bug: NT applies each
// flat rate to the ENTIRE property value once a threshold is crossed
// ("cliff edges"), confirmed across multiple current sources.
function stampDutyNT(price) {
  if (price <= 525000) {
    const v = price / 1000;
    return 0.06571441 * v * v + 15 * v;
  }
  if (price <= 3000000) return price * 0.0495;
  if (price <= 5000000) return price * 0.0575;
  return price * 0.0595;
}

function standardStampDuty(state, price) {
  if (state === "NT") return Math.round(stampDutyNT(price));
  const brackets = STAMP_DUTY_BRACKETS[state];
  if (!brackets) throw new Error(`Unknown state: ${state}`);
  // ACT top bracket is a flat rate of the *total* value, not marginal-over.
  // This flat-of-total design is a genuine, confirmed feature of the real
  // ACT system, but small official rounding at the exact boundary can put
  // it fractionally below the marginal-bracket value just under the
  // threshold — guard against duty ever appearing to DECREASE for a more
  // expensive property, which is never correct regardless of rounding.
  const topBracket = brackets[brackets.length - 1];
  if (topBracket.flatOfTotal && price > brackets[brackets.length - 2].upTo) {
    const flatValue = price * topBracket.rate;
    const valueAtThreshold = applyBrackets(brackets[brackets.length - 2].upTo, brackets);
    return Math.round(Math.max(flatValue, valueAtThreshold));
  }
  return Math.round(applyBrackets(price, brackets));
}

// ---------------------------------------------------------------------------
// First home buyer concessions
// ---------------------------------------------------------------------------
// Each state: { exemptUpTo, fullDutyAt, note }. Duty is $0 up to exemptUpTo,
// then tapers linearly to full standard duty at fullDutyAt (established homes).
// Some states differentiate new vs established homes / vacant land  -  see notes.

const FHB_CONCESSIONS = {
  NSW: { exemptUpTo: 800000, fullDutyAt: 1000000, note: "Full exemption to $800,000, sliding concession to $1,000,000 (existing homes). Vacant land: exempt to $350,000, concession to $450,000." },
  VIC: { exemptUpTo: 600000, fullDutyAt: 750000, note: "Full exemption to $600,000, sliding concession to $750,000." },
  QLD: { exemptUpTo: 700000, fullDutyAt: 800000, note: "Full exemption to $700,000, sliding concession to $800,000." },
  WA: { exemptUpTo: 500000, fullDutyAt: 700000, note: "Full exemption to $500,000, sliding concession to $700,000 (metro)." },
  SA: { exemptUpTo: 0, fullDutyAt: 0, note: "No general FHB stamp duty concession on established homes. Relief available for new builds / off-the-plan only  -  not modelled here." },
  TAS: { exemptUpTo: 0, fullDutyAt: 0, note: "Temporary FHB duty exemption lapsed 30 June 2026. Standard duty now applies  -  check for a successor scheme." },
  ACT: { exemptUpTo: Infinity, fullDutyAt: Infinity, note: "Home Buyer Concession Scheme: full exemption, no property price cap and no income test (both removed from 1 July 2026) — the first uncapped stamp duty exemption in Australia. Other eligibility rules still apply (e.g. living in the home)." },
  NT: { exemptUpTo: 0, fullDutyAt: 0, note: "No general FHB stamp duty concession. A $50,000 HomeGrown Territory grant is available for new homes (not modelled as duty relief)." },
};

function fhbStampDuty(state, price) {
  const standard = standardStampDuty(state, price);
  const c = FHB_CONCESSIONS[state];
  if (!c || c.exemptUpTo === 0) return standard;
  if (state === "ACT") return price <= c.exemptUpTo ? 0 : standard; // cliff, not taper
  return taperedFHBConcession(price, standard, c.exemptUpTo, c.fullDutyAt);
}

function stampDuty(state, price, isFirstHomeBuyer) {
  return isFirstHomeBuyer ? fhbStampDuty(state, price) : standardStampDuty(state, price);
}

// ---------------------------------------------------------------------------
// Lenders Mortgage Insurance (LMI)  -  indicative premium as % of loan amount,
// banded by Loan-to-Value Ratio (LVR). Actual premiums vary significantly by
// lender, insurer, loan size and state; treat as a rough estimate only.
// ---------------------------------------------------------------------------

const LMI_BANDS = [
  { maxLVR: 0.80, rate: 0 },
  { maxLVR: 0.85, rate: 0.011 },
  { maxLVR: 0.88, rate: 0.017 },
  { maxLVR: 0.90, rate: 0.021 },
  { maxLVR: 0.92, rate: 0.028 },
  { maxLVR: 0.95, rate: 0.038 },
  { maxLVR: 1.00, rate: 0.048 },
];

function estimateLMI(loanAmount, propertyPrice, waivedByScheme) {
  if (waivedByScheme) return 0;
  const lvr = loanAmount / propertyPrice;
  if (lvr <= 0.8) return 0;
  const band = LMI_BANDS.find((b) => lvr <= b.maxLVR) || LMI_BANDS[LMI_BANDS.length - 1];
  return Math.round(loanAmount * band.rate);
}

// ---------------------------------------------------------------------------
// Default "other" upfront costs. All editable by the user in the app.
// ---------------------------------------------------------------------------

const DEFAULT_UPFRONT_COSTS = {
  conveyancing: 1500,
  buildingPestInspection: 600,
  loanApplicationFee: 400,
  mortgageRegistrationFee: 175, // varies by state, ~$100-200
  transferRegistrationFee: 175,
  titleSearchAndOther: 300,
  movingCosts: 1500, // removalists, utility connections etc. — a commonly-forgotten cost
};

// Buyer's agent fees are optional (most buyers don't use one) so this is a
// toggle-on default, not part of the base upfront cost list above.
// Percentage-based fees for a full-service engagement typically run 1.5-3%
// of the purchase price (REBAA industry surveys); flat-fee agents commonly
// charge $8,000-$30,000, averaging around $22,000. Percentage is used as
// the default here since it scales sensibly across the price ranges this
// app is used for.
const DEFAULT_BUYERS_AGENT_PCT = 2;

// ---------------------------------------------------------------------------
// Rental yield benchmarks — NATIONAL gross-yield bands, for a general sense
// of where a number sits, not a location- or property-type-specific verdict.
// Source: Cotality (CoreLogic) national gross yield data and multiple 2026
// industry guides, cross-checked. Actual "good" varies enormously — a 2.6%
// Sydney house and an 11% regional WA house can both be a reasonable buy,
// for very different reasons (growth vs income). These bands are a starting
// orientation point only.
// ---------------------------------------------------------------------------

const YIELD_BANDS = [
  { max: 3.5, label: "Low — relies on capital growth", tier: "neutral" },
  { max: 5, label: "Solid for a capital city", tier: "positive" },
  { max: 7, label: "Strong", tier: "positive" },
  { max: Infinity, label: "Very high — often regional or higher-risk", tier: "neutral" },
];

function yieldBand(yieldPct) {
  return YIELD_BANDS.find((b) => yieldPct <= b.max) || YIELD_BANDS[YIELD_BANDS.length - 1];
}

function defaultUpfrontCostsTotal() {
  return Object.values(DEFAULT_UPFRONT_COSTS).reduce((a, b) => a + b, 0);
}

// ---------------------------------------------------------------------------
// Default ongoing ownership cost assumptions (monthly), purely as starting
// points the user overrides  -  these vary enormously by property.
// ---------------------------------------------------------------------------

const DEFAULT_ONGOING_MONTHLY = {
  councilRates: 175,
  waterRates: 80,
  homeInsurance: 120,
  strata: 0, // 0 default; user sets for units/townhouses
  maintenance: 150,
};

// ---------------------------------------------------------------------------
// Investment property defaults — landlord-specific expenses, indicative
// starting points only (a buyers agency worksheet was used as the reference
// line items). Vacancy is modelled as weeks/year of lost rent rather than a
// fixed dollar figure so it scales with whichever rent scenario it's applied to.
// ---------------------------------------------------------------------------

const DEFAULT_INVESTMENT = {
  buildingInsuranceAnnual: 1000,
  landlordInsuranceAnnual: 350,
  propertyMgmtPct: 6.6, // typical inc. GST
  leasingFeeAnnual: 605, // annualised re-letting/leasing fee equivalent
  vacancyWeeks: 1.5,
  landTaxAnnual: 0, // varies hugely by state and land value — no safe default
  stratLeviesMonthly: 0,
  maintenanceMonthly: 150,
  otherExpensesAnnual: 300, // catch-all: termites, admin fee, pool maintenance etc.
  renovationCost: 0,
  miscFees: 1000,
  depreciationAnnual: 0,
  taxRatePct: 32.5,
  growthCagrPct: 5,
};

// A commonly-cited starting point for a cash buffer held back beyond your
// purchase costs — separate from your deposit — to cover vacancies, rate
// rises, or unexpected repairs without financial stress. Financial advisors
// generally suggest 3-6 months of expenses as a baseline; this figure is a
// commonly-cited specific starting point for someone with one investment
// property. It scales up with more properties or higher living costs.
const RECOMMENDED_EMERGENCY_BUFFER = 15000;

const STATE_NAMES = {
  NSW: "New South Wales",
  VIC: "Victoria",
  QLD: "Queensland",
  WA: "Western Australia",
  SA: "South Australia",
  TAS: "Tasmania",
  ACT: "Australian Capital Territory",
  NT: "Northern Territory",
};

// ---------------------------------------------------------------------------
// Rentvesting impact on first-home-buyer eligibility for a LATER
// owner-occupied purchase, if an investment property is bought first.
// Source: cross-state comparison of FHB stamp duty concession occupancy
// rules (August 2026). The federal First Home Guarantee (5% deposit, no LMI)
// is lost in EVERY state the moment you own any property, investment or not.
// ---------------------------------------------------------------------------

const RENTVESTING_FHB_IMPACT = {
  NSW: { retainsEligibility: false, note: "Buying an investment property first forfeits your First Home Buyers Assistance stamp duty concession for a later home purchase." },
  QLD: { retainsEligibility: false, note: "Buying an investment property first forfeits your First Home Concession stamp duty relief for a later home purchase." },
  VIC: { retainsEligibility: true, note: "VIC's First Home Buyer Duty Reduction isn't tied to never having owned an investment property — you may still qualify when you later buy a home to live in." },
  WA: { retainsEligibility: true, note: "WA's First Home Owner Rate of Duty isn't tied to never having owned an investment property — you may still qualify when you later buy a home to live in." },
  SA: { retainsEligibility: null, note: "Rules aren't confirmed here — check current eligibility with Revenue SA before assuming either way." },
  TAS: { retainsEligibility: null, note: "Rules aren't confirmed here — check current eligibility with the State Revenue Office before assuming either way." },
  ACT: { retainsEligibility: null, note: "Rules aren't confirmed here — check current eligibility with the ACT Revenue Office before assuming either way." },
  NT: { retainsEligibility: null, note: "Rules aren't confirmed here — check current eligibility with the NT Territory Revenue Office before assuming either way." },
};

const PropRatesExports = {
  standardStampDuty,
  fhbStampDuty,
  stampDuty,
  estimateLMI,
  DEFAULT_UPFRONT_COSTS,
  defaultUpfrontCostsTotal,
  DEFAULT_ONGOING_MONTHLY,
  DEFAULT_INVESTMENT,
  STATE_NAMES,
  FHB_CONCESSIONS,
  RENTVESTING_FHB_IMPACT,
  RATES_LAST_VERIFIED,
  RECOMMENDED_EMERGENCY_BUFFER,
  DEFAULT_BUYERS_AGENT_PCT,
  YIELD_BANDS,
  yieldBand,
};

if (typeof module !== "undefined") {
  module.exports = PropRatesExports;
}
if (typeof window !== "undefined") {
  window.PropRates = PropRatesExports;
}
