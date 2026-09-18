# Estado verificado del paquete de tienda — 18 septiembre 2026 UTC

La identidad vigente es iOS `com.tdfrecords.app`, App Store Connect `6779786470`,
y Android `com.tdf.records`. El código de release es `efa2555c5400dfa736bc95a12414a790b82adda5`.
iOS1.0.1(18) fue subido en EAS `d3c2977f-c136-4c03-81c8-51ecbc8c110f`;
Apple confirmó build `f72c49ae-2da2-4beb-b0eb-a26bdef674b2` con processingState VALID.
Esto no acredita revisión, TestFlight disponible ni publicación.

La ficha iOS verificada por API está PREPARE_FOR_SUBMISSION, versión1.0.1.
La localización es-MX tiene descripción, palabras clave y URL de soporte guardadas
y leídas nuevamente, y el build18 está asociado. Falta App Store Review Detail. Antes de revisión se requieren capturas actuales,
acceso de demostración operativo, declaraciones de privacidad verificadas y
cuestionario de edad/distribución. Free Apps Agreement se observó Active;
Paid Apps Agreement New no impide por sí solo subir una app gratuita.

El cliente SÍ permite registro público. No reutilizar las afirmaciones históricas
“no public signup” ni el identificador antiguo de App Store Connect.
Los enlaces de soporte, privacidad y borrado respondieron200 tras su redirección
canónica; se verificaron sus títulos y contenido, no sólo el código HTTP.

## Plantilla histórica — revisar contra la implementación antes de reutilizar

# Store Metadata Template

## Shared Positioning

- App name: `TDF Records`
- Category: `Business`
- Secondary category suggestion: `Productivity`
- Content rating suggestion: `Everyone` / `4+`
- Support URL: `https://tdf-app.pages.dev/mobile-app/support.html`
- Privacy policy URL: `https://tdf-app.pages.dev/mobile-app/privacy.html`
- Marketing site: `https://tdf-app.pages.dev/mobile-app/`
- Public data deletion URL: `https://tdf-app.pages.dev/mobile-app/data-deletion.html`
- Contact email: `soporte@tdfrecords.com`

## Google Play

- Title: `TDF Records`
- Short description: `Manage bookings, events, contacts, inventory, and venues from one mobile workspace.`
- Full description:

`TDF Records keeps day-to-day operations moving for staff and invited collaborators.

Use the app to review parties and contacts, create and track bookings, move production cards through the pipeline, browse and save upcoming events, and exchange QR-based vCards with collaborators.

Operational tools are built into the same mobile workspace. Inventory teams can capture or upload asset photos, update item status, and record check-in or check-out activity. Venue teams can search nearby spaces with optional location access.

The app connects to the TDF Records backend and is intended for authorized users with a valid API token.`

- Application type: `App`
- Category: `Business`
- Contact email: `soporte@tdfrecords.com`
- Release track suggestion for first rollout: `Internal testing`

## Apple App Store

- Name: `TDF Records`
- Subtitle: `Bookings, events, and CRM`
- Promotional text:

`A focused mobile workspace for TDF Records teams handling bookings, contacts, inventory, and venue operations.`

- Description:

`TDF Records gives staff and invited collaborators a single mobile workspace for daily operations.

Browse client parties, manage bookings, track production pipeline stages, and explore upcoming events from the same app. Social tools include mutual connections, friend suggestions, and QR-based vCard exchange for quick contact sharing.

The app also supports inventory workflows with photo capture or library upload, plus nearby venue discovery with optional location access.

A valid backend token is required for protected CRM and inventory features.`

- Keywords: `bookings,events,crm,inventory,venues,contacts,artists,parties`
- Primary category: `Business`
- Support URL: `https://tdf-app.pages.dev/mobile-app/support.html`
- Marketing URL: `https://tdf-app.pages.dev/mobile-app/`
- Privacy policy URL: `https://tdf-app.pages.dev/mobile-app/privacy.html`

## Screenshot Plan

- iPhone 6.7": onboarding hero, parties list, events list, social/vCard screen, inventory modal.
- iPhone 5.5": bookings, pipelines, venue explorer.
- Android phone: parties, bookings, events, inventory, venue explorer.

Capture screenshots against a production-like backend with non-sensitive demo data.

## Manual inputs that still require humans

- Real reviewer/demo bearer token or equivalent review account
- Final Apple privacy nutrition label answers and Google Play Data safety answers
- Final screenshots from the release-candidate builds
