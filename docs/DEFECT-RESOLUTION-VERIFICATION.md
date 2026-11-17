# Audit defect resolution — verification record

Date: 16 November 2026 (Asia/Kolkata). Project: C:/Ruchita/Next/itech-v2.
Scope: modify the existing application; preserve Admin/Auth/roles and historical records. No production deployment, live migration, account change, automation configuration or real WhatsApp send was performed.

## Results

- `npm run typecheck`: PASS.
- `npm run lint`: PASS, zero warnings.
- `npm run build`: PASS, optimized local production build. This is compilation of the existing app, not a replacement application or deployment.
- `npm test`: PASS, 352 tests, zero failures/skips. Includes unit/mocked API tests and credential-cleared HTTP security smoke tests on isolated port 3107.
- `npm run test:rules`: PASS, 145 tests, zero failures/skips. This run used the checksum-verified emulator on 127.0.0.1:8187 with project demo-itech-v2; only disposable synthetic emulator data was written.
- Signed-in browser check at localhost:3001: existing Admin request details/navigation and legacy warning rendered. Selecting Completed displayed the new required, empty/invalid 2,000-character completion-notes field. Selection was reset without submitting; no browser mutation request was sent. No console warning/error was observed.
- Read-only live inspection: one maintenance request was scanned, no cap reached. Request f45g18P2hv1yvqdH10LP is in_progress and missing both servicePlanId and visitId; appliance has no installation date. Its existing period 8HMNZuZ6S0FEtJ2IQoe8 remains 2026-11-15 through 2027-11-15, total 2, used 0. It was listed for manual review only; no relationship was selected or written.

## Fixes

### Phase 1 — completion and linkage
Shared requireCompletionNotes now protects both completion paths. Admin's existing status form/API takes completion notes, which are checked and stored transactionally. Eligible new requests have schemaVersion 3, maintenanceCoverage, server-derived servicePlanId and visitId. Canonical visits are scoped under the correct customer/appliance/plan; their reciprocal IDs/request reservation are verified before deduction.

Request completion, visit completion, plan increment, immutable visits/{requestId} receipt, managed schedule projection and service event commit together. Status/version checks plus Firestore transaction conflict retries and deterministic receipts prevent duplicate or concurrent deductions. Installation, repair/complaint and cancellation do not consume included visits. Cancellation releases the canonical reservation, retaining the cancelled request and its IDs/history.

Tests: shared notes guard; Admin API missing/blank/oversized notes; emulator no-note failure with no partial writes; schema/plan/visit relationship; eight-way Admin/Technician race with one successful completion/receipt/debit; cancellation/rebooking; foreign-visit tampering; inherited final-credit and expiry tests.

### Phase 2 — scheduling
Business decision explicitly approved in this chat: require enough validity for both configured intervals. New active maintenance policy/period creation rejects incompatible durations instead of collapsing visits at expiry. Short plans work with a compatible shorter configured interval. Package changes and renewal validation cannot rewrite old dates.

New managed periods create two canonical visit rows plus their global schedule projections. Visit stages are scheduled, requested, confirmed (work started), completed; calendar overdue/expiry is derived separately. Confirmation does not create an appointment. Existing schedules remain intact.

Tests: month-end/leap arithmetic, inclusive IST boundary, short-duration conflict and compatible short frequency, distinct due dates, preserved old period/schedule snapshots.

### Phase 3 — renewals and reminders
Existing owner-agreement/Admin-confirmation locks, expected versions and latest-period checks remain in force. Confirmation creates a fresh period with two independent canonical visits; repeated concurrent confirmation produces one period and leaves the entire old period unchanged.

Expiry milestones 30 and 7 have separate deterministic source keys. Reached milestones may catch up only within the valid period; repeat scans deduplicate each key per recipient. Invalid/future/expired maintenance windows and already-requested/completed visits do not generate maintenance notices. A queued reminder's date validity is checked at claim and again before the external-send boundary, suppressing expired records. The existing expiryLeadDays field controls the dashboard's expiring-plan window; it no longer defines reminder milestones.

Tests: independent/stable milestone identities; duplicate event scans; no invalid maintenance generation; expired queued-notice suppression before a mocked provider call; retained outbox/retry/lease/delivery-order regressions. No real WhatsApp configuration/delivery is claimed. Completion notes are not copied into Customer-readable requests/events; the emulator explicitly checks this isolation.

### Phase 4 — legacy integrity
The new audit-legacy-linkage script is read-only, requires the explicitly matching development project, reports its query cap and has no write mode. The migration document requires a reviewed exact mapping or explicit no-coverage decision, original preimage/version, dry run and approval before any future migration writer/execution.

