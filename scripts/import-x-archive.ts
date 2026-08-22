// ABOUTME: Loads an X (Twitter) data-archive export into both tables the site
// ABOUTME: renders tweets from — public.tweets (the /teneika-tweets page) and
// ABOUTME: public.resources (Resources -> Top Tweets). This is the no-API-key route
// ABOUTME: for refreshing both sections: request the archive from X, point this at
// ABOUTME: the zip. Re-running is safe; both writes upsert on tweet_id.
// ABOUTME: Usage: npm run import:x-archive -- <archive.zip|tweets.js|dir> [--dry-run]
//
// GETTING THE ARCHIVE
//
//   x.com -> Settings -> Your account -> Download an archive of your data
//
// X emails a zip within a few hours to a couple of days. Any of these work, and
// several can be passed at once:
//
//   twitter-archive.zip   read in place — no unzipping, no uploading anywhere
//   tweets.js             a single tweet file; sibling tweets-part*.js in the
//                         same folder are swept in (see readSingleFile)
//   <folder>              an unzipped archive, or its data/ folder
//
// The script runs on your own machine and writes to the database over the
// network; the archive never leaves the machine. The rest of it — direct
// messages, contacts, ad-interest data — is never opened, because only files
// matching TWEET_FILE are read.
//
// CREDENTIALS
//
// Needs a service-role key. Both tables have RLS on, and writing them is
// deliberately not something a browser role can do:
//
//   export SUPABASE_URL=https://<project-ref>.supabase.co
//   export SUPABASE_SERVICE_ROLE_KEY=<service role key>
//
// Never commit that key or pass it on the command line, where it lands in shell
// history.
//
// PREREQUISITE
//
// The resources upsert needs a unique index on tweet_id as its conflict target:
// 20260818000000 added one, and 20260822000000 replaced it with a NON-PARTIAL
// index because PostgREST emits a bare ON CONFLICT (tweet_id), which cannot infer
// a partial one. A fresh database (a branch, a local stack) needs both, applied
// through db-migrate.yml — see CLAUDE.md.

import { readFile, readdir, stat } from 'node:fs/promises';
import { join, resolve, basename, dirname } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import {
  parseArchiveJs,
  toTweetRow,
  toResourceRow,
  tweetId,
  isRetweet,
  isReply,
  selectTweetFiles,
  partNumber,
  TWEET_FILE,
  ARCHIVE_USERNAME,
  type ArchiveTweet,
} from '../src/utils/xArchive';

/** Rows per upsert. Large enough to be fast, small enough to keep bodies sane. */
const CHUNK = 500;

/**
 * Every existing tweet row in public.resources carries this created_by, so imported
 * rows match rather than arriving ownerless. Override with --created-by if the
 * archive belongs to a different account.
 */
const DEFAULT_CREATED_BY = '47cf8181-c9a4-4cb9-8aa4-d6967e128c36';

const argv = process.argv.slice(2);

/** Flags that consume the next argument — everything else positional is the path. */
const VALUED_FLAGS = new Set(['--limit', '--created-by', '--only']);

const flags = new Map<string, string>();
const positional: string[] = [];

for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i];
  if (VALUED_FLAGS.has(arg)) {
    flags.set(arg, argv[i + 1]);
    i += 1;
  } else if (arg.startsWith('--')) {
    flags.set(arg, '');
  } else {
    positional.push(arg);
  }
}

// Several paths are allowed at once so a split export can be passed as
// `tweets.js tweets-part1.js` without unzipping or moving anything.
const archivePaths = positional;
const dryRun = flags.has('--dry-run');
const skipRetweets = flags.has('--skip-retweets');
const skipReplies = flags.has('--skip-replies');
const limitRaw = flags.get('--limit');
const limit = limitRaw === undefined ? Infinity : Number(limitRaw);
const createdBy = flags.get('--created-by') || DEFAULT_CREATED_BY;
const only = flags.get('--only');

