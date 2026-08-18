import { describe, it, expect } from 'vitest';
import {
  parseArchiveJs,
  parseTwitterDate,
  newYorkWallClock,
  toTweetRow,
  toResourceRow,
  isRetweet,
  isReply,
  firstLink,
  tweetId,
  ARCHIVE_USERNAME,
} from '../xArchive';

/** A realistic post-rebrand archive entry — note every count is a string. */
const modernEntry = {
  tweet: {
    id_str: '1845997658068209681',
    id: '1845997658068209681',
    created_at: 'Tue Oct 15 01:18:33 +0000 2024',
    full_text: 'Focus: Data & Software\nAgency: CDC\nPay: GS 13 / $134K https://t.co/abc123',
    favorite_count: '105',
    retweet_count: '6',
    lang: 'en',
    source: '<a href="https://mobile.x.com" rel="nofollow">X for Android</a>',
    entities: {
      user_mentions: [{ screen_name: 'someone', id_str: '42' }],
      urls: [{ url: 'https://t.co/abc123', expanded_url: 'https://usajobs.gov/posting' }],
    },
  },
};

describe('parseArchiveJs', () => {
  it('strips the window.YTD assignment and unwraps { tweet: ... }', () => {
    const file = `window.YTD.tweets.part0 = ${JSON.stringify([modernEntry])}`;
    const parsed = parseArchiveJs(file);

    expect(parsed).toHaveLength(1);
    expect(parsed[0].id_str).toBe('1845997658068209681');
  });

  it('accepts a bare JSON array and unwrapped entries', () => {
    const parsed = parseArchiveJs(JSON.stringify([modernEntry.tweet]));
    expect(parsed[0].id_str).toBe('1845997658068209681');
  });

  it('handles the part-numbered files X emits for large archives', () => {
    const parsed = parseArchiveJs(`window.YTD.tweets.part7 = ${JSON.stringify([modernEntry])}`);
    expect(parsed).toHaveLength(1);
  });

  it('throws something actionable on a file that is not an archive', () => {
    expect(() => parseArchiveJs('<html>not an archive</html>')).toThrow(/not a readable x archive/i);
  });

  it('throws when the payload parses but is not an array', () => {
    expect(() => parseArchiveJs('window.YTD.tweets.part0 = {"nope":true}')).toThrow(/array/i);
  });

  it('drops null entries rather than crashing the import', () => {
    const parsed = parseArchiveJs(JSON.stringify([modernEntry, null, modernEntry.tweet]));
    expect(parsed).toHaveLength(2);
  });
});

describe('parseTwitterDate', () => {
  it('parses the archive timestamp as UTC', () => {
    const date = parseTwitterDate('Tue Oct 15 01:18:33 +0000 2024');
    expect(date?.toISOString()).toBe('2024-10-15T01:18:33.000Z');
  });

  it('applies a non-zero offset instead of ignoring it', () => {
    // Same wall clock, but five hours behind UTC — the instant must shift.
    const date = parseTwitterDate('Tue Oct 15 01:18:33 -0500 2024');
    expect(date?.toISOString()).toBe('2024-10-15T06:18:33.000Z');
  });

  it('returns null for junk rather than an Invalid Date', () => {
    expect(parseTwitterDate('not a date')).toBeNull();
    expect(parseTwitterDate(undefined)).toBeNull();
    expect(parseTwitterDate('')).toBeNull();
  });
});

describe('newYorkWallClock', () => {
  // The 4,666 rows already in public.resources split -4/-5 across DST, so the
  // column was written with a real America/New_York conversion. Both sides matter.
  it('shifts by 4 hours during daylight time', () => {
    const date = new Date('2024-10-15T01:18:33.000Z');
    expect(newYorkWallClock(date)).toBe('2024-10-14T21:18:33Z');
  });

  it('shifts by 5 hours during standard time', () => {
    const date = new Date('2024-03-08T18:44:45.000Z');
    expect(newYorkWallClock(date)).toBe('2024-03-08T13:44:45Z');
  });

  it('normalises the hour-24 rendering of midnight', () => {
    const date = new Date('2024-03-08T05:00:00.000Z'); // 00:00 in New York
    expect(newYorkWallClock(date)).toBe('2024-03-08T00:00:00Z');
  });
});

