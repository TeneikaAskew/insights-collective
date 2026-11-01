// ABOUTME: Per-lesson save coordinator for the course builder: one ordered operation chain per lesson for
// ABOUTME: title/body saves AND side actions (rename, publish), confirmed acknowledgement, uncertainty, recovery.

/**
 * Why this exists
 * ---------------
 * The lesson editor used to keep its draft and its "saved" snapshot inside the editor component, so
 * switching lesson or unmounting cancelled the pending debounce, and a rejected write was recorded as
 * saved. Drafts now live here, outside any component, for the lifetime of the tab.
 *
 * Contract
 * --------
 * Ordering. Every write for a lesson (debounced draft save, retry, rename, publish toggle) runs on ONE
 *   per-lesson chain, in the order it was issued. Nothing for that lesson is ever in flight twice, so
 *   responses cannot complete out of order and a slow earlier write cannot overwrite a newer one.
 * Acknowledgement. "saved" means the server returned the row it stored, for this lesson id, with exactly
 *   the title and content that were sent. Nothing else marks a lesson saved.
 * Versioning. Every write is conditional on the last confirmed `updated_at`, including a confirmed NULL
 *   (null-safe). A write whose version is UNAVAILABLE is refused until an authoritative read supplies it.
 *   A changed version is an explicit conflict; the author chooses.
 * Uncertainty. A write that failed without a definitive server answer (network loss, timeout, malformed
 *   response, any error code that is not a known server rejection) may or may not apply, possibly LATER.
 *   Such sends stay "outstanding" with the version they were conditioned on. The lesson is UNCERTAIN: no
 *   edit is declared saved by comparison, and the next attempt first reads the server row:
 *   - If the row is still at a version an outstanding send was conditioned on, that send can still commit.
 *     Equality is NOT settlement: the current intent is written as a FENCE, conditional on that version.
 *     Once the fence commits, the version moves and every outstanding send fails its condition.
 *   - If the row moved past every outstanding version and holds what we sent or last confirmed, adopt it.
 *   - Anything else is a conflict. Nothing is ever written to "undo" an uncertain write.
 * Gating. Side actions (rename, publish) are refused with ZERO writes while the lesson has a failed,
 *   conflicted or uncertain save, so they can never rebase or bypass a draft the author has not resolved.
 * Durability. Outstanding sends, uncertainty and the confirmed base are mirrored too, and each send is
 *   recorded BEFORE it leaves (write-ahead). A fresh page that finds such a record restores it as uncertain
 *   even when the fetched row equals the draft, and settles it only by reconciliation plus a confirmed
 *   conditional fence. Without storage this cannot be made durable, and the UI says so (recoverable: false).
 * Recovery. Unconfirmed drafts are mirrored to sessionStorage under a key scoped to user and course.
 *   Each mirror records the queue instance that owns it; an instance never overwrites or removes a mirror
 *   another instance has claimed. A mirror is removed only when the same content is confirmed saved or
 *   the owner discards it. Other users' mirrors and the legacy unscoped format are never read into the UI
 *   and never deleted here. Storage that is unavailable or fails to write is reported
 *   (`recoverable: false`), never silently assumed. sessionStorage is NOT a confidentiality boundary:
 *   anyone using the same tab can read it with devtools.
 * Owner execution. A queue belongs to one signed-in user. Before every network operation (write, read,
 *   publish) and before any failure toast, it checks the CURRENT session user; if that is not the owner
 *   it suspends itself: no request, no toast, the draft and its mirror are kept for the owner's return.
 */

import { useSyncExternalStore } from 'react';

export interface LessonFields {
  title: string;
  content: string;
}

/** A server row. `updated_at: undefined` means the version is unavailable (not the same as a known NULL). */
export interface PersistedLesson extends LessonFields {
  id: string;
  updated_at?: string | null;
  published?: boolean | null;
}

type Version = { known: true; value: string | null } | { known: false };

export type LessonSaveStatus = 'saved' | 'dirty' | 'saving' | 'error' | 'conflict';

export interface LessonSaveSnapshot {
  id: string;
  status: LessonSaveStatus;
  draft: LessonFields;
  /** Human-readable reason when status is error or conflict. */
  error: string | null;
  /** The server may or may not hold the last write; it must be read back before anything counts as saved. */
  uncertain: boolean;
  /** Server row seen when a conflict was detected. */
  conflictWith: PersistedLesson | null;
  /** True when this draft was restored from a previous page session. */
  recovered: boolean;
  /** False when the draft could not be mirrored, so it would be lost if the page goes away. */
  recoverable: boolean;
  /** Increments when the draft is replaced from outside the editor. */
  revision: number;
}

