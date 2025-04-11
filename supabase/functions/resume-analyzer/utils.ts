// utils.ts

export function safeJsonParse<T>(jsonString: string, defaultValue: T): T {
  try {
    return JSON.parse(jsonString) as T;
  } catch (e) {
    console.error("Error parsing JSON:", e);
    return defaultValue;
  }
}

export function handleApiError(error: any): { error: string } {
  console.error("API error:", error);
  return {
    error: error.message || "An unexpected error occurred"
  };
}

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
