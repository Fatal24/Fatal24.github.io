// Esports team applications (NSE / NUEL), one entry per game. To add a game, copy the League
// entry, give it a new id and tab, and change the questions. Answers go to that game's tab in the
// private "CUDGS Esports Applications" sheet (ESPORTS_SHEET_ID); the site creates tabs and headings.
// "Current Cambridge student" and CRSid aren't asked: the University login provides both.

export type Option = string | { value: string; label: string };
export type Question = {
    id: string;
    /** Column heading in the sheet. */
    heading: string;
    label: string;
    help?: string;
    type: 'text' | 'select' | 'multi' | 'confirm';
    options?: Option[];
    required: boolean;
    /** Shown to reps on the responses page. */
    summary?: boolean;
};
export type League = { id: string; name: string; day: string; time: string; format: string };
export type Game = {
    id: string;
    name: string;
    /** Sheet tab for this game's applications. */
    tab: string;
    /** CRSids who can see responses and set season dates. */
    reps: string[];
    contact: string;
    intro: string[];
    links: { label: string; href: string; code?: string }[];
    leagues: League[];
    questions: Question[];
};

/** Can see and manage every game. */
export const admins = ['yw713'];

export const casualGrid = {
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    slots: ['18:00–20:00', '20:00–22:00', '22:00–00:00'],
};

export const availabilityChoices = ['Available', 'Maybe', 'Unavailable'] as const;

const ROLES = ['Top', 'Jungle', 'Mid', 'Bot', 'Support'];

export const games: Game[] = [
    {
        id: 'league',
        name: 'League of Legends',
        tab: 'League of Legends',
        reps: ['bg477'],
        contact: 'DM PlayBoiiBarti on Discord',
        intro: [
            'Apply for the CUDGS League of Legends teams in the National Student Esports (NSE) and NUEL leagues.',
            'NSE and NUEL require players to make accounts on their websites before they can take part. If you are applying, make sure you are signed up on the relevant website(s) and have joined the relevant team(s). If you already have accounts, double-check they are still verified and that you have joined the team(s).',
        ],
        links: [
            { label: 'NSE', href: 'https://nse.gg/', code: 'dQgCmM' },
            { label: 'NUEL: register', href: 'https://universityesports.co.uk/register' },
            { label: 'NUEL: join the team', href: 'https://universityesports.net/team/cambridge-huntrix/nqgM6G' },
        ],
        leagues: [
            { id: 'nse', name: 'NSE', day: 'Tuesdays', time: '7pm to about 9pm', format: '2 games or 1 bo3' },
            { id: 'nuel', name: 'NUEL', day: 'Wednesdays', time: '6:30pm to about 9:30pm', format: '3 games or 1 bo3' },
        ],
        questions: [
            { id: 'name', heading: 'Name', label: 'Name', type: 'text', required: true, summary: true },
            { id: 'discord', heading: 'Discord', label: 'Discord username', type: 'text', required: true, summary: true },
            {
                id: 'account', heading: 'Account', type: 'text', required: true, summary: true,
                label: 'Main League account name and tag',
                help: 'If your main account is not on EUW, please say which server.',
            },
            {
                id: 'tier', heading: 'Highest tier (2025)', type: 'select', required: true, summary: true,
                label: 'Highest ranked tier you reached in the past season (any time in 2025)',
                options: ['No rank', 'Iron', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Emerald', 'Diamond', 'Master', 'Grandmaster', 'Challenger'],
            },
            {
                id: 'division', heading: 'Division', type: 'select', required: true, summary: true,
                label: 'Your division at that highest rank',
                options: ['I', 'II', 'III', 'IV', '0-300LP (Master+ only)', '>300LP (Master+ only)'],
            },
            { id: 'primary', heading: 'Primary role', label: 'Primary role', type: 'select', required: true, summary: true, options: ROLES },
            {
                id: 'secondary', heading: 'Secondary role', label: 'Secondary role', type: 'select', required: true, summary: true,
                options: [...ROLES, 'I only play one role'],
            },
            {
                id: 'tertiary', heading: 'Other roles', type: 'multi', required: true, summary: true,
                label: 'Any other roles you would be willing to play',
                options: ROLES,
            },
            {
                id: 'experience', heading: 'Competitive before', type: 'select', required: true,
                label: 'Have you played competitive League before? (LAN tournaments, collegiate leagues etc., not Clash)',
                help: "This won't affect player selection.",
                options: ['No, this is my first competitive League experience', 'Yes, I have competed before'],
            },
            {
                id: 'leagues', heading: 'Applying for', type: 'multi', required: true, summary: true,
                label: 'Which team(s) are you applying for?',
                options: [
                    { value: 'NSE', label: 'NSE: Tuesdays, 2 games or 1 bo3, 7pm to about 9pm' },
                    { value: 'NUEL', label: 'NUEL: Wednesdays, 3 games or 1 bo3, 6:30pm to about 9:30pm' },
                ],
            },
            {
                id: 'nosub', heading: 'No sub', type: 'confirm', required: false, summary: true,
                label: 'If I do not make the main team, I would NOT like to be considered as a substitute.',
                help: "If you're not picked for the main team, you may be chosen as a substitute and play when someone can't make a week. This won't affect player selection.",
            },
            {
                id: 'accounts', heading: 'Accounts ready', type: 'confirm', required: true,
                label: 'I have made an account (or checked my existing one is verified) and joined the relevant team(s).',
            },
        ],
    },
];

export const findGame = (id: string) => games.find((g) => g.id === id);

export const optionValue = (o: Option) => (typeof o === 'string' ? o : o.value);
export const optionLabel = (o: Option) => (typeof o === 'string' ? o : o.label);
