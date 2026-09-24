// Google API access with the site's service account (see GOOGLE_SERVICE_ACCOUNT_FILE).
// Each scope gets its own token, so read-only lookups never hold write access.
import { createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { config } from './config.ts';

export const SHEETS_READONLY = 'https://www.googleapis.com/auth/spreadsheets.readonly';
export const SHEETS_READ_WRITE = 'https://www.googleapis.com/auth/spreadsheets';

const tokens = new Map<string, { value: string; expires: number }>();

export async function accessToken(scope: string) {
    const cached = tokens.get(scope);
    if (cached && cached.expires > Date.now() + 60_000) return cached.value;
    const account = JSON.parse(readFileSync(config.googleServiceAccountFile!, 'utf8'));
    const now = Math.floor(Date.now() / 1000);
    const encode = (obj: object) => Buffer.from(JSON.stringify(obj)).toString('base64url');
    const unsigned = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({
        iss: account.client_email,
        scope,
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600,
    })}`;
    const signature = createSign('RSA-SHA256').update(unsigned).sign(account.private_key, 'base64url');
    const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        body: new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion: `${unsigned}.${signature}`,
        }),
    });
    if (!response.ok) throw new Error(`Google token request failed: ${response.status}`);
    const data = await response.json();
    tokens.set(scope, { value: data.access_token, expires: Date.now() + data.expires_in * 1000 });
    return data.access_token as string;
}

/** Calls the Sheets API for one spreadsheet and returns the JSON response. */
export async function sheets(spreadsheetId: string, path: string, scope: string, init: RequestInit = {}) {
    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}${path}`, {
        ...init,
        headers: { Authorization: `Bearer ${await accessToken(scope)}`, 'Content-Type': 'application/json', ...init.headers },
    });
    if (!response.ok) throw new Error(`Sheets request ${path.split('?')[0] || '/'} failed: ${response.status}`);
    return response.json();
}
