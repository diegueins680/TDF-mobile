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
