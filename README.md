# iTech V2

iTech V2 uses Next.js App Router, TypeScript and SCSS for water purifier and AC service teams. Phase 1 authentication is preserved. The app currently implements Customer, Appliance and Service Request Management, plus Technician Assignment, Work Updates and a Service Packages catalogue. Firebase configuration is local and untracked; nothing has been deployed.

## Run locally

Use Node.js 22 or newer.

1. Open a terminal in `C:\Ruchita\Next\itech-v2`.
2. Run `npm ci`.
3. Copy `.env.example` to `.env.local` and configure the fields below.
4. Run `npm run dev`.
5. Open http://localhost:3001. This port keeps the fresh project separate from a typical existing port 3000 application.

Without environment values the login screen works as a setup preview; sign-in stays disabled. There is no demo bypass for protected dashboards.

## Configure a new development Firebase project

Do not reuse the existing application’s project or service account.

1. Create a NEW development project in Firebase Console. Register a Web app and copy its apiKey, authDomain, projectId and appId to the four NEXT_PUBLIC_FIREBASE fields in .env.local. Public Firebase web configuration identifies the project; it does not authorize access.
2. Enable Authentication → Email/Password. Add localhost to authorized domains. Enable email enumeration protection. Configure password policy and reset/verification email templates.
3. Enable Identity Platform for this development project and disable end-user account signup in its user actions/settings. The underlying config must have `client.permissions.disabledUserSignup: true`. Leaving a signup page out of the app alone does NOT prevent direct Firebase API signup. Provisioning checks this configuration and refuses to proceed if signup remains enabled. Keep email/password SIGN-IN enabled.
4. Create Cloud Firestore in locked/production mode (this describes the rules mode; use the new DEVELOPMENT project). Copy firestore.rules into that project's Rules editor and publish. User-role and bootstrap documents stay default-deny to clients. The customer-specific rules allow verified, active Admins to manage customer records, allow Customers to read only their own linked record, and deny Technicians access. The Admin SDK uses IAM and bypasses rules; every app operation independently verifies its session and permissions.
5. Create a dedicated development service account with Firebase Authentication Admin and Cloud Datastore User permissions, plus `firebaseauth.configs.get` for the CLI policy check. Use least privilege and keep its key out of Git and out of the existing project. Put project_id, client_email and private_key into the server-only FIREBASE fields. Both project ID variables must match.
6. In .env.local use `FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"` with the actual development key. Never use NEXT_PUBLIC_ for private keys. Do not commit .env.local.
7. Set APP_ORIGIN to exactly http://localhost:3001. If changing the port, update the origin as well. Restart the server after environment changes.

Signup policy reference: https://docs.cloud.google.com/identity-platform/docs/reference/rest/v2/Config
Session cookie reference: https://firebase.google.com/docs/auth/admin/manage-cookies

## Create the first Admin securely

Run this only from a trusted administrator workstation holding the NEW development service account:

`npm run bootstrap:admin -- --project YOUR_DEV_PROJECT_ID --email you@example.com --name "Your Name"`

This privileged, local-only script fixes the role to admin, verifies disabled public signup, creates an Auth account with a cryptographically random unknown password, and creates users/{uid}. It never prints or stores passwords. A Firestore transaction and persistent system/adminBootstrap marker close bootstrap permanently after success. It also refuses if an Admin profile already exists. There is no public bootstrap endpoint. Failed profile creation attempts roll back the newly created Auth account.

Open /login, choose Forgot password, and set your password through the email link. Sign in; if Firebase has not marked your email verified, choose Send verification email, open the link, and sign in again. The app never marks an email verified on your behalf.

Do not delete the bootstrap marker to reopen setup. The credential holder is a privileged platform operator; protect and rotate those credentials.

## Create accounts from the Admin dashboard

Sign in as a verified, active Admin, then choose **Create account** in the sidebar, or open /admin/accounts/new. Enter the name and email, select Technician or Customer, and submit. The server verifies the Admin session and current Firestore role and uses that session UID for createdBy; ADMIN_OPERATOR_UID is required only by the CLI.

The new user sets a password through Forgot password and completes email verification. No password is returned to the Admin. Creating an account does not replace the Admin session. Public signup must still be disabled. This screen creates new accounts only; it does not edit existing users or create Admins.

## Create later accounts using the CLI

Set ADMIN_OPERATOR_UID in .env.local to the first Admin UID printed by bootstrap, after completing password setup and verification.

