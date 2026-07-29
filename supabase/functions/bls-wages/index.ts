// ABOUTME: Serves BLS OEWS salary bands for career roles, and refreshes them from the BLS public API.
// ABOUTME: Read path is public (the landing page calls it signed out); the refresh path is service-role only.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...extra },
  });

/**
 * OEWS series ID layout, 25 characters:
 *   OE | U (not seasonally adjusted) | N (national) | 0000000 (area)
 *      | 000000 (all industries) | ######  (SOC without the dash) | ## (datatype)
 *
 * Getting the zero-padding wrong yields a syntactically valid ID that the API
 * accepts and returns no data for, so build it in exactly one place.
 */
const OEWS_DATATYPES = {
  employment: "01",
  annual_mean: "04",
  pct10: "11",
  pct25: "12",
  median: "13",
  pct75: "14",
  pct90: "15",
} as const;

type Measure = keyof typeof OEWS_DATATYPES;

const seriesId = (socCode: string, measure: Measure) =>
  `OEUN${"0".repeat(13)}${socCode.replace("-", "")}${OEWS_DATATYPES[measure]}`;

const BLS_API = "https://api.bls.gov/publicAPI/v2/timeseries/data/";
const BLS_BATCH = 25; // hard limit per request on the public API

/**
 * A registration key is required, not optional:
 *  - unregistered callers get 25 queries/day, which one discovery burst exhausts;
 *  - `catalog: true` — the only way to learn an occupation's official title — is
 *    refused without one ("The catalog has been disabled for this request").
 * Free from https://data.bls.gov/registrationEngine/. Set as a Supabase secret.
 */
const blsKey = () => Deno.env.get("BLS_API_KEY") ?? "";

const SOC_PATTERN = /^\d{2}-\d{4}$/;

async function callBls(body: Record<string, unknown>) {
  const key = blsKey();
  const res = await fetch(BLS_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(key ? { ...body, registrationkey: key } : body),
  });
  if (!res.ok) throw new Error(`BLS API returned ${res.status}`);

  const payload = await res.json();
  if (payload.status !== "REQUEST_SUCCEEDED") {
    throw new Error(`BLS API: ${payload.status} ${(payload.message || []).join("; ")}`);
  }
  return payload;
}

/**
 * Asks BLS whether a SOC code is real and what it is called.
 *
 * BLS answers the first question unambiguously — an unknown code comes back as
 * "Series does not exist for Series …" while a real one returns figures — so a
 * proposed code can be verified rather than trusted. The title comes from the
 * catalog, which is why the key is mandatory: without it we would be storing a
 * caller-supplied name against BLS figures and calling it authoritative.
 */
async function resolveOccupation(socCode: string): Promise<{ title: string }> {
  if (!SOC_PATTERN.test(socCode)) {
    throw new Error(`"${socCode}" is not a SOC code (expected NN-NNNN)`);
  }
  if (!blsKey()) {
    throw new Error(
      "BLS_API_KEY is not set. Looking up a new occupation needs it — the BLS " +
        "catalog (the only authoritative source for an occupation title) is " +
        "disabled for unregistered requests. Register free at " +
        "https://data.bls.gov/registrationEngine/ and set it as a Supabase secret.",
    );
  }

  const id = seriesId(socCode, "median");
  const payload = await callBls({ seriesid: [id], catalog: true });

  const messages: string[] = payload.message ?? [];
  if (messages.some((m) => m.includes("Series does not exist"))) {
    throw new Error(`BLS has no occupation ${socCode}`);
  }

  const series = payload.Results?.series?.[0];
  if (!series?.data?.length) {
    throw new Error(`BLS publishes no wage data for ${socCode}`);
  }

  // Catalog series titles read like "Annual median wage for Information
  // Security Analysts, All industries, National". Take the occupation clause.
  const catalogTitle: string | undefined = series.catalog?.series_title ?? series.catalog?.occupation;
  const title = (series.catalog?.occupation ?? catalogTitle ?? "").trim();
  if (!title) {
    throw new Error(
      `BLS returned no catalog title for ${socCode}; refusing to store an unverified occupation name`,
    );
  }
  return { title };
}

