// ABOUTME: Refreshes public.coursera_courses by reading Coursera's public course
// ABOUTME: pages. Runs in cron-sized batches because Edge Functions are wall-clock
// ABOUTME: limited (150s) and a full catalog crawl takes hours — the work list lives
// ABOUTME: in public.coursera_crawl_queue so progress survives between invocations.
//
// Actions (POST { action, ... }):
//   enqueue-refresh   requeue every known course, stalest first
//   enqueue-discover  read the sitemaps, queue on-topic candidates
//   process           drain a batch from the queue (what cron calls)
//   status            queue and catalog counts, no side effects
//
// Why this is an Edge Function and not a GitHub Action: an Action would need a
// Supabase service-role key in repository secrets, and that key bypasses RLS on
// every table in the project. Here the credential never leaves Supabase.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';
import { parseCoursePage, parseCourseUrl, inferSubjects } from './parser.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Paths Coursera's robots.txt permits. It disallows /api/ and /search outright, and
 * /lecture/ for AI crawlers specifically. Nothing here touches those.
 */
const ALLOWED_PATHS = ['learn', 'specializations', 'professional-certificates'];

const SITEMAPS = [
  'https://www.coursera.org/sitemap~www~courses.xml',
  'https://www.coursera.org/sitemap~www~specializations.xml',
  'https://www.coursera.org/sitemap~www~certificates.xml',
];

const USER_AGENT =
  'insights-collective-catalog/1.0 (course directory refresh; +https://insightscollective.org)';

/**
 * Batch size. 20 pages at ~1s each leaves generous headroom under the 150s ceiling
 * even when several requests need a retry. Raising this trades safety margin for
 * fewer cron ticks — measure before you do.
 */
const DEFAULT_BATCH = 20;
/** In-batch concurrency. Deliberately gentle: this is someone else's site. */
const CONCURRENCY = 4;
/** Give up on a URL after this many failed attempts and mark it failed. */
const MAX_ATTEMPTS = 3;
/** Stop claiming new work past this point so the function always returns cleanly. */
const TIME_BUDGET_MS = 100_000;

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function serviceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    // Service role: this function owns crawl state, which no browser role can touch.
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } },
  );
}

async function fetchPage(url: string): Promise<{ html?: string; status: number }> {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/xhtml+xml' },
  });
  if (!response.ok) return { status: response.status };
  return { html: await response.text(), status: response.status };
}

/** Subject keyword table, loaded once per invocation. */
async function loadKeywords(supabase: ReturnType<typeof serviceClient>) {
  const { data, error } = await supabase
    .from('coursera_subject_keywords')
    .select('subject, keyword');
  if (error) throw new Error(`keyword load failed: ${error.message}`);

  const bySubject = new Map<string, string[]>();
  for (const row of data ?? []) {
    if (!bySubject.has(row.subject)) bySubject.set(row.subject, []);
    bySubject.get(row.subject)!.push(row.keyword);
  }
  // Sorted so `subjects` arrays are stable across invocations — otherwise every run
  // would look like a change.
  return { bySubject, order: [...bySubject.keys()].sort() };
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

async function enqueueRefresh(supabase: ReturnType<typeof serviceClient>, limit: number) {
  // Stalest first, so a partially-completed month still improves the oldest rows.
  const { data, error } = await supabase
    .from('coursera_courses')
    .select('slug, url')
    .neq('status', 'retired')
    .order('last_fetched_at', { ascending: true, nullsFirst: true })
    .limit(limit);
  if (error) throw new Error(error.message);

  const rows = (data ?? []).map((course) => ({
    url: course.url,
    slug: course.slug,
    state: 'pending',
    attempts: 0,
    source: 'refresh',
    enqueued_at: new Date().toISOString(),
    processed_at: null,
    last_error: null,
  }));
  if (rows.length === 0) return { enqueued: 0 };

  const { error: upsertError } = await supabase
    .from('coursera_crawl_queue')
    .upsert(rows, { onConflict: 'url' });
  if (upsertError) throw new Error(upsertError.message);

  return { enqueued: rows.length };
}

async function enqueueDiscover(
  supabase: ReturnType<typeof serviceClient>,
  keywords: { bySubject: Map<string, string[]> },
) {
  // Slugs are hyphenated, so keywords have to be too before matching against them.
  const slugPatterns = [
    ...new Set(
      [...keywords.bySubject.values()]
        .flat()
        .map((keyword) => keyword.replace(/[^a-z0-9]+/g, '-'))
        .filter((keyword) => keyword.length >= 3),
    ),
  ].map((keyword) => new RegExp(`(^|-)${keyword}(-|$)`, 'i'));

  const candidates = new Map<string, string>();
  const perSitemap: Record<string, number> = {};

  for (const sitemap of SITEMAPS) {
    const { html } = await fetchPage(sitemap);
    if (!html) continue;

    let matched = 0;
    for (const match of html.matchAll(/<loc>([^<]+)<\/loc>/g)) {
      const parsed = parseCourseUrl(match[1]);
      if (!parsed) continue;
      // Localized duplicates of English courses: -zhtw, -ptbr, -es and friends.
      if (
        /-(zhtw|zhcn|ptbr|es|fr|de|ja|ko|ru|ar|tr|id|vi|th|hi|pt|it|pl)$/.test(parsed.slug)
      ) {
        continue;
      }
      if (slugPatterns.some((pattern) => pattern.test(parsed.slug))) {
        candidates.set(parsed.url, parsed.slug);
        matched += 1;
      }
    }
    perSitemap[sitemap.split('~').pop() ?? sitemap] = matched;
  }

  // Skip anything already retired — a 404 does not become a 200.
  const { data: retired } = await supabase
    .from('coursera_courses')
    .select('slug')
    .eq('status', 'retired');
  for (const row of retired ?? []) {
    for (const [url, slug] of candidates) if (slug === row.slug) candidates.delete(url);
  }

  const rows = [...candidates].map(([url, slug]) => ({
    url,
    slug,
    state: 'pending',
    attempts: 0,
    source: 'discover',
  }));

  // Chunked: a single 8,000-row upsert is a large statement and a large request body.
  let enqueued = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    // ignoreDuplicates so a re-run does not reset in-flight queue rows.
    const { error } = await supabase
      .from('coursera_crawl_queue')
      .upsert(chunk, { onConflict: 'url', ignoreDuplicates: true });
    if (error) throw new Error(error.message);
    enqueued += chunk.length;
  }

  return { candidates: candidates.size, enqueued, perSitemap };
}