if (archivePaths.length === 0) {
  console.error(
    'Usage: npm run import:x-archive -- <archive.zip|tweets.js|dir> [...more]\n' +
      '                                 [--dry-run] [--limit N] [--only tweets|resources]\n' +
      '                                 [--skip-retweets] [--skip-replies] [--created-by <uuid>]\n\n' +
      'Any of these work:\n' +
      '  twitter-archive.zip     the zip X emailed you, read in place — no unzipping\n' +
      '  tweets.js               a single tweet file; sibling tweets-part*.js are\n' +
      '                          picked up automatically from the same folder\n' +
      '  <folder>                an unzipped archive, or its data/ directory',
  );
  process.exit(1);
}

if (only && only !== 'tweets' && only !== 'resources') {
  console.error(`--only takes "tweets" or "resources", got "${only}".`);
  process.exit(1);
}

if (limitRaw !== undefined && (!Number.isFinite(limit) || limit <= 0)) {
  console.error(`--limit takes a positive number, got "${limitRaw}".`);
  process.exit(1);
}

const writeTweets = only !== 'resources';
const writeResources = only !== 'tweets';

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!dryRun && (!supabaseUrl || !serviceKey)) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (or pass --dry-run).');
  process.exit(1);
}

/** One tweet file pulled out of the archive, already decoded to text. */
interface ArchiveFile {
  /** Display name, e.g. "tweets-part1.js". */
  name: string;
  /** Stable identity for deduping: absolute path on disk, or zip path. */
  key: string;
  text: string;
}

/**
 * Read the archive's tweet files, from either the .zip X emails you or an
 * unzipped copy of it. X splits large exports across tweets.js, tweets-part1.js,
 * tweets-part2.js, ... — importing only the first would silently drop most of the
 * account's history, so every part is collected.
 *
 * Note what this does NOT touch. An X archive also contains your direct messages,
 * your contacts, your ad-interest profile and more; only files matching
 * TWEET_FILE are ever opened, so nothing else can reach the database by accident.
 */
async function readArchiveFiles(inputPath: string, sweepSiblings: boolean): Promise<ArchiveFile[]> {
  const root = resolve(process.cwd(), inputPath);

  const info = await stat(root).catch(() => null);
  if (!info) throw new Error(`No such path: ${root}`);

  if (info.isFile() && /\.zip$/i.test(root)) return readFromZip(root);
  if (info.isFile()) return readSingleFile(root, sweepSiblings);

  // Accept either the archive root (which holds data/) or the data/ dir itself.
  const dataDir = (await stat(join(root, 'data')).catch(() => null))?.isDirectory()
    ? join(root, 'data')
    : root;

  const matches = await tweetFilesIn(dataDir);

  if (matches.length === 0) {
    throw new Error(
      `No tweets.js found in ${dataDir}. Point this at the .zip X sent you, ` +
        'a tweets.js file, the unzipped archive, or its data/ directory.',
    );
  }

  return Promise.all(
    matches.map(async (name) => ({
      name,
      key: join(dataDir, name),
      text: await readFile(join(dataDir, name), 'utf8'),
    })),
  );
}

/** Tweet files in a directory, ordered so the base tweets.js leads. */
async function tweetFilesIn(dir: string): Promise<string[]> {
  return selectTweetFiles(await readdir(dir).catch(() => [] as string[]));
}

/**
 * A single file was named. Read it — and, when it is the archive's `tweets.js`,
 * pull in the `tweets-part*.js` files sitting beside it.
 *
 * That sweep is the point of this function. X splits a large export across
 * numbered parts, and naming just `tweets.js` is the obvious thing to do; without
 * the sweep that quietly imports the first slice of the account's history and
 * reports success, which is a far worse outcome than an error. Files the caller
 * listed explicitly are left alone — see the dedupe in the caller.
 */
async function readSingleFile(filePath: string, sweepSiblings: boolean): Promise<ArchiveFile[]> {
  const name = basename(filePath);
  const dir = dirname(filePath);

  if (!TWEET_FILE.test(name)) {
    // Not fatal: people rename downloads ("tweets (1).js"). But an X archive also
    // contains direct-messages.js, like.js and a dozen other window.YTD files that
    // would parse into nonsense rows, so say what was expected before going on.
    console.warn(
      `Warning: "${name}" is not named like an X tweet file (tweets.js, ` +
        'tweets-part1.js, ...). Reading it anyway; check the counts below.',
    );
    return [{ name, key: filePath, text: await readFile(filePath, 'utf8') }];
  }

  const siblings = sweepSiblings ? (await tweetFilesIn(dir)).filter((other) => other !== name) : [];
  if (siblings.length > 0) {
    console.log(
      `Also found beside ${name}: ${siblings.join(', ')} — including ` +
        '(pass the files you want individually to override).',
    );
  }

  const chosen = [name, ...siblings].sort((a, b) => partNumber(a) - partNumber(b));
  return Promise.all(
    chosen.map(async (each) => ({
      name: each,
      key: join(dir, each),
      text: await readFile(join(dir, each), 'utf8'),
    })),
  );
}

