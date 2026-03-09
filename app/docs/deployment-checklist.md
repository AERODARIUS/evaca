# SOTRY-9 Deployment checklist

This checklist is the source of truth for deploying the eVaca app and validating one real end-to-end alert.

## 1) Confirm secrets in Functions runtime

Run:

```bash
cd app
npm run deploy:checklist
```

Expected outcome:
- `ETORO_API_KEY` and `ETORO_USER_KEY` are listed as `OK` in the checklist output.

If a secret is missing, create it before deployment:

```bash
firebase functions:secrets:set ETORO_API_KEY
firebase functions:secrets:set ETORO_USER_KEY
```

## 2) Deploy Firestore rules and indexes

```bash
cd app
firebase deploy --only firestore:rules,firestore:indexes
```

## 3) Deploy Cloud Functions

```bash
cd app
npm run functions:lint
npm run functions:test
firebase deploy --only functions
```

## 4) Deploy Hosting (frontend)

```bash
cd app
npm run web:build
firebase deploy --only hosting
```

## 5) Smoke test with one real alert (manual E2E)

1. Sign in to the deployed app with a test user.
2. Create one active alert using a liquid symbol (for example `AAPL` or `BTC`).
3. Set interval to `1` minute and target close to current price to force a quick evaluation.
4. Confirm the alert appears in the alerts table and shows active status.
5. Wait one scheduler cycle and verify a new document appears in `notifications` with:
   - same `userId` as the test user
   - matching `alertId`
   - `status` set to `sent` or `failed` (never stuck as `pending`)
6. Validate duplicate suppression:
   - if condition remains true and no reset happened, no duplicate notification should be created on the next cycle.

## 6) Rollback notes

- If deployment fails after rules update, redeploy previous known-good functions revision.
- If functions fail smoke test, pause alert creation in UI and roll back functions first.
- Preserve logs with `correlationId` for incident review.
