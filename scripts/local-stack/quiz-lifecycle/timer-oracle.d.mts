// ABOUTME: Type declarations for timer-oracle.mjs (F2 timer arithmetic).
export const TIMER_TOLERANCE_S: number;
export const TIMER_TICK_MARGIN_S: number;
export const TIMER_MIN_ELAPSED_S: number;
export function serverSecondsLeft(startedAtMs: number, nowMs: number, limitMinutes: number): number;
export function timerMatchesServer(shownS: number, startedAtMs: number, nowMs: number, limitMinutes: number, tol?: number): boolean;
export function pgTime(t: string): number;
