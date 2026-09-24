// Esports applications stored in the private "CUDGS Esports Applications" sheet: one tab per game
// (created with its headings when first needed) plus a "Season" tab holding each league's match-week
// dates, which reps set on the site. Columns are found by heading, so the committee can reorder or
// add their own columns in the sheet without breaking anything.
import { admins, availabilityChoices, casualGrid, optionValue, type Game } from '../data/esports.ts';
import { config } from './config.ts';
import { SHEETS_READ_WRITE, sheets } from './google.ts';

export type Availability = (typeof availabilityChoices)[number];
export type Season = Record<string, string[]>; // league id -> match dates (YYYY-MM-DD), week 1 first
export type Answers = {
    questions: Record<string, string | string[]>;
    weeks: Record<string, Availability>; // "<league id>:<week number>" -> choice
    /** Default for weeks they haven't answered, per league, so they only mark the exceptions. */
    usual: Record<string, Availability>;
    casual: string[]; // "Mon 18:00–20:00"
};
export type Application = { crsid: string; submitted: string; updated: string; answers: Answers };

const SEASON_TAB = 'Season';
const SEASON_HEADINGS = ['Game', 'League', 'Week', 'Date'];

export const esportsEnabled = () => Boolean(config.esportsSheetId && config.googleServiceAccountFile);
const id = () => config.esportsSheetId!;
const range = (tab: string, cells = 'A:ZZ') => encodeURIComponent(`'${tab.replace(/'/g, "''")}'!${cells}`);

export const canManage = (crsid: string | null | undefined, game: Game) =>
    Boolean(crsid) && (admins.includes(crsid!.toLowerCase()) || game.reps.includes(crsid!.toLowerCase()));

export function columnLetter(i: number) {
    let s = '';
    for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
    return s;
}

/** "2026-09-24 21:05" in UK time. */
export function timestamp(date = new Date()) {
    const p = Object.fromEntries(
        new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
        }).formatToParts(date).map((x) => [x.type, x.value]),
    );
    return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}

/** `count` weekly dates starting on `start` (YYYY-MM-DD). */
export function generateWeeks(start: string, count: number) {
    const first = new Date(`${start}T12:00:00Z`);
    if (Number.isNaN(first.getTime())) return [];
    return Array.from({ length: Math.max(0, Math.min(count, 30)) }, (_, i) =>
        new Date(first.getTime() + i * 7 * 86_400_000).toISOString().slice(0, 10),
    );
}

export const weekHeading = (leagueName: string, week: number) => `${leagueName} wk${week}`;
export const usualHeading = (leagueName: string) => `${leagueName} usual`;

/** Today's date in the UK, as YYYY-MM-DD. */
export const todayUK = (now = new Date()) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);

/** Week numbers (1-based) whose match date is today or later. */
export const upcomingWeeks = (season: Season, leagueId: string, today = todayUK()) =>
    (season[leagueId] ?? []).map((d, i) => ({ week: i + 1, date: d })).filter((w) => w.date >= today);

/** What a player said for a week, falling back to their usual answer. */
export function effective(answers: Answers, leagueId: string, week: number): { value: Availability | ''; usual: boolean } {
    const explicit = answers.weeks[`${leagueId}:${week}`];
    if (explicit) return { value: explicit, usual: false };
    const usual = answers.usual[leagueId];
    return usual ? { value: usual, usual: true } : { value: '', usual: false };
}
const clean = (value: string, max = 200) => value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

// ---------- sheet plumbing ----------

async function tabs(): Promise<Map<string, number>> {
    const meta = await sheets(id(), '?fields=sheets.properties(sheetId,title)', SHEETS_READ_WRITE);
    return new Map(meta.sheets.map((s: { properties: { title: string; sheetId: number } }) => [s.properties.title, s.properties.sheetId]));
}

async function readTab(tab: string): Promise<string[][]> {
    const { values = [] } = await sheets(id(), `/values/${range(tab)}`, SHEETS_READ_WRITE);
    return values;
}

/** Makes sure the tab exists and has every heading in `wanted` (adding missing ones at the end). */
async function ensureTab(tab: string, wanted: string[]) {
    const existing = await tabs();
    if (!existing.has(tab)) {
        await sheets(id(), ':batchUpdate', SHEETS_READ_WRITE, {
            method: 'POST',
            body: JSON.stringify({ requests: [{ addSheet: { properties: { title: tab } } }] }),
        });
    }
    const [header = []] = existing.has(tab) ? await readTab(tab) : [[]];
    const missing = wanted.filter((h) => !header.includes(h));
    if (missing.length) {
        const row = [...header, ...missing];
        await sheets(id(), `/values/${range(tab, `A1:${columnLetter(row.length - 1)}1`)}?valueInputOption=RAW`, SHEETS_READ_WRITE, {
            method: 'PUT',
            body: JSON.stringify({ values: [row] }),
        });
        return row;
    }
    return header;
}