`npm run provision:user -- --project YOUR_DEV_PROJECT_ID --email technician@example.com --name "Team Member" --role technician`

Roles: admin, technician, customer. Only trusted operators with server credentials can run this command; it also checks that the selected Admin operator is verified, enabled, and has an active Admin profile. This is a privileged administrative CLI, not an end-user authentication endpoint. Changing ADMIN_OPERATOR_UID alone grants no authority without the service account. Account holders set their own password using Forgot password and complete verification. There is no public signup. Verified Admins can create Technician and Customer accounts through Admin → Create account. The browser form offers those two roles only to Admins.

## Access and security

- /login provides sign-in, show/hide password, reset email, verification resend, loading and error states.
- /admin, /technician and /customer have separate layouts and page-level server authorization. Wrong-role requests redirect to the user's own dashboard; unauthenticated requests go to /login.
- Firebase client auth uses memory persistence. A recent verified ID token is exchanged for an eight-hour HTTP-only SameSite=Lax session cookie. Cookies are Secure in production builds (use HTTPS when running a production server).
- Session creation and logout enforce APP_ORIGIN to protect against cross-origin requests.
- Every server authorization verifies the cookie with revocation checking, fetches the current Auth user, and checks the current active Firestore profile. No role is read from browser storage or client input.
- Logout clears the session cookie and attempts to revoke Firebase refresh tokens for all sessions. Even if Firebase is unavailable the local cookie is cleared.
- Firestore profiles contain identity, role, active status and audit timestamps; never passwords. Keep server credentials private because Admin SDK privileges bypass Firestore rules.
- There are no production Firebase credentials, deployment configuration or production connections.

## Dependency compatibility

Versions are locked in package-lock.json. Next.js 16.4.6 currently uses plugins whose peer ranges require ESLint 9; ESLint 9.39.5 is retained for compatibility despite its upstream support notice. Security overrides pin patched gRPC and minimatch transitive versions. Revisit these when upgrading Next.js and its lint plugins together.

## Checks

`npm run typecheck`  
`npm run lint`  
`npm run build`  
`npm test`

The security smoke tests need a local build and start a temporary server on port 3107 without Firebase credentials. They verify protected redirects, origin validation and the login page without role selection. Next.js may deliver protected-page redirects as a streamed redirect meta tag after the loading shell; the tests check either a 307 or that redirect marker and confirm dashboard content is absent. Live sign-in, verification email, reset delivery, profile authorization and provisioning need a configured development Firebase project; they cannot be fully validated without it.

## Firestore emulator checks

Run `npm run test:rules` with Java 21 or newer. The runner uses a pinned official Firestore emulator JAR, verifies its SHA-256, binds only to 127.0.0.1, and uses the synthetic demo-itech-v2 project. On first use it downloads that official artifact into the ignored .firebase-emulator-cache directory. It does not read .env.local or create cloud accounts.

Twelve scenarios exercise get, list, create, update and delete denial against profile, bootstrap-marker and unknown paths, using unauthenticated and synthetic Admin/Technician/Customer identities. Four additional scenarios exercise the actual shared Firestore bootstrap transaction: atomic marker/profile creation, persistent lock after profile removal, refusal when an Admin already exists, and a concurrent race with exactly one winner. All sixteen emulator scenarios passed. These synthetic documents are local only; no Firebase Auth account is created. Emulator success verifies the local rules file, not equivalence to the entire published ruleset. A single live anonymous read returning PERMISSION_DENIED also does not prove every published rule.

## File map

- src/app: root, login, three dashboards, session API, loading/error/not-found pages and global SCSS.
- src/components: reusable brand, auth form, logout, dashboard shell and overview.
- src/lib: role definitions, request security, trusted session/profile checks and Firebase client/server initialization.
- scripts/provision-user.mjs: locked first-Admin bootstrap and Admin-only account provisioning.
- scripts/provisioning-store.mjs: shared Firestore provisioning transaction, exercised in the emulator.
- scripts/test-firestore-rules.mjs and tests/firestore-rules.emulator.mjs: isolated rules and bootstrap-transaction tests.
- tests/security.test.mjs: HTTP security smoke tests.
- .env.example, firestore.rules, firebase.json: setup template and default-deny rules.
- package.json, package-lock.json, tsconfig.json, next.config.ts, eslint.config.mjs: pinned dependency lock and tooling.

## Deferred

