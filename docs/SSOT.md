# iTech V2 source of truth

Updated 16 November 2026. This document supersedes historical README feature/deferred notes.

## Phase 0 audit and migration
Existing architecture: App Router server pages and JSON handlers verify revoked session cookies, live Auth identity and active users profiles. Mutations enforce same origin. Admin SDK stores independently recheck actor roles inside transactions. Customer ownership is customers.ownerUid. Technician reads are assignment-scoped. Default-deny rules protect private collections.

Existing collections: users, system/adminBootstrap, customers, customerKeys, applianceKeys, servicePackages, serviceRequests, serviceRequestKeys, serviceWork. Appliances and servicePlans are nested beneath customers. Per-plan visits are immutable redemption receipts keyed by request ID. servicePlanState/latest serializes periods. No SSOT or architecture documents existed beyond README and AGENTS.md.

Completion already deducts maintenance atomically in both Admin and Technician paths. Installation, repair/complaint and cancellation do not consume credits. Expired-at-completion requests cannot use the old period or charge a new period. Requests are requests, never automatically confirmed appointments.

Conflicts found: manual validity and one-year UI defaults; optional package; Admin-only unilateral renewal; no scheduled visit records, approval, calendar, follow-ups, consent, outbox, jobs or business reports. Existing dates and usage must not be silently recalculated.

Migration is additive: retain all historical periods/redemption receipts, add version-2 package policies and plan snapshots, separate maintenance schedule and renewal proposals, follow-up records, consent and notification outbox. Existing packages remain visible but require explicit Admin policy configuration before creating new managed periods. Existing legacy periods retain their original dates/allowances and have no invented appointments. No cloud backfill is automatic. New initial periods derive dates from recorded installation and package policy; renewal proposals require owner agreement before Admin confirmation. Existing appliance fields remain unchanged.

## Confirmed business rules
- Business dates are calendar dates in Asia/Kolkata; expiry day is inclusive.
- Each new period has two free maintenance visits. Installation is separate. Only eligible maintenance completion deducts a visit, once per request, in the same transaction.
- Initial start is the actual recorded installation date. Package validity is explicitly configured in months; default maintenance interval is six months and is snapshotted into each new period.
- Maintenance due dates are reminders, not appointments. Business decision confirmed in this defect-resolution chat: validity must cover both visits at the configured frequency (validityMonths >= 2 × maintenanceIntervalMonths). New conflicting policies/periods are rejected; dates are never collapsed at expiry. Existing historical schedules are unchanged.
- Renewal preserves old periods and unused credits expire. A proposal snapshots package/version, dates and price; the owning customer agrees, then Admin confirms atomically. A changed latest period invalidates a stale proposal.
- Customer and Admin requests remain available. Follow-ups and schedules never auto-create service requests.
- WhatsApp requires explicit recipient consent, approved configured templates and server credentials. Both customer and Admin recipients are supported. Disabled users and inactive/unlinked customers are not notification recipients.
- Jobs run on an authenticated server endpoint, with bounded pages, persistent cursors, deterministic notification keys and transaction leases. Ambiguous provider outcomes are held for reconciliation rather than blindly resent. Provider acceptance is not delivery; authenticated status webhooks alone record delivered/read.

## Implementation status
Phase 0 source audit complete. Implementation and verification are in progress. No production changes or deployment authorized. Cloud schema inventory, new integration credentials, scheduler registration and signed-in browser workflows must be reported separately from local test results.

## Phase completion record

### Phase 0 — audit and migration
Completed source audit of README (the only pre-existing architecture/feature document), AGENTS.md, auth, APIs, transaction stores, schema, rules and indexes. Read the installed Next.js route-handler/server-component guides before editing. Read-only development inventory on 16 November found root collections applianceKeys, customerKeys, customers, servicePackages, serviceRequestKeys, serviceRequests, system and users; catalogue and request counts were one each. No cloud data was changed. SSOT was created before implementation. Migration remains additive and explicit; no automatic backfill.

### Phase 1 — lifecycle
Implemented package validityMonths and maintenanceIntervalMonths policy; Admin editor defaults interval to six months but requires explicit validity. Actual installation remains managed through the existing appliance editor. New managed-plan creation requires a recorded past/present installation date and configured matching package, derives expiry server-side and creates two global maintenanceSchedule records. The existing nested visits collection remains the immutable redemption ledger. Admin and Technician completion update the schedule and usage in the same transaction. Period dates are Asia/Kolkata calendar dates with inclusive expiry, clamped month-end arithmetic. Shorter-package due dates cap at expiry. No appointments or requests are invented.

