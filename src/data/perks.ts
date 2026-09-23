// Members-only perks. `tiers` limits a perk to those membership types (matching the
// "Membership" column in the members sheet); leave it out to show it to every active member.
export type Perk = { title: string; body: string; tiers?: string[] };

export const perks: Perk[] = [
    {
        title: 'Discounts',
        body: 'TODO: list partner discounts and codes here.',
    },
    {
        title: 'Members-only events',
        body: 'TODO: describe exclusive events, or link to the Discord channel where they are announced.',
    },
];

// TODO: where people buy or renew membership (e.g. the SU shop or a form).
export const joinUrl = '';
