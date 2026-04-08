# Submission Notes Template

## Reviewer Access

- The app is intended for TDF Records staff and invited collaborators.
- Protected features require organization-managed credentials.
- The current primary reviewer flow is username/password login or Google login; the backend issues a bearer token/session after authentication.
- Replace these placeholders before submission with real reviewer access:
  `Reviewer username: REPLACE_WITH_REVIEW_USERNAME`
  `Reviewer password: REPLACE_WITH_REVIEW_PASSWORD`
  `Reviewer token/session (optional fallback): Bearer REPLACE_WITH_STAGING_REVIEW_TOKEN`

## Review Flow

- Launch the app and complete onboarding.
- Open the auth screen and sign in with the reviewer username/password (or Google login if explicitly provisioned for review).
- If a direct session token is still needed as a fallback, provide it in reviewer notes rather than positioning it as the primary sign-in path.
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
