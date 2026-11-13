# Native UI smoke on standard hosted runners

Status: proposed and locally checked on 2026-11-13; **native execution pending**.
No simulator/emulator result is claimed by this document.

The interaction workflows retain their native build steps and add a separate
Detox UI phase. Android builds an instrumentation APK with the Detox version from
the installed lockfile; the extra Gradle script is applied only in that disposable
workflow checkout. iOS creates and deletes an owned simulator using an installed
runtime. The existing local `.detoxrc.js` and historical provider tests are unchanged.

## Scope

Three UI tests run against fresh installations:

1. Onboarding reaches login; credential fields are empty and submission disabled.
2. Password submission enables only after both synthetic fields are filled.
3. A cold restart does not retain unsubmitted credentials.

The tests never submit these synthetic credentials, authorize Google/Apple, make
purchases or call production. The existing fixture API URL is loopback and OTA
stays disabled. This is **not** password authentication, session persistence after
login/logout, real backend integration, OAuth completion or hardware qualification.
Those require separate controlled fixtures and final release/device checks.

## Cost and prerequisites

The added runtime path is restricted to public repositories and standard hosted
`ubuntu-latest` / `macos-15` runners. GitHub documents this compute as free for
public repositories: https://docs.github.com/en/actions/concepts/billing-and-usage.
Recheck current billing and repository visibility before dispatch; never select a
larger/paid runner as an automatic fallback. No hosted run has been dispatched by
this change. Private-repository skips do not qualify the candidate.

Android requires read/write access to existing KVM, installed command-line tools
and existing accepted SDK licenses. It installs the API36 default x86_64 image
without interactive license acceptance. Missing permission/license/hypervisor is
a blocker; the workflow does not chmod KVM, accept agreements or use software
emulation as a silent substitute. iOS requires the installed Xcode runtime and
Homebrew applesimutils. No physical Mac is needed on the operator's desk when the
standard GitHub macOS runner is available.

## Evidence and result interpretation

The evidence directory is initialized with `status: not_run` before dependencies
or native compilation. The runner writes the exact checked-out SHA, workflow run
and attempt, lockfile hash, device/runtime and native artifact hashes. Detox emits
its JSON report, logs and screenshots; Android also saves emulator/logcat output.
Artifacts are retained for three days, including failures.

A qualification requires a completed native UI job and `receipt.json` with
`status: passed`, matching source/artifact hashes and exactly three passing tests,
zero failed/pending/todo tests. Empty, skipped, partial and missing results fail.
A build artifact alone is insufficient. The historical successful workflow
43339081679 skipped its simulator job and is not evidence of runtime testing.

Initial qualification still needs an authorized GitHub write to place this patch
on a review branch, followed by the existing protected CI path. Do not dispatch
main and attribute its result to an uncommitted local candidate. On this Linux
workspace there is no Android SDK/KVM or connected Mac, so native compile/runtime
compatibility (including Detox instrumentation and accessibility attributes) must
be checked in the first hosted run. Do not weaken synchronization or ignore failed
assertions to obtain a green result.
