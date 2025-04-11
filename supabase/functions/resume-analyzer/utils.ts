
// Safe JSON parse with fallback
export function safeJsonParse(jsonString: string, fallback: any): any {
  try {
    return JSON.parse(jsonString);
  } catch (e) {
    console.error("Error parsing JSON:", e);
    return fallback;
  }
}

// Handle API errors consistently
export function handleApiError(error: any, defaultMessage = "An unexpected error occurred"): string {
  if (typeof error === 'string') return error;
  return error?.message || defaultMessage;
}

// Export CORS headers for use across the application
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  // Optional but good practice:
  'Access-Control-Allow-Credentials': 'true',
};
