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

const BLS_API = "https://api.bls.gov/publicAPI/v1/timeseries/data/";
const BLS_BATCH = 25; // hard limit per request on the unregistered public API

async function fetchOewsFigures(socCodes: string[]) {
  const measures = Object.keys(OEWS_DATATYPES) as Measure[];
  const wanted = socCodes.flatMap((soc) =>
    measures.map((m) => ({ id: seriesId(soc, m), soc, measure: m })),
  );

  const values = new Map<string, { value: number; year: string }>();

  for (let i = 0; i < wanted.length; i += BLS_BATCH) {
    const batch = wanted.slice(i, i + BLS_BATCH);
    const res = await fetch(BLS_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seriesid: batch.map((b) => b.id) }),
    });
    if (!res.ok) throw new Error(`BLS API returned ${res.status}`);

    const payload = await res.json();
    if (payload.status !== "REQUEST_SUCCEEDED") {
      throw new Error(`BLS API: ${payload.status} ${(payload.message || []).join("; ")}`);
    }

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
      if (!body?.refresh) {
        return json({ error: "POST requires { refresh: true }" }, 400);
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
