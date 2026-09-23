import type { APIRoute } from 'astro';
import { SESSION_COOKIE } from '../lib/session.ts';

export const prerender = false;

// Signs out of this site only. The University Account session at Nevar is left alone,
// as with other University sites.
export const POST: APIRoute = ({ cookies, redirect }) => {
    cookies.delete(SESSION_COOKIE, { path: '/' });
    return redirect('/');
};
