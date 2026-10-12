# Debt Tracker & Credit Manager (Stitch Fintech)

A modern, comprehensive Single-Page Application (SPA) designed to help users track credit cards, optimize payoffs, calculate cash advance surcharges, manage billing cycles, and analyze settlement strategies.

---

## 🌟 Key Features

- **Credit Card Portfolio & Dashboard:**
  - Real-time balances, credit utilization rates, and minimum dues.
  - Dynamic user identity personalization across greetings, profile badges, and portfolio exports.
  - Interactive portfolio distribution and payoff timelines.

- **Payoff & Debt Reduction Engine:**
  - Avalanche (highest APR first) vs. Snowball (lowest balance first) payoff simulations.
  - Custom monthly budget sliders and interest-saved visualizer.

- **Sri Lanka Bank Credit Card Support:**
  - Pre-loaded configurations for major Sri Lankan banks and credit card tiers.
  - Cash advance fee calculation and surcharge engines (0% installment conversion analytics).

- **Authentication & Cloud Synchronization:**
  - Seamless Firebase Authentication (Google Sign-In and Email/Password).
  - Cloud Firestore auto-sync for personal card portfolios, custom interest rates, and settlements.
  - Backup & restore capabilities (JSON export/import).

- **Offline / Local Mode Support:**
  - Local storage fallback when running without cloud credentials.

---

## 📂 Repository Structure

```
├── app/                  # 🚀 Production Web Application
│   ├── index.html        # Core Single Page Application (UI + Logic)
│   ├── serve.py          # Local Python development server
│   ├── firebase.json     # Firebase Hosting configuration
│   └── .firebaserc       # Firebase Project mappings
│
├── prototypes/           # 🎨 UI Screen Mockups & Component Prototypes
│   ├── 0%_surcharge/     # Surcharge fee exposer prototype
│   ├── card_overview/    # Card details view prototype
│   ├── cash_advance/     # Cash advance calculator prototype
│   ├── home_page/        # Home dashboard screen mockup
│   ├── login_page/       # Auth login view mockup
│   ├── signup_page/      # Registration view mockup
│   ├── simulators1/      # Payoff engine simulator prototypes
│   └── ...               # Additional modular screen prototypes
│
├── docs/                 # 📄 Documentation, Specifications & Data
│   ├── Sri Lanka Credit Card App.pdf
│   ├── Sri Lanka Credit Card App.txt
│   ├── sri_lanka_credit_card_cash_advance_fees.xlsx
│   └── Web design/       # Design inspiration guidelines & references
│
└── archives/             # 📦 Original Zip Archives & Backups
```

---

## 🚀 Getting Started

### Prerequisites
- Any modern web browser (Chrome, Edge, Firefox, Safari).
- (Optional) Python 3.x to run a local development server.

### Running Locally

1. Clone this repository:
   ```bash
   git clone https://github.com/Mint847/Credit_card_debt_tracker.git
   cd Credit_card_debt_tracker
   ```

2. Start the local server using Python:
   ```bash
   python app/serve.py
   ```
   *Or navigate into `app/` and double-click `index.html` to open directly in your browser.*

3. Open your browser and navigate to:
   ```
   http://localhost:8080
   ```

---

## 🛠️ Tech Stack

- **HTML5 & Vanilla JavaScript**: High performance, zero build-step architecture.
- **Tailwind CSS**: Modern, utility-first styling.
- **Firebase**: Authentication & Cloud Firestore database.
- **FontAwesome / Google Fonts**: Icons and typography.
