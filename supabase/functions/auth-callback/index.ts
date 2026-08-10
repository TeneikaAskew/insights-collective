
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, parseQueryParams } from '../_shared/utils.ts';

console.log('Auth callback function loaded');

/**
 * Reduce an untrusted redirect target to a path that cannot leave this origin.
 *
 * The previous guard rejected `//evil.com` and `/\evil.com` by prefix alone.
 * That is not sufficient: while parsing a URL a browser first REMOVES ASCII
 * tab, LF and CR, so `redirect=%2F%09%2Fevil.com` arrives here as the string
 * "/\t/evil.com" — which starts with a single '/', carries no backslash, and
 * therefore passed every check — and is then parsed as "//evil.com", a
 * protocol-relative URL pointing off-origin. Confirmed against Chromium.
 *
 * Strip the characters the parser would strip, collapse backslashes (browsers
 * treat them as '/'), and then resolve the result against a placeholder origin:
 * anything that still escapes that origin is not an internal path. This mirrors
 * safeInternalPath() in src/utils/safeRedirect.ts, which guards the same class
 * of input on the client.
 */
const safeInternalPath = (candidate: string, fallback = '/resources'): string => {
  if (!candidate) return fallback;

  const normalized = candidate.replace(/[\t\n\r]/g, '').replace(/\\/g, '/');

  if (!normalized.startsWith('/')) return fallback;
  if (normalized.startsWith('//')) return fallback;

  try {
    const base = 'https://internal.invalid';
    const resolved = new URL(normalized, base);
    if (resolved.origin !== base) return fallback;
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return fallback;
  }
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get the current URL
    const url = new URL(req.url);
    // Parse the query parameters
    const queryParams = parseQueryParams(req.url);
    // Get the redirect parameter
    const redirectTo = queryParams.redirect || '/resources';

    console.log('Auth callback received. Redirecting to:', redirectTo);

    const location = safeInternalPath(redirectTo);

    // Create a response that redirects to the specified page or default to /resources
    const headers = new Headers({
      ...corsHeaders,
      'Location': location,
    });

    return new Response(null, {
      status: 302, // Found - standard redirect status
      headers,
    });
  } catch (error) {
    console.error('Error in auth-callback function:', error);
    
    // If there's an error, redirect to resources page as fallback
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        'Location': '/resources',
      }
    });
  }
});
