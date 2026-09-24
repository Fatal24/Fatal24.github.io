// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

// Pages are static by default; login, logout, /api/me and /members run on the Node server.
export default defineConfig({
    site: process.env.SITE_URL ?? 'http://localhost:4321',
    adapter: node({ mode: 'standalone' }),
    // The site sits behind nginx, which talks to Node over plain HTTP and forwards the real host and
    // protocol in X-Forwarded-* headers. Trust them only for the real address, so Astro's CSRF
    // check (origin must match) passes for forms like logout.
    // Short link for the weekly availability page.
    redirects: {
        '/available': '/availability',
    },
    security: {
        allowedDomains: [{ hostname: 'cudgs.org', protocol: 'https' }],
    },
    // The dev server's file watcher kept missing edits on Windows; polling catches them all.
    vite: { server: { watch: { usePolling: true, interval: 300 } } },
});
