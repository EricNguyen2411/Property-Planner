# Property Planner — Australian Property Affordability Calculator

A PWA that works backwards from your actual finances — maximum loan and savings — to your real maximum property price, after stamp duty, LMI and every other upfront cost. Also includes a mortgage repayment calculator and a full purchase-cost breakdown.

- **Afford** — enter your max loan + savings, get your real maximum purchase price
- **Mortgage** — repayments, total interest, payoff date, extra repayments, offset
- **Costs** — full upfront cost breakdown for a specific property, plus a "can I afford this" check
- **Invest** — investment property cashflow: yield, upfront capital required, and cashflow before/after tax across a lower- and higher-rent scenario, with 5/10-year growth projections
- **Rates** — every stamp duty / LMI / fee assumption the app uses, editable, with a last-verified date
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
const CACHE_VERSION = "property-planner-v5"; // increment this
```

Then commit and push — GitHub Pages redeploys automatically within a minute or two. On your phone, **fully close** the app (not just background it) and reopen it to pick up the update; the service worker deliberately waits for a clean restart rather than hot-swapping mid-session.

## Keeping the rates current

Stamp duty brackets, first-home-buyer thresholds and LMI premiums are set by state governments and lenders, and change — sometimes every financial year. All of them live in `js/rates.js`, clearly labelled and commented, with a `RATES_LAST_VERIFIED` date at the top. If your state revenue office publishes new figures, that's the one file to update. The **Rates** tab in the app itself also lists the default upfront costs as editable fields, and shows the first-home-buyer concession notes for every state, so discrepancies are easy to spot.

This is a personal planning tool, not financial or legal advice — always confirm exact figures with your state revenue office, lender, or conveyancer before relying on them.

## Investment cashflow assumptions

The Invest tab separates the tax-deductible interest portion of a loan repayment from the non-deductible principal portion when estimating your after-tax cashflow (a common simplification error in flat spreadsheets is to treat the whole P&I repayment as deductible, which overstates any negative-gearing refund). It doesn't model entity structure (joint ownership, trusts, company ownership) — enter your own effective marginal tax rate instead. This isn't tax advice; check your numbers with an accountant before relying on them.

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
│   ├── calc.js             # mortgage, affordability & investment cashflow engine
│   └── app.js               # UI wiring
└── icons/
    ├── icon-192.png
    └── icon-512.png
```
