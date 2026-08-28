# Property Planner

A property affordability and strategy planner, built around one real question: **what's actually possible, and what's the next step?**

This is a from-scratch rebuild of an earlier version of the app. The previous version grew by bolting features onto whatever existed the session before — the clearest symptom was that combined income and savings were entered in two different places that didn't talk to each other. This rebuild starts from a proper plan instead: one canonical place for your financial position, everything else reads from it.

## Navigation

Four steps, in order, plus a secondary tools menu.

1. **Your Position** — combined income (you + a partner, if applying jointly), debts, current savings, monthly savings rate. Calculated once here; every other screen uses these numbers automatically. Each person's income is taxed individually (brackets, Medicare levy and HECS are all per-person, never household) then combined — that's how a joint application is actually assessed.
2. **Compare Your Paths** — the centrepiece: buy your target home directly, buy one investment property first and release equity, or buy two. Each path renders as a plain-language, colour-coded verdict rather than a bare number. Reads borrowing capacity and savings straight from Your Position — no re-entry.
3. **This Property** — full upfront cost breakdown for a specific property, plus an "Is this an investment?" toggle that reveals rental yield, cashflow before/after tax, and growth projections underneath the identical cost breakdown (the upfront-cost formula is the same in both modes — investment mode only adds analysis on top).
4. **Long-Term Plan** — a 10-year projection (property value, loan balance, usable equity at Year 5/7/10), a Sell vs Keep comparison, an extra-repayments calculator, and Property 2 serviceability with an optional credit for Property 1's projected rent. Property 1's details flow forward automatically from Compare Your Paths.

**More** (second tab): Mortgage repayments & stress test (updates live as you type — no need to press Calculate for a quick lookup), Compare Properties (save real listings side by side), Deposit Savings Goal (shows both "how long will this take" and "what do I need to save monthly" at once), and Rates, Glossary & Buying Guide.

## What's reused vs rebuilt

- `js/calc.js`, `js/rates.js`, `js/tax.js` — **unchanged**. These have been through multiple rounds of real bug-hunting across the app's history (stamp duty bracket errors, a capital-gains time-apportionment fix, joint-income tax modelling) and rebuilding them would only reintroduce risk for no benefit.
- `index.html`, `js/app.js` — **rebuilt from a clean plan**, eliminating the duplicate income/savings entry and reordering the narrative so Compare Your Paths is the second step, not a bolted-on afterthought.

## Verified against a real spreadsheet audit

This rebuild incorporates the findings from auditing two versions of a broker-style investment-property spreadsheet the app is meant to replace. Found and fixed in the source spreadsheet (not carried into the app): a workbook-wide cell-reference bug that made every growth calculation wrong by many orders of magnitude, a savings projection that only counted one partner's contribution, and an "Interest Saved" figure that wasn't actually comparing interest. The app's own capital-gains estimate improves on the spreadsheet's flat post-2027 treatment by time-apportioning the actual gain between the old 50%-discount rules and the new indexation rules, based on real hold time.

## Step 1 — Try it locally (optional)

```
cd property-planner
python3 -m http.server 8000
```
Open `http://localhost:8000` in a browser.

## Step 2 — Deploy to GitHub Pages (free hosting)

1. Create a new GitHub repository and push this folder's contents to it.
2. In the repo, go to **Settings → Pages**.
3. Under "Build and deployment", set **Source** to "Deploy from a branch", branch `main`, folder `/ (root)`.
4. Save. Your app will be live at `https://<your-username>.github.io/<repo-name>/` within a minute or two.

## Step 3 — Install it on your phone

Open the GitHub Pages URL in Safari (iOS) or Chrome (Android), then:
- **iOS**: tap the Share icon → "Add to Home Screen"
- **Android**: tap the ⋮ menu → "Add to Home screen" or "Install app"

It'll behave like a native app — full screen, works offline after the first load.

## Updating after changes

1. Edit the files, bump `CACHE_VERSION` in `service-worker.js`.
2. Push the changes to your GitHub repo (Pages redeploys automatically).
3. On your phone, fully close the app (swipe it away, don't just background it) and reopen it. A new service worker version waits until every open instance is closed before taking over, to avoid a disruptive mid-session update.

## Keeping the rates current

Every stamp duty bracket, LMI band, and default assumption lives in `js/rates.js`, with a `RATES_LAST_VERIFIED` date. All 8 states/territories' stamp duty brackets have been individually audited against official state revenue office figures. Check and update this periodically — brackets, thresholds and concessions change.

## Investment cashflow assumptions

The investment analysis separates the tax-deductible interest portion of a loan repayment from the non-deductible principal portion when estimating after-tax cashflow. It reflects the 2026 Budget's negative-gearing reform: an established property bought after 12 May 2026 can't offset a rental loss against salary from FY2027-28 onward (new builds remain exempt). This isn't tax advice — check your numbers with an accountant.

## Borrowing power assumptions

Uses real FY2026-27 income tax brackets, Medicare levy, LITO and HECS/HELP repayment thresholds, plus the APRA-mandated 3% serviceability buffer on top of the entered interest rate. Joint applications tax each person's income individually before combining — this mirrors how lenders actually assess a joint application, not a household-level approximation.

## Project structure

```
property-planner/
├── index.html              # app shell — Home, Your Position, Compare Your Paths,
│                            #   This Property, Long-Term Plan, Mortgage, Compare
│                            #   Properties, Savings Goal, Rates & Guide, More
├── manifest.json            # PWA manifest
├── service-worker.js        # offline cache, safe update pattern
├── css/
│   └── styles.css           # design system (light + dark tokens)
├── js/
│   ├── rates.js             # stamp duty / LMI / fee / land tax / investment defaults
│   ├── tax.js                # FY2026-27 income tax, Medicare levy, LITO, HECS
│   ├── glossary.js           # plain-English definitions for the tap-to-learn glossary
│   ├── calc.js                # mortgage, affordability, investment, journey & scenario engines
│   └── app.js                  # UI wiring — Your Position is the single source of
│                                #   truth for income/savings, everything else reads from it
└── icons/
    ├── icon-192.png
    └── icon-512.png
```
