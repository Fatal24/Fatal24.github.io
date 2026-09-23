import type { APIRoute } from 'astro';
import { findMember } from '../../lib/members.ts';

export const prerender = false;

const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });

export const GET: APIRoute = async ({ locals }) => {
    if (!locals.crsid) return json({ signedIn: false }, 401);
    const member = await findMember(locals.crsid).catch((error) => {
        console.error('Members lookup failed:', error);
        return null;
    });
    return json({
        signedIn: true,
        crsid: locals.crsid,
        firstName: member?.name.split(/\s+/)[0] || null,
        member: member && { tier: member.tier, active: member.active },
    });
};
