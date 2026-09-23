// Server settings, read from the environment at request time (see .env.example).
import { readFileSync } from 'node:fs';

function required(name: string) {
    const value = process.env[name];
    if (!value) throw new Error(`${name} is not set`);
    return value;
}

export const config = {
    get siteUrl() {
        return process.env.SITE_URL ?? 'http://localhost:4321';
    },
    get callbackUrl() {
        return new URL('/auth/callback', this.siteUrl).toString();
    },
    wlsUrl: 'https://nevar.srcf.net/wls/authenticate',
    get sessionSecret() {
        return required('SESSION_SECRET');
    },
    /** Nevar's public signing key(s), keyed by key id. The key is available from the SRCF sysadmins on request. */
    get wlsKeys(): Record<string, string> {
        return { [required('NEVAR_KEY_ID')]: readFileSync(required('NEVAR_KEY_FILE'), 'utf8') };
    },
    get membersSheetId() {
        return process.env.MEMBERS_SHEET_ID;
    },
    get membersRange() {
        return process.env.MEMBERS_SHEET_RANGE ?? 'Members!A:D';
    },
    get googleServiceAccountFile() {
        return process.env.GOOGLE_SERVICE_ACCOUNT_FILE;
    },
};
