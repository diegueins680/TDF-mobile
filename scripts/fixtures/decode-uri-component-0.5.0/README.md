# Historical vulnerable decoder fixture

Test-only, unchanged `index.js` and MIT license from the actual integrity-pinned
`decode-uri-component@0.5.0` installation used by original Mobile165.
It demonstrates GHSA-qr28-fpjm-wq7f against the same bounded replacement-work
oracle as the current implementation. Never import it into application code.

Source: https://registry.npmjs.org/decode-uri-component/-/decode-uri-component-0.5.0.tgz
Original source SHA-256: `9401353df38f8010ad7035fe8d666bce6a4902bc1cff809afc4ab23fa2e0bdaa`.
Original npm integrity: `sha512-1BiQVoK8C9gUbQU6NzAtO/tkz2qOFpEObMWpcFvhx4fYnj4Oc5yzaJN/LD36ihkVUdXyh5ZekzX+yM+ty/SrPg==`.
The original 0.5.0 qualification and later audit failure remain historical; this
fixture does not receive a current security or release qualification.
