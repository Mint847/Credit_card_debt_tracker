# How it works

The maths behind the numbers, the banks Serendib knows, how the app is built, and how your data is protected.

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

## Architecture

```
apps/desktop/      the app (React, TypeScript, Tailwind): every screen, on computers, iPads and phones
packages/core/     the shared core: calculations, data rules, actions, saving and sync, sign-in rules,
                   alerts, simulators, offers, backups and onboarding, with unit tests
web/               the deployed site: the built app at /desktop/, the classic app (index.html),
                   Firebase Hosting settings and the Firestore security rules
tools/offers-collector/   the weekly offers collector (GitHub Actions)
```

- **One app on every device.** `apps/desktop` builds into `web/desktop/` and serves computers, iPads and phones, with a layout for each (`data-layout` on the page: desktop, tablet or phone).
- **Shared core.** All the logic lives once, in `packages/core` (plain JavaScript modules, tested with Vitest). The app imports it directly; `npm run build:core` also writes it into the classic app between the `CORE:START` and `CORE:END` markers.
- **The classic app** (`web/index.html`) is the original single-file version. It stays available as a fallback at `/?classic` and uses the same account and data.
- **Styling:** Tailwind, with every colour a CSS variable so light and dark mode swap values without touching the markup. The phone design is a separate layer that applies only to phones.
- **Back end:** no server of its own.
  - **Firebase Authentication:** Google and email/password sign-in.
  - **Cloud Firestore:** one document per user (`users/{uid}`), plus the public `offers` collection.
  - **Firebase Hosting:** serves the site.
- **Sync:** changes appear on your other devices without reloading. Copies are merged card by card and space by space, the newest edit wins, deletions are remembered for 180 days, and every save is a transaction against the latest cloud copy.
- **Offline cache:** each account's data is cached on the device so the app opens instantly, with up to 5 safety copies (removed when you sign out).

## Security
- **Your data is yours only:** Firestore security rules let each account read and write only its own document. Offers are public to read and only an admin can publish them.
- **No card numbers or passwords** are ever asked for or stored (only an optional last four digits).
- **Browser protections:** a Content Security Policy (scripts only from this site, Firebase and Google sign-in), clickjacking protection, `nosniff`, a strict referrer policy and HTTPS everywhere.
- **Shared devices:** signing out removes the account's cached copy and its safety copies from that device.
- **Supply chain:** the offers collector installs exact, locked package versions and runs pinned GitHub Actions; it only reads each bank's own site.
- **Tested:** unit tests for the security rules in the core (`packages/core/test/security.test.js`), plus regular attack tests (script injection into every field) across both apps.