Legacy periods are readable/redeemable under existing eligibility rules. The internal store's managed:false mode is reserved for trusted historical fixture/import use; it is not accepted from HTTP inputs. All application creation calls force managed:true, also the default. No legacy period is recalculated or deleted.

### Phase 2 — follow-ups and renewals
Implemented Admin follow-ups against existing request IDs with due date, private notes and close status. Due records derive overdue/expired/completed state without changing historical balances. Renewal proposals snapshot package version, price, policy, dates and previous period. A per-appliance lock prevents simultaneous open proposals. Only the current linked Customer may agree/decline; Admin cannot agree on their behalf. Only Admin confirms an agreed proposal, transactionally checks current ownership/active profiles/package/latest-period version, creates a separate period with two visits and releases the proposal lock. Stale package terms block confirmation; Admin can withdraw and repropose. Old history remains intact.

### Phase 3 — WhatsApp automation
Implemented server-only Meta template sender, explicit Customer/Admin consent, settings, notification history, deterministic event/recipient IDs, per-message claims, rate-limit retry/backoff and signed delivery webhooks. Request creation, assignment and status changes append immutable serviceEvents in the same transaction, so scheduler polling cannot lose intermediate request changes. Jobs use a recoverable global lease, bounded persistent cursor pages and rotating dispatch states. External scheduler cadence is configured outside the browser. Job endpoint requires a 32-character-or-longer bearer secret and explicitly matching automation project.

Accepted is not delivered. Signed callbacks provide delivery confirmation; event replay and out-of-order updates are idempotent. Ambiguous network/dispatch outcomes are held as uncertain, not automatically resent. Current consent, profile, ownership and actual Auth enabled/verified state are checked before sending. Re-checking an explicit global pause prevents dispatch after automation is disabled.

Integration blocker: all seven automation/WhatsApp server environment values are missing. No real send, provider delivery, template approval, webhook subscription or scheduler invocation was executed. Meta setup remains manual; see SERVICE-LIFECYCLE-SETUP.md.

### Phase 4 — dashboard and reports
Implemented /admin/lifecycle and /customer/lifecycle within existing protected layouts, responsive navigation, chronological maintenance calendar, renewal agreement/confirmation actions, consent controls, Admin-only follow-ups/settings and notification history. Admin KPIs use actual Firestore aggregate counts for pending/in-progress requests, pending renewals, upcoming/overdue visits and expiring managed plans. CSV reports are Admin-only, formula-escaped and explicitly limited to the displayed page. Legacy plan metrics are not invented; original appliance/history pages remain available.

### Phase 5 — verification
TypeScript, ESLint and production build passed. Full regression/security suite: 339 passed, zero failures/skips. Isolated demo-itech-v2 emulator: 135 passed, zero failures/skips. Coverage includes Kolkata expiry boundary, month-end/leap dates, credit eligibility and races, schedule completion, owner isolation, proposal/confirmation races, stale terms, consent withdrawal, disabled Auth dispatch denial, notification deduplication, provider acceptance versus delivery, callback replay, configured retries, ambiguous sends, scheduler leases and default-deny rules. Synthetic tests never use development/production Auth users or send real WhatsApp messages.

Signed-in browser acceptance remains untested: browser inventory explicitly reports Local browser access is unavailable for this chat. New rules/indexes are local only and must be published/verified in development. Emulator tests do not verify composite-index readiness. Real Meta delivery, retries/webhooks and the hosted scheduler remain unverified until configured. No production deployment or data modifications were performed.

## Modified-file map
- New scripts: lifecycle-policy.{mjs,d.mts}, lifecycle-store.{mjs,d.mts}, lifecycle-events.mjs, lifecycle-jobs.{mjs,d.mts}, whatsapp-outbox.{mjs,d.mts}.
- Extended stores: service-package-store.mjs; service-plan-store.{mjs,d.mts}; service-plan-core.mjs; service-request-store.mjs; assignment-store.mjs; technician-work-store.mjs.
- New server adapter: src/lib/lifecycle/server.ts. Extended service-packages/{data,server}.ts and service-plans/{server,http}.ts.
- New screens: src/app/{admin,customer}/lifecycle/{page,loading,error}.tsx.
- New controls: src/components/lifecycle/{overview,actions,settings-form}.tsx.
- Extended UI: dashboard-navigation.tsx, service-packages/package-form.tsx, service-plans/{plan-form,appliance-plans}.tsx, Admin request detail page and globals.scss.
- New APIs: api/lifecycle/route.ts, api/lifecycle/report/route.ts, api/jobs/service-lifecycle/route.ts and api/whatsapp/webhook/route.ts.
- Configuration: firestore.rules, firestore.indexes.json and .env.example. Real .env.local was not edited.
- Tests: lifecycle.test.mjs and lifecycle-api.test.mjs; extended security.test.mjs and firestore-rules.emulator.mjs.
- Documentation: README.md, docs/SSOT.md and docs/SERVICE-LIFECYCLE-SETUP.md.

