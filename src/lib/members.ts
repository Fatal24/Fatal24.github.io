// Membership lookup from the committee's private Google Sheet, read with a service account.
// The sheet must stay private: share it only with the service account's email (Viewer).
// Expected headings (any order, found by name): CRSid | Name | Membership | Expires (YYYY-MM-DD,
// blank = never), plus an optional Acquired (YYYY-MM-DD, when they joined).
import { config } from './config.ts';
import { SHEETS_READONLY, accessToken } from './google.ts';

export type Member = {
    crsid: string;
    name: string;
    tier: string;
    expires: Date | null;
    /** When they became a member, from the optional "Acquired" column. */
    since: Date | null;
    active: boolean;
};

const CACHE_MS = 5 * 60 * 1000;
let cache: { at: number; members: Map<string, Member> } | null = null;

function parseExpiry(value: string | undefined) {
    if (!value?.trim()) return null;
    const date = new Date(`${value.trim()}T23:59:59Z`);
    // An unreadable date counts as expired, so a typo never grants access.
    return Number.isNaN(date.getTime()) ? new Date(0) : date;
}

// Informational only, so an unreadable date is simply not shown.
function parseDate(value: string | undefined) {
    if (!value?.trim()) return null;
    const date = new Date(`${value.trim()}T12:00:00Z`);
    return Number.isNaN(date.getTime()) ? null : date;
}

async function loadMembers() {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${config.membersSheetId}/values/${encodeURIComponent(config.membersRange)}`;
    const response = await fetch(url, { headers: { Authorization: `Bearer ${await accessToken(SHEETS_READONLY)}` } });
    if (!response.ok) throw new Error(`Members sheet request failed: ${response.status}`);
    const { values = [] }: { values?: string[][] } = await response.json();
    const [header = [], ...rows] = values;
    const col = (name: string) => header.findIndex((h) => h.trim().toLowerCase() === name.toLowerCase());
    const [iCrsid, iName, iTier, iExpires, iSince] = ['CRSid', 'Name', 'Membership', 'Expires', 'Acquired'].map(col);
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
            since: iSince >= 0 ? parseDate(row[iSince]) : null,
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
