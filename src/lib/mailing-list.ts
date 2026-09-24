// The society mailing list: a private Google Sheet with headings Name | CRSid | College (optional),
// found by name in any order. Sign-ups also record when they joined in an "Added" column (created
// automatically if missing) and, if the sheet has a "Source" column, "Website" there, so rows the
// committee adds by hand (e.g. at Freshers' Fair) can be told apart. Logged-in visitors add or remove themselves from the Members page;
// their CRSid always comes from the University login, never from the form.
// The service account must be an Editor on this sheet (and on no other sheet it doesn't need).
import { config } from './config.ts';
import { SHEETS_READ_WRITE, sheets } from './google.ts';

export const COLLEGES = [
    "Christ's", 'Churchill', 'Clare', 'Clare Hall', 'Corpus Christi', 'Darwin', 'Downing', 'Emmanuel',
    'Fitzwilliam', 'Girton', 'Gonville & Caius', 'Homerton', 'Hughes Hall', 'Jesus', "King's",
    'Lucy Cavendish', 'Magdalene', 'Murray Edwards', 'Newnham', 'Pembroke', 'Peterhouse', "Queens'",
    'Robinson', "St Catharine's", "St Edmund's", "St John's", 'Selwyn', 'Sidney Sussex', 'Trinity',
    'Trinity Hall', 'Wolfson',
];

export type Subscription = { row: number; name: string; college: string };

export const mailingListEnabled = () => Boolean(config.mailingListSheetId && config.googleServiceAccountFile);

/** Tidies a typed name: no control characters or runs of spaces, at most 80 characters. */
export function cleanName(value: string) {
    return value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
}

export const cleanCollege = (value: string) => (COLLEGES.includes(value) ? value : '');

async function readSheet() {
    const id = config.mailingListSheetId!;
    const { values = [] }: { values?: string[][] } = await sheets(id, `/values/${encodeURIComponent('A:Z')}`, SHEETS_READ_WRITE);
    const [header = [], ...rows] = values;
    const find = (word: string) => header.findIndex((h) => h.toLowerCase().includes(word));
    const added = ['added', 'joined', 'timestamp'].map(find).find((i) => i >= 0) ?? -1;
    const cols = { name: find('name'), crsid: find('crsid'), college: find('college'), added, source: find('source'), width: header.length };
    if (cols.crsid < 0 || cols.name < 0) throw new Error('Mailing list sheet needs "Name" and "CRSid" headings');
    return { rows, cols };
}

/** The visitor's row on the list, or null if they aren't on it. Rows are numbered from 0 = headings. */
export async function getSubscription(crsid: string): Promise<Subscription | null> {
    const { rows, cols } = await readSheet();
    const i = rows.findIndex((row) => row[cols.crsid]?.trim().toLowerCase() === crsid.toLowerCase());
    if (i < 0) return null;
    return { row: i + 1, name: rows[i][cols.name] ?? '', college: cols.college >= 0 ? rows[i][cols.college] ?? '' : '' };
}

/** "2026-09-24 21:05" in UK time: readable, and sorts correctly as text. */
export function timestamp(date = new Date()) {
    const parts = Object.fromEntries(
        new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
        }).formatToParts(date).map((p) => [p.type, p.value]),
    );
    return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

const columnLetter = (i: number) => {
    let s = '';
    for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
    return s;
};

/** Adds the visitor unless they're already on the list. Returns false if they already were. */
export async function subscribe(crsid: string, name: string, college: string) {
    const { rows, cols } = await readSheet();
    if (rows.some((row) => row[cols.crsid]?.trim().toLowerCase() === crsid.toLowerCase())) return false;
    if (cols.added < 0) {
        // First sign-up since the column was wanted: add the "Added" heading in the next free column.
        cols.added = cols.width++;
        const cell = `${columnLetter(cols.added)}1`;
        await sheets(config.mailingListSheetId!, `/values/${cell}?valueInputOption=RAW`, SHEETS_READ_WRITE, {
            method: 'PUT',
            body: JSON.stringify({ values: [['Added']] }),
        });
    }
    const row = Array<string>(cols.width).fill('');
    row[cols.crsid] = crsid.toLowerCase();
    row[cols.name] = name;
    if (cols.college >= 0) row[cols.college] = college;
    row[cols.added] = timestamp();
    if (cols.source >= 0) row[cols.source] = 'Website';
    // RAW: stored exactly as typed, so a name starting with "=" can never become a formula.
    await sheets(config.mailingListSheetId!, `/values/${encodeURIComponent('A:Z')}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, SHEETS_READ_WRITE, {
        method: 'POST',
        body: JSON.stringify({ values: [row] }),
    });
    return true;
}

/** Removes the visitor's row. Returns false if they weren't on the list. */
export async function unsubscribe(crsid: string) {
    const current = await getSubscription(crsid);
    if (!current) return false;
    const id = config.mailingListSheetId!;
    const meta = await sheets(id, '?fields=sheets.properties(sheetId,index)', SHEETS_READ_WRITE);
    const first = meta.sheets.find((s: { properties: { index: number } }) => s.properties.index === 0).properties.sheetId;
    await sheets(id, ':batchUpdate', SHEETS_READ_WRITE, {
        method: 'POST',
        body: JSON.stringify({
            requests: [{ deleteDimension: { range: { sheetId: first, dimension: 'ROWS', startIndex: current.row, endIndex: current.row + 1 } } }],
        }),
    });
    return true;
}
