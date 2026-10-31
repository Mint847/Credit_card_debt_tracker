# Development

How to run, test, build and deploy Serendib.

## Repository layout

| Path | What it is |
|---|---|
| `apps/desktop/` | The app (React, TypeScript, Tailwind): every screen, for computers, iPads and phones. Builds into `web/desktop/` |
| `packages/core/` | The shared core: calculations, data rules, actions, sync, sign-in rules, alerts, simulators, offers, backups and onboarding, with Vitest tests |
| `web/` | The deployed site: `index.html` (the classic app, with the core inlined), `firebase.json`, `firestore.rules`, `.firebaserc`, `serve.py` (local server) and the built app in `desktop/` |
| `tools/offers-collector/` | The weekly offers collector (Node, Claude API, Firebase Admin) and the admin set-up script |
| `.github/workflows/` | Runs the offers collector every Monday |
| `docs/` | Features, how it works, this guide, the change history, screenshots and research material |
| `design/` | Design mock-ups, their zip archives and design inspiration |

## Requirements
- Node.js 20 or newer
- Python 3 (only for the classic app's local server)
- The Firebase CLI for deploying: `npm install -g firebase-tools`

## Run it locally
```bash
git clone https://github.com/Mint847/Credit_card_debt_tracker.git
cd Credit_card_debt_tracker
npm install              # once, from the repository root
npm run dev:desktop      # the app at http://localhost:5174/desktop/
```
Add `?demo` to the address to open it with a sample account and no sign-in. Sign-in and sync use the live Firebase project, so you need an internet connection.

The classic app runs from the `web/` folder:
```bash
cd web
python serve.py          # http://localhost:8080
```

## Test and build
```bash
npm run test:core        # unit tests for the shared core (including the security tests)
npm run build:core       # rebuild the core and write it into web/index.html
npm run build:desktop    # type-check and build the app into web/desktop/
```
Edit the core in `packages/core/src`, never between the `CORE:START` and `CORE:END` markers in `web/index.html`.

The offers collector has its own tests:
```bash
cd tools/offers-collector
npm ci
npm test
```

## Deploy
Run `npm run build:core` first if anything in `packages/core` changed. Deploying the site rebuilds the app first (the `predeploy` step in `web/firebase.json`).
```bash
cd web
firebase login
firebase deploy --only hosting           # the site
firebase deploy --only firestore:rules   # the security rules, when they change
firebase hosting:channel:deploy preview  # a private preview link instead of the live site
```
