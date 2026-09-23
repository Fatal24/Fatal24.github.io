// Ucam-WebAuth ("WAA2WLS") client for University Account login via Nevar (https://nevar.srcf.net/).
// Protocol: https://raven.cam.ac.uk/project/waa2wls-protocol.txt (version 3).
import { createVerify } from 'node:crypto';

export type WlsResult =
    | { ok: true; principal: string; ptags: string[]; id: string; issue: Date; params: string }
    | { ok: false; status: string; message: string; params: string };

/** Status codes a WLS can return instead of 200 (success). */
export const WLS_STATUS = {
    OK: '200',
    CANCELLED: '410',
} as const;

export function buildAuthUrl(opts: { wlsUrl: string; callbackUrl: string; desc: string; msg: string; params: string }) {
    const url = new URL(opts.wlsUrl);
    url.search = new URLSearchParams({
        ver: '3',
        url: opts.callbackUrl,
        desc: opts.desc,
        msg: opts.msg,
        params: opts.params,
    }).toString();
    return url.toString();
}

// Response fields are '!'-separated, with '%' and '!' inside a field escaped as %25 and %21.
const decodeField = (field: string) => field.replace(/%21/gi, '!').replace(/%25/g, '%');

// Signatures use base64 with '-', '.', '_' in place of '+', '/', '='.
const decodeSignature = (sig: string) =>
    Buffer.from(sig.replace(/-/g, '+').replace(/\./g, '/').replace(/_/g, '='), 'base64');

// Issue times look like 20260923T140512Z.
function parseIssue(issue: string) {
    const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(issue);
    if (!m) throw new Error('Malformed issue time');
    const [, y, mo, d, h, mi, s] = m.map(Number);
    return new Date(Date.UTC(y, mo - 1, d, h, mi, s));
}

/**
 * Parses and verifies a WLS-Response. Throws if the response is malformed, unsigned,
 * signed by an unknown key, meant for another site, or too old/new.
 */
export function verifyWlsResponse(
    raw: string,
    opts: { callbackUrl: string; keys: Record<string, string>; now?: number; maxSkewMs?: number },
): WlsResult {
    const fields = raw.split('!');
    if (fields[0] !== '3' || fields.length !== 14) throw new Error('Unsupported or malformed WLS response');

    const [, status, msg, issue, id, url, principal, ptags, , , , params, kid, sig] = fields;

    // Failures (e.g. the user pressed cancel) may be unsigned, so they carry no identity.
    if (status !== WLS_STATUS.OK) {
        return { ok: false, status, message: decodeField(msg), params: decodeField(params) };
    }

    const key = opts.keys[kid];
    if (!key) throw new Error(`Unknown WLS signing key "${kid}"`);
    const verifier = createVerify('RSA-SHA1');
    verifier.update(fields.slice(0, 12).join('!'));
    if (!verifier.verify(key, decodeSignature(sig))) throw new Error('Bad WLS signature');

    if (decodeField(url) !== opts.callbackUrl) throw new Error('WLS response was issued for a different URL');

    const issued = parseIssue(issue);
    const skew = Math.abs((opts.now ?? Date.now()) - issued.getTime());
    if (skew > (opts.maxSkewMs ?? 5 * 60 * 1000)) throw new Error('WLS response is stale');

    return {
        ok: true,
        principal: decodeField(principal),
        ptags: decodeField(ptags).split(',').filter(Boolean),
        id: decodeField(id),
        issue: issued,
        params: decodeField(params),
    };
}
