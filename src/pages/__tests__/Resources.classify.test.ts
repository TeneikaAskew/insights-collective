import { describe, it, expect } from 'vitest';
import { classifyResourceSource, adaptResourceToTweet } from '../Resources';
import type { Resource } from '@/hooks/useResources';

/**
 * Only the fields the classifier reads matter here; the rest of Resource is
 * padding, so build rows from a minimal base.
 */
const resource = (overrides: Partial<Resource>): Resource =>
  ({
    id: 'row-1',
    tweet_id: null,
    source: null,
    resource_link: null,
    full_text: null,
    created_at: null,
    favorite_count: null,
    retweet_count: null,
    tweet_likes: null,
    tweet_retweets: null,
    ...overrides,
  }) as Resource;

describe('classifyResourceSource', () => {
  it('classifies the legacy "Twitter for Android" client anchor as a tweet', () => {
    const row = resource({
      source: '<a href="http://twitter.com/download/android" rel="nofollow">Twitter for Android</a>',
    });
    expect(classifyResourceSource(row)).toBe('Tweet');
  });

  // The regression this guards: every tweet posted after the rebrand carries an
  // "X for ..." label pointing at x.com. Before the href check these classified as
  // 'Standard', so an archive import landed in the table and never appeared in the
  // Top Tweets tab — fetched by useAllTweetsData, then filtered straight back out.
  it('classifies the post-rebrand "X for Android" anchor as a tweet', () => {
    const row = resource({
      source: '<a href="https://mobile.x.com" rel="nofollow">X for Android</a>',
    });
    expect(classifyResourceSource(row)).toBe('Tweet');
  });

  it('classifies the "X Web App" anchor as a tweet', () => {
    const row = resource({
      source: '<a href="https://x.com" rel="nofollow">X Web App</a>',
    });
    expect(classifyResourceSource(row)).toBe('Tweet');
  });

  it('still classifies by resource_link when there is no source anchor', () => {
    const row = resource({ resource_link: 'https://x.com/teneikaask_you/status/123' });
    expect(classifyResourceSource(row)).toBe('Tweet');
  });

  it('does not treat a lookalike host in the anchor as X', () => {
    // The reason the href is host-matched rather than substring-matched.
    const row = resource({
      source: '<a href="https://x.com.evil.net" rel="nofollow">X for Android</a>',
    });
    expect(classifyResourceSource(row)).toBe('Standard');
  });

  it('does not treat an unrelated host containing "x.com" as X', () => {
    const row = resource({ source: '<a href="https://box.com/app">Box</a>' });
    expect(classifyResourceSource(row)).toBe('Standard');
  });

  it('leaves LinkedIn rows classified as LinkedIn', () => {
    expect(classifyResourceSource(resource({ source: 'LinkedIn' }))).toBe('LinkedIn');
    expect(
      classifyResourceSource(resource({ resource_link: 'https://www.linkedin.com/posts/abc' })),
    ).toBe('LinkedIn');
  });

  it('leaves a plain resource as Standard', () => {
    const row = resource({ source: 'Newsletter', resource_link: 'https://example.com/guide' });
    expect(classifyResourceSource(row)).toBe('Standard');
  });
});

describe('adaptResourceToTweet', () => {
  it('builds a status URL for a post-rebrand row with no outbound link', () => {
    const row = resource({
      tweet_id: '1845997658068209681',
      source: '<a href="https://mobile.x.com" rel="nofollow">X for Android</a>',
    });
    expect(adaptResourceToTweet(row).url).toBe(
      'https://x.com/teneikaask_you/status/1845997658068209681',
    );
  });

  it('prefers the row own outbound link over the built status URL', () => {
    const row = resource({
      tweet_id: '123',
      source: '<a href="https://mobile.x.com">X for Android</a>',
      resource_link: 'https://usajobs.gov/posting',
    });
    expect(adaptResourceToTweet(row).url).toBe('https://usajobs.gov/posting');
  });

  it('reads the archive engagement counts', () => {
    const row = resource({ tweet_id: '1', favorite_count: 105, retweet_count: 6 });
    const adapted = adaptResourceToTweet(row);
    expect(adapted.likes).toBe(105);
    expect(adapted.retweets).toBe(6);
  });
});
