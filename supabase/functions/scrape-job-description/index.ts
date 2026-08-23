
// Follow Deno and Edge Functions v2 URL imports
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import * as cheerio from "https://esm.sh/cheerio@1.0.0-rc.12";
import { requireUser } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Blocks the ranges that make a server-side fetcher useful as an SSRF probe:
// loopback, link-local (which is where cloud instance-metadata lives), and the
// RFC1918 private ranges. Hostnames are resolved first so a public name that
// points at 169.254.169.254 does not slip through.
const BLOCKED_V4 = [
  /^127\./,                        // loopback
  /^10\./,                         // RFC1918
  /^192\.168\./,                   // RFC1918
  /^172\.(1[6-9]|2\d|3[01])\./,    // RFC1918
  /^169\.254\./,                   // link-local / cloud metadata
  /^0\./,
];

function isBlockedAddress(addr: string): boolean {
  const v4 = addr.replace(/^::ffff:/i, '');
  if (BLOCKED_V4.some((re) => re.test(v4))) return true;
  const lower = addr.toLowerCase();
  // IPv6 loopback, link-local and unique-local.
  return lower === '::1' || lower.startsWith('fe80:') || lower.startsWith('fc') || lower.startsWith('fd');
}

async function assertPublicHttpUrl(raw: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error('Invalid URL');
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('Only http(s) URLs are supported');
  }

  const host = parsed.hostname.replace(/^\[|\]$/g, '');
  if (isBlockedAddress(host)) {
    throw new Error('URL resolves to a non-public address');
  }

  // A public hostname can still resolve into a private range.
  try {
    const records = await Deno.resolveDns(host, 'A').catch(() => [] as string[]);
    const records6 = await Deno.resolveDns(host, 'AAAA').catch(() => [] as string[]);
    const all = [...records, ...records6];
    if (all.some(isBlockedAddress)) {
      throw new Error('URL resolves to a non-public address');
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes('non-public')) throw err;
    // Resolution failures are not conclusive; the literal checks above still applied.
  }

  return parsed;
}

const MAX_BYTES = 2 * 1024 * 1024;

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Deployed with verify_jwt=false, so this server-side fetcher was reachable by
  // anyone and would return the response body — a readable SSRF.
  const auth = await requireUser(req);
  if (auth.response) return auth.response;

  try {
    const { url } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ error: "URL is required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    let target: URL;
    try {
      target = await assertPublicHttpUrl(url);
    } catch (err) {
      return new Response(
        JSON.stringify({ error: err instanceof Error ? err.message : 'Invalid URL' }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Fetch the URL content. `redirect: 'manual'` stops a public URL from
    // bouncing the fetch into a private address after the checks above.
    const fetchPage = () => fetch(target.toString(), {
      redirect: 'manual',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    // Career sites behind CDNs answer with a one-off 502/503/504 and then
    // serve the same URL fine seconds later (careers.homedepot.com did exactly
    // this), so a gateway failure gets two short retries before it becomes the
    // user's problem.
    let response = await fetchPage();
    for (const delayMs of [1000, 2000]) {
      if (![502, 503, 504].includes(response.status)) break;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      // The wait gives a hostile DNS record time to move behind the hostname,
      // so every retry repeats the public-address check the first fetch got.
      await assertPublicHttpUrl(url);
      response = await fetchPage();
    }

    if (response.status >= 300 && response.status < 400) {
      return new Response(
        JSON.stringify({ error: "URL redirected; provide the final URL directly" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    if (!response.ok) {
      const status = `${response.status}${response.statusText ? ` ${response.statusText}` : ''}`;
      return new Response(
        JSON.stringify({ error: `The job site responded with ${status}. It may be temporarily unavailable — try again in a moment.` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 502 }
      );
    }

    const raw = await response.arrayBuffer();
    if (raw.byteLength > MAX_BYTES) {
      return new Response(
        JSON.stringify({ error: "Page too large to process" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 413 }
      );
    }
    const html = new TextDecoder().decode(raw);
    const $ = cheerio.load(html);

    // Extract job description - this is a simplified approach
    // Different job boards have different structures, so this is a basic implementation
    // that looks for common job description containers
    
    // Common selectors for job descriptions across various job boards
    const possibleSelectors = [
      // LinkedIn
      '.description__text',
      '.show-more-less-html',
      // Indeed
      '#jobDescriptionText',
      // Glassdoor
      '.jobDescriptionContent',
      '.desc',
      // ZipRecruiter
      '.job_description',
      // General
      '[data-automation="jobDescription"]',
      '.job-description',
      '#job-description',
      '.description',
      'section.description',
      'div[class*="description"]',
      'div[id*="description"]'
    ];

    let jobDescription = '';
    
    // Try each selector until we find content
    for (const selector of possibleSelectors) {
      const element = $(selector);
      if (element.length > 0) {
        jobDescription = element.text().trim();
        if (jobDescription) break;
      }
    }

    // If standard selectors didn't work, try a more generic approach
    if (!jobDescription) {
      // Look for h2 elements that might indicate a job description section
      $('h2, h3').each((_, element) => {
        const heading = $(element).text().toLowerCase();
        if (
          heading.includes('job description') || 
          heading.includes('description') || 
          heading.includes('about the role') ||
          heading.includes('responsibilities') ||
          heading.includes('requirements')
        ) {
          // Get the next sibling elements until the next heading
          let currentElement = $(element).next();
          let tempDescription = '';
          
          while (currentElement.length && !['h1', 'h2', 'h3'].includes(currentElement.prop('tagName')?.toLowerCase())) {
            tempDescription += currentElement.text() + ' ';
            currentElement = currentElement.next();
          }
          
          if (tempDescription.trim()) {
            jobDescription += tempDescription.trim() + '\n\n';
          }
        }
      });
    }

    // Last resort: just grab all paragraphs from the page
    if (!jobDescription) {
      jobDescription = $('p').map((_, element) => $(element).text().trim()).get().join('\n\n');
    }

    // Clean up the description
    jobDescription = jobDescription
      .replace(/\s+/g, ' ')
      .trim();

    if (!jobDescription) {
      return new Response(
        JSON.stringify({ error: "Could not extract job description from the provided URL" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 422 }
      );
    }

    return new Response(
      JSON.stringify({ jobDescription }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error scraping job description:", error);
    
    return new Response(
      JSON.stringify({ error: (error instanceof Error && error.message) || "Failed to scrape job description" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
