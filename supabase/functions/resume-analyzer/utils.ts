// utils.ts - CORS Headers utility functions

/**
 * Get CORS headers dynamically based on the request
 * @param req The incoming request
 * @returns Object with CORS headers
 */
export function getCorsHeaders(req) {
  const origin = req.headers.get("Origin") || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-custom-header",
    "Access-Control-Max-Age": "86400",
    "Access-Control-Allow-Credentials": "true"
  };
}

/**
 * Standard CORS headers for simplicity
 * Can be used when request object isn't available
 */
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400"
};

/**
 * Handle OPTIONS preflight requests
 * @param req The incoming request
 * @returns Response with appropriate CORS headers
 */
export function handlePreflight(req) {
  return new Response(null, {
    status: 204, // No Content is more efficient than 200 OK
    headers: getCorsHeaders(req)
  });
}

/**
 * Check if request is a CORS preflight
 * @param req The incoming request
 * @returns Boolean indicating if this is a preflight request
 */
export function isPreflightRequest(req) {
  return req.method === 'OPTIONS';
}
// // Safe JSON parse with fallback
// export function safeJsonParse(jsonString: string, fallback: any): any {
//   try {
//     return JSON.parse(jsonString);
//   } catch (e) {
//     console.error("Error parsing JSON:", e);
//     return fallback;
//   }
// }

// // Handle API errors consistently
// export function handleApiError(error: any, defaultMessage = "An unexpected error occurred"): string {
//   if (typeof error === 'string') return error;
//   return error?.message || defaultMessage;
// }

// // Export comprehensive CORS headers for use across the application
// export const corsHeaders = {
//   'Access-Control-Allow-Origin': '*',
//   'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
//   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',//'Content-Type, Authorization, x-client-info, apikey',
//   'Access-Control-Allow-Credentials': 'true',
//   'Access-Control-Max-Age': '86400'
// };
// export const preflightCorsHeaders = {
//   'Access-Control-Allow-Origin': '*',
//   'Access-Control-Allow-Methods': 'POST, OPTIONS',
//   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',//'Content-Type, Authorization, apikey',
//   'Access-Control-Max-Age': '86400'
// };


// // Handle OPTIONS requests
// if (req.method === 'OPTIONS') {
//   return new Response('ok', { headers: corsHeaders });
// }