// Signed session cookie. It holds only the CRSid and an expiry; names and membership are
// looked up fresh from the members sheet, so edits and removals there apply straight away.
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { AstroCookieSetOptions } from 'astro';

export const SESSION_COOKIE = 'cudgs_session';
export const SESSION_MAX_AGE = 7 * 24 * 60 * 60; // seconds

export const sessionCookieOptions = (secure: boolean): AstroCookieSetOptions => ({
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
});

const sign = (payload: string, secret: string) => createHmac('sha256', secret).update(payload).digest('base64url');

export function createSession(crsid: string, secret: string, now = Date.now()) {
    const payload = Buffer.from(JSON.stringify({ sub: crsid, exp: now + SESSION_MAX_AGE * 1000 })).toString('base64url');
    return `${payload}.${sign(payload, secret)}`;
}

/** Returns the CRSid from a valid, unexpired session cookie, or null. */
export function readSession(value: string, secret: string, now = Date.now()): string | null {
    const [payload, signature] = value.split('.');
    if (!payload || !signature) return null;
    const expected = Buffer.from(sign(payload, secret));
    const given = Buffer.from(signature);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
    try {
        const { sub, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString());
        return typeof sub === 'string' && typeof exp === 'number' && exp > now ? sub : null;
    } catch {
        return null;
    }
}

/** Only allow redirects back to paths on this site, never to another origin. */
export function safeReturnPath(path: string | null | undefined, fallback = '/members') {
    return path && path.startsWith('/') && !path.startsWith('//') && !path.startsWith('/\\') ? path : fallback;
}
