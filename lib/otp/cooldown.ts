/**
 * Shared by the server actions that enforce the cooldown and the client hook
 * that counts it down, so this file must stay free of "use client"/"use server"
 * and of any server-only import - a directive here puts it on one side of the
 * RSC boundary and breaks the other.
 */
export const RESEND_COOLDOWN_SECONDS = 30;
