# Property Planner — Australian Property Affordability Calculator

A PWA that works backwards from your actual finances — maximum loan and savings — to your real maximum property price, after stamp duty, LMI and every other upfront cost. Also includes a mortgage repayment calculator and a full purchase-cost breakdown.

- **Afford** — enter your max loan + savings, get your real maximum purchase price. Includes an optional "estimate my borrowing power from income" panel: salary, other income, rental income (if buying an investment), HECS/HELP, dependents, living expenses and existing debts, run through real FY2026-27 tax brackets and the APRA 3% serviceability buffer to estimate your maximum loan
- **Mortgage** — repayments, total interest, payoff date, extra repayments, offset
- **Costs** — full upfront cost breakdown for a specific property, plus a "can I afford this" check
- **Invest** — investment property cashflow: yield, upfront capital required, and cashflow before/after tax across a lower- and higher-rent scenario, with 5/10-year growth projections. Includes a New Build / Established toggle reflecting the 2026 Budget's negative gearing reform (established properties bought now lose the ability to offset losses against salary from FY2027-28 — new builds are exempt)
- **Journey** — for buying an investment property now and a home to live in later: models Property 1's equity growth, how much of it you could release to fund Property 2's deposit, and flags the state-specific impact on first-home-buyer stamp duty relief and the federal First Home Guarantee
- **Compare** — save a few real properties side by side (price, deposit, total cash required, yield, cashflow) with a "best cashflow" highlight, so you're comparing like-for-like instead of re-running numbers in your head
- **Rates** — every stamp duty / LMI / fee assumption the app uses, editable, with a last-verified date, a step-by-step buying process guide, and a full glossary of every term used in the app
- **Glossary** — tap any dotted-underline term anywhere in the app (Stamp duty, LMI, LVR, Negative gearing, Yield, DTI, and 15 more) for a plain-English explanation in a bottom sheet — helpful if you're new to property
- A first-run welcome guide offers a **guided walkthrough** — chains Afford → Invest → Costs → Journey in order, carrying your numbers forward automatically at each step so you never retype the same price twice. Restart it anytime from the Rates tab.
- The Mortgage tab includes a rate stress test showing your repayment from -1% to +3% (the buffer banks assess you at)
- Light, dark and system theme
- Installable to your home screen, works fully offline after first load
- All data stays on your device (localStorage only — nothing is sent anywhere)

## Step 1 — Try it locally (optional)

Open `index.html` directly in a browser, or serve the folder locally:

```
cd property-planner
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## Step 2 — Deploy to GitHub Pages (free hosting)

1. Create a new **public** GitHub repo (e.g. `property-planner`).
2. From inside this folder:
   ```
   git init
   git add .
   git commit -m "property planner app"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/property-planner.git
   git push -u origin main
   ```
3. GitHub repo → **Settings → Pages** → Source: **Deploy from a branch** → `main`, `/ (root)` → Save.
4. After a minute or two: `https://YOUR_USERNAME.github.io/property-planner/`

## Step 3 — Install it on your phone

Open the URL from Step 2 on your phone in Safari (iOS) or Chrome (Android), then:

- **iOS Safari**: Share button → Add to Home Screen
- **Android Chrome**: ⋮ menu → Add to Home screen / Install app

The app then runs offline, with its own icon, no browser chrome.

## Updating after changes

Whenever you edit any file, bump the cache version in `service-worker.js`:

```js
const CACHE_VERSION = "property-planner-v10"; // increment this
```

Then commit and push — GitHub Pages redeploys automatically within a minute or two. On your phone, **fully close** the app (not just background it) and reopen it to pick up the update; the service worker deliberately waits for a clean restart rather than hot-swapping mid-session.

## Keeping the rates current

Stamp duty brackets, first-home-buyer thresholds and LMI premiums are set by state governments and lenders, and change — sometimes every financial year. All of them live in `js/rates.js`, clearly labelled and commented, with a `RATES_LAST_VERIFIED` date at the top. If your state revenue office publishes new figures, that's the one file to update. The **Rates** tab in the app itself also lists the default upfront costs as editable fields, and shows the first-home-buyer concession notes for every state, so discrepancies are easy to spot.

This is a personal planning tool, not financial or legal advice — always confirm exact figures with your state revenue office, lender, or conveyancer before relying on them.

## Investment cashflow assumptions

The Invest tab separates the tax-deductible interest portion of a loan repayment from the non-deductible principal portion when estimating your after-tax cashflow (a common simplification error in flat spreadsheets is to treat the whole P&I repayment as deductible, which overstates any negative-gearing refund). It doesn't model entity structure (joint ownership, trusts, company ownership) — enter your own effective marginal tax rate instead. It also reflects the 2026 Budget's negative-gearing reform: an established property bought now can't offset a rental loss against your salary from FY2027-28 onward (new builds remain exempt) — select the right property type on the Invest tab for an accurate after-tax figure. This isn't tax advice; check your numbers with an accountant before relying on them.

## Borrowing power assumptions

The income-based borrowing estimate on the Afford tab mirrors the real structure lenders use — assessed income minus tax minus living expenses minus existing debts, tested against the loan at your rate plus the APRA 3% serviceability buffer — using real FY2026-27 tax brackets, Medicare levy, LITO and the HECS/HELP marginal repayment system. It is not a real bank serviceability calculator: every lender shades bonus/rental income and weighs living expenses differently, and the living-expense default here is a simplified placeholder, not the real bank HEM benchmark (which varies by income, location and household profile and isn't public). Treat the result as a planning estimate, not a pre-approval.

## Journey planner assumptions

The Journey tab assumes you can refinance Property 1 up to your chosen LVR to release equity, and that a lender approves the new loan for Property 2 — both depend on serviceability at the time, not just the property's value. It always calculates Property 2 at standard (non-concession) stamp duty with no LMI waiver, because the federal First Home Guarantee is lost the moment you own any property, and first-home stamp duty concessions are lost in some states (confirmed for NSW and QLD) but not others (VIC and WA don't require you to have never owned an investment property). Confirm your own state's current rules before relying on this.

## Project structure

```
property-planner/
├── index.html            # app shell, all 4 screens
├── manifest.json          # PWA manifest
├── service-worker.js      # offline cache, safe update pattern
├── css/
│   └── styles.css         # design system (light + dark tokens)
├── js/
│   ├── rates.js           # stamp duty / LMI / fee / investment default data
│   ├── tax.js              # FY2026-27 income tax, Medicare levy, LITO, HECS
│   ├── glossary.js         # plain-English definitions for the tap-to-learn glossary
│   ├── calc.js             # mortgage, affordability, investment & borrowing-power engine
│   └── app.js               # UI wiring
└── icons/
    ├── icon-192.png
    └── icon-512.png
```
