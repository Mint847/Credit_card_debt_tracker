# Contributing to Serendib

Thanks for wanting to help. Serendib is a credit card debt tracker built around how Sri Lankan banks charge interest and set minimum payments, so the most useful contributions are often **checking the numbers against your own bank**.

## Ways to help

- **Correct a bank's figures.** If a fee, rate, minimum-payment rule or late fee doesn't match your bank's official tariff or your statement, open an issue or a pull request (see [Bank data](#bank-data)).
- **Report a bug.** Say what you did, what you expected and what happened. A screenshot and your device (computer, iPad or phone) help a lot. Don't include real card numbers or statements.
- **Suggest a feature.** Open an issue first, so we can agree on it before you spend time on it.
- **Fix something.** Small, focused pull requests are easiest to review.

## Run it locally

You need **Node.js 20 or newer**.

```bash
git clone https://github.com/Mint847/Credit_card_debt_tracker.git
cd Credit_card_debt_tracker
npm install              # once, from the repository root
npm run dev:desktop      # the app at http://localhost:5174/desktop/
```

Open **http://localhost:5174/desktop/?demo**. The `?demo` address loads a sample account (made-up data, no sign-in), and nothing you do is saved. A refresh starts over.

**Please develop in demo mode.** Signing in uses the real Serendib Firebase project, so a sign-in from your machine creates a real account there. You don't need it to work on the app.

### Check your work

```bash
npm run test:core        # unit tests for the shared core
npm run build:desktop    # type-checks the app, then builds it into web/desktop/
```

Both should pass before you open a pull request. There is no automatic test run on pull requests yet, so please run them yourself.

## Where things live

| Path | What it is |
|---|---|
| `apps/desktop/src/` | The app (React, TypeScript, Tailwind): every screen, for computers, iPads and phones |
| `packages/core/src/` | The shared core: interest and payoff maths, bank rules, alerts, simulators, SMS parsing, sync |
| `packages/core/test/` | Unit tests for the core |
| `apps/desktop/src/lib/sample.ts` | The sample account used by `?demo` |
| `web/` | The deployed site and Firebase settings |
| `tools/offers-collector/` | The weekly bank-offers collector |
| `docs/` | [Features](docs/features.md), [how it works](docs/how-it-works.md), [development](docs/development.md) |

Two things worth knowing:

- **Edit the core in `packages/core/src`, never in `web/index.html`.** That file contains a generated copy of the core between `CORE:START` and `CORE:END`. Run `npm run build:core` to refresh it.
- **One app, three layouts.** Computers, iPads and phones use the same screens with different layouts, chosen by the `phone:`, `tablet:` and `compact:` Tailwind variants. A change meant for phones must leave the computer and iPad layouts unchanged, so check all three.

## Bank data

Each bank's rules are in the issuer table in `packages/core/src/domain.js`: fees, APR, minimum payment percentage and floor, the interest day-count basis (360 or 365), the grace period, late fees, and when each was `verified` (`asOf`).

To correct or add a bank:

1. **Cite the source.** Link the bank's official tariff or calculation guide, or attach the page, and give the date. Figures from a statement are welcome too, with personal details removed.
2. **Change the issuer table** and update its `asOf` date and source comment.
3. **Add or update a test** in `packages/core/test/bank-rules.test.js` using a worked example from the bank's own document, if it has one.
4. **Run the tests.**

Please don't guess a figure. If you aren't sure, say so in the issue and we'll find the source together. Banks change their tariffs, and the app tells users to check their statement.

## Pull requests

1. Fork the repository and create a branch for one change.
2. Keep the change small and focused. Don't mix a fix with unrelated tidying.
3. Run `npm run test:core` and `npm run build:desktop`.
4. In the pull request, say what changed and why, and for visual changes add a screenshot (computer and phone if both are affected).
5. Write commit messages in plain English that say what the change does.

## Please never commit

- Passwords, API keys, tokens or service-account files. (Firebase's public web key is already in the app and is meant to be public.)
- Real card numbers, statements, SMS messages or any customer's personal data. Use made-up data in tests and screenshots.
- Bank tariff PDFs or other documents you don't have the right to share. Link to them instead.

## Security problems

If you find a security problem, **please don't open a public issue.** Use the repository's **Security** tab and choose **Report a vulnerability**, so it can be fixed before it's shared.

## License

Serendib is licensed under the [GNU Affero General Public License v3.0](LICENSE). By contributing, you agree that your contribution is licensed under the same terms.
