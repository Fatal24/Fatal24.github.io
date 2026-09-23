declare namespace App {
    interface Locals {
        /** CRSid of the signed-in user, or null. Only set on server-rendered routes. */
        crsid: string | null;
    }
}
