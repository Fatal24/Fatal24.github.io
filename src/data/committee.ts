// The Executive Committee. Leave `name` empty for a vacant or not-yet-announced role.
// Photos go in src/assets/committee/ (square works best); set `photo` to the filename.
// Only publish a name or photo with that person's agreement.
export type CommitteeMember = { role: string; name: string; photo?: string };

export const committee: CommitteeMember[] = [
    { role: 'President', name: 'Philip Wang' },
    { role: 'Vice President', name: 'Aanya Khan' },
    { role: 'Treasurer', name: 'Abhishek Sundararaman' },
    { role: 'E-Sports Officer', name: 'Kiara Shahid' },
    { role: 'Publicity Officer', name: 'Gerald Chen' },
    { role: 'Social & Welfare Officer', name: 'Nikki Warchon' },
];

// Game Representatives, e.g. { role: 'Valorant Rep', name: 'Alex' }. Shown under the committee.
export const gameReps: CommitteeMember[] = [];
