// ABOUTME: Covers the browser side of the archive upload — reading a zip in the
// ABOUTME: page, mapping rows, and batching them to the Edge Function. The file
// ABOUTME: itself is never uploaded, so the parsing half has to be right here.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import JSZip from 'jszip';
import { parseArchive, sendArchive, ArchiveError } from '../xArchiveUpload';

const invoke = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { functions: { invoke } },
}));

const tweet = (id: string, createdAt = 'Tue Oct 15 01:18:33 +0000 2024') => ({
  tweet: {
    id_str: id,
    created_at: createdAt,
    full_text: `tweet ${id}`,
    favorite_count: '5',
    retweet_count: '1',
    lang: 'en',
    source: '<a href="https://mobile.x.com" rel="nofollow">X for Android</a>',
    entities: { user_mentions: [], urls: [] },
  },
});

const asFile = (name: string, text: string) => new File([text], name);

const archiveJs = (entries: unknown[], part = 0) =>
  `window.YTD.tweets.part${part} = ${JSON.stringify(entries)}`;

async function zipFile(files: Record<string, string>): Promise<File> {
  const zip = new JSZip();
  for (const [path, text] of Object.entries(files)) zip.file(path, text);
  const blob = await zip.generateAsync({ type: 'blob' });
  return new File([blob], 'twitter-archive.zip');
}

describe('parseArchive', () => {
  it('reads a bare tweets.js', async () => {
    const parsed = await parseArchive(asFile('tweets.js', archiveJs([tweet('1'), tweet('2')])));

    expect(parsed.tweetRows).toHaveLength(2);
    expect(parsed.resourceRows).toHaveLength(2);
    expect(parsed.files).toEqual(['tweets.js']);
  });

  it('reads tweets.js out of the archive zip', async () => {
    const file = await zipFile({
      'data/tweets.js': archiveJs([tweet('1')]),
      'Your archive.html': '<html></html>',
    });
    const parsed = await parseArchive(file);

    expect(parsed.tweetRows).toHaveLength(1);
    expect(parsed.files).toEqual(['tweets.js']);
  });

  // A split export read in the wrong order, or partially, silently imports a
  // random slice of the account's history.
  it('reads every numbered part, base file first', async () => {
    const file = await zipFile({
      'data/tweets-part1.js': archiveJs([tweet('2')], 1),
      'data/tweets.js': archiveJs([tweet('1')]),
    });
    const parsed = await parseArchive(file);

    expect(parsed.files).toEqual(['tweets.js', 'tweets-part1.js']);
    expect(parsed.tweetRows.map((row) => row.tweet_id)).toEqual(['1', '2']);
  });

  // The archive also holds direct messages, contacts and media. None of it is
  // opened, which is what lets the zip be read in the page at all.
  it('ignores every non-tweet file in the zip', async () => {
    const file = await zipFile({
      'data/tweets.js': archiveJs([tweet('1')]),
      'data/direct-messages.js': 'window.YTD.direct_messages.part0 = [{"secret":true}]',
      'data/like.js': 'window.YTD.like.part0 = []',
      'data/tweets_media/img.jpg': 'binary',
    });
    const parsed = await parseArchive(file);

    expect(parsed.files).toEqual(['tweets.js']);
    expect(parsed.tweetRows).toHaveLength(1);
  });

  it('rejects a zip with no tweet files, naming what it wanted', async () => {
    const file = await zipFile({ 'data/direct-messages.js': 'window.YTD.direct_messages = []' });

    await expect(parseArchive(file)).rejects.toThrow(/no data\/tweets\.js/i);
  });

  it('rejects a file that is not a zip and not an archive', async () => {
    await expect(parseArchive(asFile('notes.js', 'hello'))).rejects.toBeInstanceOf(ArchiveError);
  });

  it('names the offending file when a part fails to parse', async () => {
    await expect(parseArchive(asFile('tweets.js', '<html>nope</html>'))).rejects.toThrow(
      /^tweets\.js:/,
    );
  });

  it('rejects a file that parses but holds no tweets', async () => {
    await expect(parseArchive(asFile('tweets.js', archiveJs([])))).rejects.toThrow(
      /no tweets found/i,
    );
  });

  it('drops duplicates and counts them', async () => {
    const parsed = await parseArchive(
      asFile('tweets.js', archiveJs([tweet('1'), tweet('1'), tweet('2')])),
    );

    expect(parsed.tweetRows).toHaveLength(2);
    expect(parsed.skipped.duplicate).toBe(1);
    expect(parsed.totalEntries).toBe(3);
  });

  it('drops entries with an unusable date', async () => {
    const parsed = await parseArchive(
      asFile('tweets.js', archiveJs([tweet('1'), tweet('2', 'not a date')])),
    );

    expect(parsed.tweetRows).toHaveLength(1);
    expect(parsed.skipped.badDate).toBe(1);
  });

  it('attributes resource rows to the importing admin', async () => {
    const parsed = await parseArchive(asFile('tweets.js', archiveJs([tweet('1')])), 'admin-1');
    expect(parsed.resourceRows[0].created_by).toBe('admin-1');
  });
});

describe('sendArchive', () => {
  beforeEach(() => {
    invoke.mockReset();
  });

  const parsedOf = async (count: number) =>
    parseArchive(
      asFile('tweets.js', archiveJs(Array.from({ length: count }, (_, i) => tweet(String(i + 1))))),
    );

  it('posts one batch and reports what was written', async () => {
    invoke.mockResolvedValue({
      data: { success: true, tweetsWritten: 3, resourcesWritten: 3 },
      error: null,
    });

    const result = await sendArchive(await parsedOf(3));

    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith('import-x-archive', expect.anything());
    expect(result).toEqual({ tweetsWritten: 3, resourcesWritten: 3 });
  });

  it('sends both tables in the same request so they cannot drift', async () => {
    invoke.mockResolvedValue({ data: { success: true }, error: null });

    await sendArchive(await parsedOf(2));

    const body = invoke.mock.calls[0][1].body;
    expect(body.tweets).toHaveLength(2);
    expect(body.resources).toHaveLength(2);
  });

  it('reports progress as batches land', async () => {
    invoke.mockResolvedValue({ data: { success: true }, error: null });
    const seen: number[] = [];

    await sendArchive(await parsedOf(3), ({ sent }) => seen.push(sent));

    expect(seen).toEqual([3]);
  });

  // Batches are not a transaction. The message has to say how far it got, and
  // that re-running is safe, because every write upserts on tweet_id.
  it('says how far it got when a batch fails', async () => {
    invoke.mockResolvedValue({ data: null, error: { message: 'boom' } });

    await expect(sendArchive(await parsedOf(2))).rejects.toThrow(/stopped after 0 of 2/i);
    await expect(sendArchive(await parsedOf(2))).rejects.toThrow(/re-running is safe/i);
  });

  it('treats a success:false body as a failure, not a silent no-op', async () => {
    invoke.mockResolvedValue({
      data: { success: false, error: 'Admin privileges required' },
      error: null,
    });

    await expect(sendArchive(await parsedOf(1))).rejects.toThrow(/admin privileges required/i);
  });
});
