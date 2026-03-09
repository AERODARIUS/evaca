# SOTRY-4 - Integrate eToro market data via Cloud Functions

## Story
- ID: `SOTRY-4`
- Title: `Integrate eToro market data via Cloud Functions`

## What was implemented
- Refactored eToro market-data logic into shared handlers used by Cloud Functions.
- Added consistent mapping from eToro responses into internal alert asset shape:
  - `instrumentId`
  - `symbol`
  - `displayName`
- Added normalized rate mapping (`instrumentId`, `symbol`, `displayName`, `rate`) for instrument-rate responses.
- Kept callable Functions in place:
  - `searchEtoroInstruments`
  - `getEtoroInstrumentRate`
- Added HTTP wrappers for the same integrations:
  - `marketDataSearchHttp` (GET, wrapper for `/market-data/search` behavior)
  - `marketDataInstrumentRatesHttp` (GET, wrapper for `/market-data/instruments/rates` behavior)
- Added unit tests for core mapping and extraction logic in Functions.

## Files changed
- `app/functions/index.js`
- `app/functions/index.test.js`
- `app/functions/package.json`
- `app/package.json`
- `app/README.md`
- `TODO.md`

## Tests executed and results
- `cd app && npm run functions:test` -> Passed (4/4 tests)
- `cd app && npm run functions:build` -> Passed
- `cd app && npm run functions:lint` -> Passed (`No lint configured`)

## Notes / limitations
- HTTP wrappers expose the same integration logic as callable functions; callers still need to pass required query params (`searchText`, `instrumentId`).
