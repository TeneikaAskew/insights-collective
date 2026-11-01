// ABOUTME: Type declarations for learner-auth-probe.mjs (pre-browser learner sign-in probe; fixed allowlisted output).
export const LEARNER_EMAIL: string;
export const EXPECTED_LEARNER_UID: string;
export const PATH: string;
export const ERROR_CODE_ALLOWLIST: readonly string[];
export class Refusal extends Error {}
export function loopbackOrigin(value: string | undefined, name: string): string;
export function classifyErrorCode(json: unknown): string;
export function verdict(status: number | null, json: unknown, errorCodeOverride?: string): { line: string; ok: boolean };
export function probe(o: { api: string; anonKey: string; password: string; fetchImpl?: typeof fetch; timeoutMs?: number }): Promise<{ line: string; ok: boolean }>;
export function versionToken(json: unknown): string;
export function health(o: { api: string; anonKey: string; fetchImpl?: typeof fetch; timeoutMs?: number }): Promise<string>;
