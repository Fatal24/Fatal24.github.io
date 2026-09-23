import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSign, generateKeyPairSync } from 'node:crypto';
import { buildAuthUrl, verifyWlsResponse } from './ucam-webauth.ts';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const keys = { '1': publicKey.export({ type: 'spki', format: 'pem' }).toString() };
const callbackUrl = 'https://cudgs.example/auth/callback';
const now = Date.UTC(2026, 8, 23, 14, 5, 12);

function signedResponse(overrides: Partial<Record<'status' | 'issue' | 'url' | 'principal' | 'kid', string>> = {}) {
    const f = {
        status: '200', issue: '20260923T140512Z', url: callbackUrl, principal: 'ab123', kid: '1', ...overrides,
    };
    const data = ['3', f.status, '', f.issue, '1758636312-1234-5', f.url, f.principal, 'current', 'pwd', '', '36000', '/members'].join('!');
    const signer = createSign('RSA-SHA1');
    signer.update(data);
    const sig = signer.sign(privateKey, 'base64').replace(/\+/g, '-').replace(/\//g, '.').replace(/=/g, '_');
    return `${data}!${f.kid}!${sig}`;
}

test('accepts a correctly signed response', () => {
    const result = verifyWlsResponse(signedResponse(), { callbackUrl, keys, now });
    assert.deepEqual(result.ok && [result.principal, result.ptags, result.params], ['ab123', ['current'], '/members']);
});

test('rejects a tampered principal', () => {
    const tampered = signedResponse().replace('!ab123!', '!zz999!');
    assert.throws(() => verifyWlsResponse(tampered, { callbackUrl, keys, now }), /signature/);
});

test('rejects an unknown key id', () => {
    assert.throws(() => verifyWlsResponse(signedResponse({ kid: '9' }), { callbackUrl, keys, now }), /Unknown/);
});

test('rejects a response issued for another site', () => {
    const other = signedResponse({ url: 'https://evil.example/auth/callback' });
    assert.throws(() => verifyWlsResponse(other, { callbackUrl, keys, now }), /different URL/);
});

test('rejects a stale response', () => {
    assert.throws(() => verifyWlsResponse(signedResponse(), { callbackUrl, keys, now: now + 10 * 60 * 1000 }), /stale/);
});

test('reports a cancelled login without trusting it', () => {
    const cancelled = '3!410!!20260923T140512Z!1758636312-1234-5!' + callbackUrl + '!!!!!!/members!!';
    assert.deepEqual(verifyWlsResponse(cancelled, { callbackUrl, keys, now }), {
        ok: false, status: '410', message: '', params: '/members',
    });
});

test('builds a version 3 request', () => {
    const url = new URL(buildAuthUrl({ wlsUrl: 'https://nevar.srcf.net/wls/authenticate', callbackUrl, desc: 'CUDGS', msg: 'hi', params: '/members' }));
    assert.equal(url.searchParams.get('ver'), '3');
    assert.equal(url.searchParams.get('url'), callbackUrl);
});
