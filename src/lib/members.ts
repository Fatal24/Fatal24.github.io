// Membership lookup from the committee's private Google Sheet, read with a service account.
// The sheet must stay private: share it only with the service account's email (Viewer).
// Expected header row: CRSid | Name | Membership | Expires (YYYY-MM-DD, blank = never).
import { createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { config } from './config.ts';

export type Member = {
    crsid: string;
    name: string;
    tier: string;
    expires: Date | null;
    active: boolean;
};

const CACHE_MS = 5 * 60 * 1000;
let cache: { at: number; members: Map<string, Member> } | null = null;
let token: { value: string; expires: number } | null = null;

async function accessToken() {
    if (token && token.expires > Date.now() + 60_000) return token.value;
    const account = JSON.parse(readFileSync(config.googleServiceAccountFile!, 'utf8'));
    const now = Math.floor(Date.now() / 1000);
    const encode = (obj: object) => Buffer.from(JSON.stringify(obj)).toString('base64url');
    const unsigned = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({
        iss: account.client_email,
        scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
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
    token = { value: data.access_token, expires: Date.now() + data.expires_in * 1000 };
    return token.value;
}

function parseExpiry(value: string | undefined) {
    if (!value?.trim()) return null;
    const date = new Date(`${value.trim()}T23:59:59Z`);
    // An unreadable date counts as expired, so a typo never grants access.
    return Number.isNaN(date.getTime()) ? new Date(0) : date;
}

async function loadMembers() {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${config.membersSheetId}/values/${encodeURIComponent(config.membersRange)}`;
    const response = await fetch(url, { headers: { Authorization: `Bearer ${await accessToken()}` } });
    if (!response.ok) throw new Error(`Members sheet request failed: ${response.status}`);
    const { values = [] }: { values?: string[][] } = await response.json();
    const [header = [], ...rows] = values;
    const col = (name: string) => header.findIndex((h) => h.trim().toLowerCase() === name.toLowerCase());
    const [iCrsid, iName, iTier, iExpires] = ['CRSid', 'Name', 'Membership', 'Expires'].map(col);
    if (iCrsid < 0) throw new Error('Members sheet has no "CRSid" column');

    const members = new Map<string, Member>();
    for (const row of rows) {
        const crsid = row[iCrsid]?.trim().toLowerCase();
        if (!crsid) continue;
        const expires = parseExpiry(row[iExpires]);
        members.set(crsid, {
            crsid,
            name: row[iName]?.trim() ?? '',
            tier: row[iTier]?.trim() || 'Member',
            expires,
            active: !expires || expires.getTime() > Date.now(),
        });
    }
    return members;
}

/** Returns the member's record, or null if they're not in the sheet (or the sheet isn't set up). */
export async function findMember(crsid: string): Promise<Member | null> {
    if (!config.membersSheetId || !config.googleServiceAccountFile) return null;
    if (!cache || Date.now() - cache.at > CACHE_MS) {
        cache = { at: Date.now(), members: await loadMembers() };
    }
    return cache.members.get(crsid.toLowerCase()) ?? null;
}