/**
 * Above this, refuse the zip and point at the unzipped directory instead.
 *
 * JSZip has no streaming reader, so the whole archive is materialised in memory
 * before the few megabytes of tweet text can be picked out of it. That is fine
 * for a text-heavy export and bad for a media-heavy one, and this path exists
 * precisely to support large archives. The directory path reads only the
 * matching .js files and never holds the media at all, so there is a real answer
 * to give rather than an out-of-memory crash halfway through.
 */
const MAX_ZIP_BYTES = 1_500_000_000;

/**
 * Pull the tweet files straight out of the .zip so nobody has to unzip a
 * multi-gigabyte archive (nearly all of which is media this import never reads)
 * just to load a few megabytes of text.
 */
async function readFromZip(zipPath: string): Promise<ArchiveFile[]> {
  const { size } = await stat(zipPath);
  if (size > MAX_ZIP_BYTES) {
    const gb = (size / 1_000_000_000).toFixed(1);
    throw new Error(
      `${basename(zipPath)} is ${gb} GB, too large to open in memory. ` +
        'Unzip it and pass the folder (or its data/ directory) instead — that ' +
        'reads only tweets.js and its parts, and never touches the media.',
    );
  }

  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(await readFile(zipPath));

  const entries = Object.values(zip.files).filter(
    (entry) => !entry.dir && TWEET_FILE.test(basename(entry.name)),
  );

  if (entries.length === 0) {
    throw new Error(
      `No data/tweets.js inside ${basename(zipPath)}. Is this the X archive zip? ` +
        'It should contain a data/ folder with tweets.js in it.',
    );
  }

  entries.sort((a, b) => partNumber(basename(a.name)) - partNumber(basename(b.name)));

  return Promise.all(
    entries.map(async (entry) => ({
      name: basename(entry.name),
      key: `${zipPath}!${entry.name}`,
      text: await entry.async('string'),
    })),
  );
}

let files: ArchiveFile[];
try {
  // Sweep for sibling parts only when a single path was named. If the caller
  // listed files themselves, that list is the instruction — sweeping on top of it
  // would re-read the very files they just enumerated.
  const sweepSiblings = archivePaths.length === 1;
  const collected = await Promise.all(
    archivePaths.map((path) => readArchiveFiles(path, sweepSiblings)),
  );

  // Dedupe by resolved identity, not by basename: two different archives can each
  // hold a "tweets.js", and both should be read.
  const seenFiles = new Set<string>();
  files = collected.flat().filter((file) => {
    const key = file.key;
    if (seenFiles.has(key)) return false;
    seenFiles.add(key);
    return true;
  });
} catch (error) {
  // A wrong path is the most likely way to run this, so it gets a plain message
  // rather than a stack trace.
  console.error((error as Error).message);
  process.exit(1);
}

console.log(`Reading ${files.length} archive file(s):`);

const rawTweets: ArchiveTweet[] = [];
for (const file of files) {
  let parsed: ArchiveTweet[];
  try {
    parsed = parseArchiveJs(file.text);
  } catch (error) {
    // Name the file. Pointing this at the wrong window.YTD file (like.js,
    // direct-messages.js) is an easy mistake once single files are accepted, and
    // a bare stack trace does not say which of several inputs was the bad one.
    console.error(`${file.name}: ${(error as Error).message}`);
    process.exit(1);
  }
  console.log(`  ${file.name}: ${parsed.length} entries`);
  rawTweets.push(...parsed);
}

const skipped = { noId: 0, badDate: 0, duplicate: 0, retweet: 0, reply: 0 };
const seen = new Set<string>();
const selected: ArchiveTweet[] = [];