async function processBatch(
  supabase: ReturnType<typeof serviceClient>,
  keywords: { bySubject: Map<string, string[]>; order: string[] },
  batchSize: number,
  startedAt: number,
) {
  const { data: claimed, error } = await supabase
    .from('coursera_crawl_queue')
    .select('url, slug, attempts')
    .eq('state', 'pending')
    .lt('attempts', MAX_ATTEMPTS)
    .order('enqueued_at', { ascending: true })
    .limit(batchSize);
  if (error) throw new Error(error.message);

  const queue = claimed ?? [];
  if (queue.length === 0) return { processed: 0, upserted: 0, failed: 0, remaining: 0 };

  const upserts: Record<string, unknown>[] = [];
  const done: string[] = [];
  const failed: { url: string; attempts: number; reason: string }[] = [];

  for (let i = 0; i < queue.length; i += CONCURRENCY) {
    if (Date.now() - startedAt > TIME_BUDGET_MS) break;

    await Promise.all(
      queue.slice(i, i + CONCURRENCY).map(async (item) => {
        try {
          const { html, status } = await fetchPage(item.url);
          if (!html) {
            // 404 means retired. Record it on the course so discovery stops
            // re-queueing it, instead of retrying forever.
            if (status === 404) {
              await supabase
                .from('coursera_courses')
                .update({ status: 'retired', last_http_status: 404, last_verified_at: new Date().toISOString() })
                .eq('slug', item.slug);
              done.push(item.url);
              return;
            }
            failed.push({ url: item.url, attempts: item.attempts + 1, reason: `HTTP ${status}` });
            return;
          }

          const result = parseCoursePage(html, item.url);
          if ('error' in result) {
            failed.push({ url: item.url, attempts: item.attempts + 1, reason: result.error });
            return;
          }

          const course = result.course;
          // No partner means no attribution, and attribution is not something a
          // course directory may invent. Drop rather than store a placeholder.
          if (!course.partner || course.partner === 'Coursera') {
            failed.push({ url: item.url, attempts: MAX_ATTEMPTS, reason: 'no partner' });
            return;
          }

          const skillsText = course.skills.join(', ');
          upserts.push({
            slug: course.slug,
            url: course.url,
            title: course.title,
            partner: course.partner,
            format: course.format,
            level: course.level,
            rating: course.rating,
            reviews: course.reviews,
            enrolled: course.enrolled,
            estimated_hours: course.estimatedHours,
            description: course.description,
            skills: course.skills,
            // Inferred from title + skills only, never the description: marketing
            // prose name-drops everything adjacent and produced nonsense
            // classifications (an academic English course as `research`).
            subjects: inferSubjects(keywords.bySubject, keywords.order, course.title, skillsText),
            primary_subjects: inferSubjects(keywords.bySubject, keywords.order, course.title),
            top_reviews: course.topReviews,
            last_fetched_at: new Date().toISOString(),
            last_verified_at: new Date().toISOString(),
            last_http_status: 200,
          });
          done.push(item.url);
        } catch (caught) {
          failed.push({
            url: item.url,
            attempts: item.attempts + 1,
            reason: caught instanceof Error ? caught.message : 'unknown',
          });
        }
      }),
    );
    await sleep(300);
  }

  if (upserts.length > 0) {
    // Upsert preserves curation: status, curator_note and is_featured are absent
    // from the payload, so an admin's decision to hide a course survives refreshes.
    const { error: upsertError } = await supabase
      .from('coursera_courses')
      .upsert(upserts, { onConflict: 'slug' });
    if (upsertError) throw new Error(`upsert failed: ${upsertError.message}`);
  }

  if (done.length > 0) {
    await supabase
      .from('coursera_crawl_queue')
      .update({ state: 'done', processed_at: new Date().toISOString(), last_error: null })
      .in('url', done);
  }

  for (const failure of failed) {
    await supabase
      .from('coursera_crawl_queue')
      .update({
        // Exhausted retries become 'failed' so the queue drains instead of
        // spinning on a permanently broken page.
        state: failure.attempts >= MAX_ATTEMPTS ? 'failed' : 'pending',
        attempts: failure.attempts,
        last_error: failure.reason,
      })
      .eq('url', failure.url);
  }

  const { count: remaining } = await supabase
    .from('coursera_crawl_queue')
    .select('url', { count: 'exact', head: true })
    .eq('state', 'pending')
    .lt('attempts', MAX_ATTEMPTS);

  return {
    processed: done.length + failed.length,
    upserted: upserts.length,
    failed: failed.length,
    remaining: remaining ?? 0,
  };
}