Technician assignment, scheduling, packages, AMC, WhatsApp, payments and reports are intentionally absent. The three dashboards contain clearly labelled future-phase placeholder cards. Dashboard cards do not show fabricated metrics; synthetic development QA records are labelled explicitly.

## Development integration verification

The development integration check on 13 November 2026 confirmed all required environment fields are present, Admin SDK Auth and Firestore are reachable, the Email/Password endpoint rejects a synthetic invalid login, and a development Firestore anonymous read is denied. No bootstrap command or cloud account creation was executed. No Admin, Technician or Customer role profiles, and no bootstrap marker, existed at the time of the check.

Public end-user signup was ENABLED in the checked development project. Disable it manually before provisioning; the script intentionally refuses to provision until client.permissions.disabledUserSignup is true. Email sign-in and email enumeration protection were enabled. Full login, verification/reset delivery, persistent sessions, wrong-role and disabled-account behavior remain untested until an Admin and disposable test accounts are created. Never paste service-account private keys into chat; rotate the shared key and replace the local value.

After completing the setup above, manually run bootstrap for a disposable development Admin, then provision a disposable Technician and Customer. Use controlled test mailboxes only. For each role, set a password by email, verify the email if needed, and confirm sign-in lands on its own dashboard. Before verification, dashboard access must be denied.

Then check a wrong password; reset the password through Forgot password; log out and confirm protected URLs redirect to login. After successful login, refresh and reopen the browser to check the eight-hour cookie persists. Each role must be redirected to its own dashboard when requesting another role's URL.

Disable a disposable test Auth account in Firebase Console and confirm its existing session and new sign-in are rejected. Also set a test profile's active field to false and verify dashboard denial. Restore or remove only these disposable test accounts when finished.

Use the Firestore Rules Playground in the DEVELOPMENT project to test unauthenticated and authenticated get, list, create and update attempts against users/{testUid}, system/adminBootstrap and another collection. All must be denied. Verify that the actual published rules match firestore.rules; local file inspection cannot prove deployed rules are active.

Bootstrap checks both the marker and existing Admin profiles before creation, repeats both checks in a transaction, and atomically creates the permanent marker with the first profile. The shared Firestore transaction passed four runtime emulator tests, including concurrent attempts. The cloud bootstrap command, account-creation/rollback path and first Admin account remain unexecuted.

Final checks: all 43 provisioning and HTTP security tests, TypeScript, ESLint and the production build passed. npm audit reported zero vulnerabilities after the emulator runner was reduced to the official checksum-verified JAR plus rules-unit-testing dependency.


## Phase 2 — Customer Management

Admin → Customers provides a paginated list, Add customer, customer details and Edit customer. Search uses case-insensitive prefixes of the full name, any name word, email or phone; it is not arbitrary substring/full-text search. Lists show 25 records per page.

Fields: fullName, normalized email, canonical 10-digit Indian phone, optional alternatePhone, address, city, state, 6-digit Indian pincode, active status, created/updated timestamps and audit UIDs. Email and primary phone are unique across active and inactive records. Names and alternate phones may be shared. Status changes only the customer record, not the sign-in account.

Data is stored separately in customers/{autoId}; no users documents or Firebase Auth accounts are edited by customer CRUD. customerKeys reserves normalized email, primary phone and linked owner UID in the same transaction as each write. Concurrent duplicates are rejected, contact edits release the old keys, and linked ownership and creation metadata are preserved.

A record is linked to an existing Customer Auth UID when its email matches that account and its users/{uid} profile has the Customer role. It can be created unlinked when no Auth account exists. After creating that sign-in account separately, edit/save the record to link it. Once linked, changing the contact email does not transfer ownership or alter the login email.

Customer → My profile is read-only and queries only the current session UID. Customers cannot list all records or edit any record. Technicians cannot access the customer APIs or customer documents. Firestore rules check current users/{uid} roles and active status rather than role claims supplied by clients. Phase 1 role/bootstrap documents and unknown collections remain default-deny. Customer deletion is not provided; use Inactive.

### Manual Firebase configuration

No rules, indexes, users or customer data are automatically deployed or migrated.

1. In the DEVELOPMENT Firebase project, publish the updated firestore.rules through the Firestore Rules editor.
2. Create the composite index declared in firestore.indexes.json: collection customers, searchTokens ARRAY_CONTAINS, createdAt DESCENDING. Wait for the index to finish building before using search.
3. Alternatively, if using an installed Firebase CLI, run this manually against the confirmed development project: firebase deploy --only firestore:rules,firestore:indexes --project blog-a893e
4. Existing Customer accounts need a separate customer record added by an Admin using their sign-in email before My profile has details. Do not migrate or alter production users.
5. No new environment variables or libraries are required.