Historical reads/cancellation remain available. Unlinked pre-version-3 maintenance completion returns a clear linkage-review-required conflict rather than guessing a plan. Explicitly linked pre-managed legacy periods retain receipt compatibility without invented schedule dates. A new request against a valid legacy period can reserve an unscheduled canonical visit (dueOn null); it never invents a historic maintenance date.

Tests: legacy assignment/read regression; new booking on legacy period; unlinked historical request refuses inferred coverage without debit; canonical visit read isolation and direct-write denial.

## Modified files by phase

### Phase 1
- `scripts/service-errors.mjs`
- `scripts/completion-notes.mjs`
- `scripts/maintenance-visits.mjs`
- `scripts/service-request-store.mjs`
- `scripts/technician-work-store.mjs`
- `scripts/service-plan-core.mjs`
- `scripts/service-request-store.d.mts`
- `scripts/service-plan-core.d.mts`
- `src/lib/service-requests/server.ts`
- `src/lib/service-requests/data.ts`
- `src/lib/service-requests/http.ts`
- `src/app/api/service-requests/[id]/route.ts`
- `src/components/service-requests/request-status-form.tsx`
- `src/components/service-requests/request-details.tsx`
- `firestore.rules`
- `tests/completion-notes.test.mjs`
- `tests/service-requests.test.mjs`

### Phase 2
- `scripts/lifecycle-policy.mjs`
- `scripts/service-plan-store.mjs`
- `scripts/lifecycle-store.mjs`
- `src/lib/service-plans/http.ts`
- `src/app/api/lifecycle/route.ts`
- `src/components/service-plans/plan-form.tsx`
- `src/lib/service-packages/data.ts`
- `scripts/service-package-store.mjs`
- `src/lib/lifecycle/server.ts`
- `src/components/lifecycle/overview.tsx`
- `tests/lifecycle.test.mjs`

### Phase 3
- `scripts/lifecycle-jobs.mjs`
- `scripts/whatsapp-outbox.mjs`
- `scripts/lifecycle-store.mjs`
- `src/components/lifecycle/settings-form.tsx`
- `tests/lifecycle.test.mjs`

### Phase 4 / verification
- `scripts/audit-legacy-linkage.mjs`
- `docs/LEGACY-LINKAGE-MIGRATION.md`
- `tests/firestore-rules.emulator.mjs`
- `src/lib/service-packages/http.ts`
- `scripts/whatsapp-outbox.d.mts`
- `docs/SSOT.md`
- `docs/SERVICE-LIFECYCLE-SETUP.md`

This verification document is also new; docs/SSOT.md records the final results.

## Reproducible evidence logs

- Build: C:/Users/Admin/.codex/visualizations/2026/11/16/01a1e42b-d8a2-7e83-8626-63d577d7dda9/itech-fixes-build.log
- Full regression: C:/Users/Admin/.codex/visualizations/2026/11/16/01a1e42b-d8a2-7e83-8626-63d577d7dda9/itech-fixes-regression.log
- Emulator: C:/Users/Admin/.codex/visualizations/2026/11/16/01a1e42b-d8a2-7e83-8626-63d577d7dda9/itech-fixes-emulator.log
- Guarded change manifests/preimages: itech-phase1-changes.json, itech-phase2-changes.json, itech-phase3-changes.json, itech-phase4-verification-changes.json in that same report folder.

The project directory has no Git repository, so this work has no commit ID. Change manifests refuse to overwrite a concurrently modified source file.

## Remaining limits and next approvals

- The existing unlinked request is intentionally unchanged and cannot use an inferred plan. A business owner must approve the mapping/coverage decision; no destructive or automatic migration is offered.
- No local Firestore rule change was deployed. New nested canonical-visit client reads remain subject to current published rules; application server reads continue through existing authorization. Review/authorize development publication separately if direct client reads are needed.
- Live Customer/Technician full creation→completion and renewal browser mutation acceptance was not executed against cloud data. These transactional behaviors were exercised in the emulator; the real Admin check was read-only.
- The audit's separate direct-Admin Firestore calendar-regex weakness, orphan-profile cleanup, dedicated renewal-follow-up expansion and general uncertain-send operator tooling are outside these specified lifecycle fixes and remain unchanged. No account/profile cleanup was attempted.
- WhatsApp credentials, template approvals, external scheduler, HTTPS webhook registration and real delivery remain unconfigured/unverified.
