
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

// Export comprehensive CORS headers for use across the application
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info, apikey',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Max-Age': '86400'
};

// Handle OPTIONS preflight requests
export function handleOptions(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  return null;
}
// Add this function for retry logic with exponential backoff
export async function callGroqWithRetry(apiKey, body, maxRetries = 3) {
  let retryCount = 0;
  let baseDelay = 1000; // Start with 1 second delay
  
  while (retryCount <= maxRetries) {
    try {
      console.log(`callGroqWithRetry: Attempt ${retryCount + 1}/${maxRetries + 1}`);
      
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
      
      // If successful, return the response
      if (response.ok) {
        return await response.json();
      }
      
      // If we hit a rate limit (429)
      if (response.status === 429) {
        const errorText = await response.text();
        console.log(`callGroqWithRetry: Rate limit hit (429). Error: ${errorText}`);
        
        // Try to extract wait time from error message
        let waitTime = baseDelay * Math.pow(2, retryCount); // Default exponential backoff
        
        try {
          // Extract retry time from error message if available
          const errorJson = JSON.parse(errorText);
          const waitTimeMatch = errorJson?.error?.message.match(/try again in (\d+)m?(\d+(?:\.\d+)?)s/i);
          
          if (waitTimeMatch) {
            const minutes = waitTimeMatch[1] ? parseInt(waitTimeMatch[1], 10) : 0;
            const seconds = parseFloat(waitTimeMatch[2] || 0);
            const extractedWaitTime = (minutes * 60 + seconds) * 1000; // Convert to milliseconds
            
            if (extractedWaitTime > 0) {
              waitTime = extractedWaitTime + 500; // Add a small buffer (500ms)
              console.log(`callGroqWithRetry: Extracted wait time of ${waitTime}ms from error message`);
            }
          }
        } catch (e) {
          console.log(`callGroqWithRetry: Couldn't parse error message for wait time: ${e.message}`);
        }
        
        // Wait before retry
        console.log(`callGroqWithRetry: Waiting ${waitTime}ms before retry ${retryCount + 1}`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        retryCount++;
        continue;
      }
      
      // For other errors, throw and don't retry
      const errorText = await response.text();
      throw new Error(`GROQ API error: ${response.status} - ${errorText}`);
      
    } catch (error) {
      // If this is a network error or something we can retry
      if (retryCount < maxRetries && !error.message.includes('GROQ API error:')) {
        const waitTime = baseDelay * Math.pow(2, retryCount);
        console.log(`callGroqWithRetry: Error: ${error.message}. Retrying in ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        retryCount++;
      } else {
        // We've exhausted retries or got a non-retryable error
        throw error;
      }
    }
  }
  
  throw new Error(`Failed after ${maxRetries} retries`);
}