Local coverage: customer field/format validation, API role and origin checks, owner isolation, default-deny regression tests, direct Firestore Admin/Customer/Technician permissions, protected audit fields, uniqueness keys, simultaneous duplicates, edits and search-token generation. Live customer creation/editing is not executed during automated validation; tests use synthetic emulator data or isolated adapters.

Customer files: src/lib/customers/{data,server,http}.ts; scripts/customer-store.{mjs,d.mts}; src/components/customers/{customer-form,customer-details}.tsx; Admin pages under src/app/admin/customers; Customer page at src/app/customer/profile; APIs under src/app/api/customers and src/app/api/customer/profile; firestore.rules and firestore.indexes.json. Existing dashboard navigation/styles and test suites are extended.

Customer Management validation: TypeScript, ESLint and production build passed; npm test passed all 91 security/API tests; npm run test:rules passed all 34 emulator tests. No cloud customer writes, user modifications or deployment were performed. Signed-in browser add/edit/profile smoke testing remains manual after the development rules/index setup.


## Appliance Management

Admin: Customers → open a customer → View appliances → Add appliance. Lists, details and editing are under /admin/customers/{customerId}/appliances. Customer: My appliances at /customer/appliances, with read-only detail pages.

Supported types are Water purifier and Air conditioner. Required fields are type, brand, model and Active/Inactive status. Serial number, purchase date, installation date and notes are optional. Dates must be real calendar dates in 1900–2099; installation cannot precede purchase when both dates are supplied. Serial numbers are uppercase with spaces removed and allow letters, numbers, dots, underscores and hyphens.

Records are stored in customers/{customerId}/appliances/{applianceId}. The parent customer is fixed by the path; it cannot be changed through an appliance edit. Each supplied brand/serial combination is reserved in applianceKeys in the same transaction as the write. Brand comparisons ignore case. Inactive appliances retain their serial reservation. Records without serial numbers are allowed. Creation metadata is immutable, edits retain audit fields, and deletion is not offered.

Customers can read only appliances under their own linked customer record. Linking an existing customer record later also makes its appliances available to that owner. Customers cannot add, edit or delete appliances; Technicians have no appliance access until a future assignment feature is explicitly implemented. Direct Firestore rules enforce these permissions using trusted user profiles and the parent customer UID. App APIs independently verify the server session and parent ownership.

### Firebase setup for appliances

Publish the UPDATED firestore.rules to the DEVELOPMENT project again. The previously published customer-only rules do not include appliance permissions. No new composite index, environment variable or package is required for the per-customer appliance lists; automatic createdAt indexing is used.

Do not deploy production rules or migrate existing users as part of this setup. No live appliance/customer/user records were changed during implementation. Emulator fixtures and isolated adapters cover creates, edits, duplicate races, serial changes, parent linking, forged ownership/audit fields, date validation, Admin access, Customer isolation and Technician/unauthenticated denial.

Files added: src/lib/appliances/{data,server,http}.ts; scripts/appliance-store.{mjs,d.mts}; src/components/appliances/{appliance-form,appliance-list,appliance-details}.tsx; Admin pages beneath src/app/admin/customers/[id]/appliances; Customer pages beneath src/app/customer/appliances; nested appliance APIs and /api/customer/appliances; tests/appliances.test.mjs. Customer details/profile links, dashboard navigation/overview, styles, Firestore rules and existing test suites are extended.

Validation: TypeScript, ESLint and production build passed; all 140 security/API tests and 49 emulator tests passed. The signed-in Customer empty state and redirect from Admin appliance creation were verified in the browser. Live Admin creation/editing and a populated Customer appliance page remain smoke tests after setup.

Technician assignment, scheduling, service packages, AMC, WhatsApp, payments and reports remain deferred.

## Service Request Management — latest feature

Admin → Service requests lists all requests, with status filters and 25-record pagination. Create a request from Customers → customer → View appliances → appliance → Request service. Customers use My requests, or My appliances → appliance → Request service. New requests require a linked, active customer record and an active appliance.

