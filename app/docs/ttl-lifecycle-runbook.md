# TTL lifecycle controls for operational collections

This runbook defines lifecycle cleanup for high-churn operational collections:
- `_rateLimits`
- `schedulerLeases`

## Cleanup mechanism

`cleanupOperationalCollections` runs every 60 minutes in Cloud Functions and performs bounded deletes:
- `_rateLimits`: deletes documents where `expiresAt <= now`.
- `schedulerLeases`: deletes stale leases where `leaseExpiresAt <= now - retention`.

Default retention for stale scheduler leases is 24 hours (`DEFAULT_SCHEDULER_LEASE_RETENTION_MS`).

## Verify cleanup in runtime

1. Confirm scheduled function is deployed:

```bash
cd app
firebase deploy --only functions:cleanupOperationalCollections
```

2. Check logs for cleanup summaries (`rateLimitsDeleted`, `schedulerLeasesDeleted`, `totalDeleted`):

```bash
firebase functions:log --only cleanupOperationalCollections
```

3. In Firestore console, validate old docs are being removed:
- `_rateLimits`: query by `expiresAt` older than current time.
- `schedulerLeases`: query by `leaseExpiresAt` older than retention cutoff.

## Monitor abnormal growth

Track document counts and log trends per collection:
- Alert when `_rateLimits` document growth is sustained for more than 24h.
- Alert when `schedulerLeases` stale documents remain above expected baseline after cleanup runs.
- Treat zero deletions over multiple runs as a signal to verify scheduler execution and query fields.

## Operational notes

- Cleanup is bounded by batch and max-batch limits to avoid long-running jobs.
- If growth exceeds cleanup throughput, increase schedule frequency or batch limits in a controlled release.