for (const tweet of rawTweets) {
  if (selected.length >= limit) break;

  const id = tweetId(tweet);
  if (!id) {
    skipped.noId += 1;
    continue;
  }
  if (seen.has(id)) {
    // Overlapping part files repeat tweets; the DB upsert would collapse them
    // anyway, but deduping here keeps the reported counts honest.
    skipped.duplicate += 1;
    continue;
  }
  if (skipRetweets && isRetweet(tweet)) {
    skipped.retweet += 1;
    continue;
  }
  if (skipReplies && isReply(tweet)) {
    skipped.reply += 1;
    continue;
  }
  // A row with no parseable date cannot be ordered, and both sections sort by
  // date — drop it rather than write a row that can never surface correctly.
  if (!toTweetRow(tweet)) {
    skipped.badDate += 1;
    continue;
  }

  seen.add(id);
  selected.push(tweet);
}

const tweetRows = selected.map((tweet) => toTweetRow(tweet)!);
const resourceRows = selected.map((tweet) => toResourceRow(tweet, createdBy)!);

console.log(
  `\nPrepared ${selected.length} tweets from ${rawTweets.length} archive entries ` +
    `(skipped ${skipped.noId} no id, ${skipped.badDate} unparseable date, ` +
    `${skipped.duplicate} duplicate, ${skipped.retweet} retweet, ${skipped.reply} reply)`,
);

if (selected.length > 0) {
  const dates = tweetRows.map((row) => row.tweeted_at).sort();
  console.log(`  range ${dates[0]} .. ${dates[dates.length - 1]}`);
  console.log(`  targets: ${[writeTweets && 'public.tweets', writeResources && 'public.resources'].filter(Boolean).join(', ')}`);
}

// Checked before the dry-run sample below, which would otherwise print
// "undefined" for a file that parsed but held no tweets — the shape you get from
// aiming this at the wrong window.YTD file.
if (selected.length === 0) {
  console.error(
    '\nNo tweets found. If you passed a single .js file, check it is the ' +
      "archive's tweets.js rather than another window.YTD file.",
  );
  process.exit(1);
}

if (dryRun) {
  console.log('\n--dry-run: nothing written. Sample rows:');
  console.log('public.tweets    ', JSON.stringify(tweetRows[0], null, 2));
  console.log('public.resources ', JSON.stringify(resourceRows[0], null, 2));
  process.exit(0);
}

const supabase = createClient(supabaseUrl!, serviceKey!, { auth: { persistSession: false } });

async function upsertAll(
  table: 'tweets' | 'resources',
  rows: Record<string, unknown>[],
  onConflict: string,
): Promise<void> {
  let written = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error } = await supabase.from(table).upsert(chunk, { onConflict });

    if (error) {
      console.error(`\npublic.${table} chunk at ${i} failed: ${error.message}`);
      console.error(`${written} rows were written before this point; re-running is safe.`);
      if (table === 'resources' && /no unique|constraint matching/i.test(error.message)) {
        console.error(
          'This looks like the missing conflict target: apply migration ' +
            '20260818000000_resources_tweet_id_unique via db-migrate.yml first.',
        );
      }
      process.exit(1);
    }

    written += chunk.length;
    if (written % 2000 === 0 || written === rows.length) {
      console.log(`  public.${table}: ${written}/${rows.length}`);
    }
  }
}

console.log('');
if (writeTweets) await upsertAll('tweets', tweetRows, 'tweet_id');
if (writeResources) await upsertAll('resources', resourceRows, 'tweet_id');

const { count: tweetsTotal } = await supabase
  .from('tweets')
  .select('tweet_id', { count: 'exact', head: true })
  .eq('author_username', ARCHIVE_USERNAME);

const { count: resourcesTotal } = await supabase
  .from('resources')
  .select('tweet_id', { count: 'exact', head: true })
  .not('tweet_id', 'is', null);

console.log(`\nDone.`);
console.log(`  public.tweets    now holds ${tweetsTotal ?? '?'} tweets for @${ARCHIVE_USERNAME}  -> /teneika-tweets`);
console.log(`  public.resources now holds ${resourcesTotal ?? '?'} tweet rows                 -> Resources > Top Tweets`);