Service types: Installation, Maintenance and Repair. A 10–2,000 character description is required. Requests begin Pending. Only verified, active Admins change progress: Pending → In progress → Completed, or Pending/In progress → Cancelled. Completed and cancelled requests cannot be reopened or deleted. Customers can submit/read their own requests, but cannot edit submitted details or change status. Technician assignment, scheduling, notifications and billing remain deferred.

Data: serviceRequests/{id}, referencing an existing customer and its appliance. The server derives creator/audit metadata, Pending status and display labels; client-supplied status, attribution and labels are ignored. Names are snapshots from creation time. Read permissions follow the parent customer's current linked owner UID. Auth accounts and users profiles remain unchanged.

serviceRequestKeys reserves each customer/appliance/service-type combination atomically while Pending or In progress. Simultaneous duplicates produce one winner. Completion/cancellation releases the reservation for a later request. Status changes require the previous status and a transaction rejects stale concurrent changes. Creation metadata, customer/appliance references and description remain immutable.

All request and reservation writes use protected server APIs. Firestore client rules allow Admins to read all requests and Customers to read only their own; all client writes are denied, including Admin client SDK writes. Reservations are default-deny. Direct SDK calls cannot bypass duplicate/status checks. The Admin SDK bypasses rules, so server operations independently authorize the verified session and recheck active Firestore roles and parent ownership in transactions.

### Development setup

Publish the updated firestore.rules to the DEVELOPMENT project again. Add the three serviceRequests composite indexes declared in firestore.indexes.json, with Collection query scope:

- status Ascending + createdAt Descending
- customerId Ascending + createdAt Descending
- customerId Ascending + status Ascending + createdAt Descending

Wait until each index is Ready. Keep the existing customers search index. With an installed Firebase CLI, the manual development-only command is:

    firebase deploy --only firestore:rules,firestore:indexes --project blog-a893e

No new environment variables or packages are needed. No deployment, cloud request creation, account changes or existing record edits were performed. The published development rules matched the previous appliance implementation before these request rules were added; the new request rules still need publication.

### Validation and remaining manual checks

TypeScript, ESLint and production build passed. The full suite passed 186 security/API tests; the isolated Firestore emulator passed all 64 tests. Coverage includes ownership and scoped lists, unauthenticated/Technician denial, forged identity/status, inactive records, duplicate races, immutable creation data, terminal transitions, cancellation key release and concurrent updates. HTTP smoke tests verify protected routes and origin checks without cloud credentials.

Signed-in browser verification was unavailable because local browser use is disabled in Work settings. After publishing development rules/indexes:

1. As Admin or Customer, open an active appliance and submit a clearly labelled development test request.
2. Confirm a second open request of the same type is rejected, and Customers see only their own requests.
3. As Admin, move Pending → In progress → Completed; refresh Customer details to check progress. Check cancellation on a separate disposable request.
4. Check filtering/pagination, another Customer's request URL denial and Technician access denial.
5. Confirm inactive customer/appliance records block new requests.

