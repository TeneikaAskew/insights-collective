
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
};

// Function to parse URL query parameters
export const parseQueryParams = (url: string): Record<string, string> => {
  try {
    const params = new URL(url).searchParams;
    return Object.fromEntries(params.entries());
  } catch (e) {
    console.error('Failed to parse URL:', e);
    return {};
  }
};
