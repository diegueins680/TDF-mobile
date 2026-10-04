# Native navigation accessibility — UX-260917-033

Actual iOS18.3 accessibility hierarchy from the existing simulator artifact source
1ec9160 reports "Perfil, tab, 5 of 12" although only five destinations are visible.
The installed React Navigation BottomTabBar counts all registered routes, including
seven internal routes hidden with href:null. It also uses an English position phrase
on the Spanish interface. Tab titles were evaluated once at module initialization
from a separate default-Spanish translator rather than current UserSettings locale.

Resolve visible labels on render from the existing locale provider and translation
keys. Supply the documented tabBarAccessibilityLabel option: localized visible count
on iOS, title-only on Android (native role retained). Signing out keeps only the public
directory tab and reports1of1. Hidden routes and all permission checks are unchanged.
The authentication loading indicator also follows the selected language.

Primary source consulted2026-09-18:
https://reactnavigation.org/docs/bottom-tab-navigator/#tabbaraccessibilitylabel
Installed BottomTabBar.tsx lines430-433 confirm the default all-route count. The before
observation is a real accessibility tree, not a claim that human VoiceOver was run.

Validation before publication: actual TabsLayout component regressions cover ES→EN→ES
changes, five visible destinations, signed-out1of1 and localized session loading.
Finite language/auth/platform combinations check label/count contracts. Complete
83suites/486tests passed before adding the additional loading assertion; the final
focused suite and hosted checks carry their own counts. TypeScript and release checks
are recorded in the PR. Offline Metro8101 started successfully. Actual corrected native
runtime, signed distribution, store submission/review/publication remain separate gates.

This focused source starts at the parent repository's published gitlink34971c451,
including notification2244490 and generated experiment declarations. It deliberately
does not import the independent Google-linking/contact-intake stack merely to fix
these labels. Parent must qualify the exact published source and preserve newer
contracts if its backend base changes before updating the gitlink. No API/schema or
entitlement changes occur here. Canonical finding/release status remains in the parent
repository's docs/ux-ui-audit/2026-09-17 records, not a separate findings tracker.

Actual corrected artifact verification, 2026-09-18 07:15 UTC:
EAS simulator4696e1b9-97e3-42a8-ace1-64ed1a637a20 FINISHED from
`afbd5dcc7f42b612ce1ca678871b1b1aa69227cc`; archive SHA256
`c2304379eedb1da8fea0ac758c9aeba2983443658b334a2f175583dc83c3b4a9`.
Installed on isolated iOS18.3 simulator97AB8B7E. Actual Info.plist is1.0.1/build1;
EAS metadata20 is not a claim that this is the signed App Store20 binary.
Maestro passed the existing legitimate App Review session: directory1of5,
profile5of5, authenticated profile, stop/relaunch and authenticated return.
A second flow passed ES→EN→ES with current accessible labels and restored Spanish.
Screenshots are in `docs/evidence/native-tabs-2026-09-18/`.
No account creation, consequential business action or credential is included.
This verifies the simulator accessibility tree, not a human VoiceOver session,
physical devices, Android runtime, signed build, or store publication.

## Continuation: native text scaling, 2026-09-18 17:10 UTC

On the physical Samsung SM-S928B / Android16, system font_scale2.0 truncated
Directorio/Seguir/Explorar in the fixed-height bottom bar. The custom labels now
retain unrestricted system scaling and wrapping. Native text layout measures the
tallest label and reserves that height plus icon/padding and the bottom safe area.
Measurements reset when width, scale, language or authentication changes.
Accessible names and authorized destinations retain the existing contracts.

508 tests in85 suites and release:check passed. The component regression checks
measured multiline height, safe-area allowance and unrestricted scaling. Actual
production Hermes export completed2315modules; the isolated QA package used its
existing native base46b1cca1-f38e-4105-b9c4-68947bcdd52d with only the JS bundle
replaced and re-signed with its existing QA key. This is a native visual prototype,
not a complete new cloud/store artifact. Before/after screenshots and receipts are
in docs/evidence/native-tabs-text-2026-09-18/. At1.0 and2.0 labels are complete;
long words wrap within their tab. font_scale was restored to its original1.0.
The screenshot's session/API state does not qualify authentication or persistence.
The phone subsequently disconnected; further native journey checks remain pending.
No TalkBack/VoiceOver or physical-iPhone execution is claimed.

Primary implementation references checked2026-09-18:
- https://reactnative.dev/docs/text#ontextlayout — measure native line geometry.
- https://reactnative.dev/docs/text#allowfontscaling — preserve the user setting.
- https://reactnavigation.org/docs/bottom-tab-navigator/#tabbarlabel — custom label
  with the navigator's active/inactive color.

No auth/permission/payment transition changes; existing formal properties remain
applicable, but model checking does not prove this visual geometry. Signed iOS24
and a subsequent Android artifact must include this fix before store qualification.

## iOS counterexample and repair — 2026-09-18 17:45 UTC

The Android wrapping implementation in109 still clips long words on iOS18.3 at
accessibility-extra-large. React Native0.81 TextKit uses clipping for an unlimited
line count; bounding lines by title code-point count removes that mode but alone
still ellipsizes because layout is constrained to the bar's old height. The actual
two failed screenshots are not passing evidence.

Measure iOS labels outside the bar's constrained layout, at the exact per-tab width
and font settings, then reserve the tallest measured line geometry. Measurement
views ignore touches and are hidden from accessibility. One possible line per code
point allows every character to wrap without capping font scale. Android retains
109's visible-label measurement and unrestricted lines. Width/insets, scale, locale
and account changes invalidate old measurements.

The actual compatible simulator native binary with production Hermes now displays
all five full labels at accessibility-extra-large and after restoring large. Its
hierarchy reports five localized accessible tabs and zero measurement nodes.
Images/receipts are in docs/evidence/native-tabs-text-2026-09-18/. Simulator was
shut down afterward. No human VoiceOver or physical Google OAuth claim. Seven
focused component tests cover measurement, locale reset, hidden nodes and unchanged
Android path; release:check is recorded separately. Hosted full suite and signed
iOS25 must pass before advancing the release. iOS24 was Apple-validated/uploaded
but remains an intermediate artifact; it must not be promoted as this correction.

Implementation evidence: installed React Native RCTTextLayoutManager.mm lines228–231
and React Navigation BottomTabItem.tsx; these renderer constraints explain the
actual native counterexample. The Android17 source retains the qualified Android
behavior; this successor is an iOS-specific visual correction with no API changes.
