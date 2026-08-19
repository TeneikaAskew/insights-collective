// ABOUTME: Browser side of the admin X-archive upload. Opens the .zip (or a bare
// ABOUTME: tweets.js) locally, maps rows with the same pure functions the CLI
// ABOUTME: importer uses, and posts them to the import-x-archive Edge Function in
// ABOUTME: batches. The archive file itself is never uploaded.
//
// Reading the zip in the browser rather than posting it is the whole design. An X
// archive is usually gigabytes of media and also contains direct messages and
// contacts; only `data/tweets.js` and its numbered parts are ever opened, so
// nothing else can leave the machine, and the request bodies stay small.

import JSZip from 'jszip';
import { supabase } from '@/integrations/supabase/client';
import {
  parseArchiveJs,
  toTweetRow,
  toResourceRow,
  tweetId,
  selectTweetFiles,
  TWEET_FILE,
  type ArchiveTweet,
  type TweetRow,
  type ResourceRow,
} from '@/utils/xArchive';

/** Rows per request. Must stay at or under the Edge Function's own cap. */
const BATCH_SIZE = 500;

export interface ParsedArchive {
  /** Names of the tweet files actually read, in the order they were read. */
  files: string[];
  tweetRows: TweetRow[];
  resourceRows: ResourceRow[];
  /** Entries seen across all files, before dedupe and validation. */
  totalEntries: number;
  skipped: { noId: number; badDate: number; duplicate: number };
}

export interface ImportProgress {
  /** Rows sent so far, of `total`. */
  sent: number;
  total: number;
}

export interface ImportResult {
  tweetsWritten: number;
  resourcesWritten: number;
}

/** Thrown with a message worth showing the user verbatim. */
export class ArchiveError extends Error {}

/**
 * Read a File as text.
 *
 * `Blob.text()` is the obvious call and is what every current browser has, but it
 * is absent in older Safari and in jsdom, so the tests could not exercise this
 * path at all. FileReader is the universally available route; prefer the modern
 * one when it is there.
 */
function readAsText(file: Blob): Promise<string> {
  if (typeof file.text === 'function') return file.text();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the file'));
    reader.readAsText(file);
  });
}

/**
 * Read the tweet files out of whatever the admin dropped in — the archive zip, or
 * a single `tweets.js`.
 */
async function readFiles(file: File): Promise<{ name: string; text: string }[]> {
  if (/\.zip$/i.test(file.name)) {
    const zip = await JSZip.loadAsync(file).catch(() => {
      throw new ArchiveError(`${file.name} could not be opened as a zip.`);
    });

    const entries = Object.values(zip.files).filter(
      (entry) => !entry.dir && TWEET_FILE.test(entry.name.split('/').pop() ?? ''),
    );

    if (entries.length === 0) {
      throw new ArchiveError(
        `No data/tweets.js inside ${file.name}. Is this the X archive zip? ` +
          'It should contain a data/ folder with tweets.js in it.',
      );
    }

    // Same ordering rule as the CLI: base tweets.js first, then parts in numeric
    // order, so a partial read is never a random slice of history.
    const byName = new Map(entries.map((entry) => [entry.name.split('/').pop()!, entry]));
    const ordered = selectTweetFiles([...byName.keys()]);

    return Promise.all(
      ordered.map(async (name) => ({ name, text: await byName.get(name)!.async('string') })),
    );
  }

  return [{ name: file.name, text: await readAsText(file) }];
}

/**
 * Parse and map an archive file. Does not touch the network — the caller shows
 * the counts and asks for confirmation before `sendArchive` writes anything.
 */
export async function parseArchive(file: File, createdBy: string | null = null): Promise<ParsedArchive> {
  const files = await readFiles(file);

  const raw: ArchiveTweet[] = [];
  for (const each of files) {
    try {
      raw.push(...parseArchiveJs(each.text));
    } catch (error) {
      // Name the file: dropping the wrong window.YTD file (like.js,
      // direct-messages.js) is the likely mistake, and the bare parser message
      // does not say which file failed.
      throw new ArchiveError(`${each.name}: ${(error as Error).message}`);
    }
  }

  const skipped = { noId: 0, badDate: 0, duplicate: 0 };
  const seen = new Set<string>();
  const tweetRows: TweetRow[] = [];
  const resourceRows: ResourceRow[] = [];

  for (const entry of raw) {
    const id = tweetId(entry);
    if (!id) {
      skipped.noId += 1;
      continue;
    }
    if (seen.has(id)) {
      skipped.duplicate += 1;
      continue;
    }

    const tweetRow = toTweetRow(entry);
    const resourceRow = toResourceRow(entry, createdBy);
    if (!tweetRow || !resourceRow) {
      // Both mappers fail on the same condition — an unparseable date — and a row
      // with no date cannot be ordered, which is all either section does with it.
      skipped.badDate += 1;
      continue;
    }

    seen.add(id);
    tweetRows.push(tweetRow);
    resourceRows.push(resourceRow);
  }

  if (tweetRows.length === 0) {
    throw new ArchiveError(
      'No tweets found in that file. If you picked a single .js file, check it is ' +
        "the archive's tweets.js rather than another file from data/.",
    );
  }

  return {
    files: files.map((each) => each.name),
    tweetRows,
    resourceRows,
    totalEntries: raw.length,
    skipped,
  };
}

/**
 * Post the parsed rows to the Edge Function in batches.
 *
 * Batches are not a transaction. A failure part-way leaves the rows already sent
 * in place, which is safe precisely because every write upserts on tweet_id:
 * re-running finishes the job instead of duplicating it. The error says how far
 * it got so that is obvious.
 */
export async function sendArchive(
  parsed: ParsedArchive,
  onProgress?: (progress: ImportProgress) => void,
): Promise<ImportResult> {
  const total = parsed.tweetRows.length;
  const result: ImportResult = { tweetsWritten: 0, resourcesWritten: 0 };

  for (let i = 0; i < total; i += BATCH_SIZE) {
    const tweets = parsed.tweetRows.slice(i, i + BATCH_SIZE);
    const resources = parsed.resourceRows.slice(i, i + BATCH_SIZE);

    const { data, error } = await supabase.functions.invoke('import-x-archive', {
      body: { tweets, resources },
    });

    if (error) {
      throw new ArchiveError(
        `Import stopped after ${result.tweetsWritten} of ${total} tweets: ${error.message}. ` +
          'Re-running is safe — rows already written will be updated, not duplicated.',
      );
    }
    // The function returns 4xx/5xx as a body rather than throwing in every case.
    if (data && data.success !== true) {
      throw new ArchiveError(
        `Import stopped after ${result.tweetsWritten} of ${total} tweets: ` +
          `${data.error ?? 'unknown error'}. Re-running is safe.`,
      );
    }

    result.tweetsWritten += data?.tweetsWritten ?? tweets.length;
    result.resourcesWritten += data?.resourcesWritten ?? resources.length;
    onProgress?.({ sent: Math.min(i + BATCH_SIZE, total), total });
  }

  return result;
}
