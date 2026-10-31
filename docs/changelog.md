# Change history

| Date | Change |
|---|---|
| 31 Oct 2026 | **Security:** security headers and a Content Security Policy, sign-out clears safety copies, dependency upgrades, a locked and pinned offers collector, database delete protection, and security regression tests. **Design:** card bars in each card's colour, blended home utilisation and spending bars, a close button for a space's details, foldable Spaces activity, and the phone Plan page's ring chart. Repository reorganised (site folder renamed to `web/`) |
| 31 Oct 2026 | **Phone design:** a design of its own for phones (larger text, rounded cards, new tab bar and menus, a one-handed Plan page). **Tutorial:** a spotlight tour on every screen of the new app, on every device. **iPhone Google sign-in fix** turned on |
| 30 Oct 2026 | **New app on every device:** phones and iPads open the new app too; the classic app stays at `/?classic` |
| 30 Oct 2026 | **Desktop app launched:** computers open the new desktop app automatically; phones and iPads keep the phone and iPad app. The beta switches are gone. The desktop app loads faster: each page is its own file, and the first download is about half the size |
| 29 Oct 2026 | **One debt-free date:** Cards Overview, the desktop Plan page and the Share progress message now use the same month-by-month plan as Home (each card's own rate, minimums first, extra money moving to the next card once one is paid off). Cards Overview used to divide the total debt by the monthly payment at a flat 28%, which gave a later date |
| 29 Oct 2026 | **Desktop app beta:** "Try the new desktop app" in the account menu on computers, remembered per device, with "Back to classic view". Fixed: the Avalanche card shows what it really saves compared with Snowball (it said LKR 34,200 for everyone); "Adopt Fixed Repayment Plan" sets the card's monthly goal and "Negotiate Cash Discount" copies a cash-price request (the unused "Compare Alternatives" button is gone); payoff presets such as Full save the exact amount, not the slider's rounded one |
| 28 Oct 2026 | **Desktop app, all screens:** real sign-in and sync, card actions, Activity, Plan, Simulators, Spaces, Offers and admin review, Settings and guided setup. More of the phone app's rules moved into the shared core. Fixed: Replay app guide now resets the tips and checklist across devices |
| 26 Oct 2026 | **Desktop app prototype:** a new React desktop app (Overview, Cards, card workspace, command palette) on sample data, for review. The home screen's payoff plan moved into the shared core |
| 25 Oct 2026 | **Shared core:** the app's logic moved into `packages/core` with unit tests, ready for the new desktop app. No visible change |
| 25 Oct 2026 | **Account menu everywhere:** tapping your profile picture opens the account menu on phone and iPad too. It replaces the hamburger side menu, and all of that menu's options moved into it |
| 25 Oct 2026 | **Desktop panels:** upcoming payments, spending by category, utilisation by card and recent activity. One sidebar avatar on desktop |
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