## Audit defect resolution — 16 November 2026

This section supersedes the earlier implementation/capped-date descriptions for new records. Historical verification above describes the prior implementation, not these fixes.

### Phase 1
Both Admin and Technician completion require nonblank service notes through a shared server-side guard. Admin completion accepts explicit notes in its existing status form/API, stores versioned notes and a final completion snapshot, and checks them inside the transaction before writes. Request status, plan usage, canonical visit, managed schedule, redemption receipt and event commit together. Completion/cancellation and role/origin security remain server-controlled.

New service requests use schemaVersion 3. Eligible maintenance links the server-selected current plan and a deterministic visitId; submitted plan/visit/ownership fields are ignored. Canonical visits live under servicePlans/{planId}/maintenanceVisits/{visitId}; existing visits/{requestId} redemption receipts are retained. The booking transaction reserves the visit without spending it. Completion checks reciprocal parent IDs and request ownership before one debit. Cancel releases the reservation, retaining cancelled request history. Installation, repair/complaint and cancellation never redeem maintenance.

### Phase 2 — approved scheduling decision
Each new managed period creates two distinct frequency-based due dates and canonical visit records. Validity must cover both intervals. Short durations are supported with an appropriately shorter explicitly configured interval; incompatible settings return schedule-conflict. No historical date is recalculated or schedule removed. The raw calendar completion status is separate from workflowStatus: scheduled, requested, confirmed (work started), completed. Overdue is derived from the calendar; confirmation does not promise an appointment.

### Phase 3
Renewal retains the original period and creates an independent new period, schedules and canonical visits under the existing owner-agreement/Admin-confirmation lock/version protocol. Expiry reminders have independent 30-day and 7-day source keys; repeated scans/retries reuse each event identity. Reached milestones can catch up only while the period remains valid. Expired/future/invalid maintenance windows and requested/completed visits do not generate maintenance notices. Queued dated notices are checked again before dispatch and suppressed after expiry. The old expiryLeadDays setting now controls the expiring-plan dashboard window, not milestone identity. No real WhatsApp credentials, sends or provider delivery are configured or claimed.

### Phase 4
Read-only inventory script: scripts/audit-legacy-linkage.mjs. No migration write mode exists. Unlinked historical maintenance requests are not assigned to any apparent current plan. They remain readable/cancellable and require approved linkage/coverage review before completion. Explicitly plan-linked pre-managed legacy requests retain receipt-based compatibility without guessed historic schedule dates. New requests against a valid legacy period reserve an unscheduled canonical visit with dueOn null, without backdating a schedule.
See LEGACY-LINKAGE-MIGRATION.md for the review, dry-run, preimage, transaction, audit and approval requirements before any future live migration.

### Phase 5
New unit/API and emulator regression tests cover mandatory notes, server linkage, atomic redemption, concurrent completions, cancellation/rebooking, cross-visit tampering, legacy review, period history, scheduling conflict, milestone identity and expiry suppression. Final execution results are recorded in DEFECT-RESOLUTION-VERIFICATION.md after checks finish. Local rules changes are not deployed and do not establish cloud publication. Live data stays unchanged.

### Final defect-resolution verification
16 November 2026: TypeScript, ESLint (zero warnings), local production build and all 352 regression/security tests passed. The current isolated Firestore emulator run passed all 145 tests with zero failures/skips, including the new completion/linkage/concurrency/legacy/scheduling/renewal/reminder regressions. Read-only Admin browser inspection confirmed the required completion-notes field and preserved request detail/legacy warning. Read-only development inspection found one unlinked maintenance request; no mapping or cloud write was performed. See DEFECT-RESOLUTION-VERIFICATION.md for modified files, exact evidence and remaining limits. This is local verification, not production deployment or real WhatsApp delivery.

Completion-note snapshots are stored only in private serviceWork documents (completedNotes/completedBy/completedAt), never on Customer-readable serviceRequests or serviceEvents. The canonical-linkage emulator regression verifies the Customer cannot read the work record and the request has no completionNotes field.
