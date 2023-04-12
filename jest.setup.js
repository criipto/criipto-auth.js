const crypto = require('node:crypto').webcrypto;

Object.defineProperty(globalThis, "crypto", {
  value: crypto
});