describe('toTweetRow', () => {
  it('maps an archive entry onto the public.tweets shape', () => {
    const row = toTweetRow(modernEntry.tweet)!;

    expect(row).toMatchObject({
      tweet_id: '1845997658068209681',
      author_username: ARCHIVE_USERNAME,
      author_display_name: 'Teneika Askew',
      tweeted_at: '2024-10-15T01:18:33.000Z',
      like_count: 105,
      retweet_count: 6,
    });
    expect(row.content).toContain('Agency: CDC');
  });

  it('coerces the archive string counts to numbers', () => {
    const row = toTweetRow(modernEntry.tweet)!;
    expect(typeof row.like_count).toBe('number');
    expect(typeof row.retweet_count).toBe('number');
  });

  it('writes 0 for the counts the archive does not carry', () => {
    const row = toTweetRow(modernEntry.tweet)!;
    expect(row.reply_count).toBe(0);
    expect(row.quote_count).toBe(0);
  });

  it('never emits NaN for a missing or malformed count', () => {
    const row = toTweetRow({ ...modernEntry.tweet, favorite_count: undefined, retweet_count: 'x' })!;
    expect(row.like_count).toBe(0);
    expect(row.retweet_count).toBe(0);
  });

  it('returns null when there is no id or no usable date', () => {
    expect(toTweetRow({ ...modernEntry.tweet, id_str: undefined, id: undefined })).toBeNull();
    expect(toTweetRow({ ...modernEntry.tweet, created_at: 'garbage' })).toBeNull();
  });
});

describe('toResourceRow', () => {
  it('maps an archive entry onto the public.resources shape', () => {
    const row = toResourceRow(modernEntry.tweet, 'abc-123')!;

    expect(row).toMatchObject({
      tweet_id: '1845997658068209681',
      created_at: '2024-10-15T01:18:33.000Z',
      created_at_est: '2024-10-14T21:18:33Z',
      favorite_count: 105,
      retweet_count: 6,
      lang: 'en',
      created_by: 'abc-123',
      resource_link: 'https://usajobs.gov/posting',
    });
  });

  it('keeps the client anchor verbatim so the tab can classify the row', () => {
    // Flattening this to "X for Android" would strip the host that
    // classifyResourceSource reads, and the row would never reach Top Tweets.
    const row = toResourceRow(modernEntry.tweet, null)!;
    expect(row.source).toBe('<a href="https://mobile.x.com" rel="nofollow">X for Android</a>');
  });

  it('defaults user_mentions to an array, never null', () => {
    const row = toResourceRow({ ...modernEntry.tweet, entities: undefined }, null)!;
    expect(row.user_mentions).toEqual([]);
  });

  it('leaves resource_link null when the tweet has no outbound URL', () => {
    const row = toResourceRow({ ...modernEntry.tweet, entities: { urls: [] } }, null)!;
    expect(row.resource_link).toBeNull();
  });
});

describe('tweet predicates', () => {
  it('detects retweets by their preserved RT prefix', () => {
    expect(isRetweet({ full_text: 'RT @someone: hello' })).toBe(true);
    expect(isRetweet(modernEntry.tweet)).toBe(false);
  });

  it('does not mistake a mid-text RT for a retweet', () => {
    expect(isRetweet({ full_text: 'please RT @someone' })).toBe(false);
  });

  it('detects replies by the handle the export records', () => {
    expect(isReply({ in_reply_to_screen_name: 'teneikaask_you' })).toBe(true);
    expect(isReply(modernEntry.tweet)).toBe(false);
  });

  it('prefers the expanded URL over the t.co shortener', () => {
    expect(firstLink(modernEntry.tweet)).toBe('https://usajobs.gov/posting');
  });

  it('falls back to the t.co URL when no expansion is present', () => {
    expect(firstLink({ entities: { urls: [{ url: 'https://t.co/xyz' }] } })).toBe('https://t.co/xyz');
  });

  it('reads either id_str or id', () => {
    expect(tweetId({ id_str: '1' })).toBe('1');
    expect(tweetId({ id: '2' })).toBe('2');
    expect(tweetId({})).toBeNull();
  });
});
