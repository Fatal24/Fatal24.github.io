import type { APIRoute } from 'astro';
import { cleanCollege, cleanName, mailingListEnabled, subscribe, unsubscribe } from '../../lib/mailing-list.ts';

export const prerender = false;

// The Members page's join/leave form. Astro's origin check blocks cross-site submissions, and the
// CRSid always comes from the login cookie, so nobody can add or remove someone else.
export const POST: APIRoute = async ({ locals, request, redirect }) => {
    if (!locals.crsid) return redirect('/login?return=/members');
    if (!mailingListEnabled()) return redirect('/members?mailing=error#mailing-list');

    const form = await request.formData();
    try {
        if (form.get('action') === 'leave') {
            await unsubscribe(locals.crsid);
            return redirect('/members?mailing=left#mailing-list');
        }
        const name = cleanName(String(form.get('name') ?? ''));
        if (!name) return redirect('/members?mailing=noname#mailing-list');
        const added = await subscribe(locals.crsid, name, cleanCollege(String(form.get('college') ?? '')));
        return redirect(`/members?mailing=${added ? 'joined' : 'already'}#mailing-list`);
    } catch (error) {
        console.error('Mailing list update failed:', error);
        return redirect('/members?mailing=error#mailing-list');
    }
};
