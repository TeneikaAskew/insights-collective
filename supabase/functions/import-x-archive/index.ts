// Upsert a batch of archive-derived tweets into the two tables the site renders
// them from. Called by the admin-only upload dialog on /teneika-tweets.
//
// WHY THIS FUNCTION EXISTS AT ALL
//
// The browser cannot do this write, even as an admin:
//
//   public.tweets     RLS on, and the ONLY policy is SELECT. There is no insert
//                     or update policy for any role, so every browser write is
//                     refused. Service role is the only way in.
//   public.resources  INSERT is open to authenticated, but UPDATE requires
//                     auth.uid() = created_by OR auth.role() = 'admin' — and
//                     auth.role() returns the POSTGRES role ('authenticated',
//                     'anon', 'service_role'), never 'admin', so that branch is
//                     dead. An upsert needs the update half, so it would fail
//                     for any row the caller did not originally create.
//
// So the privileged write lives here, behind requireAdmin, which authorizes
// against user_roles via has_admin_access() rather than the owner-writable
// profiles.roles column.
//
// The FILE is never uploaded. The browser opens the zip locally, maps the rows
// with src/utils/xArchive.ts, and posts batches of finished rows to this
// endpoint — so a multi-gigabyte archive full of direct messages and media never
// leaves the admin's machine, and this function only ever sees tweet rows.

import { requireAdmin, authJson } from '../_shared/auth.ts';
import { corsHeaders } from '../_shared/utils.ts';

/** Matches the client-side chunking. Kept well under the request body limit. */
const MAX_ROWS_PER_REQUEST = 1000;

/**
 * Columns this endpoint is willing to write, per table. The payload is built by
 * the browser, so it is caller-controlled: anything not named here is dropped
 * rather than passed through to a service-role upsert.
 */
const TWEET_COLUMNS = [
  'tweet_id',
  'content',
  'author_username',
  'author_display_name',
  'tweeted_at',
  'like_count',
  'retweet_count',
  'reply_count',
  'quote_count',
] as const;

const RESOURCE_COLUMNS = [
  'tweet_id',
  'full_text',
  'created_at',
  'created_at_est',
  'favorite_count',
  'retweet_count',
  'lang',
  'source',
  'in_reply_to_screen_name',
  'user_mentions',
  'resource_link',
] as const;

function pick(row: Record<string, unknown>, columns: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const column of columns) {
    if (row[column] !== undefined) out[column] = row[column];
  }
  return out;
}

/** Every row must carry a tweet_id — it is the conflict target for both upserts. */
function hasTweetId(row: Record<string, unknown>): boolean {
  return typeof row.tweet_id === 'string' && row.tweet_id.length > 0;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return authJson({ error: 'Method not allowed' }, 405);
  }

  const auth = await requireAdmin(req);
  if (auth.response) return auth.response;

  let body: { tweets?: unknown; resources?: unknown };
  try {
    body = await req.json();
  } catch {
    return authJson({ error: 'Body must be JSON' }, 400);
  }

  const tweetsIn = Array.isArray(body.tweets) ? body.tweets : [];
  const resourcesIn = Array.isArray(body.resources) ? body.resources : [];

  if (tweetsIn.length === 0 && resourcesIn.length === 0) {
    return authJson({ error: 'Nothing to import: send tweets and/or resources' }, 400);
  }

  if (tweetsIn.length > MAX_ROWS_PER_REQUEST || resourcesIn.length > MAX_ROWS_PER_REQUEST) {
    return authJson(
      { error: `Send at most ${MAX_ROWS_PER_REQUEST} rows per table per request` },
      413,
    );
  }

  const tweetRows = tweetsIn
    .filter((row): row is Record<string, unknown> => !!row && typeof row === 'object')
    .map((row) => pick(row, TWEET_COLUMNS))
    .filter(hasTweetId);

  const resourceRows = resourcesIn
    .filter((row): row is Record<string, unknown> => !!row && typeof row === 'object')
    .map((row) => ({
      ...pick(row, RESOURCE_COLUMNS),
      // Never taken from the payload. The importing admin owns the rows, which
      // is also what makes the resources UPDATE policy hold for them later.
      created_by: auth.user.id,
    }))
    .filter(hasTweetId);

  if (tweetRows.length === 0 && resourceRows.length === 0) {
    return authJson({ error: 'No rows carried a tweet_id' }, 400);
  }

  try {
    let tweetsWritten = 0;
    let resourcesWritten = 0;

    if (tweetRows.length > 0) {
      const { error } = await auth.admin
        .from('tweets')
        .upsert(tweetRows, { onConflict: 'tweet_id' });
      if (error) throw new Error(`tweets: ${error.message}`);
      tweetsWritten = tweetRows.length;
    }

    if (resourceRows.length > 0) {
      const { error } = await auth.admin
        .from('resources')
        .upsert(resourceRows, { onConflict: 'tweet_id' });
      if (error) {
        // The conflict target is migration 20260818000000. Without it PostgREST
        // reports a missing unique constraint, which reads as a mystery unless
        // the cause is named.
        if (/no unique|constraint matching|on conflict/i.test(error.message)) {
          throw new Error(
            'resources: the unique index on tweet_id is missing — apply migration ' +
              '20260818000000_resources_tweet_id_unique before importing.',
          );
        }
        throw new Error(`resources: ${error.message}`);
      }
      resourcesWritten = resourceRows.length;
    }

    return authJson(
      { success: true, tweetsWritten, resourcesWritten },
      200,
    );
  } catch (error) {
    console.error('import-x-archive failed:', error);
    return authJson({ error: (error as Error).message }, 500);
  }
});
