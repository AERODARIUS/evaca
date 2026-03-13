# Functions module boundaries

`index.js` is intentionally a thin composition layer that wires Cloud Function exports.

Core runtime logic is split by domain under `app/functions/src`:
- `marketData.js`: eToro request/retry logic, instrument normalization, and search/rate fetch workflows.
- `scheduler.js`: due-alert selection, evaluation pipeline, idempotent notification writes, lease handling, and operational cleanup jobs.
- `rateLimit.js`: distributed request throttling and auth/app-check request guards.
- `pagination.js`: cursor/page-size contracts for notification pagination.
- `errors.js`: safe client-facing error mapping and notification failure sanitization.
- `primitives.js`: shared value normalization helpers.

Testing strategy:
- `index.test.js` consumes `exports.__test` from `index.js` as a stable test surface.
- Domain modules keep behavior-focused logic isolated while preserving the existing public function contract.
