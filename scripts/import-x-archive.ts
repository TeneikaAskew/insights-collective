// ABOUTME: Loads an X (Twitter) data-archive export into both tables the site
// ABOUTME: renders tweets from — public.tweets (the /teneika-tweets page) and
// ABOUTME: public.resources (Resources -> Top Tweets). This is the no-API-key route
// ABOUTME: for refreshing both sections: request the archive from X, unzip it, run
// ABOUTME: this. Re-running is safe; both writes upsert on tweet_id.
// ABOUTME: Usage: npm run import:x-archive -- <archive-dir> [--dry-run] [--limit N]
//
// GETTING THE ARCHIVE
//
//   x.com -> Settings -> Your account -> Download an archive of your data
//
// X emails a zip within a few hours to a couple of days. Unzip it and point this
// script at either the unzipped root or its `data/` directory; it finds
// `data/tweets.js` and any `tweets-part1.js`, `-part2.js`, ... beside it.
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
// Migration 20260818000000_resources_tweet_id_unique must be applied first — it
// adds the conflict target the resources upsert names. Apply it through
// db-migrate.yml, never the Supabase MCP (see CLAUDE.md).

import { readFile, readdir, stat } from 'node:fs/promises';
import { join, resolve, basename } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import {
  parseArchiveJs,
  toTweetRow,
  toResourceRow,
  tweetId,
  isRetweet,
  isReply,
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

const archivePath = positional[0];
const dryRun = flags.has('--dry-run');
const skipRetweets = flags.has('--skip-retweets');
const skipReplies = flags.has('--skip-replies');
const limitRaw = flags.get('--limit');
const limit = limitRaw === undefined ? Infinity : Number(limitRaw);
const createdBy = flags.get('--created-by') || DEFAULT_CREATED_BY;
const only = flags.get('--only');

if (!archivePath) {
  console.error(
    'Usage: npm run import:x-archive -- <archive-dir> [--dry-run] [--limit N]\n' +
      '                                 [--only tweets|resources] [--skip-retweets] [--skip-replies]\n' +
      '                                 [--created-by <uuid>]\n\n' +
      '<archive-dir> is the unzipped X archive, or its data/ directory.',
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

/**
 * Locate the archive's tweet files. X splits large exports across
 * tweets.js, tweets-part1.js, tweets-part2.js, ... — importing only the first
 * would silently drop most of the account's history, so all parts are collected.
 */
async function findTweetFiles(inputPath: string): Promise<string[]> {
  const root = resolve(process.cwd(), inputPath);

  const info = await stat(root).catch(() => null);
  if (!info) throw new Error(`No such path: ${root}`);

  // A file was passed directly — use it as-is.
  if (info.isFile()) return [root];

  // Accept either the archive root (which holds data/) or the data/ dir itself.
  const dataDir = (await stat(join(root, 'data')).catch(() => null))?.isDirectory()
    ? join(root, 'data')
    : root;

  const entries = await readdir(dataDir);
  // Order by part number so the base tweets.js leads. Plain string sort puts
  // "tweets-part1.js" ahead of "tweets.js" ('-' < '.'), which only matters when
  // --limit truncates the run, but a limited import that silently starts midway
  // through the account's history is a confusing thing to hand someone.
  const partNumber = (name: string): number =>
    Number(/-part(\d+)\.js$/i.exec(name)?.[1] ?? 0);

  const matches = entries
    .filter((name) => /^tweets(-part\d+)?\.js$/i.test(name))
    .sort((a, b) => partNumber(a) - partNumber(b))
    .map((name) => join(dataDir, name));

  if (matches.length === 0) {
    throw new Error(
      `No tweets.js found in ${dataDir}. Point this at the unzipped X archive ` +
        'or its data/ directory.',
    );
  }

  return matches;
}

let files: string[];
try {
  files = await findTweetFiles(archivePath);
} catch (error) {
  // A wrong path is the most likely way to run this, so it gets a plain message
  // rather than a stack trace.
  console.error((error as Error).message);
  process.exit(1);
}

console.log(`Reading ${files.length} archive file(s):`);

const rawTweets: ArchiveTweet[] = [];
for (const file of files) {
  const parsed = parseArchiveJs(await readFile(file, 'utf8'));
  console.log(`  ${basename(file)}: ${parsed.length} tweets`);
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

if (dryRun) {
  console.log('\n--dry-run: nothing written. Sample rows:');
  console.log('public.tweets    ', JSON.stringify(tweetRows[0], null, 2));
  console.log('public.resources ', JSON.stringify(resourceRows[0], null, 2));
  process.exit(0);
}

if (selected.length === 0) {
  console.log('\nNothing to import.');
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