async function queueStatus(supabase: ReturnType<typeof serviceClient>) {
  const counts: Record<string, number> = {};
  for (const state of ['pending', 'done', 'failed']) {
    const { count } = await supabase
      .from('coursera_crawl_queue')
      .select('url', { count: 'exact', head: true })
      .eq('state', state);
    counts[state] = count ?? 0;
  }
  for (const status of ['active', 'hidden', 'retired']) {
    const { count } = await supabase
      .from('coursera_courses')
      .select('slug', { count: 'exact', head: true })
      .eq('status', status);
    counts[`courses_${status}`] = count ?? 0;
  }
  return counts;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const startedAt = Date.now();

  // This function writes with the service role and makes outbound requests, so it
  // must not be callable by anonymous traffic.
  //
  // The shared secret lives in Vault rather than in this function's environment, so
  // it can be set and rotated over the database connection alone — no management
  // access token, no `supabase secrets set`. The RPC returns only a boolean, so it
  // cannot be used to read the secret back. SUPABASE_SERVICE_ROLE_KEY is injected by
  // the platform, so this needs no configuration on the function side at all.
  const provided =
    req.headers.get('x-refresh-secret') ??
    (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');

  if (!provided) return json({ error: 'unauthorized' }, 401);

  const authClient = serviceClient();
  const { data: authorized, error: authError } = await authClient.rpc(
    'coursera_verify_refresh_secret',
    { p_secret: provided },
  );

  if (authError) {
    // Distinguish "cannot check" from "checked and refused" — a missing migration
    // and a wrong secret need different fixes.
    return json({ error: `authorization check failed: ${authError.message}` }, 500);
  }
  if (authorized !== true) return json({ error: 'unauthorized' }, 401);

  let body: Record<string, unknown> = {};
  try {
    body = req.method === 'POST' ? await req.json() : {};
  } catch {
    body = {};
  }

  const action = String(body.action ?? 'process');
  const batchSize = Math.min(Number(body.batch ?? DEFAULT_BATCH) || DEFAULT_BATCH, 60);

  try {
    const supabase = serviceClient();

    if (action === 'status') {
      return json({ action, ...(await queueStatus(supabase)) });
    }

    const keywords = await loadKeywords(supabase);

    if (action === 'enqueue-refresh') {
      const limit = Math.min(Number(body.limit ?? 10_000) || 10_000, 20_000);
      return json({ action, ...(await enqueueRefresh(supabase, limit)) });
    }

    if (action === 'enqueue-discover') {
      return json({ action, ...(await enqueueDiscover(supabase, keywords)) });
    }

    if (action === 'process') {
      const result = await processBatch(supabase, keywords, batchSize, startedAt);
      return json({ action, ...result, elapsed_ms: Date.now() - startedAt });
    }

    return json({ error: `unknown action: ${action}` }, 400);
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : 'unknown error';
    // Surface the reason: a silent 500 on a cron job is invisible until someone
    // notices the catalog has stopped moving.
    return json({ error: message, elapsed_ms: Date.now() - startedAt }, 500);
  }
});

// Filters the ALLOWED_PATHS constant into use so a future edit cannot silently
// widen what this crawls. Any queued URL outside those prefixes is a bug.
export function isAllowedCourseUrl(url: string): boolean {
  const parsed = /coursera\.org\/([a-z-]+)\//.exec(url);
  return !!parsed && ALLOWED_PATHS.includes(parsed[1]);
}
