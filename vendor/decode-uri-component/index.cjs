'use strict';

// query-string 7 calls require() directly; upstream 0.5 exports an ES module.
const decode = require('decode-uri-component-upstream').default;

// Preserve the installed 0.2 caller contract, including form-style plus signs.
module.exports = value => decode(typeof value === 'string' ? value.replace(/\+/g, ' ') : value);
