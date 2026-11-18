import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

// Vercel disables require(ESM); a normal local Node run can hide this failure.
test("Firebase Admin Auth and JWKS verification work without require(ESM)", () => {
  const result = spawnSync(process.execPath, ["--no-experimental-require-module", "-e", `
    const assert = require('node:assert/strict');
    const { generateKeyPairSync } = require('node:crypto');
    const { createRequire } = require('node:module');
    assert.equal(typeof require('firebase-admin/auth').getAuth, 'function');
    const adminRequire = createRequire(require.resolve('firebase-admin/auth'));
    const jwks = adminRequire('jwks-rsa');
    const jwt = adminRequire('jsonwebtoken');
    (async () => {
      for (const [type, options, algorithm] of [
        ['rsa', { modulusLength: 2048 }, 'RS256'],
        ['ec', { namedCurve: 'prime256v1' }, 'ES256'],
        ['ed25519', {}, 'EdDSA'],
      ]) {
        const { publicKey, privateKey } = generateKeyPairSync(type, options);
        const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'synthetic', use: 'sig', alg: algorithm };
        const client = jwks({ jwksUri: 'https://synthetic.invalid/jwks', cache: false,
          fetcher: async () => ({ keys: [jwk] }) });
        const key = await client.getSigningKey('synthetic');
        assert.match(key.getPublicKey(), /BEGIN PUBLIC KEY/);
        await assert.rejects(client.getSigningKey('missing'));
        if (algorithm === 'EdDSA') continue; // Firebase JWT verification uses RSA/EC.
        const token = jwt.sign({ sub: 'synthetic-user' }, privateKey, { algorithm });
        assert.equal(jwt.verify(token, key.getPublicKey(), { algorithms: [algorithm] }).sub, 'synthetic-user');
        const parts = token.split('.');
        parts[1] = Buffer.from(JSON.stringify({ sub: 'forged-user' })).toString('base64url');
        assert.throws(() => jwt.verify(parts.join('.'), key.getPublicKey(), { algorithms: [algorithm] }), /invalid signature/);
        assert.throws(() => jwt.verify(token, key.getPublicKey(), { algorithms: ['HS256'] }));
      }
    })().catch(error => { console.error(error); process.exitCode = 1; });
  `], { encoding: "utf8", timeout: 30000 });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr || result.stdout);
});
