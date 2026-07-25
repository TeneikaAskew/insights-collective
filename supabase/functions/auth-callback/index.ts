
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, parseQueryParams } from '../_shared/utils.ts';

console.log('Auth callback function loaded');

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

    // Silent-failure audit / fail-open fix: the old check only prefixed a '/'
    // when missing, so a crafted `redirect=//evil.com` passed through as a
    // protocol-relative URL — an open redirect on the auth callback. Only
    // same-origin paths (single leading '/', no backslash tricks) are allowed.
    const isSafePath = redirectTo.startsWith('/')
      && !redirectTo.startsWith('//')
      && !redirectTo.startsWith('/\\');
    const location = isSafePath ? redirectTo : '/resources';

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
