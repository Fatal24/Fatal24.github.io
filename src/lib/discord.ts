// Member and online counts for the CUDGS Discord, from Discord's public invite endpoint
// (no bot or token needed). Discord only updates these every few minutes, so answers are cached
// for 5 minutes: the site asks Discord at most once per 5 minutes, however many people visit,
// and visitors' browsers never talk to Discord themselves.
import { gamesLink } from '../data/games.ts';

export type DiscordCounts = { members: number; online: number };

const CACHE_MS = 5 * 60 * 1000;
let cache: { at: number; counts: DiscordCounts } | null = null;

const inviteCode = () => new URL(gamesLink.href).pathname.split('/').filter(Boolean).pop()!;

/** Latest counts, or the last known ones if Discord can't be reached, or null if never fetched. */
export async function getDiscordCounts(): Promise<DiscordCounts | null> {
    if (cache && Date.now() - cache.at < CACHE_MS) return cache.counts;
    try {
        const response = await fetch(
            `https://discord.com/api/v10/invites/${encodeURIComponent(inviteCode())}?with_counts=true`,
            { signal: AbortSignal.timeout(5000) },
        );
        if (!response.ok) throw new Error(`Discord invite lookup failed: ${response.status}`);
        const data = await response.json();
        const counts = { members: data.approximate_member_count, online: data.approximate_presence_count };
        if (typeof counts.members !== 'number') throw new Error('Discord returned no member count');
        cache = { at: Date.now(), counts };
    } catch (error) {
        console.warn((error as Error).message);
        if (cache) cache.at = Date.now() - CACHE_MS + 60_000; // retry in a minute, keep old numbers
    }
    return cache?.counts ?? null;
}

export const formatCount = (n: number) => n.toLocaleString('en-GB');