/** Conditional title/body write. `expected` null = the confirmed version IS null (null-safe match). */
export type PersistLesson = (id: string, fields: LessonFields, expected: string | null) => Promise<PersistedLesson>;
/** Authoritative read of the current server row; null when it does not exist or is not readable. */
export type ReadLesson = (id: string) => Promise<PersistedLesson | null>;
/** A side write (e.g. publish) conditional on `expected`, resolving with the stored row. */
export type SideWrite = (expected: string | null) => Promise<PersistedLesson>;

export interface DraftStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  readonly length?: number;
  key?(index: number): string | null;
}

export interface LessonSaveHandlers {
  onPersisted?: (row: PersistedLesson) => void;
  onFailed?: (id: string, snapshot: LessonSaveSnapshot) => void;
}

export interface LessonSaveQueueOptions extends LessonSaveHandlers {
  persist: PersistLesson;
  read: ReadLesson;
  debounceMs?: number;
  storage?: DraftStorage | null;
  /** Namespaces storage keys: must identify the signed-in user AND the course. */
  storageScope?: string;
  /** The signed-in user this queue acts for. */
  ownerId?: string | null;
  /** Reads the CURRENT session user. When given, every network operation is gated on it equalling ownerId. */
  currentUserId?: () => Promise<string | null>;
}

export const DRAFT_KEY_PREFIX = 'ic.builder.lessonDraft.v2.';

type Send = { fields: LessonFields; expected: string | null };

interface StoredDraft {
  v: 2;
  owner: string;
  draft: LessonFields;
  base: Version;
  /** Durable settlement state (absent in mirrors written before this field existed). */
  confirmed?: LessonFields;
  outstanding?: Send[];
  uncertain?: boolean;
}

interface Entry {
  server: LessonFields;
  version: Version;
  draft: LessonFields;
  status: LessonSaveStatus;
  error: string | null;
  uncertain: boolean;
  /** Sends whose outcome is unknown, with the version each was conditioned on (they may still commit). */
  outstanding: Send[];
  /** The current intent must be written conditionally even if equal to the row (see Uncertainty). */
  needsFence: boolean;
  conflictWith: PersistedLesson | null;
  recovered: boolean;
  mirrorOk: boolean;
  revision: number;
  tail: Promise<void>;
  pending: number;
  timer: ReturnType<typeof setTimeout> | null;
  snapshot: LessonSaveSnapshot;
}

const sameFields = (a: LessonFields, b: LessonFields) => a.title === b.title && a.content === b.content;
const fieldsOf = (row: LessonFields): LessonFields => ({ title: row.title ?? '', content: row.content ?? '' });
const versionOf = (row: PersistedLesson): Version =>
  row.updated_at === undefined ? { known: false } : { known: true, value: row.updated_at };
const sameVersion = (a: Version, b: Version) => a.known && b.known && a.value === b.value;

/**
 * Errors that carry a definitive server answer: the write certainly did NOT apply. Only known server
 * rejections qualify: PostgREST request errors (PGRSTnnn) and SQLSTATEs whose class means the statement
 * was refused or rolled back. Transport codes (ETIMEDOUT, ECONNRESET, EPIPE...), connection classes
 * (08), "completion unknown" (40003), operator intervention (57), system/internal (58, XX) and anything
 * unrecognised stay UNCERTAIN.
 */
const DEFINITIVE_SQLSTATE_CLASSES = new Set(['22', '23', '28', '42', 'P0']);
const DEFINITIVE_SQLSTATES = new Set(['40001', '40P01']);
export function isDefinitive(err: any): boolean {
  if (!err) return false;
  if (err.name === 'LessonSaveRejectedError') return true;
  const code = typeof err.code === 'string' ? err.code : '';
  if (/^PGRST\d{3}$/.test(code)) return true;
  if (!/^[0-9A-Z]{5}$/.test(code)) return false;
  return DEFINITIVE_SQLSTATES.has(code) || DEFINITIVE_SQLSTATE_CLASSES.has(code.slice(0, 2));
}
const isConflict = (err: any) => !!err && err.name === 'LessonSaveConflictError' && !!err.current;

export function describeSaveError(err: unknown): string {
  const raw =
    (err && typeof err === 'object' && 'message' in err && String((err as any).message)) || String(err ?? 'Unknown error');
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
  if (offline || /failed to fetch|networkerror|load failed|network request failed/i.test(raw)) {
    return 'You appear to be offline.';
  }
  return raw;
}

