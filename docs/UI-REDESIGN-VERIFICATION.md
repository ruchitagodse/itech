# iTech UI redesign: final verification

Reviewed on 27 November 2026. All implementation and test artifacts are inside
the iTech workspace. The booking project was used only as a design reference
and was not modified.

## Final review fixes

- Menus close when the route changes, including navigation outside menu links.
- Closing a menu after resizing to desktop restores focus to the main content
  when its original mobile trigger is hidden.
- Open dialogs prevent background scrolling. Their contents remain scrollable
  in short landscape viewports, including the sign-out action.
- Back links and related navigation links have a minimum 44px target height.
- Rechecked the latest iTech wordmarks, customer headers, blue primary-button
  text contrast, checkbox sizing and bottom-navigation positioning.

Firebase adapters, authentication rules, API contracts and business workflows
were not changed during this final review.

## Checks passed

- `npm run build`: production compilation, TypeScript and route generation passed.
- `npm run typecheck`: passed.
- `npm run lint`: passed with zero warnings.
- `npm test`: 438 passed, zero failures or skips, against the final build.
- `npm run test:ui`: 245 responsive checks and 88 interaction groups passed,
  with zero failures.
- The implementation's isolated Firestore emulator run passed 145 tests.
  It was not repeated for the final presentation-only fixes; Firebase rules
  and transaction code have not changed since that run.

The responsive suite renders 49 screen/state variants at 320, 360, 768, 1024
and 1440px. Interaction checks run at 360, 768 and 1440px, with an additional
844 x 390 landscape scenario and reduced-motion emulation.

Interaction coverage includes touch and keyboard navigation, role-specific menu
destinations, search, focus trapping/restoration, Escape, desktop sidebar
collapse, sign-out failure recovery, request validation and retry, filters,
pagination destinations, customer/appliance editing, technician provisioning,
assignment, work notes/start/completion, package validation/editing, configured
plan creation, consent, and separate Customer/Admin renewal actions.

Of the 88 interaction groups, 21 exercise the actual production Next.js build:
login hydration, password visibility, responsive layout and zoom settings,
plus anonymous redirects for six protected routes at each of three widths.

## Reproducing and interpreting browser checks

Run `npm run build`, then `npm run test:ui`. The suite uses a local Chrome or
Edge installation; `UI_BROWSER` can specify another Chromium executable.
It requires permission to spawn local browser and server processes.

The component scenarios use real presentation components and React handlers
with synthetic data, mocked navigation and intercepted API responses. They
do not establish successful live Firebase operations. The separate production
smoke server has blank server Firebase configuration and its browser blocks
external traffic; those checks cover public login and anonymous access only.

Generated evidence is in `.ui-check/report.json` and `.ui-check/screens/`.
The directory is ignored by Git and contains synthetic fixtures, not customer
records. Fixture login screenshots intentionally show Firebase as unconfigured.

## Remaining gaps

- Authenticated, end-to-end acceptance against a live Firebase development
  project has not been executed. Real sign-in, email delivery, persisted
  writes, authenticated route transitions and notification delivery therefore
  remain unverified in a browser.
- Browser verification used Chromium emulation, not physical phones/tablets,
  Safari/WebKit or Firefox. Native keyboards, OS safe-area behavior and actual
  PWA installation still need device acceptance.
- The fixture matrix checks shared module presentations and selected states;
  it is not exhaustive coverage of every record, permission or failure state.

No live records, credentials, booking files or deployments were changed by the
final review.
