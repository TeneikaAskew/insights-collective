// ABOUTME: Type declarations for login-diagnostics.mjs (allowlisted sign-in failure diagnostics; no values recorded).
export const ERROR_CODE_ALLOWLIST: readonly string[];
export const UI_MESSAGE_ALLOWLIST: readonly string[];
export interface TokenSummary { status: number | 'none'; errorCode: string; uidPresent: boolean }
export function isPasswordGrant(method: string, url: string): boolean;
export function summarizeTokenResponse(status: number, json: unknown): TokenSummary;
export function matchUiMessages(visibleText: string): string[];
export function pathOnly(url: string): string;
export function slug(title: string): string;
export function diagnosticLine(d: {
  test: string; urlPath: string; attempts: number; last: TokenSummary | null; transportFailures: number; ui: string[];
}): string;
export function captureLoginFailure(page: import('@playwright/test').Page, o: {
  out: string; sha: string; title: string; attempts: number; transportFailures: number; last: TokenSummary | null;
}): Promise<string>;
