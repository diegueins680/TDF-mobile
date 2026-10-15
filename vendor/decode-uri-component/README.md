# Patched URI decoder compatibility

`query-string` 7 requires a directly callable CommonJS export. The fixed
`decode-uri-component` 0.5.0 exports an ES module namespace instead. This private
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
