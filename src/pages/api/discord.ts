import type { APIRoute } from 'astro';
import { getDiscordCounts } from '../../lib/discord.ts';

export const prerender = false;

// Used by the Games section to keep "Join N members on Discord" up to date.
export const GET: APIRoute = async () => {
    const counts = await getDiscordCounts();
    return new Response(JSON.stringify(counts ?? {}), {
        status: counts ? 200 : 503,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' },
    });
};
