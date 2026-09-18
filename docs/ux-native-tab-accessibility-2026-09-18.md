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
