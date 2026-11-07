# Patched URI decoder compatibility

`query-string` 7 requires a directly callable CommonJS export. The fixed
`decode-uri-component` 0.5.1 exports an ES module namespace instead. This private
adapter selects its default export and preserves the formerly installed 0.2.2
contract for literal plus signs and non-string errors. The upstream algorithm is
installed unchanged under the pinned `decode-uri-component-upstream` npm alias.

Both dependencies are declared at the app root: npm does not install dependencies
of a linked `file:` package by itself. The `$decode-uri-component` override binds
transitive consumers to that same root dependency; a relative file override in a
transitive package can produce a nonportable nested lockfile path.

The regression uses the actual installed query-string caller, deterministic
Unicode samples, malformed UTF-8 cases and an instrumented built-in-call budget
for repeated `%FF` bytes. The test-only upstream 0.2.2 fixture (with its MIT license)
violates the same budget. A second control demonstrates that selecting the ES
module namespace without the adapter breaks the real CommonJS caller. These
checks are scoped empirical properties, not a general complexity proof.

Current Expo Router6.0.24 incoming query parsing uses `URLSearchParams`, and the
installed React Navigation core has its own query parser. This dependency repair
does not establish a currently exploitable incoming deep-link path. It removes
the affected decoder implementation from installed query-string7 consumers.

Primary advisory: https://github.com/SamVerschueren/decode-uri-component/security/advisories/GHSA-vcc3-ghjq-m6fr

The intentionally vulnerable fixture lives only under `scripts/fixtures` and is
loaded by this regression test. Never import it into application code.

## Subsequent quadratic-replacement advisory

The original 0.5.0 qualification preceded GHSA-qr28-fpjm-wq7f, which affects
versions through 0.5.0. The adapter now wraps the unchanged official 0.5.1
release; its npm integrity is pinned, and the private wrapper version reflects
that actual algorithm. No dependency-security exception is added.

The original 24 regressions remain unchanged. A second, finite regression uses
32 and 64 distinct percent-encoded runs followed by `%zz`. It checks decoded
output and requires the sum of String.replace receiver lengths to be positive
and at most four times input length. The genuine, unchanged and licensed 0.5.0
source fails the same budget. Instrumentation is synchronous and restored in
finally before assertions; no wall-clock threshold or production limit is used.
This measures that bounded family, not universal complexity or app security.

Produced percent text is intentionally not decoded a second time. Separate
examples cover nested percent text, BOM byte pairs and truncated `%C2` fallback.
The new fix retains the callable CommonJS adapter and the original literal-plus
and non-string behavior; it does not preserve the old unintended rescanning.
The 0.5.0 fixture and MIT license are test-only, never application imports.

Primary advisory and upstream fix:
- https://github.com/advisories/GHSA-qr28-fpjm-wq7f
- https://github.com/SamVerschueren/decode-uri-component/commit/fad01d65b93bd3f2f0dc32dfd8d57a38b57bc608
