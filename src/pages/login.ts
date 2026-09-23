import type { APIRoute } from 'astro';
import { config } from '../lib/config.ts';
import { safeReturnPath } from '../lib/session.ts';
import { buildAuthUrl } from '../lib/ucam-webauth.ts';

export const prerender = false;

export const GET: APIRoute = ({ url, redirect }) =>
    redirect(
        buildAuthUrl({
            wlsUrl: config.wlsUrl,
            callbackUrl: config.callbackUrl,
            desc: 'Cambridge University Digital Gaming Society',
            msg: 'to check your CUDGS membership',
            params: safeReturnPath(url.searchParams.get('return')),
        }),
    );
