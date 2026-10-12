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

- **`stitch_fintech_credit_debt_manager/`**: The primary production web application.
  - `index.html`: The core Single Page Application containing all views, components, and logic.
  - `serve.py`: Lightweight Python local HTTP server script.
  - `firebase.json` & `.firebaserc`: Firebase hosting and project deployment configuration.
- **Reference & Design Packages:**
  - Feature-specific UI prototypes, design archives, and spreadsheets detailing fee structures.

---

## 🚀 Getting Started

### Prerequisites
- Any modern web browser (Chrome, Edge, Firefox, Safari).
- (Optional) Python 3.x to run a local development server.

### Running Locally

1. Clone or download this repository:
   ```bash
   git clone <REPO_URL>
   cd "Debt tracker"
   ```

2. Start the local server using Python:
   ```bash
   python stitch_fintech_credit_debt_manager/serve.py
   ```
   Or navigate into `stitch_fintech_credit_debt_manager` and open `index.html` directly in your browser.

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
