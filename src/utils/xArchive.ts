// ABOUTME: Parses an X (Twitter) "Download an archive of your data" export and maps
// ABOUTME: each tweet onto the two tables the site already renders tweets from:
// ABOUTME: public.tweets (the /teneika-tweets archive page) and public.resources
// ABOUTME: (the Resources -> Top Tweets tab). Pure functions only — no filesystem,
// ABOUTME: no network, no env — so the CLI in scripts/import-x-archive.ts stays thin
// ABOUTME: and every mapping rule below is unit-testable.
//
// WHY AN ARCHIVE IMPORTER RATHER THAN THE API
//
// The scrape-teneika-tweets Edge Function already pulls the timeline from X's API
// and is still deployed, but it stopped producing rows in June 2025 and needs a
// paid X API credential to start again. The archive export is the zero-cost route:
// you request it from X, drop the zip here, and both sections catch up.
//
// SHAPE OF THE EXPORT
//
// The tweets live in `data/tweets.js` (plus `tweets-part1.js`, `-part2.js`, ... on
// large accounts). Each file is JavaScript, not JSON — it opens with an assignment
// that has to be stripped before the array parses:
//
//   window.YTD.tweets.part0 = [ { "tweet" : { ... } }, ... ]
//
// Inside, every count is a STRING ("105", not 105), the date is Ruby-style
// ("Tue Oct 15 01:18:33 +0000 2024"), and `reply_count`/`quote_count` are absent
// entirely — the export simply does not carry them. That last point is why
// imported rows show 0 replies rather than a real number; see toTweetRow.

/** The account these archives belong to. Both tables key their tweets to it. */
export const ARCHIVE_USERNAME = 'teneikaask_you';
export const ARCHIVE_DISPLAY_NAME = 'Teneika Askew';

/** One entry of the archive's tweet array, after the `{ tweet: ... }` unwrap. */
export interface ArchiveTweet {
  id_str?: string;
  id?: string;
  full_text?: string;
  text?: string;
  created_at?: string;
  favorite_count?: string | number;
  retweet_count?: string | number;
  lang?: string;
  source?: string;
  in_reply_to_screen_name?: string;
  entities?: {
    user_mentions?: unknown[];
    urls?: { url?: string; expanded_url?: string; display_url?: string }[];
  };
}

/** A row destined for public.tweets — the /teneika-tweets page reads this table. */
export interface TweetRow {
  tweet_id: string;
  content: string;
  author_username: string;
  author_display_name: string;
  tweeted_at: string;
  like_count: number;
  retweet_count: number;
  reply_count: number;
  quote_count: number;
}

/** A row destined for public.resources — the Top Tweets tab reads this table. */
export interface ResourceRow {
  tweet_id: string;
  full_text: string;
  created_at: string;
  created_at_est: string;
  favorite_count: number;
  retweet_count: number;
  lang: string | null;
  source: string | null;
  in_reply_to_screen_name: string | null;
  user_mentions: unknown[];
  resource_link: string | null;
  created_by: string | null;
}

/**
 * Strip the `window.YTD.<name>.partN =` assignment and parse the array behind it.
 *
 * Accepts plain JSON too, so a caller that has already unwrapped the file (or a
 * test fixture written as JSON) works without a special case.
 */
export function parseArchiveJs(text: string): ArchiveTweet[] {
  const withoutAssignment = text.replace(/^\s*window\.YTD\.[\w.]+\s*=\s*/, '');

  let parsed: unknown;
  try {
    parsed = JSON.parse(withoutAssignment);
  } catch (error) {
    throw new Error(
      `Not a readable X archive file: ${(error as Error).message}. ` +
        'Expected `window.YTD.tweets.partN = [ ... ]` or a bare JSON array.',
    );
  }

  if (!Array.isArray(parsed)) {
    throw new Error('X archive file did not contain an array of tweets.');
  }

  // Entries are wrapped as { tweet: {...} }; very old exports store the tweet
  // directly. Unwrap both, and drop anything that is not an object.
  return parsed
    .map((entry) => {
      if (entry && typeof entry === 'object' && 'tweet' in entry) {
        return (entry as { tweet: ArchiveTweet }).tweet;
      }
      return entry as ArchiveTweet;
    })
    .filter((tweet): tweet is ArchiveTweet => !!tweet && typeof tweet === 'object');
}

const MONTHS: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

/**
 * Parse the archive's Ruby-style timestamp: "Tue Oct 15 01:18:33 +0000 2024".
 *
 * Parsed explicitly rather than handed to `new Date(...)`, whose handling of this
 * format is engine-specific — the offset is real data here, not decoration, and a
 * silently wrong date would land 4-5 hours off and never be noticed.
 */
