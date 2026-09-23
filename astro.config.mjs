// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

// Pages are static by default; login, logout, /api/me and /members run on the Node server.
export default defineConfig({
    site: process.env.SITE_URL ?? 'http://localhost:4321',
    adapter: node({ mode: 'standalone' }),
    // The dev server's file watcher kept missing edits on Windows; polling catches them all.
    vite: { server: { watch: { usePolling: true, interval: 300 } } },
});
