import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// A throwaway service account and a fake Sheets API holding the sheet in memory.
const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const accountFile = join(mkdtempSync(join(tmpdir(), 'cudgs-ml-')), 'account.json');
writeFileSync(accountFile, JSON.stringify({ client_email: 'site@x.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) }));
process.env.MAILING_LIST_SHEET_ID = 'list123';
process.env.GOOGLE_SERVICE_ACCOUNT_FILE = accountFile;

let sheet: string[][] = [['Name', 'CRSid', '(Opt) College']];
globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
    const url = decodeURIComponent(String(input));
    if (url.startsWith('https://oauth2.googleapis.com/token')) return Response.json({ access_token: 't', expires_in: 3600 });
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    if (url.includes(':append')) sheet.push(body.values[0]);
    else if (init?.method === 'PUT') sheet[0][url.match(/values\/([A-Z]+)1/)![1].charCodeAt(0) - 65] = body.values[0][0];
    else if (url.includes('fields=sheets')) return Response.json({ sheets: [{ properties: { sheetId: 7, index: 0 } }] });
    else if (url.includes(':batchUpdate')) sheet.splice(body.requests[0].deleteDimension.range.startIndex, 1);
    else return Response.json({ values: sheet });
    return Response.json({});
}) as typeof fetch;

const { subscribe, getSubscription, unsubscribe, cleanName, timestamp } = await import('./mailing-list.ts');

test('joining adds a row with an Added timestamp, creating the heading if missing', async () => {
    assert.equal(await subscribe('AB123', 'Alex Smith', "King's"), true);
    assert.deepEqual(sheet[0], ['Name', 'CRSid', '(Opt) College', 'Added']);
    assert.equal(sheet[1][1], 'ab123');
    assert.match(sheet[1][3], /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    assert.deepEqual(await getSubscription('ab123'), { row: 1, name: 'Alex Smith', college: "King's" });
});

test('joining twice is refused; leaving deletes the row', async () => {
    assert.equal(await subscribe('ab123', 'Alex', ''), false);
    assert.equal(await unsubscribe('AB123'), true);
    assert.equal(sheet.length, 1);
    assert.equal(await unsubscribe('ab123'), false);
});

test('names are tidied and timestamps are UK time', () => {
    assert.equal(cleanName('  Sam \n  Jones\u0007 '), 'Sam Jones');
    assert.equal(timestamp(new Date('2026-07-01T11:30:00Z')), '2026-07-01 12:30');
});
