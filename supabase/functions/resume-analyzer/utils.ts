
// Common CORS headers for Edge Functions
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to safely parse JSON
export function safeJsonParse(text: string, fallback: any = {}) {
  try {
    return JSON.parse(text);
  } catch (error) {
    console.error("Error parsing JSON:", error);
    return fallback;
  }
}

// Helper function to handle API errors
export function handleApiError(error: any, defaultMessage = "An error occurred") {
  console.error("API Error:", error);
  
  const message = error?.message || defaultMessage;
  return {
    error: true,
    message
  };
}
