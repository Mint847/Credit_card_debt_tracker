# Features

A complete catalogue of what Serendib does. For a quick visual tour, see the [README](../README.md).

## Contents
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

### Home dashboard
- **Debt at a glance:** total debt, total limit, overall credit utilisation (target under 30%) and a safe-limit marker.
- **One-tap logging:** the **Log** button (the **+** in the phone's tab bar) records spending, a payment, a refund or a pasted bank SMS. Pick the card and the amount, and every total updates straight away.
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
- **Overview tiles:** total interest bleed this month and your debt-free target month (the same month-by-month plan as Home).
- **Mark as settled:** clears a card without deleting its history.

### Card page
- **Summary:** outstanding balance, remaining limit, utilisation and the next statement and due date.
- **Tabs for everything on the card:** Overview (this statement cycle and payoff), Activity, Recurring, Budgets, Calculators and Billing & statements.
- **Three calculators for that card** (Calculators tab):
  - **Payoff simulator:** minimum-only payoff time and interest against a fixed payment. A slider in the card's own colour (Min, Recommended, 50%, Full) shows how much paying more saves. *Set automated monthly repayment goal* saves a target the plan always honours.
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
- **Account menu:** tap your profile picture on any screen (in the sidebar on desktop) to open it. It has:
  - your photo, name, email and sign-in method
  - Profile & settings
  - Payoff strategy and CBSL rules, each opening Profile at that section
  - Light / Dark / Auto
  - Download a backup
  - Replay app guide
  - Keyboard shortcuts (desktop only)
  - Reset my card data, which asks before doing anything
  - Sign out

  A tap outside the menu only closes it.
- **Live sync across devices:** changes on one device appear on the others without reloading.
- **Safe merging, so nothing is lost:**
  - cards and spaces are merged item by item, and the newest edit wins
  - deletions are remembered for 180 days, so a deleted card doesn't come back
  - default values never overwrite real ones
  - every save is a transaction against the latest cloud copy
- **Privacy:** Serendib never asks for card numbers or passwords. Each account can read and write only its own data (enforced by Firestore security rules).

### Phone, iPad and desktop
One app adapts to every screen (served from `/desktop/`):

| Device | Layout |
|---|---|
| **Computer** | Sidebar with your cards, a top bar with search (**Ctrl K**) and **Log**, tables with a details panel, dialogs |
| **iPad** | A labelled side rail; in landscape, two-column pages; sheets and dialogs sized for touch |
| **Phone** | A design of its own: larger text, rounded cards, a bottom tab bar (Overview, Cards, **+**, Plan, More), bottom sheets, a one-handed Plan page with a ring chart of this month's split |

- **Card colours everywhere:** each card's chosen colour appears in its tile, its utilisation bar, its payment slider and (on phones) its selected tab and Log chip.
- **Bars that read at a glance:** the home utilisation bar runs green, yellow, orange and red across its thresholds (30%, 50%, 75%), and the spending bar's category colours fade into each other.
- **Keyboard shortcuts on a computer:**

  | Key | Action |
  |---|---|
  | `Ctrl K` | Search cards, entries and pages, or run an action |
  | `1`–`5` | Switch pages |
  | `L` / `P` | Log spending / a payment |
  | `?` | Show all shortcuts |
  | `Esc` | Close a dialog |

- **The classic app:** the original single-file app (`web/index.html`) is still there as a fallback. Add `?classic` to the address to open it.

### Guided setup and tutorial
- **Welcome:** three slides, ending with your income and payoff strategy.
- **Setup checklist:** set income, choose a strategy, link a card, set a billing cycle, try a simulator, create a buffer. Each step ticks itself off.
- **A spotlight tour on every screen:** the page dims, the item lights up and a card explains it, with Next and Back, *Skip tour*, and the arrow keys on a computer.
  - the wording suits the device (click and shortcuts on a computer, tap on phones and iPads)
  - the Overview tour points to Plan and Activity
  - replay it any time from Settings or the account menu