// ---------- season dates ----------

let seasonCache: { at: number; rows: string[][] } | null = null;

async function seasonRows() {
    if (seasonCache && Date.now() - seasonCache.at < 60_000) return seasonCache.rows;
    const existing = await tabs();
    const rows = existing.has(SEASON_TAB) ? (await readTab(SEASON_TAB)).slice(1) : [];
    seasonCache = { at: Date.now(), rows };
    return rows;
}

export async function getSeason(game: Game): Promise<Season> {
    const season: Season = Object.fromEntries(game.leagues.map((l) => [l.id, [] as string[]]));
    const rows = (await seasonRows()).filter((r) => r[0] === game.id && season[r[1]] && r[3]);
    for (const r of rows.sort((a, b) => Number(a[2]) - Number(b[2]))) season[r[1]].push(r[3]);
    return season;
}

export async function saveSeason(game: Game, season: Season) {
    await ensureTab(SEASON_TAB, SEASON_HEADINGS);
    const others = (await readTab(SEASON_TAB)).slice(1).filter((r) => r[0] !== game.id);
    const mine = game.leagues.flatMap((l) =>
        (season[l.id] ?? []).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort().map((d, i) => [game.id, l.id, String(i + 1), d]),
    );
    await sheets(id(), `/values/${range(SEASON_TAB)}:clear`, SHEETS_READ_WRITE, { method: 'POST', body: '{}' });
    await sheets(id(), `/values/${range(SEASON_TAB, 'A1')}?valueInputOption=RAW`, SHEETS_READ_WRITE, {
        method: 'PUT',
        body: JSON.stringify({ values: [SEASON_HEADINGS, ...others, ...mine] }),
    });
    seasonCache = null;
}

// ---------- answers ----------

/** Checks a submitted form against the game's questions. Always returns the cleaned answers (so the
 *  form can be shown again as typed), plus a list of problems; empty means it can be saved. */
export function validate(game: Game, season: Season, form: FormData): { answers: Answers; errors: string[] } {
    const errors: string[] = [];
    const questions: Answers['questions'] = {};
    for (const q of game.questions) {
        const allowed = (q.options ?? []).map(optionValue);
        if (q.type === 'text') {
            const v = clean(String(form.get(`q_${q.id}`) ?? ''));
            if (!v && q.required) errors.push(`Please answer "${q.label}".`);
            questions[q.id] = v;
        } else if (q.type === 'select') {
            const v = String(form.get(`q_${q.id}`) ?? '');
            if (v && !allowed.includes(v)) errors.push(`Please pick an option for "${q.label}".`);
            else if (!v && q.required) errors.push(`Please answer "${q.label}".`);
            questions[q.id] = allowed.includes(v) ? v : '';
        } else if (q.type === 'multi') {
            const v = form.getAll(`q_${q.id}`).map(String).filter((x) => allowed.includes(x));
            if (!v.length && q.required) errors.push(`Please choose at least one option for "${q.label}".`);
            questions[q.id] = v;
        } else {
            const v = form.get(`q_${q.id}`) === 'yes';
            if (!v && q.required) errors.push(`Please tick "${q.label}".`);
            questions[q.id] = v ? 'Yes' : '';
        }
    }
    const weeks: Answers['weeks'] = {};
    for (const l of game.leagues) {
        (season[l.id] ?? []).forEach((_, i) => {
            const v = String(form.get(`w_${l.id}_${i + 1}`) ?? '') as Availability;
            if (availabilityChoices.includes(v)) weeks[`${l.id}:${i + 1}`] = v;
        });
    }
    const usual: Answers['usual'] = {};
    for (const l of game.leagues) {
        const v = String(form.get(`u_${l.id}`) ?? '') as Availability;
        if (availabilityChoices.includes(v)) usual[l.id] = v;
    }
    const slots = casualGrid.days.flatMap((d) => casualGrid.slots.map((s) => `${d} ${s}`));
    const casual = form.getAll('casual').map(String).filter((c) => slots.includes(c));
    return { answers: { questions, weeks, usual, casual }, errors };
}

const fixedHeadings = ['CRSid', 'Submitted', 'Updated'];
function headingsFor(game: Game, season: Season) {
    const weekCols = game.leagues.flatMap((l) => [usualHeading(l.name), ...(season[l.id] ?? []).map((_, i) => weekHeading(l.name, i + 1))]);
    return [...fixedHeadings, ...game.questions.map((q) => q.heading), ...weekCols, 'Casual availability'];
}