async function fetchOewsFigures(socCodes: string[]) {
  const measures = Object.keys(OEWS_DATATYPES) as Measure[];
  const wanted = socCodes.flatMap((soc) =>
    measures.map((m) => ({ id: seriesId(soc, m), soc, measure: m })),
  );

  const values = new Map<string, { value: number; year: string }>();

  for (let i = 0; i < wanted.length; i += BLS_BATCH) {
    const batch = wanted.slice(i, i + BLS_BATCH);
    const payload = await callBls({ seriesid: batch.map((b) => b.id) });

    for (const series of payload.Results?.series ?? []) {
      const latest = (series.data ?? [])[0];
      if (!latest) continue;
      const parsed = Number(String(latest.value).replace(/[^0-9.]/g, ""));
      if (!Number.isFinite(parsed)) continue;
      values.set(series.seriesID, { value: Math.round(parsed), year: latest.year });
    }
  }

  // Reassemble per occupation. A row is only usable if the percentiles are all
  // present and ordered — the table has a CHECK constraint that says the same.
  const rows: Record<string, unknown>[] = [];
  const skipped: { soc_code: string; reason: string }[] = [];

  for (const soc of socCodes) {
    const figures: Partial<Record<Measure, number>> = {};
    let year = "";
    for (const m of measures) {
      const hit = values.get(seriesId(soc, m));
      if (hit) {
        figures[m] = hit.value;
        year = hit.year || year;
      }
    }

    const ordered = [figures.pct10, figures.pct25, figures.median, figures.pct75, figures.pct90];
    if (ordered.some((v) => v === undefined)) {
      skipped.push({ soc_code: soc, reason: "BLS returned no data for one or more percentiles" });
      continue;
    }
    if (!ordered.every((v, i) => i === 0 || (v as number) >= (ordered[i - 1] as number))) {
      skipped.push({ soc_code: soc, reason: "percentiles came back out of order" });
      continue;
    }

    rows.push({
      soc_code: soc,
      ...figures,
      reference_period: year ? `May ${year}` : undefined,
      retrieved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  return { rows, skipped };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!supabaseUrl || !anonKey) {
    return json({ error: "Supabase environment is not configured" }, 500);
  }

  try {
    // ── Refresh ────────────────────────────────────────────────────────────
    // Writes to reference data, so it requires the service-role key rather
    // than any signed-in user's JWT.
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));

      // ── Lookup ───────────────────────────────────────────────────────────
      // Someone asked about an occupation we do not hold — "cyber security
      // analyst". Verify the proposed SOC code against BLS, store it and its
      // wage series, and return it. Next time it is a plain database read.
      if (body?.lookup) {
        const socCode = String(body.socCode ?? "").trim();
        const requestedTitle = String(body.title ?? "").trim();
        if (!socCode || !requestedTitle) {
          return json({ error: "lookup requires { socCode, title }" }, 400);
        }

        const admin = createClient(supabaseUrl, serviceKey || anonKey);

        // Already known? Return it without spending a BLS query.
        const { data: existing } = await admin
          .from("career_role_wages")
          .select("*")
          .eq("soc_code", socCode)
          .limit(1);
        if (existing?.length) {
          return json({ role: existing[0], discovered: false });
        }

        if (!serviceKey) {
          return json({ error: "Discovering a new occupation requires the service role key" }, 403);
        }

        // Both of these throw with an actionable message rather than storing
        // anything questionable: an unknown SOC code, a code BLS publishes no
        // wages for, or a missing registration key all stop here.
        const { title } = await resolveOccupation(socCode);
        const { rows, skipped } = await fetchOewsFigures([socCode]);
        if (!rows.length) {
          return json(
            { error: `BLS wage data for ${socCode} is incomplete`, detail: skipped },
            422,
          );
        }

        const { error: occError } = await admin
          .from("bls_occupations")
          .insert({ ...rows[0], occupation_title: title, source: "discovered" });
        if (occError) throw occError;

        const slug = requestedTitle
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");

        const { error: roleError } = await admin.from("career_roles").insert({
          slug,
          title: requestedTitle,
          category: "Discovered",
          soc_code: socCode,
          source: "discovered",
          requested_title: requestedTitle,
          mapping_note: `Looked up on demand; BLS reports this as ${title}.`,
        });
        if (roleError) throw roleError;

        const { data: stored, error: readBack } = await admin
          .from("career_role_wages")
          .select("*")
          .eq("slug", slug)
          .single();
        if (readBack) throw readBack;

        return json({ role: stored, discovered: true });
      }

      if (!body?.refresh) {
        return json({ error: "POST requires { refresh: true } or { lookup: true, socCode, title }" }, 400);
      }

      const presented = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
      if (!serviceKey || presented !== serviceKey) {
        return json({ error: "Refreshing wage data requires the service role key" }, 403);
      }

      const admin = createClient(supabaseUrl, serviceKey);
      const { data: occupations, error: readError } = await admin
        .from("bls_occupations")
        .select("soc_code");
      if (readError) throw readError;

      const socCodes = (occupations ?? []).map((o: { soc_code: string }) => o.soc_code);
      if (!socCodes.length) return json({ updated: 0, skipped: [], message: "No occupations to refresh" });

      const { rows, skipped } = await fetchOewsFigures(socCodes);

      // Upsert rather than replace: occupation_title and source_url are curated
      // here, not published by the wage series.
      for (const row of rows) {
        const { error } = await admin.from("bls_occupations").update(row).eq("soc_code", row.soc_code);
        if (error) throw error;
      }

      return json({
        updated: rows.length,
        skipped,
        reference_period: rows[0]?.reference_period ?? null,
      });
    }

    // ── Read ───────────────────────────────────────────────────────────────
    // Public reference data. Served from the table, never live from BLS, so a
    // BLS outage can never take the landing page's salary bands down.
    const url = new URL(req.url);
    const slug = url.searchParams.get("slug");
    const category = url.searchParams.get("category");
    const socCode = url.searchParams.get("soc_code");

    const client = createClient(supabaseUrl, anonKey);
    let query = client.from("career_role_wages").select("*").order("title");

    if (slug) query = query.eq("slug", slug);
    if (category) query = query.eq("category", category);
    if (socCode) query = query.eq("soc_code", socCode);

    const { data, error } = await query;
    if (error) throw error;

    const first = data?.[0];
    return json(
      {
        roles: data ?? [],
        citation: first
          ? {
              source: first.source_name,
              url: first.source_url,
              reference_period: first.reference_period,
              note: "National, cross-industry annual wage estimates. Figures are for the BLS occupation each role maps to, not for the role title itself.",
            }
          : null,
      },
      200,
      // Wage data changes once a year. Let the CDN and the browser hold it.
      { "Cache-Control": "public, max-age=3600, s-maxage=86400" },
    );
  } catch (error) {
    console.error("bls-wages failed:", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
