# Debt Tracker & Credit Manager (Stitch Fintech)

> **A comprehensive personal finance, debt elimination, and credit card portfolio management web application designed to help users track multi-card balances, optimize payoff velocity, expose hidden merchant surcharges, and maximize interest-free grace periods.**

---

## 📌 Table of Contents

- [Overview](#-overview)
- [Comprehensive Feature Breakdown](#-comprehensive-feature-breakdown)
  - [1. Credit Card Portfolio & Dashboard](#1-credit-card-portfolio--dashboard)
  - [2. Payoff Strategy & Debt Reduction Engines](#2-payoff-strategy--debt-reduction-engines)
  - [3. Hidden Surcharge & Cash Advance Calculators](#3-hidden-surcharge--cash-advance-calculators)
  - [4. Category Spaces & Expense Allocation](#4-category-spaces--expense-allocation)
  - [5. Bank Offers & Deals Hub](#5-bank-offers--deals-hub)
  - [6. Billing Cycle & Grace Period Maximizer](#6-billing-cycle--grace-period-maximizer)
  - [7. Authentication & Dynamic Identity](#7-authentication--dynamic-identity)
  - [8. Cloud Synchronization & Data Portability](#8-cloud-synchronization--data-portability)
- [Repository Structure](#-repository-structure)
- [Technical Architecture](#-technical-architecture)
- [Getting Started & Local Setup](#-getting-started--local-setup)
- [Deployment](#-deployment)
- [License](#-license)

---

## 🌟 Overview

Credit card debt often compounds quickly due to complex interest rate calculations, varying statement closing dates, and non-transparent merchant surcharges.

**Debt Tracker & Credit Manager** is built to solve these challenges. Operating as a responsive Single Page Application (SPA), it gives cardholders complete clarity over their entire credit portfolio. Whether you want to eliminate debt using mathematical optimization (Avalanche) or psychological momentum (Snowball), calculate the true cost of ATM cash advances under Central Bank of Sri Lanka (CBSL) regulations, or discover which card gives you the longest interest-free runway today, this platform provides the tools you need.

---

## 🚀 Comprehensive Feature Breakdown

### 1. Credit Card Portfolio & Dashboard
- **Consolidated Financial Metrics:**
  - **Total Available Credit:** Aggregates limits across all active credit cards.
  - **Total Outstanding Balance:** Real-time visibility into overall debt burden.
  - **Portfolio Utilization Ratio:** Instant gauge of credit usage (e.g. flagging utilization above 30% or 50% to protect credit scores).
  - **Total Minimum Due:** Sum of upcoming minimum payments required across all cards to avoid default penalties.
- **Card Portfolio Management:**
  - Add, edit, and remove cards with custom metadata: Bank Name, Card Tier (e.g., Infinite, Platinum, Signature), Card Nickname, Balance, Limit, APR, Cut-Off Date, and Due Date.
  - **Custom Card Themes:** Select from curated color palettes (e.g., Deep Navy, Emerald, Sunset, Midnight, Obsidian) with realistic card styling, chip graphics, and masked card numbers.
  - **Mark as Settled:** Toggle any card to "Settled" status once paid off; updates statistics immediately and provides visual payoff confirmation without deleting historical card data.

---

### 2. Payoff Strategy & Debt Reduction Engines
- **Mathematical Avalanche Method (Optimal Interest Savings):**
  - Allocates minimum payments to all cards and funnels remaining budget to the debt with the highest Annual Percentage Rate (APR).
  - Minimizes compounding interest bleed and saves the maximum amount of money over time.
- **Behavioral Snowball Method (Psychological Momentum):**
  - Directs surplus funds to the smallest balance first, regardless of APR.
  - Rapidly eliminates individual accounts to deliver quick psychological wins and build repayment momentum.
- **Dynamic Repayment Budget Slider:**
  - Interactively adjust your monthly repayment budget to see real-time recalculations of debt-free target dates.
- **Payoff Timeline & Interest Saved Visualizer:**
  - Projects exact months to debt-free status.
  - Highlights total interest saved by following the recommended accelerated strategy versus paying minimum dues.

---

### 3. Hidden Surcharge & Cash Advance Calculators
- **0% Installment Surcharge Exposer:**
  - Analyzes merchant "0% installment handling fees" and point-of-sale credit card swipe surcharges.
  - Calculates the **Effective Annual APR** of seemingly small upfront fees (e.g., a 3% one-off fee on a 6-month term corresponds to an annualized APR of ~10.5%).
  - **Regulatory Guidance:** Displays statutory notices regarding Visa, Mastercard, and CBSL Merchant Regulations prohibiting unapproved merchant pass-on surcharges.
- **Cash Advance Trap Calculator:**
  - Calculates upfront ATM withdrawal fees (percentage fee + fixed levy) across major Sri Lankan banks.
  - **No Grace Period Alert:** Educates cardholders on the Central Bank of Sri Lanka (CBSL) statutory directive—cash advances do not qualify for interest-free grace periods; interest begins compounding immediately from the withdrawal timestamp.

---

### 4. Category Spaces & Expense Allocation
- **Targeted Debt Buckets:**
  - Organize debt into distinct functional categories (e.g., *Emergency Medical*, *Travel*, *Tech & Gadgets*, *Home Renovation*, *Dining*).
- **Custom Space Customization:**
  - Define custom target budgets, colors, icons, and descriptions for each space.
  - Monitor which spending categories contribute most to your total debt.

---

### 5. Bank Offers & Deals Hub
- **Curated Promotional Directory:**
  - Aggregates ongoing credit card promotions from major Sri Lankan banks (Commercial Bank, Sampath Bank, HNB, Seylan Bank, HSBC, Standard Chartered, Nations Trust, DFCC).
- **Category Filtering:**
  - Filter offers by **Dining**, **Supermarket**, **Travel & Leisure**, **Online Shopping**, and **Electronics**.
- **Offer Intelligence:**
  - Displays discount percentages, validity expiration dates, minimum spend thresholds, and eligible card tiers.

---

### 6. Billing Cycle & Grace Period Maximizer
- **Grace Period Maximization Engine:**
  - Analyzes the relationship between today's date, each card's billing cycle cut-off date, and payment due dates.
  - Recommends which card in your wallet currently offers the longest interest-free grace period (up to 51–55 interest-free days).
- **Payment Due Date Tracker:**
  - Countdown badges showing days remaining before payment due dates to prevent late payment penalties.

---

### 7. Authentication & Dynamic Identity
- **Integrated SPA Auth Flow:**
  - Smooth in-app transitions between Login and Sign-Up without full page reloads.
- **Dual Authentication Modes:**
  - **Google OAuth:** One-click authentication with Google via Firebase Auth.
  - **Email & Password:** Secure sign-up and sign-in with interactive validation, password visibility toggles, and password reset flows.
- **Dynamic Identity Personalization:**
  - User's name collected during registration is dynamically synchronized across:
    - Personalized greeting headers (`Good morning, {Name}`).
    - Profile tab names and avatar initial badges (`{Initials}`).
    - Drawer navigation portfolio header (`{Name}'s Portfolio`).
    - Backup export filenames (`{FirstName}_portfolio_backup.json`).
- **Guest / Demo Mode:**
  - Instant access to the app without authentication for evaluation and testing.

---

### 8. Cloud Synchronization & Data Portability
- **Real-Time Cloud Firestore Sync:**
  - Authenticated accounts automatically sync cards, settings, spaces, and custom rates to their private Firestore collection (`users/{uid}`).
- **Zero Data Loss Local Storage Fallback:**
  - Unauthenticated guest sessions persist seamlessly via browser `localStorage`.
- **Full Portfolio Backup & Restore:**
  - **One-Click JSON Export:** Export your entire card portfolio, spaces, and preferences to a timestamped backup JSON file.
  - **JSON Import:** Restore your portfolio on any browser or device instantly.

---

## 📂 Repository Structure

```text
Credit_card_debt_tracker/
│
├── 🚀 app/                       # Production Web Application
│   ├── index.html                # Complete Single Page Application (UI + Engine)
│   ├── serve.py                  # Lightweight local Python HTTP server
│   ├── firebase.json             # Firebase Hosting deployment config
│   ├── .firebaserc               # Firebase project association
│   └── .gitignore                # Application-level ignore rules
│
├── 🎨 prototypes/                # Modular UI Screen Prototypes & Mockups
│   ├── 0%_surcharge/             # Surcharge exposer screen mockup
│   ├── card_detail_payoff_simulator/
│   ├── card_overview/            # Card detail inspection view
│   ├── cash_advance/             # Cash advance calculator mockup
│   ├── credit_cards_list_starling_style/
│   ├── edit_card_details/        # Card editor modal component
│   ├── home_page/                # Home dashboard mockup
│   ├── kebab_menu/ & kebab2/     # Overflow options menu prototypes
│   ├── login_page/               # Login screen prototype
│   ├── markassetteled/           # Settled card indicator prototype
│   ├── offers_page/              # Deals and promotions directory
│   ├── sandwich_menu/            # Global navigation drawer prototype
│   ├── serendib_neo_fintech/     # Theme & design tokens
│   ├── signup_page/              # Account registration mockup
│   ├── simulators1/              # Repayment engine prototypes
│   ├── spaces_page/              # Category spaces layout
│   ├── update_billing_cycle/     # Cycle date editor modal
│   └── user_account/             # User profile settings view
│
├── 📄 docs/                      # Reference Specifications, Rates & Guides
│   ├── Sri Lanka Credit Card App.pdf
│   ├── Sri Lanka Credit Card App.txt
│   ├── sri_lanka_credit_card_cash_advance_fees.xlsx
│   └── Web design/               # Design inspiration and UI asset guidelines
│
├── 📦 archives/                  # Preserved .zip Archives & Export Bundles
│   └── (All original component .zip files)
│
├── .gitignore                    # Root repository ignore rules
├── LICENSE                       # MIT License
└── README.md                     # Comprehensive project documentation
```

---

## 🛠️ Technical Architecture

- **Frontend Architecture:** Pure Single Page Application (SPA) with zero build tools or complex toolchains. Fast load times, instantly editable, and runs in any modern browser.
- **Styling:** Tailwind CSS (via CDN) paired with custom CSS glassmorphism, responsive flex/grid layouts, and micro-transitions.
- **Backend Services:**
  - **Firebase Authentication:** Handles user identity via Google Provider & Email/Password credentials.
  - **Cloud Firestore:** Real-time NoSQL cloud document database for multi-device data persistence.
- **Local Dev Server:** Built-in Python `SimpleHTTPRequestHandler` configured with aggressive no-cache headers for instant local development feedback.

---

## 💻 Getting Started & Local Setup

### Prerequisites
- A modern web browser (Google Chrome, Microsoft Edge, Safari, Firefox).
- Python 3.x *(optional, for running the local dev server)*.

### Step-by-Step Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Mint847/Credit_card_debt_tracker.git
   cd Credit_card_debt_tracker
   ```

2. **Run the local development server:**
   ```bash
   python app/serve.py
   ```

3. **Open the application:**
   Navigate in your browser to:
   ```
   http://localhost:8080
   ```

*(Alternative: You can simply navigate into the `app/` folder and double-click `index.html` to open it directly in your browser without any server).*

---

## 🚢 Deployment

The project includes pre-configured Firebase Hosting settings. To deploy:

1. Ensure the Firebase CLI is installed:
   ```bash
   npm install -g firebase-tools
   ```

2. Navigate to the `app/` directory and log in:
   ```bash
   cd app
   firebase login
   ```

3. Deploy to your Firebase project:
   ```bash
   firebase deploy
   ```

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.
