import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// A throwaway service account and an in-memory fake of the Sheets API with several tabs.
const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const accountFile = join(mkdtempSync(join(tmpdir(), 'cudgs-es-')), 'account.json');
writeFileSync(accountFile, JSON.stringify({ client_email: 'site@x.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) }));
process.env.ESPORTS_SHEET_ID = 'es123';
process.env.GOOGLE_SERVICE_ACCOUNT_FILE = accountFile;

const tabs = new Map<string, string[][]>();
const col = (letters: string) => [...letters].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;
globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
    const url = decodeURIComponent(String(input));
    if (url.startsWith('https://oauth2.googleapis.com/token')) return Response.json({ access_token: 't', expires_in: 3600 });
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    if (url.includes('fields=sheets')) return Response.json({ sheets: [...tabs.keys()].map((title, i) => ({ properties: { title, sheetId: i } })) });
    if (url.endsWith(':batchUpdate')) {
        tabs.set(body.requests[0].addSheet.properties.title, []);
        return Response.json({});
    }
    const m = url.match(/values\/'(.+?)'!([A-Z]+)?(\d+)?(?::([A-Z]+)(\d+)?)?(:append|:clear)?(\?|$)/)!;
    const [tab, startCol, startRow, , , action] = [m[1].replace(/''/g, "'"), m[2], m[3], m[4], m[5], m[6]];
    const sheet = tabs.get(tab)!;
    if (action === ':append') sheet.push(body.values[0]);
    else if (action === ':clear') sheet.length = 0;
    else if (init?.method === 'PUT') {
        const r = startRow ? Number(startRow) - 1 : 0;
        body.values.forEach((row: string[], i: number) => (sheet[r + i] = row));
        void col(startCol ?? 'A');
    } else return Response.json({ values: sheet });
    return Response.json({});
}) as typeof fetch;

const { games } = await import('../data/esports.ts');
const es = await import('./esports.ts');
const league = games.find((g) => g.id === 'league')!;

const form = (extra: Record<string, string | string[]> = {}) => {
    const f = new FormData();
    const base: Record<string, string | string[]> = {
        q_name: 'Alex Smith', q_discord: 'alex', q_account: 'Alex#EUW', q_tier: 'Gold', q_division: 'II',
        q_primary: 'Mid', q_secondary: 'Top', q_tertiary: ['Bot'], q_experience: 'Yes, I have competed before',
        q_leagues: ['NSE'], q_accounts: 'yes', w_nse_1: 'Available', w_nse_2: 'Maybe', casual: ['Mon 18:00–20:00'],
        ...extra,
    };
    for (const [k, v] of Object.entries(base)) for (const x of [v].flat()) f.append(k, x);
    return f;
};

test('generateWeeks gives weekly dates from the first match', () => {
    assert.deepEqual(es.generateWeeks('2027-01-19', 3), ['2027-01-19', '2027-01-26', '2027-02-02']);
    assert.deepEqual(es.generateWeeks('not a date', 3), []);
});

test('season dates are saved per game and league, in date order', async () => {
    await es.saveSeason(league, { nse: ['2027-01-26', '2027-01-19'], nuel: ['2027-01-20'] });
    assert.deepEqual(await es.getSeason(league), { nse: ['2027-01-19', '2027-01-26'], nuel: ['2027-01-20'] });
});

test('validation rejects unknown options and missing required answers', async () => {
    const season = await es.getSeason(league);
    const bad = es.validate(league, season, form({ q_tier: 'Wood', q_accounts: '' }));
    assert.equal(bad.errors.length, 2);
    assert.equal(bad.answers.questions.name, 'Alex Smith'); // kept so the form can be shown again
    const good = es.validate(league, season, form({ w_nse_3: 'Available', q_tertiary: ['Bot', 'Nonsense'] }));
    assert.deepEqual(good.errors, []);
    assert.deepEqual(good.answers.questions.tertiary, ['Bot']);
    assert.deepEqual(good.answers.weeks, { 'nse:1': 'Available', 'nse:2': 'Maybe' }); // week 3 isn't in the season
});

test('applying creates the tab and headings; applying again updates the same row', async () => {
    const season = await es.getSeason(league);
    const first = es.validate(league, season, form());
    assert.deepEqual(first.errors, []);
    assert.equal(await es.saveApplication(league, season, 'AB123', first.answers), true);
    const header = tabs.get(league.tab)![0];
    assert.deepEqual(header.slice(0, 4), ['CRSid', 'Submitted', 'Updated', 'Name']);
    assert.ok(header.includes('NSE wk2') && header.includes('NUEL wk1') && header.includes('Casual availability'));
    const submitted = (await es.getApplication(league, 'ab123'))!.submitted;

    const second = es.validate(league, season, form({ q_tier: 'Diamond' }));
    assert.deepEqual(second.errors, []);
    assert.equal(await es.saveApplication(league, season, 'ab123', second.answers), false);
    const all = await es.listApplications(league);
    assert.equal(all.length, 1);
    assert.equal(all[0].answers.questions.tier, 'Diamond');
    assert.equal(all[0].submitted, submitted);
    assert.deepEqual(all[0].answers.weeks, { 'nse:1': 'Available', 'nse:2': 'Maybe' });
    assert.deepEqual(all[0].answers.casual, ['Mon 18:00–20:00']);
});

test('only admins and that game\'s reps can manage it', () => {
    assert.equal(es.canManage('bg477', league), true);
    assert.equal(es.canManage('YW713', league), true);
    assert.equal(es.canManage('zz999', league), false);
    assert.equal(es.canManage(null, league), false);
});

test('usual availability fills unanswered weeks; upcoming weeks skip past dates', async () => {
    const answers = { questions: {}, weeks: { 'nse:2': 'Unavailable' as const }, usual: { nse: 'Available' as const }, casual: [] };
    assert.deepEqual(es.effective(answers, 'nse', 1), { value: 'Available', usual: true });
    assert.deepEqual(es.effective(answers, 'nse', 2), { value: 'Unavailable', usual: false });
    assert.deepEqual(es.effective(answers, 'nuel', 1), { value: '', usual: false });
    const season = { nse: ['2027-01-19', '2027-01-26', '2027-02-02'] };
    assert.deepEqual(es.upcomingWeeks(season, 'nse', '2027-01-26').map((w) => w.week), [2, 3]);
    assert.equal(es.todayUK(new Date('2027-03-28T23:30:00Z')), '2027-03-29'); // BST: already the 29th in the UK
});

test('quick availability updates keep the rest of the application and past answers', async () => {
    const season = await es.getSeason(league);
    const f = new FormData();
    f.append('w_nse_2', 'Unavailable');
    f.append('u_nse', 'Available');
    assert.equal(await es.updateAvailability(league, season, 'ab123', f), true);
    const app = (await es.getApplication(league, 'ab123'))!;
    assert.equal(app.answers.questions.tier, 'Diamond'); // untouched
    assert.deepEqual(app.answers.weeks, { 'nse:1': 'Available', 'nse:2': 'Unavailable' }); // week 1 kept
    assert.deepEqual(app.answers.usual, { nse: 'Available' });
    assert.equal(await es.updateAvailability(league, season, 'nobody', f), false);
});
