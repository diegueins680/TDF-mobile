# Isolated mobile authentication fixture

Mobile end-to-end authentication tests must use an isolated, non-production account supplied at runtime. The repository must not contain a permanent username, password, token, party identifier, or development auto-fill.

Configure the runner through its secret store:

```sh
TDF_E2E_USERNAME='<isolated fixture username>' \
TDF_E2E_PASSWORD='<isolated fixture password>' \
npx detox test --configuration ios.sim.release
```

The fixture must:

- Exist only in the selected test environment.
- Have the minimum roles/modules required by the workflow under test.
- Be reset or recreated before the run and expired afterward.
- Never target the production API.
- Never be printed in logs, screenshots, artifacts, or failure reports.

The app intentionally leaves username and password fields empty in every build, including `__DEV__`. Detox can enter the runtime values through the stable `usernameInput` and `passwordInput` test IDs.

If text injection is unavailable on a particular simulator, fix the test harness or use a short-lived fixture token injected by the runner. Do not reintroduce application-side credential defaults.
