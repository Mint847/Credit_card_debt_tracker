# Serendib: Sri Lanka Credit Card Debt Tracker

> A web app that helps Sri Lankan cardholders see all their credit card debt in one place, decide which card to pay first, log spending and payments, and understand what minimum payments, cash advances and "0%" plans really cost.

**Live app:** https://stitch-debt-manager.web.app

It works on phones, iPads and desktop computers, in light or dark mode, and syncs across all of your devices.

---

## Contents

- [Features](#features)
  - [Home dashboard](#home-dashboard)
  - [Cards and the monthly repayment plan](#cards-and-the-monthly-repayment-plan)
  - [Card page](#card-page)
  - [Spending, payments and statements](#spending-payments-and-statements)
  - [Simulators](#simulators)
  - [Spaces (savings buffers)](#spaces-savings-buffers)
  - [Offers](#offers)
  - [Profile and settings](#profile-and-settings)
  - [Accounts, sync and your data](#accounts-sync-and-your-data)
  - [Phone, iPad and desktop](#phone-ipad-and-desktop)
  - [Guided setup and tutorial](#guided-setup-and-tutorial)
- [How the numbers are worked out](#how-the-numbers-are-worked-out)
- [Supported banks](#supported-banks)
- [Repository structure](#repository-structure)
- [Technical architecture](#technical-architecture)
- [Running it locally](#running-it-locally)
- [Deployment](#deployment)
- [Change history](#change-history)
- [License](#license)

---

## Features

### Home dashboard
- **Debt at a glance:** total debt, total limit, overall credit utilisation (target under 30%) and a safe-limit marker.
- **One-tap logging:** *Log spend* and *Log payment* buttons. Pick the card and the amount, and every total updates straight away.
- **Alerts that need you.** Each alert has a coloured status label:
  - **Payment due:** the next due date, the minimum left to pay, and a *Log payment* shortcut. It changes to **On track** once every minimum is paid.
  - **Check-in:** "Did you pay?" the day after a due date when the minimum looks unpaid.
  - **Overdue:** how many days late, with a catch-up plan. A **Critical** alert warns before a missed payment can be reported to CRIB (30+ days).
  - **Over budget:** a spending category over its budget this period.
  - **Tomorrow:** recurring charges due the next day.
  - **Interest:** estimated interest this month across all cards.
- **Payoff pace:** the bank minimum against your target plan, your debt-free date and the interest you save.
- **Calculator shortcuts** and a **setup checklist** for new users.

### Cards and the monthly repayment plan
- **Add, edit and delete cards:** bank, card tier or nickname, credit limit, current balance, APR and an icon colour.
  - **Bank suggestions:** a type-ahead list of Sri Lankan banks with their card networks. Typing "amex", "hsbc" or "standard chartered" finds the bank that now issues those cards.
  - **Tier chips:** the bank's own card tiers (for example *Visa Platinum*, *Mastercard World*) appear as one-tap chips.
  - **Card colours:** chosen per card and carried through every screen.
- **This month's repayment strategy:**
  - Every card gets at least its minimum, and the rest goes to one **Pay first** card, chosen by your strategy.
  - **Avalanche** pays the highest interest first and saves the most money. **Snowball** pays the smallest balance first for quicker wins.
  - When a card is cleared, its money rolls on to the next one.
- **Log this month's payment:** records the plan's suggested payment on the pay-first card in one step.
- **Overview tiles:** total interest bleed this month and your debt-free target month.
- **Mark as settled:** clears a card without deleting its history.

### Card page
- **Summary:** outstanding balance, remaining limit, utilisation and the next statement and due date.
- **Three calculators for that card.** Swipe left or right on a phone or iPad to move between them; on desktop they sit beside the summary.
  - **Payoff simulator:** minimum-only payoff time and interest against a fixed payment. A slider (Min, Recommended, 50%, Full) shows how much paying more saves. *Commit a monthly payment* saves a target the plan always honours.
  - **Cash advance:** the bank's fee and daily interest for 15, 30 and 60 days.
  - **0% surcharge:** the true yearly interest rate hidden in a "0%" plan's upfront fee.
- **Share your progress:** a short progress message with no balances, limits or bank details. It uses the phone's share sheet where available, or copies the text.
- **Card actions:** edit details, clear the balance, set the billing cycle, delete the card.

### Spending, payments and statements
- **Log entries:** purchases, payments and refunds, with a category, merchant, date and note. Merchant names are suggested from your history.
- **Paste a bank SMS:** paste the bank's transaction message and the amount, merchant and date are filled in for you.
- **Budgets per category:** set them for each card, with progress bars and over-budget alerts.
- **Recurring payments** (subscriptions, bills): they add themselves on the right day each month. You can pause or cancel them, give them an end date, or undo a month's charge so that month is skipped.
- **History:** every entry, searchable. Tap an entry to edit or delete it.
- **Match statement:** if the balance doesn't match your bank statement, enter the statement figure and the difference is recorded as an adjustment.
- **Billing cycles:** set the statement day and due day for each card. The app then:
  - records each statement
  - tracks how much of the minimum you've paid
  - detects overdue payments, with a catch-up plan for each card

### Simulators
Three sandboxes. Load one of your cards, or try your own numbers:
- **Minimum payment trap:** how long a balance takes to clear on minimums, and how much a fixed payment of about 12 months saves. Includes a principal-versus-interest split of the first payment.
- **Cash advance trap:** the upfront fee, daily interest and total owed for any amount and number of days.
- **0% surcharge exposer:** the hidden cost and yearly interest rate of an instalment plan's fee.

### Spaces (savings buffers)
- **Create a space:** an emergency fund or another savings goal, with a target amount and date.
- **Use your spaces:** add money, use funds from a space (including paying a card), and see each space's history.
- **Overview:** a combined total with a progress bar across every space.

### Offers
- **Card promotions from Sri Lankan banks:** filter by category, or by **My cards** against **Explore all**. Each offer shows its terms, eligible cards and whether your cards qualify.
- **Sample offers for now:** the Offers page shows sample offers until live promotions are published.
- **Offer collection pipeline** (`tools/offers-collector`):
  - a weekly GitHub Action reads each bank's official offers page
  - Claude extracts structured offers from each page
  - new or changed offers are saved as drafts, which an admin approves in the app under **Profile → Manage offers**

### Profile and settings
- **Income:** monthly take-home income, which sets the default repayment budget (25% of income).
- **Debt-to-income health:** your minimum payments as a share of your income.
- **Payoff strategy:** switch between Avalanche and Snowball.
- **Appearance:** **Light**, **Dark** or **Auto** (follows the device), saved per device.
- **CBSL reference:** the 28% p.a. card interest cap, and the usual 4% minimum payment.
- **Backup and restore:**
  - download a JSON backup of your cards, spending and spaces
  - preview a backup before restoring, then merge it or replace your data, with **Undo**
  - recover from the last 5 safety copies kept on each device
- **Account:** change your password, delete your account, sign out, and replay the app guide.

### Accounts, sync and your data
- **Sign in:** with **Google** or **email and password**, including email verification, password rules, *Keep me signed in* and password reset. X and Apple sign-in buttons are in place but not configured yet.
- **Google profile photo:** shown in every avatar on all screen sizes, with your initials as the fallback.
- **Live sync across devices:** changes on one device appear on the others without reloading.
- **Safe merging, so nothing is lost:**
  - cards and spaces are merged item by item, and the newest edit wins
  - deletions are remembered for 180 days, so a deleted card doesn't come back
  - default values never overwrite real ones
  - every save is a transaction against the latest cloud copy
- **Privacy:** Serendib never asks for card numbers or passwords. Each account can read and write only its own data (enforced by Firestore security rules).

### Phone, iPad and desktop
| Size | Layout |
|---|---|
| **Phone** | Bottom tab bar, sheets that slide up |
| **iPad** (768–1279 px) | Side rail, two-column screens, card list beside the card page, centred dialogs |
| **Desktop** (1280 px and up) | Compact dashboard (see below) |

**On desktop:**
- **Layout:**
  - a 200 px labelled sidebar
  - slim screen headers
  - desktop-sized text and spacing
  - three-column Home
  - all three simulators side by side
  - a three-pane card page (card list, summary and calculators, spending)
  - grids for Spaces and Offers
- **Extra panels** (desktop only):
  - **Upcoming payments:** overdue payments, minimums due, statements closing and recurring charges in the next 30 days
  - **Spending by category:** this period's spending across all cards, with budgets marked
  - **Utilisation by card:** each card's balance against its limit, with the 30% line
  - **Recent activity:** the latest entries across all cards; click any row to open that card
- **Account menu:** opens from your avatar in the sidebar, with:
  - Profile
  - Payoff strategy
  - Appearance
  - Backup
  - Keyboard shortcuts
  - App guide
  - Sign out
- **Keyboard shortcuts:**

  | Key | Action |
  |---|---|
  | `1`–`5` | Switch tabs |
  | `L` | Log spending |
  | `P` | Log a payment |
  | `/` | Search the open card's history |
  | `?` | Show all shortcuts |
  | `Esc` | Close a dialog |

  Visible focus outlines and themed scrollbars appear on mouse and keyboard devices.

### Guided setup and tutorial
- **Welcome:** three slides, ending with your income and payoff strategy.
- **Setup checklist:** set income, choose a strategy, link a card, set a billing cycle, try a simulator, create a buffer. Each step ticks itself off.
- **Spotlight tips on each screen:**
  - each tip follows its element even when content loads or moves, and stays fully on screen on every device
  - tips adapt to the device: swipe hints on touch screens, the shortcuts tip on desktop
  - replay them any time from Profile

---

## How the numbers are worked out
- **Payoff:**
  - each month starts from a statement balance
  - paying it in full by the due date costs no interest; whatever is left carries a month's interest (APR ÷ 12)
  - the minimum is the card's rule applied to the statement balance; most banks use 4% with an LKR 1,000 floor, and Nations Trust uses a lower LKR 250 floor
- **Fixed plan:** the "about 12 months" fixed payment is rounded up to the nearest LKR 1,000.
- **Cash advance:** the bank's fee (percentage, fixed or both, per its tariff) plus simple daily interest (APR ÷ 365) from the day of withdrawal. There is no interest-free period.
- **0% plans:** the fee is turned into an interest rate with an IRR calculation and shown as a yearly rate, the same basis as the 28% cap. For example, a 5% fee over 12 months is about 9.1% a year.
- **Interest cap:** CBSL has capped credit card interest at 28% a year since August 2023.

## Supported banks
Commercial Bank, Bank of Ceylon, People's Bank, Sampath Bank, HNB, Seylan Bank, Nations Trust Bank, NDB Bank, DFCC Bank, Pan Asia Bank, Union Bank, CDB, Cargills Bank and LOLC Finance.
- **Former brands:**
  - HSBC's retail cards now map to Nations Trust Bank (May 2026).
  - Standard Chartered's retail cards now map to DFCC Bank (July 2026).
- **Fees:** cash-advance fees come from each bank's published tariff, with the date each was checked. Banks not yet checked use the app's defaults.

---

## Repository structure

| Path | What it is |
|---|---|
| `stitch_fintech_credit_debt_manager/index.html` | The whole app: one HTML file with all screens, styles and logic |
| `stitch_fintech_credit_debt_manager/firestore.rules` | Firestore security rules (own data only; offers public to read, admin to write) |
| `stitch_fintech_credit_debt_manager/firebase.json`, `.firebaserc` | Firebase Hosting and project settings |
| `stitch_fintech_credit_debt_manager/serve.py` | Local development server with no-cache headers (port 8080) |
| `tools/offers-collector/` | Weekly offers collector (Node, Claude API, Firebase Admin) and the admin set-up script |
| `.github/workflows/offers-collector.yml` | Runs the collector every Monday |
| `0%_surcharge/`, `card_overview/`, `home_page/`, … | Original UI design prototypes |
| `Sri Lanka Credit Card App.pdf` / `.txt`, `sri_lanka_credit_card_cash_advance_fees.xlsx`, `Web design/` | Reference material |

## Technical architecture
- **Front end:** a single-page app in one HTML file, with no build step.
- **Styling:**
  - Tailwind CSS via the Play CDN (forms and container-queries plugins)
  - every colour is a CSS variable, so dark mode swaps values without touching the markup
  - responsive layers at 768, 1024, 1280, 1440 and 1536 px
- **Back end:**
  - **Firebase Authentication:** Google and email/password sign-in.
  - **Cloud Firestore:** one document per user (`users/{uid}`), plus the public `offers` collection.
  - **Firebase Hosting:** serves the app.
- **Offline cache:** each account's data is also cached on the device, so the app opens instantly and keeps up to 5 safety copies.

## Running it locally
1. **Clone the repository:**
   ```bash
   git clone https://github.com/Mint847/Credit_card_debt_tracker.git
   cd Credit_card_debt_tracker/stitch_fintech_credit_debt_manager
   ```
2. **Start the local server** from inside the app folder. It serves the current folder.
   ```bash
   python serve.py
   ```
3. **Open the app:** go to http://localhost:8080.

Sign-in and sync use the live Firebase project, so you'll need an internet connection.

## Deployment
```bash
npm install -g firebase-tools
cd stitch_fintech_credit_debt_manager
firebase login
firebase deploy --only hosting           # the app
firebase deploy --only firestore:rules   # security rules, when they change
```

---

## Change history

| Date | Change |
|---|---|
| 25 Oct 2026 | **Desktop redesign:** a compact dashboard, an account menu from the avatar, and Google profile photos everywhere |
| 25 Oct 2026 | **Tutorial update:** the spotlight follows its element reliably on every device. New tips for quick log, alerts, shortcuts, sharing, appearance and backup |
| 25 Oct 2026 | **Simulator math fixes:** one payoff method everywhere, both surcharge calculators agree, labels show the rate actually used, and the Cash Advance inputs recalculate |
| 25 Oct 2026 | **Card page:** swipe between the three calculators |
| 25 Oct 2026 | **Design:** coloured accent stripes replaced by status labels and colour dots |
| 25 Oct 2026 | **Add card form:** cleaner bank and tier suggestions (floating list, tier chips), and rounded text fields restored app-wide |
| 25 Oct 2026 | **Desktop layout:** labelled sidebar, three-pane card page and keyboard shortcuts |
| 25 Oct 2026 | **Sync fix:** cross-device data loss fixed (item-by-item merge, deletions remembered, transactional saves). Cards overview redesigned |
| 25 Oct 2026 | **iPad and large screens:** side rail, two-column layouts, centred dialogs |
| 25 Oct 2026 | **New features:** dark mode, payment tracking with statement cycles and catch-up plans, Spaces history and use-funds, backup restore with preview and Undo, sharing progress |
| 24 Oct 2026 | **Sync and colours:** card colours across the app, live cross-device sync, audit fixes |
| 24 Oct 2026 | **Spending and offers:** spend logging (SMS paste, budgets, recurring payments, history), the offers back end and collector, a sign-in overhaul, and card suggestions |
| 24 Oct 2026 | **Onboarding and bank data:** onboarding overhaul (welcome, checklist, tips) and updated bank tariffs |
| 23 Oct 2026 | **Repayment plan fixes:** strategy budget allocation, card menu actions and billing calendar inputs |
| 17–18 Oct 2026 | **Accounts:** forgot password, password rules, Google sign-up autofill, per-user data isolation, and the first guided walkthrough |
| 12 Oct 2026 | **First release:** initial version of the app and repository |

## License
This project is licensed under the **MIT License**. See [LICENSE](LICENSE) for details.
