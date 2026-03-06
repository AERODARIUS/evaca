# New Alert Form + eToro + Firebase

- [x] `SOTRY-1` Build `New Alert` form UI in app:
  - Alert name
  - Asset selector (symbol/search)
  - Condition (`above` / `below`)
  - Target price
  - Check interval
  - Notification channel(s)
  - Enabled/disabled status

- [x] `SOTRY-2` Create Firestore data model:
  - `alerts` collection (user-scoped alert definitions)
  - `notifications` collection (trigger history + delivery status)
  - Suggested alert fields: `userId`, `instrumentId`, `symbol`, `displayName`, `condition`, `targetPrice`, `isActive`, `intervalMinutes`, `lastCheckedAt`, `lastTriggeredAt`, `createdAt`, `updatedAt`

- [ ] `SOTRY-3` Wire form submission to Firestore:
  - Validate input client-side and server-side
  - Save alert documents to `alerts`
  - Add edit/delete/toggle active support

- [ ] `SOTRY-4` Integrate eToro market data via Cloud Functions:
  - Use secrets `ETORO_APP_KEY` and `ETORO_USER_KEY`
  - Add callable/HTTP function to search assets (`/market-data/search`)
  - Add function to fetch current rates (`/market-data/instruments/rates`)
  - Map eToro response to internal alert asset shape

- [ ] `SOTRY-5` Implement scheduled price monitoring (Cloud Functions scheduler):
  - Run at configured cadence
  - Load active alerts
  - Fetch latest prices from eToro
  - Evaluate trigger conditions
  - Write notification documents to Firestore `notifications` when triggered
  - Prevent duplicate notifications for unchanged conditions

- [ ] `SOTRY-6` Add notification delivery pipeline (phase 1: in-app history):
  - Persist each trigger event in `notifications`
  - Mark status (`pending`, `sent`, `failed`)
  - Link notification to alert + user

- [ ] `SOTRY-7` Security and ops:
  - Keep all eToro keys only in Functions secrets manager
  - Enforce Firestore security rules per user
  - Add retries + logging for eToro/API failures
  - Add basic rate-limit/backoff handling for polling

- [ ] `SOTRY-8` Testing:
  - Unit tests for condition evaluator
  - Integration tests for alert creation + trigger flow
  - Emulator tests for Firestore + Functions

- [ ] `SOTRY-9` Deployment checklist:
  - Confirm secrets are configured in Functions runtime
  - Deploy Firestore indexes/rules
  - Deploy Cloud Functions
  - Smoke test with one real alert end-to-end
