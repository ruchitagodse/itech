# Legacy maintenance linkage review — no automatic migration

This is a proposed runbook, not approval to change existing records. No migration writer is provided.

## Inventory
Run the read-only command:
`node --env-file=.env.local scripts/audit-legacy-linkage.mjs --project blog-a893e`

It lists maintenance requests missing plan/visit IDs and existing periods for manual inspection, with no contact details and no selected mapping. It refuses another project and has no write mode. A 500-request cap is explicitly reported.

## Required approval before a future write
1. An authorized business owner must decide whether each open request was an included visit or uncovered/paid work. A single apparent candidate is not sufficient proof.
2. Record an explicit mapping of request ID, customer ID, appliance ID, plan ID and visit ordinal, or an explicit no-included-coverage decision, with reason, evidence, reviewer and approval time. Review original request date, promised coverage, plan dates, receipts, used count, duplicate locks and any prior work. Never choose the latest/current plan automatically for an old request.
3. Completed/cancelled records, old dates, original notes, existing receipts and old schedules stay immutable. Historical dates must never be recalculated from today's package.
4. First test an approved manifest in an isolated emulator with an exact data snapshot. Reject missing/ambiguous/cross-parent/expired or already consumed assignments. Do not turn a review into a free-credit allocation or alter totalServices/usedServices.
5. A future migration must compare the approved preimage/version in a transaction, recheck the current Admin, customer/appliance/plan relationship, reserve only an explicitly approved unused visit, record an append-only linkage-review audit with before/after and approval identity, and commit all linkage fields atomically. Keep the original creation timestamps/attribution; make reruns idempotent by a durable operation ID.
6. Require a dry-run diff and explicit approval of the exact manifest before implementation/execution. Stop on any divergence. Reconcile counts and relationships read-only after the operation.

## Current application compatibility
- Historical plan/receipt/history reads are retained; no backfill runs during startup, page views or job processing.
- New requests are schemaVersion 3. Eligible maintenance binds servicePlanId and visitId server-side in the booking transaction. Clients cannot supply those relationships.
- New requests on an eligible legacy period may reserve an unscheduled maintenanceVisits slot with dueOn null. No historic due date or appointment is invented.
- A pre-version-3 maintenance request with no plan ID cannot complete until its coverage/linkage has an explicit approved review. It returns a clear 409; cancellation and reads remain available.
- Explicitly plan-linked legacy requests on pre-managed periods retain the old receipt-based redemption path, without inferring a historical schedule. Managed historical requests missing a visit ID require review.
- New uncovered maintenance requests explicitly record maintenanceCoverage=not_included and can complete without a free-visit deduction.
