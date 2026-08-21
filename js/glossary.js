// glossary.js
// Plain-English explanations for property/finance jargon used throughout the
// app. Tapping a highlighted term anywhere opens its definition in a sheet.

const GLOSSARY = {
  lvr: {
    term: "LVR",
    full: "Loan-to-Value Ratio",
    definition: "Your loan as a percentage of the property's price. A $560,000 loan on a $700,000 property is an 80% LVR. Stay at or under 80% and you avoid LMI — go above it and the bank usually charges LMI to cover its extra risk.",
  },
  lmi: {
    term: "LMI",
    full: "Lenders Mortgage Insurance",
    definition: "A one-off insurance premium the bank charges you when your deposit is under 20% (LVR over 80%). It protects the bank if you default — it does not protect you. It can cost thousands and is usually added to your loan rather than paid upfront.",
  },
  stampDuty: {
    term: "Stamp duty",
    full: "Transfer duty",
    definition: "A one-off state government tax on buying property, calculated on the purchase price using a sliding scale. It's one of the biggest upfront costs after your deposit — often tens of thousands of dollars — and is due around settlement.",
  },
  offset: {
    term: "Offset account",
    full: "Offset account",
    definition: "A bank account linked to your home loan. Every dollar sitting in it is subtracted from your loan balance before interest is calculated — so $20,000 in offset against a $500,000 loan means you only pay interest on $480,000, while your savings stay accessible.",
  },
  piVsIo: {
    term: "P&I",
    full: "Principal & Interest",
    definition: "The standard way to repay a loan — each payment reduces both the interest owed and the actual amount borrowed (the principal), so the loan is paid off by the end of the term. The alternative, Interest Only, pays just the interest for a set period, keeping repayments lower but never reducing what you owe during that time.",
  },
  negativeGearing: {
    term: "Negative gearing",
    full: "Negative gearing",
    definition: "When an investment property costs more to hold (loan interest, fees, maintenance) than the rent it earns, the shortfall is a loss you can use to reduce your taxable income — effectively getting some of that loss back as a tax refund. From FY2027-28, this only applies to new-build properties; established properties bought now have losses quarantined instead (see the Invest tab).",
  },
  yield: {
    term: "Yield",
    full: "Rental yield",
    definition: "Annual rent as a percentage of the property's price — a quick way to compare how much income different properties generate. A $500,000 property renting for $500/week earns $26,000/year, a 5.2% gross yield. It doesn't account for costs, so it's a starting point, not the full picture.",
  },
  dti: {
    term: "DTI",
    full: "Debt-to-Income ratio",
    definition: "Your total debt (all loans combined) divided by your gross annual income. Banks in Australia are now restricted in how much lending they can do above a 6x ratio — so at $100,000 income, $600,000+ in total debt starts drawing extra scrutiny.",
  },
  equity: {
    term: "Equity",
    full: "Equity",
    definition: "The share of a property you actually own outright — its current value minus what you still owe on it. A $700,000 property with a $400,000 loan balance has $300,000 of equity. As the property grows in value and you pay down the loan, equity grows too, and can sometimes be borrowed against for your next purchase.",
  },
  cagr: {
    term: "CAGR",
    full: "Compound Annual Growth Rate",
    definition: "The average yearly growth rate that would take a property from today's price to a future price, assuming steady compounding. It's a planning assumption, not a guarantee — property values don't actually rise by the same percentage every single year.",
  },
  depreciation: {
    term: "Depreciation",
    full: "Depreciation",
    definition: "A tax deduction for the wear and tear on a building and its fixtures over time, even though you haven't actually spent that money in the current year. Investors typically get a quantity surveyor's report to work out exactly how much they can claim.",
  },
  vacancy: {
    term: "Vacancy allowance",
    full: "Vacancy allowance",
    definition: "An assumption for how many weeks a year the property might sit empty between tenants, so your cashflow numbers aren't overly optimistic. It's a buffer, not a guarantee — actual vacancy depends on the local rental market.",
  },
  propertyMgmt: {
    term: "Property management",
    full: "Property management fee",
    definition: "The percentage of rent an agency charges to find tenants, collect rent, and handle day-to-day issues on your behalf. Typically 6-8% of rent including GST. You can self-manage to avoid this, but it takes real time and effort.",
  },
  fhg: {
    term: "First Home Guarantee",
    full: "First Home Guarantee",
    definition: "A federal scheme letting eligible first-home buyers purchase with just a 5% deposit and no LMI, with the government guaranteeing the rest of the gap to 20%. It only applies to owner-occupied purchases, and is lost permanently the moment you own any property — including an investment property.",
  },
  hecs: {
    term: "HECS/HELP",
    full: "HECS/HELP debt",
    definition: "A government loan for university study, repaid automatically through the tax system once your income passes a threshold. Even though it's not a normal debt, banks treat the compulsory repayment as a reduction to your take-home income when assessing how much you can borrow.",
  },
  serviceabilityBuffer: {
    term: "Serviceability buffer",
    full: "APRA serviceability buffer",
    definition: "A regulator-mandated safety margin: banks must test whether you could still afford a loan at your actual interest rate PLUS 3 percentage points, not just at today's rate. It exists so borrowers aren't left stranded if rates rise, and it significantly shrinks how much you're approved for.",
  },
  strata: {
    term: "Strata / body corporate",
    full: "Strata fees / body corporate",
    definition: "Ongoing fees for units, townhouses or any property sharing common areas (driveways, gardens, pools, building structure). They cover building insurance, maintenance and a fund for bigger future repairs — and can materially affect whether a property is actually affordable.",
  },
  conveyancing: {
    term: "Conveyancing",
    full: "Conveyancing",
    definition: "The legal process of transferring property ownership from seller to buyer — contract review, title checks, and coordinating settlement. Done by a conveyancer or solicitor, and it's a legally required cost, not an optional one.",
  },
  cashflowBeforeAfterTax: {
    term: "Cashflow before/after tax",
    full: "Cashflow before/after tax",
    definition: "Before tax: what actually leaves your bank account each year — rent in, all expenses and the full loan repayment out. After tax: that same figure adjusted for any tax refund (or extra tax) the property triggers, once negative gearing and depreciation are factored in.",
  },
  marginalTaxRate: {
    term: "Marginal tax rate",
    full: "Marginal tax rate",
    definition: "The tax rate on your NEXT dollar of income, not your average rate across all your income. Australia's brackets mean a $100,000 salary might have a marginal rate of 30%, even though the effective (average) tax paid is lower once you account for the tax-free threshold.",
  },
};

if (typeof module !== "undefined") module.exports = GLOSSARY;
if (typeof window !== "undefined") window.PropGlossary = GLOSSARY;
