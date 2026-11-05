// ABOUTME: Type declarations for local-dsn.mjs (strict local DSN split and scratch derivation).
// One shape (the repo compiles without strictNullChecks, where a discriminated union does not narrow): on ok false
// only `reason` is set; on ok true every other field is.
export type LocalDsn = { ok: boolean; reason?: string; host?: string; port?: string; user?: string; db?: string; password?: string; uri?: string };
export function splitLocalDsn(dsn: string, env?: NodeJS.ProcessEnv): LocalDsn;
export function deriveScratch(maintenanceDsn: string, db: string, env?: NodeJS.ProcessEnv): LocalDsn;
