import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// A throwaway service account and a fake Google API, so no real credentials are needed.
const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const accountFile = join(mkdtempSync(join(tmpdir(), 'cudgs-')), 'account.json');
writeFileSync(accountFile, JSON.stringify({
    client_email: 'site@cudgs.iam.gserviceaccount.com',
    private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }),
}));
process.env.MEMBERS_SHEET_ID = 'sheet123';
process.env.GOOGLE_SERVICE_ACCOUNT_FILE = accountFile;

const requests: string[] = [];
globalThis.fetch = (async (input: string | URL) => {
    const url = String(input);
    requests.push(url);
    if (url.startsWith('https://oauth2.googleapis.com/token')) {
        return Response.json({ access_token: 'token', expires_in: 3600 });
    }
    return Response.json({
        values: [
            ['CRSid', 'Name', 'Membership', 'Expires'],
            ['AB123', 'Alex Smith', 'Lifetime', ''],
            ['cd456', 'Sam Jones', 'Standard', '2020-06-30'],
            ['ef789', 'Kai Lee', 'Standard', 'next june'],
            ['gh012', 'Jo Park', '', '2099-01-01'],
        ],
    });
}) as typeof fetch;

const { findMember } = await import('./members.ts');

test('matches CRSids case-insensitively; blank expiry never expires', async () => {
    assert.deepEqual(await findMember('ab123'), {
        crsid: 'ab123', name: 'Alex Smith', tier: 'Lifetime', expires: null, active: true,
    });
});

test('past expiry is inactive', async () => {
    assert.equal((await findMember('cd456'))?.active, false);
});

test('an unreadable expiry fails closed', async () => {
    assert.equal((await findMember('ef789'))?.active, false);
});

test('blank membership type defaults to "Member"', async () => {
    assert.equal((await findMember('gh012'))?.tier, 'Member');
});

test('unknown CRSid is null, and the sheet is cached between lookups', async () => {
    assert.equal(await findMember('zz999'), null);
    assert.equal(requests.filter((url) => url.includes('sheets.googleapis.com')).length, 1);
    assert.ok(requests[1].includes('/spreadsheets/sheet123/values/Members!A%3AD'));
});
