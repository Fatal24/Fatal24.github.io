// Sponsor logos live in src/assets/sponsors/ and every image there appears in the scrolling
// sponsor bar automatically (transparent PNG, SVG, WebP or GIF works best; shown as white).
// Add an entry here, keyed by filename, to give a logo a name and a link.
export const sponsorInfo: Record<string, { name: string; url?: string }> = {
    'obby-sponsor.gif': { name: 'obby.page', url: 'https://obby.page' },
};
