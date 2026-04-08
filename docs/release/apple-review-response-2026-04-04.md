# Apple App Review Response — 2026-04-04

Use this response in App Store Connect when Apple requests business-model clarification.

## Suggested reply

Hello App Review,

Thank you for the details. Here are direct answers to your questions about the app’s business model and access model.

1. **Who are the users that will use the paid content and features in the app?**
   The app is intended for TDF Records staff and invited collaborators/partners who have been authorized by the organization to use its operational tools.

2. **Where can users purchase the content and features that can be accessed in the app?**
   End users do not purchase consumer digital content inside the app. Access is granted by TDF Records through organization-managed accounts/credentials for internal operational use.

3. **What specific types of previously purchased content and features can a user access in the app?**
   The app provides access to organization data and workflows such as parties/CRM records, bookings, pipeline stages, events, inventory, venues, social/vCard tools, and related operational data tied to the authorized account.

4. **What paid content, subscriptions, or features are unlocked within the app that do not use In-App Purchase?**
   The app does not unlock consumer-facing digital content, subscriptions, or features for retail users. Access is role-based and organization-managed for staff/approved collaborators rather than sold as in-app consumer purchases.

5. **How do users obtain a Bearer token? Are there fees associated with obtaining the token?**
   In the current app flow, users primarily sign in with username/password or Google login. After successful authentication, the backend issues a bearer token/session for authenticated API access. The token is not a separately sold product and there is no standalone fee to obtain the token itself.

Additional clarification:
- The current app no longer uses a manual bearer-token-first sign-in as the primary reviewer flow.
- Protected features are available only after organization-provided credentials are validated.
- Reviewer/demo access should use the provided review account credentials (or an equivalent organization-provided review session) rather than treating the token as a retail purchase.

Thank you.