export function parseTwitterDate(raw: string | undefined): Date | null {
  if (!raw) return null;

  const match = /^\w{3} (\w{3}) (\d{2}) (\d{2}):(\d{2}):(\d{2}) ([+-]\d{4}) (\d{4})$/.exec(raw.trim());
  if (!match) return null;

  const [, monthName, day, hour, minute, second, offset, year] = match;
  const month = MONTHS[monthName];
  if (month === undefined) return null;

  const offsetMinutes =
    (offset.startsWith('-') ? -1 : 1) *
    (Number(offset.slice(1, 3)) * 60 + Number(offset.slice(3, 5)));

  const utcMillis =
    Date.UTC(Number(year), month, Number(day), Number(hour), Number(minute), Number(second)) -
    offsetMinutes * 60_000;

  const date = new Date(utcMillis);
  return Number.isNaN(date.getTime()) ? null : date;
}

const NEW_YORK_PARTS = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
  hour12: false,
});

/**
 * Reproduce the `resources.created_at_est` convention of the 4,666 rows already in
 * that table: the NEW YORK WALL CLOCK stored in a timestamptz column labelled +00.
 *
 * That is not what a timestamptz is for — the stored instant is wrong by the
 * offset — but every existing row does it, the spread across the table is a real
 * -4/-5 DST split (so it was a genuine America/New_York conversion, not a fixed
 * shift), and no UI code reads the column. Matching the existing convention keeps
 * the column internally consistent; diverging would make it mean two things at
 * once. Sorting and display both run off `created_at`, which is honest UTC.
 */
export function newYorkWallClock(date: Date): string {
  const parts = Object.fromEntries(
    NEW_YORK_PARTS.formatToParts(date).map((part) => [part.type, part.value]),
  );
  // en-US renders midnight as hour "24"; normalise it back to "00".
  const hour = parts.hour === '24' ? '00' : parts.hour;
  return `${parts.year}-${parts.month}-${parts.day}T${hour}:${parts.minute}:${parts.second}Z`;
}

/** Archive counts arrive as strings; anything unparseable is 0, never NaN. */
function toCount(value: string | number | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : 0;
}

export function tweetId(tweet: ArchiveTweet): string | null {
  return tweet.id_str || tweet.id || null;
}

export function tweetText(tweet: ArchiveTweet): string {
  return tweet.full_text ?? tweet.text ?? '';
}

/** Retweets are stored by X with the "RT @handle:" prefix intact. */
export function isRetweet(tweet: ArchiveTweet): boolean {
  return /^RT @/.test(tweetText(tweet));
}

/** A reply is any tweet the export tagged with the handle it answered. */
export function isReply(tweet: ArchiveTweet): boolean {
  return !!tweet.in_reply_to_screen_name;
}

/**
 * First outbound link in the tweet, preferring the expanded form over the t.co
 * shortener. Mirrors what `resources.resource_link` already holds.
 */
export function firstLink(tweet: ArchiveTweet): string | null {
  const urls = tweet.entities?.urls;
  if (!Array.isArray(urls)) return null;
  for (const url of urls) {
    const candidate = url?.expanded_url || url?.url;
    if (candidate) return candidate;
  }
  return null;
}

export function toTweetRow(tweet: ArchiveTweet): TweetRow | null {
  const id = tweetId(tweet);
  const tweetedAt = parseTwitterDate(tweet.created_at);
  if (!id || !tweetedAt) return null;

  return {
    tweet_id: id,
    content: tweetText(tweet),
    author_username: ARCHIVE_USERNAME,
    author_display_name: ARCHIVE_DISPLAY_NAME,
    tweeted_at: tweetedAt.toISOString(),
    like_count: toCount(tweet.favorite_count),
    retweet_count: toCount(tweet.retweet_count),
    // The archive carries neither of these. Writing 0 is a statement that the
    // number is unknown, not that it is zero — the API scraper is the only thing
    // that can fill them, and it will on its next run because the upsert below
    // conflicts on tweet_id.
    reply_count: 0,
    quote_count: 0,
  };
}

export function toResourceRow(tweet: ArchiveTweet, createdBy: string | null): ResourceRow | null {
  const id = tweetId(tweet);
  const createdAt = parseTwitterDate(tweet.created_at);
  if (!id || !createdAt) return null;

  return {
    tweet_id: id,
    full_text: tweetText(tweet),
    created_at: createdAt.toISOString(),
    created_at_est: newYorkWallClock(createdAt),
    favorite_count: toCount(tweet.favorite_count),
    retweet_count: toCount(tweet.retweet_count),
    lang: tweet.lang ?? null,
    // Kept verbatim (`<a href="...">X for Android</a>`), matching every existing
    // row. classifyResourceSource in Resources.tsx reads the host out of this
    // anchor to decide the row is a tweet, so it must not be flattened to a label.
    source: tweet.source ?? null,
    in_reply_to_screen_name: tweet.in_reply_to_screen_name ?? null,
    user_mentions: tweet.entities?.user_mentions ?? [],
    resource_link: firstLink(tweet),
    created_by: createdBy,
  };
}
