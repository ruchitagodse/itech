# Service lifecycle development setup

This upgrade is local only. Never deploy to production without explicit approval. The existing development project was confirmed as blog-a893e; the audit only read collection names and counts. No existing cloud customer, user, appliance or plan records were modified.

## Admin workflow
1. Edit the maintenance package. Set its validity in months and maintenance interval (default six months), then save. Existing packages without policy remain visible but cannot create new managed periods.
2. In Customers → appliance → Edit appliance, record the actual installation date. Do not enter an intended appointment date here.
3. Add service plan and select that appliance type's configured maintenance package. Expiry is derived server-side from installation plus validity months. Example: 15 November 2026 + 12 months expires at the end of 15 November 2027 in Asia/Kolkata.
4. Two due records are created; these are reminders, not appointments or requests. Each due date is the interval multiplied by visit number from the start. Validity must cover both visits; conflicting policies are rejected instead of clamping dates together. Use an explicitly shorter interval for a short plan. Customers can request their included visits before the due date as well. Only eligible maintenance completion redeems a visit.
5. Service lifecycle contains the chronological due-date calendar, overdue states, pending renewals, notification history, follow-ups and paginated CSV exports. Request details link directly to the follow-up form. CSV exports cover the displayed page, not an unbounded all-time report.
6. For renewal, choose Renew plan from the appliance. Choose a configured package and propose. The owning Customer sees the quoted price and dates in Care & renewals and explicitly agrees or declines. Admin confirms only an agreed offer. Changed package versions or stale latest periods block confirmation. Withdraw a stale offer before proposing again. Confirmation creates a separate period with two fresh visits; no payment is inferred.

## Additive migration
There is no automatic cloud migration. Old periods retain their exact dates, redemption receipts and balances. They do not acquire invented due dates. They remain readable on appliance/history pages, and can be renewed through the new approval flow. Maintenance KPIs only cover managed periods created by this upgrade.

New global collections: maintenanceSchedule, renewals, renewalLocks, serviceFollowups, notificationConsents, notifications, notificationEvents, notificationProviderIds, serviceEvents, automationCursors, automationLocks; settings/serviceAutomation contains non-secret reminder policy. All writes go through trusted server transactions. Client rules permit scoped reads only. User roles/bootstrap remain default-deny.

New package policy is snapshotted into managed periods. Redemption receipts remain at the original nested servicePlans/{planId}/visits/{requestId} paths. Updating a catalogue package does not rewrite past periods.

## Development Firebase rules and indexes
After reviewing the local changes, publish firestore.rules and create the new maintenanceSchedule indexes in firestore.indexes.json in the DEVELOPMENT project. Wait for Ready. The additional composites cover customer-scoped due-date lists and Admin count aggregations. Existing indexes remain intact.

Manual development command, only if Firebase CLI is installed and the selected project is confirmed:
firebase deploy --only firestore:rules,firestore:indexes --project blog-a893e

No automatic cloud publication was performed. Local emulator success does not prove published rules/indexes match.

## WhatsApp integration prerequisites
Configure server-only values from .env.example in your development secret store or ignored .env.local, then restart:
- AUTOMATION_PROJECT_ID: exact confirmed development project ID. Must match FIREBASE_PROJECT_ID.
- SERVICE_JOB_SECRET: cryptographically random secret of at least 32 characters.
- WHATSAPP_ACCESS_TOKEN: development Meta system-user access token with messaging permissions.
- WHATSAPP_PHONE_NUMBER_ID: development/test WhatsApp sender phone-number ID.
- WHATSAPP_API_VERSION: explicit supported version such as v27.0; choose a supported version for your Meta app.
- WHATSAPP_APP_SECRET: Meta app secret for X-Hub-Signature-256 validation.
- WHATSAPP_VERIFY_TOKEN: independent random webhook subscription challenge secret.

Never put these in NEXT_PUBLIC variables, Git, browser code or chat. Real WhatsApp sends were not run. Provision a Meta developer app/test sender and test recipient numbers. Obtain approval for the maintenance, expiry, followup, renewal and request utility templates. Each configured template uses exactly THREE body text parameters in this order: event label, business date, reference ID. Language must exactly match the approved language. Confirm template category/wording with Meta; software does not approve templates.

In Admin → Service lifecycle configure lead days, overdue repeat interval, retry delay, maximum attempts, approved template names and language. There are no hidden hardcoded reminder intervals. Leave automation disabled until configured.

Customer and each Admin must explicitly opt in with their own WhatsApp number in Care & renewals / Service lifecycle. There is no automatic consent from a stored customer phone. Withdrawal suppresses queued sends; dispatch also checks current role, ownership, active status and real Auth enabled/verified state.

## Server scheduling and webhook
Use an external server scheduler (for example Cloud Scheduler) to POST the HTTPS /api/jobs/service-lifecycle endpoint with Authorization: Bearer SERVICE_JOB_SECRET. Configure cadence explicitly in the scheduler; do not use browser timers. A recoverable global job lease prevents overlapping cursor runs. Pages and dispatch are bounded; schedule frequently enough for the queue volume. Non-2xx responses should be retried with scheduler backoff. This repository does not provision a hosting service or scheduler.

Register HTTPS /api/whatsapp/webhook in Meta, use WHATSAPP_VERIFY_TOKEN and subscribe to messages. GET handles the challenge; POST verifies the raw-body HMAC and sender phone-number ID before processing statuses. Localhost cannot receive Meta callbacks directly: use an approved development HTTPS environment/tunnel manually. Do not expose service-account files or local env files.

Notifications use deterministic event/recipient IDs, per-message transactional claims, persistent cursors and leases. A provider HTTP success records accepted only. Delivered/read require authenticated callback confirmation. Callback replay and out-of-order status are safe. Definite rate limiting retries with configured exponential delay and attempt limit. A timeout, interrupted dispatch or ambiguous provider response becomes uncertain: do not blindly resend. An operator must reconcile it with Meta; no automated retry of an ambiguous outcome is offered. Provider failed is a terminal history state.

Reference: https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/send-messages
Reference: https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/overview

## Manual acceptance checks
- Sign in as Admin and Customer in separate browser sessions; retain Technician restrictions.
- Create a disposable installed appliance and configured initial plan; verify anniversary expiry and two due records.
- Request maintenance as Customer and as Admin. Assign and complete through both existing workflows. Only maintenance uses a visit. Installation, repair/complaint and cancellation do not.
- Propose renewal, verify another Customer cannot read/agree, agree as owner, confirm as Admin once. Verify old history/balance remain unchanged.
- Verify calendar/overdue/KPI queries once new indexes are Ready.
- Opt in controlled test recipients, enable development automation, call scheduler, check accepted then actual delivered webhook. Test withdrawal, duplicate job calls, retry and invalid signature.
- Keep real accounts/data unchanged. Signed-in browser tests and real provider delivery remain separate from local automated checks.

## Defect-resolution compatibility
New requests bind both servicePlanId and visitId to a server-reserved canonical maintenanceVisits record. Both completion paths require service notes. See SSOT.md for schema/stage definitions and LEGACY-LINKAGE-MIGRATION.md for approval-gated legacy review. Expiry reminders now use independent 30-day and 7-day event identities. No live migration, scheduler invocation or WhatsApp delivery was performed by this phase.
