# Privacy And Data Safety Checklist

Use this as a starting point for Google Play Data safety and App Store privacy nutrition labels. Confirm the final answers with the backend owner before submission.

## Features That Trigger Permissions

- Camera for QR scanning and inventory photo capture
- Photo library access for inventory image upload
- Location access for nearby venue search

## Likely Data Types Present In The Product

- Contact info: names, email addresses, phone numbers in vCards and party profiles
- User identifiers: bearer tokens and party IDs
- Business data: bookings, pipeline stages, venues, events, inventory records
- Photos: inventory images uploaded by authorized users
- Approximate or precise location: only when venue explorer is used

## Likely Store Form Answers To Verify

- Data is tied to user or business accounts managed by the backend.
- Sensitive access is role-gated by bearer token.
- Location, camera, and photo access are optional at runtime.
- Replace placeholder privacy URLs before submission.
