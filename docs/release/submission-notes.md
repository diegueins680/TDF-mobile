# Submission Notes Template

## Reviewer Access

- The app is intended for TDF Records staff and invited collaborators.
- Protected features require a bearer token from the TDF Records backend.
- Replace this placeholder before submission with a real review credential:
  `Reviewer token: Bearer REPLACE_WITH_STAGING_REVIEW_TOKEN`

## Review Flow

- Launch the app and complete onboarding.
- Open the auth screen and paste the reviewer token.
- Use the tabs to verify parties, bookings, pipelines, events, social connections, and vCard exchange.
- Open inventory to verify photo upload and asset state changes.
- Open venue explorer to verify optional location-based venue search.

## Permission Explanations

- Camera: used for QR scanning in vCard exchange and capturing inventory photos.
- Photo library: used for selecting existing inventory photos.
- Location: used only to show nearby venues when the user enters venue explorer.

## Notes For Apple Review

- No account creation exists in-app.
- The app has no public social feed or user-generated public posting.
- If reviewer access to backend endpoints is limited, the protected CRM screens will show restricted-access states instead of editable data.