Feature files: src/lib/service-requests/{data,server,http}.ts; scripts/service-request-store.{mjs,d.mts}; src/components/service-requests/*; Admin and Customer service-requests pages; /api/service-requests and /api/service-requests/[id]; tests/service-requests.test.mjs. Existing navigation/overview, appliance detail links, SCSS, rules/indexes and security/emulator suites were extended.

## Technician Assignment — latest feature

Admin → Service requests → open a Pending request → Technician assignment → choose an eligible account → Save assignment. Choose Unassigned to remove an assignment. Eligible technicians load automatically when the Admin opens a Pending request. Load more technicians supports larger teams; a Load technicians retry remains available if the initial lookup fails. Only active Firestore Technician profiles with enabled, email-verified Firebase Auth accounts are eligible; the server rechecks eligibility when saving.

Assignment is separate from service progress. Admins can assign, reassign or unassign while Pending. An existing unassigned In-progress request can receive its initial technician without resetting its status. Once an In-progress request has an assignment, reassignment/removal remains blocked. Starting work requires an active, enabled, verified assigned Technician; completing work requires an assignment. Assignment does not automatically start or complete a request. Assigned Technicians now use the minimal work-update actions described below. Started/completed/cancelled requests retain their assignment for history. Scheduling, notifications and billing are not included.

Technician → My assigned work (/technician/assignments) shows a paginated list with status filters and request details with the minimal work-update controls below. Technicians see only requests currently assigned to their own verified session UID; no technician UID is accepted from query parameters. Reassignment/unassignment revokes old technician access on subsequent reads. Assigned technicians still cannot browse customer records, appliance records, user profiles or the technician directory. Their detail page shows only the request's existing customer/appliance display snapshots and description, without links to other role dashboards.

Customers retain ownership-based request access and can see the assigned technician's display name. Customer creation cannot supply assignment metadata. The shared serviceRequests collection adds assignedTechnicianUid, assignedTechnicianName, assignmentVersion, assignmentUpdatedAt and assignedBy. Existing requests without these fields appear Unassigned/version 0; no backfill or user migration is needed.

Assignments use an Admin-only, same-origin server endpoint and an atomic transaction that rechecks the operator role, target Technician profile and Pending status. The target Auth account must be enabled and verified; this eligibility is rechecked when work starts. Expected assignment versions prevent stale concurrent changes from overwriting newer assignments. Creation data, description, customer/appliance references, service status and duplicate-request reservations remain unchanged. Firestore permits assigned-only Technician reads while keeping all direct request writes denied.

### Development Firebase configuration

Publish the latest firestore.rules to DEVELOPMENT again. The previous request rules deny all Technician reads; the new rules permit only the assigned Technician.

Create these TWO additional serviceRequests indexes from firestore.indexes.json (Collection scope), then wait until Ready:

- assignedTechnicianUid Ascending + createdAt Descending
- assignedTechnicianUid Ascending + status Ascending + createdAt Descending

Keep all existing indexes. No new packages, environment variables or account changes are required. Technician accounts must complete their existing password setup and email verification before appearing as eligible choices.

### Verification

TypeScript, ESLint and production build passed; all 225 security/API tests and 78 isolated Firestore emulator tests passed. Coverage includes Admin-only assignment, verified/enabled/active target checks, directory filtering/pagination, current-session Technician queries, forged cursor denial, missing/legacy records, immutable request data, concurrent version conflicts, reassignment/unassignment revocation and unchanged customer/appliance isolation. Auth target responses in emulator tests are synthetic adapters; live account eligibility and signed-in UI flows remain manual.

No production connection, deployment, live assignment, user modification or record migration was performed for this feature. The earlier live Customer request test succeeded with Pending status; its Admin progress flow remains unverified. This does not count as a passed live assignment test.

After development rules/index setup, sign in as Admin and assign a labelled Pending QA request. Sign in as that Technician and verify its list/details, status filtering and denial of unassigned/other technicians' URLs. Reassign or unassign as Admin, then refresh the old Technician session to confirm access is removed. Confirm Customers cannot assign and technicians cannot browse customers or update unassigned requests. Use disposable development data only.

Files added: scripts/assignment-store.{mjs,d.mts}; src/lib/assignments/{data,server}.ts; src/components/service-requests/assignment-form.tsx; /api/admin/technicians; /api/service-requests/[id]/assignment; /api/technician/assignments and /[id]; /technician/assignments pages; tests/assignments.test.mjs. Shared request data mapping/create defaults, details/list UI, navigation/overview, Firestore rules/indexes, security/emulator tests and this README were updated.

## Technician dropdown and workflow fixes

Eligible technicians now load automatically on the protected Admin request page, including recovery of an unassigned In-progress request. Lookup failure leaves a visible retry action without blocking request details. Existing eligibility filters remain enforced. Development read-only diagnosis found one eligible Technician (Sim); Simran has a role profile without a matching Auth account and is correctly excluded. No accounts were changed.

Server transactions reject starting or completing unassigned work. Starting additionally rechecks the assigned Technician profile and current Auth enabled/verified state; lookup failures fail closed. The UI hides unavailable work transitions and explains that assignment is required. Legacy unassigned In-progress requests can be assigned once by Admin without resetting status. Existing live requests are not automatically modified.

Validation: TypeScript, ESLint, production build, 229 security/API/rendering tests and 82 emulator tests passed. Regression coverage includes automatic dropdown rendering, initial-load retry, protected Admin preloading, legacy assignment recovery, unassigned work denial, disabled/unverified Technician start denial and assignment/start races. No additional Firebase rules, indexes, environment variables or packages are needed. Signed-in browser verification remains manual.

## Minimal Technician Work Updates

Technician → My assigned work → open a request. Pending work offers Start work. In-progress work offers Save notes and Complete work. Completion requires nonblank service notes, with a maximum of 2,000 characters. Completed/cancelled work is read-only. Admins retain their existing controls and can view service notes; Customers see progress only.

The same-origin Technician-only endpoint verifies the existing server session, then a transaction rechecks the current active Technician profile and assignment. Start changes Pending to In progress; save edits one notes field; complete changes In progress to Completed and atomically releases the open-request reservation. Expected status and note version reject stale edits and concurrent changes. Request creation data, customer/appliance references and assignment remain unchanged.

Private notes live in serviceWork/{requestId}, separately from Customer-readable requests. Firestore allows Admin and currently assigned Technician reads, denies Customer reads and denies all direct client writes. Missing note records need no migration. Reassignment/removal revokes the former Technician's note access. No accounts or live requests were changed during implementation.

Publish the latest firestore.rules to DEVELOPMENT once validation is complete. No new index, environment variable or package is required. Then manually test an assigned Pending development request: Start work → Save notes → Complete work; check that blank completion is blocked, Admin sees notes, Customer sees status only, and another Technician cannot open/update that request. Signed-in browser verification remains manual.

New files: src/lib/technician-work/{data,server}.ts; scripts/technician-work-store.{mjs,d.mts}; src/app/api/technician/assignments/[id]/work/route.ts; src/components/service-requests/{technician-work-form,work-notes}.tsx; tests/technician-work.test.mjs. Admin/Technician detail pages, Technician list copy, shared request reservation helper/error mapping, Firestore rules and regression tests were updated.

Validation completed: TypeScript, ESLint and production build passed; all 251 security/API/rendering tests and 91 isolated Firestore emulator tests passed. Live signed-in work-update testing remains manual; no development rules were published and no live records were changed.

Development rules publication on 16 November 2026: published the tested firestore.rules to blog-a893e and read back the active ruleset to verify it matches the local source. Only the new serviceWork permission block differed before publication; other permissions were preserved. No Auth accounts or service records were changed, and the application was not deployed. Live browser work-update verification remains unavailable for this chat.

## Service Packages — small catalogue

Admin → Service packages provides Add package and Edit package. Fields: name, appliance type (water purifier/AC), service type (installation/maintenance/repair), INR price, description and Active/Inactive status. Required fields are validated. Prices must be above zero, at most INR 10,00,000 and have no more than two decimal places; storage uses integer paise. Lists show 25 records per page. Inactive packages remain available to Admin for editing.

Customer → Service packages shows only active offerings, with names, descriptions, appliance/service types and formatted INR prices. This is a catalogue only: no booking, checkout, payment, package purchase or link to service-request pricing. Technicians have no package access in this version.

Records are in servicePackages/{id}. Only protected, same-origin Admin server operations create/edit records; the transaction checks the current active Admin profile, keeps creation metadata and rejects stale version edits. No delete operation is provided. Firestore allows Admin reads and verified active Customer reads of active packages only; direct client writes are denied for every role. The server independently enforces the same read restrictions because Admin SDK access bypasses rules.

Development setup: publish the updated firestore.rules, and create ONE additional servicePackages index with Collection scope: active Ascending + createdAt Descending, as declared in firestore.indexes.json. Wait until Ready. Keep existing indexes. No new packages, environment variables, migrations or account changes are required. Nothing has been published or written to cloud data for this feature.

Manual smoke test after setup: Admin adds a clearly labelled development package, edits the price/description and confirms success; Customer sees it; Admin marks it Inactive and Customer no longer sees it. Verify Customer/Technician writes are denied and that another Admin edit causes a stale-save conflict. Signed-in browser verification remains manual.

Added: src/lib/service-packages/{data,server,http}.ts; scripts/service-package-store.{mjs,d.mts}; src/components/service-packages/{package-form,package-list}.tsx; Admin /service-packages list/new/edit pages; Customer /service-packages catalogue; /api/service-packages and /api/service-packages/[id]; tests/service-packages.test.mjs. Navigation, SCSS, rules/indexes and security/emulator suites were extended.

Service Packages validation completed: TypeScript, ESLint and production build passed; all 288 security/API/rendering tests and 99 isolated Firestore emulator tests passed. Signed-in catalogue create/edit/deactivate testing remains manual after development rules/index publication. No cloud package records or Auth users were changed.

## Appliance service plans and Customer self-service

Admin → Customers → customer → appliance → Add service plan. Each period includes exactly TWO free maintenance visits, apart from installation. Set the plan name, start date and inclusive expiry date; for example 15 November 2026 through 15 November 2027. An optional active maintenance catalogue package matching the appliance copies its name; it does not create a payment or charge.

Renew plan creates a new period after the latest period's expiry. Default renewal dates after 15 November 2027 are 16 November 2027 through 15 November 2028. Early renewal may schedule a future period; it does not replace current coverage. Each renewal starts with two visits and zero usage. Old periods/history remain immutable. Unused visits expire without rollover.

Customer → My service plans shows owned appliances, plan/package names, used/remaining visits and expiry. Book free maintenance submits a maintenance request only if an allowance is available; the server rechecks it, ignores client-supplied plan/counter fields and rejects expired/upcoming/exhausted free bookings. Only one open request per appliance/service type is allowed. This requests Admin review, not a confirmed appointment slot.

Report a complaint creates a repair/complaint request for the Customer's own appliance. Complaints, repairs, installation and cancellations never use included maintenance. My services shows bookings, complaints, progress and history; Service catalogue remains separate from the Customer's attached plans.

Visits are deducted only on maintenance completion, through the same transaction for Admin or assigned-Technician completion. A request stays linked to its original period. If that period expires before completion, no included visit is used and renewal credits are untouched; the job may be recorded completed without any automatic billing. Successful redemptions are recorded once, preventing duplicate deductions and overdraw.

Plan records/visit history are under customers/{customerId}/appliances/{applianceId}/servicePlans/{planId}; a server-only servicePlanState/latest document prevents overlapping/concurrent renewals. Only Admin and the owning Customer can read plans/history. Technicians receive the request's coverage summary, not unrestricted plan/customer access. All direct plan/counter writes are denied. Remaining allowance/expiry is computed in India time without background jobs; no user migration is needed.

Setup: publish the updated firestore.rules to DEVELOPMENT. No additional index is needed for per-appliance date/history queries. Keep all existing indexes. No environment variables, packages, accounts, automatic payments or notification services were added. No live plans, renewals or requests were created/changed during implementation.

Manual smoke test: add a labelled development appliance plan; as Customer book maintenance; complete it as assigned Technician and check remaining 2 → 1 → 0 across two completed visits. Confirm complaint completion does not deduct, expiry hides free booking, a future renewal keeps previous usage/history and other Customers cannot read or book against that appliance.

Files: scripts/service-plan-{dates,core,store}.{mjs,d.mts}; src/lib/service-plans/{data,server,http}.ts; src/components/service-plans/{plan-form,appliance-plans}.tsx; Admin appliance service-plans/new page; nested service-plans API; Customer service-plans overview. Existing appliance/request pages, request/Technician completion transactions, Customer navigation/dashboard, rules, SCSS and tests were extended. Signed-in browser verification remains manual.

Appliance plans and Customer self-service validation completed: TypeScript, ESLint and production build passed; all 315 security/API/rendering tests and 117 isolated Firestore emulator tests passed. Coverage includes inclusive Indian expiry dates, independent renewals without rollover, strict free-booking eligibility, complaints that consume no allowance, owner isolation, immutable plan periods and exactly-once completion deductions. New service-plans rules still require publication to development. No live records, Auth accounts, rules or indexes were changed for this feature; signed-in browser smoke testing remains manual.

## Service lifecycle and WhatsApp upgrade — current status

The current business rules, audit, migration policy, phase results and modified-file map are in [docs/SSOT.md](docs/SSOT.md). Historical feature notes above describe earlier milestones; this section and SSOT supersede their deferred/current-status wording.

Admin → Service lifecycle adds a maintenance calendar, real KPIs, renewal decisions, follow-ups, notification history, consent and automation settings. Customer → Care & renewals shows owned scheduled maintenance/renewals and WhatsApp preferences. Initial periods use the recorded installation date and configured package validity. Renewals need owner agreement before Admin confirmation and create separate periods. Existing plans/receipts are retained.

Read [docs/SERVICE-LIFECYCLE-SETUP.md](docs/SERVICE-LIFECYCLE-SETUP.md) for exact development rules/index publication, package policy configuration, Meta template/secret setup, scheduler/webhook registration, migration limitations and manual acceptance checks. No new dependencies were added.

Validation: TypeScript, ESLint and production build passed; 339 regression/security tests and 135 isolated Firestore emulator tests passed. Signed-in browser acceptance and live Meta delivery remain untested. The seven new server-only automation values are absent. No new cloud rules/indexes were published, no records were migrated and no production deployment was performed.
