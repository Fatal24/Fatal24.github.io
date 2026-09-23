import { defineMiddleware } from 'astro:middleware';
import { config } from './lib/config.ts';
import { SESSION_COOKIE, readSession } from './lib/session.ts';

export const onRequest = defineMiddleware((context, next) => {
    if (context.isPrerendered) return next();
    const value = context.cookies.get(SESSION_COOKIE)?.value;
    context.locals.crsid = value ? readSession(value, config.sessionSecret) : null;
    return next();
});
