# eToro Search Empty Results Troubleshooting

## Problem
`searchEtoroAssets` returned `items: []` even when `/market-data/search` returned HTTP `200` and multiple pages of results for queries like `XRP`.

## Log Signatures That Identified the Issue
- Search request was healthy and paginated:
  - `eToro response received` with `ok: true`, `status: 200`, `pageNumber: 2`.
- Pipeline drop happened after provider response:
  - `eToro search response` with:
    - `totalRawItems: 115`
    - `totalDedupedItems: 65`
    - `totalNormalizedItems: 0`
    - `totalMatchedItems: 0`
- Raw item shape showed missing symbol/name fields:
  - `firstPageItemKeys: ["instrumentId"]`
  - `firstRawItem.symbol: ""`

## Root Causes
1. `fields` was not always sent on `searchText` candidate requests after a refactor.
2. ID casing variants (`InstrumentId`) were not fully handled in all parsing points.
3. eToro search responses can include ID-only items (`instrumentId` without `internalSymbolFull`/`displayname`).
4. CSV query params (`fields`, `instrumentIds`) can fail when commas are URL-encoded as `%2C`.

## Fixes Implemented
### 1) Always include `fields` on all search candidates
- Ensure both `internalSymbolFull` and `searchText` candidates carry:
  - `instrumentId,internalSymbolFull,displayname`

### 2) Normalize all instrument ID casing variants
- Added support for:
  - `instrumentId`
  - `InstrumentId`
  - `InstrumentID`
  - `instrumentID`
  - plus `id` / `ID` fallback where applicable

### 3) Metadata hydration fallback for ID-only search results
- If search normalization produces zero items but IDs exist:
  - Call `/market-data/instruments?instrumentIds=...`
  - Normalize from metadata payload
  - Continue ranking and matching using hydrated symbol/display name

### 4) Preserve literal commas in eToro CSV query params
- Added query serialization helper to keep commas unescaped for known CSV keys:
  - `fields`
  - `instrumentIds`

## Files Updated
- `/Users/dariocruz/Documents/eVaca/app/functions/index.js`
- `/Users/dariocruz/Documents/eVaca/app/functions/index.test.js`

## Regression Coverage Added
- Candidate generation includes `fields` for `searchText` path.
- `InstrumentId` casing is validated.
- Nested/enveloped instrument payload normalization is validated.
- ID extraction helper is covered.

## Operational Verification Checklist
1. Trigger search with a known term (for example `XRP`).
2. Confirm `QUERY STRING` contains literal commas:
   - `fields=instrumentId,internalSymbolFull,displayname`
3. Confirm page extraction logs are non-zero:
   - `eToro search page processed` with `pageItemsCount > 0`
4. Confirm post-processing is no longer zeroed:
   - `eToro search response` with `totalNormalizedItems > 0`
5. If fallback runs, verify it succeeds:
   - `eToro search fallback metadata hydration` with `metadataNormalizedItems > 0`

## Notes
- Historical reference commit where a related issue was fixed: `9d0162b742512c49f8db0e28118e3834cf19127e`.
- Later refactor reintroduced part of the problem by omitting `fields` in `searchText` candidate construction.
