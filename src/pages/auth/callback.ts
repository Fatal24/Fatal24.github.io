import type { APIRoute } from 'astro';
import { config } from '../../lib/config.ts';
import { SESSION_COOKIE, createSession, safeReturnPath, sessionCookieOptions } from '../../lib/session.ts';
import { WLS_STATUS, verifyWlsResponse } from '../../lib/ucam-webauth.ts';

export const prerender = false;

// Each WLS response may only be used once. Responses older than the allowed skew are
// rejected anyway, so ids only need remembering for that long.
const seen = new Map<string, number>();
const SEEN_MS = 10 * 60 * 1000;

export const GET: APIRoute = ({ url, cookies, redirect }) => {
    const raw = url.searchParams.get('WLS-Response');
    if (!raw) return redirect('/auth/error');

    let result;
    try {
        result = verifyWlsResponse(raw, { callbackUrl: config.callbackUrl, keys: config.wlsKeys });
    } catch (error) {
        console.warn('Rejected WLS response:', (error as Error).message);
        return redirect('/auth/error');
    }

    if (!result.ok) {
        return redirect(result.status === WLS_STATUS.CANCELLED ? '/' : '/auth/error');
    }

    const now = Date.now();
    for (const [id, at] of seen) if (now - at > SEEN_MS) seen.delete(id);
    if (seen.has(result.id)) return redirect('/auth/error');
    seen.set(result.id, now);

    // "current" marks current University members (students and staff).
    if (!result.ptags.includes('current')) return redirect('/auth/error?reason=not-current');

    cookies.set(SESSION_COOKIE, createSession(result.principal, config.sessionSecret), sessionCookieOptions(url.protocol === 'https:'));
    return redirect(safeReturnPath(result.params));
};
