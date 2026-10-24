# Offers collector

Weekly job that keeps the app's **Offers** page up to date. It reads each bank's official offers page (`sources.json`), uses Claude to extract structured credit-card offers, and saves anything new or changed as a **draft** in Firestore (`offer_drafts`). Nothing reaches users until it's approved in the app under **Profile → Manage offers**. Published offers whose end date has passed are expired automatically.

## One-time setup

1. **Service account:** Firebase console → Project settings → Service accounts → *Generate new private key*. Keep the file out of git (it's ignored here).
2. **Make yourself admin:** `npm install`, then
   `FIREBASE_SERVICE_ACCOUNT="$(cat service-account.json)" node set-admin.mjs you@example.com`
   Sign out of the app and back in; **Manage offers** appears in Profile.
3. **GitHub secrets** (repo → Settings → Secrets and variables → Actions):
   - `ANTHROPIC_API_KEY`: from the Claude Console
   - `FIREBASE_SERVICE_ACCOUNT`: the full JSON of the service-account file
   - Optional variable `OFFERS_MODEL`, for example `claude-haiku-5-5` for a much cheaper run. The default is `claude-opus-5-5`.
4. Deploy the Firestore rules from the app folder: `firebase deploy --only firestore:rules`.

## Running

- The workflow runs every Monday at about 02:00 Sri Lanka time, or on demand from **Actions → Weekly offers collector → Run workflow** (tick *Dry run* to see the extracted offers without saving).
- Locally: `npm run dry-run`, or `node collect.mjs --dry-run --only seylan` for one bank. Add `--fixtures ./fixtures` to read `./fixtures/<issuer>.html` instead of fetching.
- Tests: `npm test`.

## Adding or fixing a bank

Edit `sources.json`. `issuer` must be a key from `SL_CARD_ISSUERS` in `index.html`. Use `"fetch": "browser"` for pages that are built with JavaScript or reject plain requests. The run report on the admin screen lists any bank whose page failed.
