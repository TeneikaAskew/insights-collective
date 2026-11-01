// ABOUTME: Type declarations for browser-egress.mjs (egress confinement arguments and the exact proxy bypass list).
export const BROWSER_EGRESS_ARGS: readonly string[];
export function exactBypassList(origins: Iterable<string>): string;
