// ABOUTME: Type declarations for case-diagnostics.mjs (allowlisted post-sign-in case-failure diagnostics; no values recorded).
export const API_PATH_ALLOWLIST: readonly string[];
export const ERROR_CODE_ALLOWLIST: readonly string[];
export const TESTID_ALLOWLIST: readonly string[];
export const HEADING_ALLOWLIST: readonly string[];
export interface Reduced { method: string; status: number | 'none'; code: string; rows: number | 'n/a' }
export function routeShape(url: string): { template: string; ids: boolean[] };
export function apiPathOf(url: string): string | null;
export function classifyCode(json: unknown): string;
export function rowCount(contentRange: string | null, json: unknown): number | 'n/a';
export function reduceResponse(method: string, status: number, contentRange: string | null, json: unknown): Reduced;
export interface CaseRecorder {
  settle(timeoutMs?: number): Promise<{ byPath: Map<string, Reduced[]>; settled: boolean }>;
  detach(): void;
}
export function createCaseRecorder(page: import('@playwright/test').Page): CaseRecorder;
export function probePage(page: import('@playwright/test').Page): Promise<{ present: number[]; shown: number[] }>;
export function caseLine(d: {
  test: string; route: { template: string; ids: boolean[] }; present: number[]; shown: number[];
  byPath: Map<string, Reduced[]>; settled: boolean;
}): string;
export function captureCaseFailure(page: import('@playwright/test').Page, o: { out: string; title: string; recorder: CaseRecorder }): Promise<string>;