function toRow(game: Game, headings: string[], crsid: string, submitted: string, a: Answers) {
    const row = Array<string>(headings.length).fill('');
    const set = (h: string, v: string) => {
        const i = headings.indexOf(h);
        if (i >= 0) row[i] = v;
    };
    set('CRSid', crsid);
    set('Submitted', submitted);
    set('Updated', timestamp());
    for (const q of game.questions) {
        const v = a.questions[q.id];
        set(q.heading, Array.isArray(v) ? v.join('; ') : v ?? '');
    }
    for (const l of game.leagues) {
        for (const [key, v] of Object.entries(a.weeks)) {
            const [lid, n] = key.split(':');
            if (lid === l.id) set(weekHeading(l.name, Number(n)), v);
        }
    }
    for (const l of game.leagues) set(usualHeading(l.name), a.usual[l.id] ?? '');
    set('Casual availability', a.casual.join('; '));
    return row;
}

function fromRow(game: Game, headings: string[], row: string[]): Application {
    const get = (h: string) => row[headings.indexOf(h)] ?? '';
    const questions: Answers['questions'] = {};
    for (const q of game.questions) {
        const v = headings.includes(q.heading) ? get(q.heading) : '';
        questions[q.id] = q.type === 'multi' ? v.split(';').map((x) => x.trim()).filter(Boolean) : v;
    }
    const weeks: Answers['weeks'] = {};
    headings.forEach((h, i) => {
        for (const l of game.leagues) {
            const m = h.match(new RegExp(`^${l.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} wk(\\d+)$`));
            if (m && availabilityChoices.includes(row[i] as Availability)) weeks[`${l.id}:${m[1]}`] = row[i] as Availability;
        }
    });
    const usual: Answers['usual'] = {};
    for (const l of game.leagues) {
        const v = headings.includes(usualHeading(l.name)) ? (get(usualHeading(l.name)) as Availability) : ('' as Availability);
        if (availabilityChoices.includes(v)) usual[l.id] = v;
    }
    const casual = get('Casual availability').split(';').map((x) => x.trim()).filter(Boolean);
    return { crsid: get('CRSid'), submitted: get('Submitted'), updated: get('Updated'), answers: { questions, weeks, usual, casual } };
}

export async function listApplications(game: Game): Promise<Application[]> {
    const existing = await tabs();
    if (!existing.has(game.tab)) return [];
    const [headings = [], ...rows] = await readTab(game.tab);
    return rows.filter((r) => r[headings.indexOf('CRSid')]).map((r) => fromRow(game, headings, r));
}

export async function getApplication(game: Game, crsid: string) {
    return (await listApplications(game)).find((a) => a.crsid.toLowerCase() === crsid.toLowerCase()) ?? null;
}

/** Saves the player's application, updating their existing row if they've applied before. */
export async function saveApplication(game: Game, season: Season, crsid: string, answers: Answers) {
    const headings = await ensureTab(game.tab, headingsFor(game, season));
    const rows = (await readTab(game.tab)).slice(1);
    const c = headings.indexOf('CRSid');
    const index = rows.findIndex((r) => r[c]?.toLowerCase() === crsid.toLowerCase());
    const submitted = index >= 0 ? rows[index][headings.indexOf('Submitted')] || timestamp() : timestamp();
    if (index >= 0) {
        // Past weeks aren't shown on the forms, so keep what they said for any week not sent now.
        const before = fromRow(game, headings, rows[index]).answers;
        answers = { ...answers, weeks: { ...before.weeks, ...answers.weeks } };
    }
    const row = toRow(game, headings, crsid.toLowerCase(), submitted, answers);
    if (index >= 0) {
        // Keep anything the committee typed into their own extra columns.
        const old = rows[index];
        row.forEach((v, i) => {
            if (!v && old[i] && !headingsFor(game, season).includes(headings[i])) row[i] = old[i];
        });
        const r = index + 2;
        await sheets(id(), `/values/${range(game.tab, `A${r}:${columnLetter(headings.length - 1)}${r}`)}?valueInputOption=RAW`, SHEETS_READ_WRITE, {
            method: 'PUT',
            body: JSON.stringify({ values: [row] }),
        });
    } else {
        await sheets(id(), `/values/${range(game.tab, 'A:A')}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, SHEETS_READ_WRITE, {
            method: 'POST',
            body: JSON.stringify({ values: [row] }),
        });
    }
    return index < 0;
}

/** Updates only availability (weeks and usual answers), keeping the rest of their application.
 *  Returns false if they haven't applied for this game. */
export async function updateAvailability(game: Game, season: Season, crsid: string, form: FormData) {
    const existing = await getApplication(game, crsid);
    if (!existing) return false;
    const { answers } = validate(game, season, form);
    await saveApplication(game, season, crsid, {
        ...existing.answers,
        weeks: answers.weeks,
        usual: { ...existing.answers.usual, ...answers.usual },
    });
    return true;
}

export const sheetUrl = (game: Game, gid?: number) =>
    `https://docs.google.com/spreadsheets/d/${config.esportsSheetId}/edit${gid !== undefined ? `#gid=${gid}` : ''}`;

export async function tabId(game: Game) {
    return (await tabs()).get(game.tab);
}