const CHANGED_MESSAGE =
  'The saved version of this lesson is not the one you last saw (it may have been changed elsewhere). Your draft is kept. Choose which version to keep.';

const UNCERTAIN_MESSAGE =
  "We couldn't confirm whether your last save reached the server. Retry to check the saved version before anything else is written.";

/** sessionStorage, or null if the browser refuses it (the getter itself can throw). */
export function resolveSessionStorage(): DraftStorage | null {
  try {
    if (typeof window === 'undefined') return null;
    const s = window.sessionStorage;
    const probe = `${DRAFT_KEY_PREFIX}probe`;
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

let instanceCounter = 0;

export class LessonSaveQueue {
  private entries = new Map<string, Entry>();
  private listeners = new Set<() => void>();
  private readonly persist: PersistLesson;
  private readonly read: ReadLesson;
  private readonly debounceMs: number;
  private readonly storage: DraftStorage | null;
  private readonly scope: string;
  private handlers: LessonSaveHandlers;
  private version = 0;
  private suspended = false;
  private readonly ownerId: string | null;
  private readonly currentUserId?: () => Promise<string | null>;
  readonly instanceId: string;

  constructor(opts: LessonSaveQueueOptions) {
    this.persist = opts.persist;
    this.read = opts.read;
    this.debounceMs = opts.debounceMs ?? 800;
    this.storage = opts.storage ?? null;
    this.scope = opts.storageScope ?? '';
    this.handlers = { onPersisted: opts.onPersisted, onFailed: opts.onFailed };
    this.ownerId = opts.ownerId ?? null;
    this.currentUserId = opts.currentUserId;
    instanceCounter += 1;
    this.instanceId = `q${instanceCounter}-${Math.random().toString(36).slice(2, 8)}`;
  }

  /** Re-bind callbacks (the builder remounts while the queue lives on). */
  setHandlers(h: LessonSaveHandlers) {
    this.handlers = h;
  }

  // ---- subscription (useSyncExternalStore compatible) ----
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  getVersion = () => this.version;

  private emit(entry?: Entry, id?: string) {
    if (entry && id) entry.snapshot = this.buildSnapshot(id, entry);
    this.version += 1;
    this.listeners.forEach((l) => l());
  }

  private buildSnapshot(id: string, e: Entry): LessonSaveSnapshot {
    return {
      id,
      status: e.status,
      draft: e.draft,
      error: e.error,
      uncertain: e.uncertain,
      conflictWith: e.conflictWith,
      recovered: e.recovered,
      recoverable: !!this.storage && this.scope !== '' && e.mirrorOk,
      revision: e.revision,
    };
  }

  // ---- storage mirror (ownership-checked) ----
  private key(id: string) {
    return `${DRAFT_KEY_PREFIX}${this.scope}.${id}`;
  }

  private readStored(id: string): StoredDraft | null {
    if (!this.storage || !this.scope) return null;
    try {
      const raw = this.storage.getItem(this.key(id));
      if (!raw) return null;
      const p = JSON.parse(raw) as StoredDraft;
      if (!p || p.v !== 2 || !p.draft || typeof p.owner !== 'string' || !p.base) return null;
      const outstanding = Array.isArray(p.outstanding)
        ? p.outstanding
            .filter((o) => o && o.fields && (typeof o.expected === 'string' || o.expected === null))
            .map((o) => ({ fields: fieldsOf(o.fields), expected: o.expected }))
        : [];
      return {
        v: 2,
        owner: p.owner,
        draft: fieldsOf(p.draft),
        base: p.base.known ? { known: true, value: p.base.value ?? null } : { known: false },
        confirmed: p.confirmed ? fieldsOf(p.confirmed) : undefined,
        outstanding,
        uncertain: !!p.uncertain,
      };
    } catch {
      return null;
    }
  }

  private claim(id: string, e: Entry) {
    this.writeMirror(id, e, true);
  }

  private mirror(id: string, e: Entry) {
    this.writeMirror(id, e, false);
  }

  private writeMirror(id: string, e: Entry, force: boolean) {
    if (!this.storage || !this.scope) {
      e.mirrorOk = false;
      return;
    }
    try {
      const existing = this.readStored(id);
      if (!force && existing && existing.owner !== this.instanceId) {
        // Another instance claimed this lesson's mirror (e.g. it restored it). Never overwrite or remove it.
        return;
      }
      // Removed only when settled: confirmed saved, nothing uncertain, no send whose outcome is unknown.
      const clean = e.status === 'saved' && !e.uncertain && e.outstanding.length === 0 && e.pending === 0 && !e.timer;
      if (clean) {
        this.storage.removeItem(this.key(id));
      } else {
        const value: StoredDraft = {
          v: 2,
          owner: this.instanceId,
          draft: e.draft,
          base: e.version,
          confirmed: e.server,
          outstanding: e.outstanding,
          uncertain: e.uncertain,
        };
        this.storage.setItem(this.key(id), JSON.stringify(value));
      }
      e.mirrorOk = true;
    } catch {
      e.mirrorOk = false;
    }
  }

  // ---- reads ----
  get(id: string): LessonSaveSnapshot | null {
    return this.entries.get(id)?.snapshot ?? null;
  }

  unsavedIds(): string[] {
    const out: string[] = [];
    this.entries.forEach((e, id) => {
      if (e.status !== 'saved' || e.uncertain || e.pending > 0 || e.timer) out.push(id);
    });
    return out;
  }

  hasUnsaved(): boolean {
    return this.unsavedIds().length > 0;
  }

  failedIds(): string[] {
    const out: string[] = [];
    this.entries.forEach((e, id) => {
      if (e.status === 'error' || e.status === 'conflict') out.push(id);
    });
    return out;
  }

  /** Why a side action must not run now, or null when it may. */
  blockedReason(id: string): string | null {
    const e = this.entries.get(id);
    if (!e) return 'This lesson is not loaded.';
    if (e.status === 'conflict') return 'Resolve the conflicting change on this lesson first.';
    if (e.uncertain) return 'Check the saved version of this lesson first (Retry save).';
    if (e.status === 'error') return 'This lesson has changes that were not saved. Retry the save first.';
    return null;
  }

  // ---- registration ----

  /**
   * Register the server row for a lesson. Creates the entry on first sight (restoring any unconfirmed
   * draft mirrored by an earlier page in this tab), or adopts a newer server row for a clean entry.
   * Never overwrites a dirty, failed, conflicted or uncertain draft.
   */
  track(row: PersistedLesson): LessonSaveSnapshot {
    const existing = this.entries.get(row.id);
    if (existing) {
      const clean = existing.status === 'saved' && !existing.uncertain && existing.pending === 0 && !existing.timer;
      if (clean && (!sameVersion(existing.version, versionOf(row)) || !sameFields(existing.server, fieldsOf(row)))) {
        existing.server = fieldsOf(row);
        existing.version = versionOf(row);
        existing.draft = fieldsOf(row);
        existing.revision += 1;
        this.emit(existing, row.id);
      }
      return existing.snapshot;
    }

    const entry: Entry = {
      server: fieldsOf(row),
      version: versionOf(row),
      draft: fieldsOf(row),
      status: 'saved',
      error: null,
      uncertain: false,
      outstanding: [],
      needsFence: false,
      conflictWith: null,
      recovered: false,
      mirrorOk: !!this.storage && this.scope !== '',
      revision: 0,
      tail: Promise.resolve(),
      pending: 0,
      timer: null,
      snapshot: null as unknown as LessonSaveSnapshot,
    };
    entry.snapshot = this.buildSnapshot(row.id, entry);
    this.entries.set(row.id, entry);

    const stored = this.readStored(row.id);
    if (stored && (stored.uncertain || (stored.outstanding?.length ?? 0) > 0)) {
      // An earlier document sent a write whose outcome is unknown; it may still commit. Restore the exact
      // settlement state, even if the fetched row equals the draft: equality is not settlement. The next
      // save reconciles (identity-gated) and fences before anything is called saved or the mirror removed.
      entry.server = stored.confirmed ?? fieldsOf(row);
      entry.version = stored.base;
      entry.draft = stored.draft;
      entry.outstanding = stored.outstanding ?? [];
      entry.uncertain = true;
      entry.recovered = true;
      entry.status = 'dirty';
      if (!stored.confirmed) {
        entry.status = 'conflict';
        entry.conflictWith = { id: row.id, ...fieldsOf(row), updated_at: row.updated_at };
        entry.error =
          'Unsaved changes from your last visit were restored, but this lesson may have changed since. Choose which version to keep.';
      } else {
        this.schedule(row.id, entry);
      }
      this.claim(row.id, entry);
    } else if (stored && !sameFields(stored.draft, entry.draft)) {
      entry.draft = stored.draft;
      entry.recovered = true;
      if (!sameVersion(stored.base, entry.version)) {
        // The lesson changed since the draft was taken, or one of the two versions is unavailable.
        entry.status = 'conflict';
        entry.conflictWith = { id: row.id, ...fieldsOf(row), updated_at: row.updated_at };
        entry.error =
          'Unsaved changes from your last visit were restored, but this lesson may have changed since. Choose which version to keep.';
      } else {
        entry.status = 'dirty';
        this.schedule(row.id, entry);
      }
      this.claim(row.id, entry);
    } else if (stored) {
      try {
        this.storage?.removeItem(this.key(row.id));
      } catch {
        /* ignore */
      }
    }
    entry.snapshot = this.buildSnapshot(row.id, entry);
    this.emit();
    return entry.snapshot;
  }

  // ---- chain ----
  private enqueue<T>(id: string, e: Entry, op: () => Promise<T>, whenForgotten: T): Promise<T> {
    e.pending += 1;
    const p = e.tail.then(() => (this.entries.get(id) === e ? op() : whenForgotten));
    e.tail = p.then(
      () => undefined,
      () => undefined,
    );
    p.then(
      () => this.settle(id, e),
      () => this.settle(id, e),
    );
    return p;
  }

  private settle(id: string, e: Entry) {
    e.pending -= 1;
    if (this.entries.get(id) === e) {
      this.mirror(id, e);
      this.emit(e, id);
    }
  }

  // ---- owner execution ----

  /** True when this queue may perform a network operation (or notify) for its owner right now. */
  private async mayAct(): Promise<boolean> {
    if (this.suspended) return false;
    if (!this.currentUserId) return true;
    let who: string | null = null;
    try {
      who = await this.currentUserId();
    } catch {
      who = null;
    }
    if (who !== this.ownerId) {
      this.suspend();
      return false;
    }
    return !this.suspended;
  }

  private async notifyFailed(id: string, e: Entry) {
    if (!(await this.mayAct())) return; // never show one user's lesson title to another user
    if (this.entries.get(id) === e) this.handlers.onFailed?.(id, e.snapshot);
  }

  /** Stop all network activity and notifications, keeping every draft and mirror (owner signed out). */
  suspend() {
    if (this.suspended) return;
    this.suspended = true;
    this.entries.forEach((e, id) => {
      if (e.timer) {
        clearTimeout(e.timer);
        e.timer = null;
        if (e.status === 'saved') e.status = 'dirty';
      }
      this.mirror(id, e);
    });
    this.emit();
  }

  /** The owner is back: resume, and re-arm saves for drafts that were waiting. */
  resume() {
    if (!this.suspended) return;
    this.suspended = false;
    this.entries.forEach((e, id) => {
      if (e.status === 'saving' && e.pending === 0) e.status = 'dirty';
      if (e.status === 'dirty') this.schedule(id, e);
      e.snapshot = this.buildSnapshot(id, e);
    });
    this.emit();
  }

  isSuspended() {
    return this.suspended;
  }

  private fail(id: string, e: Entry, err: unknown, send?: Send) {
    const drop = () => {
      if (!send) return;
      const i = e.outstanding.indexOf(send);
      if (i >= 0) e.outstanding.splice(i, 1);
    };
    if (isConflict(err)) {
      drop(); // refused by its condition: it did not and cannot apply
      const cur = (err as any).current as PersistedLesson;
      e.status = 'conflict';
      e.conflictWith = { ...cur, ...fieldsOf(cur) };
      e.error =
        'This lesson was changed somewhere else (for example in another tab) after you opened it. Your draft is kept. Choose which version to keep.';
    } else if (isDefinitive(err)) {
      drop();
      e.status = 'error';
      e.error = describeSaveError(err);
    } else {
      e.status = 'error';
      e.uncertain = true; // the send stays outstanding (it was recorded before it left)
      e.error = `${describeSaveError(err)} ${UNCERTAIN_MESSAGE}`;
    }
    this.mirror(id, e);
    this.emit(e, id);
    void this.notifyFailed(id, e);
  }

  private markConflict(id: string, e: Entry, row: PersistedLesson, message: string) {
    e.status = 'conflict';
    e.conflictWith = { ...row, ...fieldsOf(row) };
    e.error = message;
    this.mirror(id, e);
    this.emit(e, id);
    void this.notifyFailed(id, e);
  }

  /**
   * Authoritative read after an uncertain write or an unavailable version. True when writing may continue
   * (possibly with a fence pending); false when the lesson is now conflicted, failed or suspended.
   */
  private async reconcile(id: string, e: Entry): Promise<boolean> {
    if (!(await this.mayAct())) return false;
    let row: PersistedLesson | null;
    try {
      row = await this.read(id);
    } catch (err) {
      if (this.entries.get(id) !== e) return false;
      e.status = 'error';
      e.uncertain = true;
      e.error = `Could not read the saved version of this lesson: ${describeSaveError(err)} ${UNCERTAIN_MESSAGE}`;
      this.emit(e, id);
      return false;
    }
    if (this.entries.get(id) !== e) return false;
    if (!row || row.id !== id) {
      e.status = 'error';
      e.error = 'This lesson no longer exists or you no longer have access to it. Your draft is kept here.';
      this.emit(e, id);
      return false;
    }
    if (row.updated_at === undefined) {
      e.status = 'error';
      e.error = 'The server did not report this lesson\u2019s version, so the save was refused rather than written unconditionally.';
      this.emit(e, id);
      return false;
    }
    const rowFields = fieldsOf(row);
    const rowVersion = row.updated_at;
    const live = e.outstanding.some((o) => o.expected === rowVersion);
    if (live) {
      // An unknown send is conditioned on the CURRENT version and may still commit. Reading the old base is
      // not settlement: keep the lesson uncertain and write the current intent as a fence on this version.
      if (!sameFields(rowFields, e.server)) {
        this.markConflict(id, e, row, CHANGED_MESSAGE);
        return false;
      }
      e.version = { known: true, value: rowVersion };
      e.needsFence = true;
      this.mirror(id, e);
      return true;
    }
    // The version moved past every outstanding send, so none of them can still commit.
    const ours = sameFields(rowFields, e.server) || e.outstanding.some((o) => sameFields(rowFields, o.fields));
    if (!ours) {
      e.uncertain = false;
      e.outstanding = [];
      this.markConflict(id, e, row, CHANGED_MESSAGE);
      return false;
    }
    e.server = rowFields;
    e.version = { known: true, value: rowVersion };
    e.uncertain = false;
    e.outstanding = [];
    e.needsFence = false;
    this.mirror(id, e);
    this.handlers.onPersisted?.({ ...row, ...rowFields });
    return true;
  }

  /** Bring the server to the latest draft. Runs ON the chain. */
  private async syncDraft(id: string, e: Entry, opts: { retry: boolean }): Promise<boolean> {
    if (e.status === 'conflict') return false;
    if (e.status === 'error' && !opts.retry) return false; // a failure is reported, not silently re-sent
    if (e.uncertain || !e.version.known) {
      if (e.status === 'error') {
        e.status = 'saving';
        this.emit(e, id);
      }
      if (!(await this.reconcile(id, e))) {
        if (e.status === 'saving') e.status = e.uncertain ? 'error' : 'dirty';
        this.emit(e, id);
        return false;
      }
    }
    while (!sameFields(e.draft, e.server) || e.needsFence) {
      if (!(await this.mayAct()) || this.entries.get(id) !== e) {
        if (e.status === 'saving') e.status = e.uncertain ? 'error' : 'dirty';
        this.emit(e, id);
        return false;
      }
      const sent = { ...e.draft };
      const expected = (e.version as { value: string | null }).value;
      const send: Send = { fields: sent, expected };
      e.status = 'saving';
      e.error = null;
      // Write-ahead: the send is recorded as outstanding in the mirror BEFORE it leaves, so a reload or crash
      // while it is in flight still knows it may commit.
      e.outstanding.push(send);
      this.mirror(id, e);
      this.emit(e, id);
      let row: PersistedLesson;
      try {
        row = await this.persist(id, sent, expected);
      } catch (err) {
        if (this.entries.get(id) !== e) return false;
        this.fail(id, e, err, send);
        return false;
      }
      if (this.entries.get(id) !== e) return false;
      if (!row || row.id !== id || !sameFields(fieldsOf(row), sent) || row.updated_at === undefined) {
        this.fail(id, e, new Error('The server response did not confirm this save.'), send);
        return false;
      }
      // A conditional write committed at a NEW version: every outstanding send is now fenced out.
      e.server = fieldsOf(row);
      e.version = versionOf(row);
      e.outstanding = [];
      e.needsFence = false;
      e.uncertain = false;
      e.recovered = false;
      this.mirror(id, e); // keep the mirror's base on the confirmed version while newer edits queue
      this.handlers.onPersisted?.({ ...row, ...e.server });
    }
    e.status = 'saved';
    e.error = null;
    this.emit(e, id);
    return true;
  }

  // ---- edits and flushes ----

  /** Record an edit from the editor and schedule a debounced save. */
  edit(id: string, draft: LessonFields) {
    const e = this.entries.get(id);
    if (!e) return;
    e.draft = fieldsOf(draft);
    if (e.status === 'conflict') {
      this.mirror(id, e);
      this.emit(e, id);
      return;
    }
    const certainlySaved = !e.uncertain && e.version.known && sameFields(e.draft, e.server) && e.pending === 0;
    if (certainlySaved) {
      if (e.timer) clearTimeout(e.timer);
      e.timer = null;
      e.status = 'saved';
      e.error = null;
    } else {
      if (e.status !== 'saving') e.status = 'dirty';
      if (e.status === 'dirty') e.error = null;
      this.schedule(id, e);
    }
    this.mirror(id, e);
    this.emit(e, id);
  }

  private schedule(id: string, e: Entry) {
    if (e.timer) clearTimeout(e.timer);
    e.timer = setTimeout(() => {
      e.timer = null;
      // A typed edit after a failure is a new intent: it may retry (an uncertain lesson reconciles first).
      void this.enqueue(id, e, () => this.syncDraft(id, e, { retry: true }), true);
    }, this.debounceMs);
  }

  /** Send the latest draft now (skipping the debounce). Resolves true only when confirmed. */
  flush(id: string): Promise<boolean> {
    const e = this.entries.get(id);
    if (!e) return Promise.resolve(true);
    const hadTimer = !!e.timer;
    if (e.timer) {
      clearTimeout(e.timer);
      e.timer = null;
    }
    // A pending debounce means the author typed after any failure: treat as a retry, as the timer would.
    return this.enqueue(id, e, () => this.syncDraft(id, e, { retry: hadTimer && e.status !== 'conflict' }), true);
  }

  retry(id: string): Promise<boolean> {
    const e = this.entries.get(id);
    if (!e) return Promise.resolve(true);
    if (e.timer) {
      clearTimeout(e.timer);
      e.timer = null;
    }
    return this.enqueue(id, e, () => this.syncDraft(id, e, { retry: true }), true);
  }

  async flushAll(): Promise<boolean> {
    const ids = Array.from(this.entries.keys());
    const results = await Promise.all(ids.map((id) => this.flush(id)));
    return results.every(Boolean);
  }

  retryFailed(): Promise<boolean[]> {
    const ids: string[] = [];
    this.entries.forEach((e, id) => {
      if (e.status === 'error') ids.push(id);
    });
    return Promise.all(ids.map((id) => this.retry(id)));
  }

  // ---- side actions, on the same chain ----

  /**
   * Rename = a title edit plus an immediate save, in issue order with every other write for the lesson.
   * Refused (no write, draft unchanged) while the lesson is failed, conflicted or uncertain.
   */
  async rename(id: string, title: string): Promise<{ ok: boolean; reason?: string }> {
    const reason = this.blockedReason(id);
    if (reason) return { ok: false, reason };
    const e = this.entries.get(id)!;
    this.edit(id, { ...e.draft, title });
    if (e.timer) {
      clearTimeout(e.timer);
      e.timer = null;
    }
    // retry:false: if an earlier write on this lesson fails before this turn, the rename does NOT re-send
    // the failed draft; it stays in the draft, shown as not saved, until the author retries.
    const ok = await this.enqueue(id, e, () => this.syncDraft(id, e, { retry: false }), true);
    return ok ? { ok } : { ok, reason: this.entries.get(id)?.error ?? 'The rename was not saved.' };
  }

  /**
   * A non-draft write (publish toggle). Waits for the lesson's pending draft save on the chain; runs only
   * if that save is confirmed and the lesson is not failed/conflicted/uncertain; is conditional on the
   * confirmed version; and must return a row whose title/body still equal the confirmed ones.
   */
  sideWrite(id: string, write: SideWrite): Promise<{ ok: boolean; row?: PersistedLesson; reason?: string }> {
    const e = this.entries.get(id);
    const early = this.blockedReason(id);
    if (!e || early) return Promise.resolve({ ok: false, reason: early ?? 'This lesson is not loaded.' });
    if (e.timer) {
      clearTimeout(e.timer);
      e.timer = null;
    }
    return this.enqueue(
      id,
      e,
      async () => {
        const blocked = this.blockedReason(id);
        if (blocked) return { ok: false, reason: blocked };
        if (!(await this.syncDraft(id, e, { retry: false }))) {
          return { ok: false, reason: e.error ?? 'The lesson’s changes were not saved.' };
        }
        if (!(await this.mayAct())) return { ok: false, reason: 'You are no longer signed in as the author of this change.' };
        const expected = (e.version as { value: string | null }).value;
        const send: Send = { fields: { ...e.server }, expected };
        e.outstanding.push(send);
        this.mirror(id, e);
        let row: PersistedLesson;
        try {
          row = await write(expected);
        } catch (err) {
          if (this.entries.get(id) !== e) return { ok: false, reason: 'Lesson removed.' };
          this.fail(id, e, err, send);
          return { ok: false, reason: e.error ?? 'Not changed.' };
        }
        if (this.entries.get(id) !== e) return { ok: false, reason: 'Lesson removed.' };
        if (!row || row.id !== id || !sameFields(fieldsOf(row), e.server) || row.updated_at === undefined) {
          this.fail(id, e, new Error('The server response did not confirm this change.'), send);
          return { ok: false, reason: e.error ?? 'Not confirmed.' };
        }
        e.version = versionOf(row);
        e.outstanding = [];
        this.mirror(id, e);
        this.emit(e, id);
        return { ok: true, row };
      },
      { ok: false, reason: 'Lesson removed.' },
    );
  }

  // ---- author decisions ----

  resolveConflict(id: string, choice: 'keepMine' | 'useTheirs'): Promise<boolean> {
    const e = this.entries.get(id);
    if (!e || e.status !== 'conflict' || !e.conflictWith) return Promise.resolve(false);
    const current = e.conflictWith;
    e.conflictWith = null;
    e.error = null;
    e.server = fieldsOf(current);
    e.version = versionOf(current);
    // A send of ours conditioned on this exact version could still commit over the chosen version.
    const live = e.version.known && e.outstanding.some((o) => o.expected === (e.version as { value: string | null }).value);
    if (!live) {
      e.outstanding = [];
      e.uncertain = false;
    }
    if (choice === 'useTheirs') {
      e.draft = fieldsOf(current);
      e.recovered = false;
      e.revision += 1;
      if (!live) {
        e.status = 'saved';
        this.mirror(id, e);
        this.emit(e, id);
        this.handlers.onPersisted?.({ ...current, ...e.server });
        return Promise.resolve(true);
      }
      e.needsFence = true; // confirm "theirs" with a conditional write before calling it saved
    }
    e.status = 'dirty';
    this.emit(e, id);
    return this.retry(id);
  }

  /** Discard a restored draft and return to the confirmed server row (not allowed while uncertain). */
  discard(id: string) {
    const e = this.entries.get(id);
    if (!e || e.pending > 0 || e.uncertain || !e.version.known) return;
    if (e.timer) clearTimeout(e.timer);
    e.timer = null;
    e.draft = { ...e.server };
    e.status = 'saved';
    e.error = null;
    e.conflictWith = null;
    e.recovered = false;
    e.revision += 1;
    this.mirror(id, e);
    this.emit(e, id);
  }

  forget(id: string) {
    const e = this.entries.get(id);
    if (!e) return;
    if (e.timer) clearTimeout(e.timer);
    this.entries.delete(id);
    try {
      const stored = this.readStored(id);
      if (!stored || stored.owner === this.instanceId) this.storage?.removeItem(this.key(id));
    } catch {
      /* ignore */
    }
    this.emit();
  }

  cancelTimers() {
    this.entries.forEach((e) => {
      if (e.timer) clearTimeout(e.timer);
      e.timer = null;
    });
  }
}

// ---- one queue per (user, course) for the lifetime of the tab ----
const registry = new Map<string, LessonSaveQueue>();

/**
 * A remounted builder must reuse the queue that still owns in-flight writes, otherwise two queues could
 * race on the same lesson and the same mirror. The key MUST include the signed-in user.
 */
export function getSharedLessonSaveQueue(key: string, create: () => LessonSaveQueue): LessonSaveQueue {
  let q = registry.get(key);
  if (!q) {
    q = create();
    registry.set(key, q);
  }
  return q;
}

/**
 * Suspend every shared queue that does not belong to `activeUserId` (same-tab sign-out / sign-in). This is
 * a second line of defence: each queue also checks the session user before every network operation.
 * Suspended queues keep their drafts and mirrors for their owner's return.
 */
export function suspendForeignLessonSaveQueues(activeUserId: string | null) {
  const own = activeUserId ? `${activeUserId}:` : null;
  registry.forEach((q, k) => {
    if (!own || !k.startsWith(own)) q.suspend();
  });
}

/** Test-only: forget every shared queue (simulates a fresh page). */
export function __resetSharedLessonSaveQueues() {
  registry.forEach((q) => q.cancelTimers());
  registry.clear();
}

/** Subscribe a component to one lesson's save state. */
export function useLessonSaveState(queue: LessonSaveQueue, id: string | null | undefined): LessonSaveSnapshot | null {
  const read = () => (id ? queue.get(id) : null);
  return useSyncExternalStore(queue.subscribe, read, read);
}
