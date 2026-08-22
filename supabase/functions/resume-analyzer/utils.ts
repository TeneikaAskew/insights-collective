// ABOUTME: Utility functions for the resume-analyzer edge function including LLM API calls
// ABOUTME: Provides provider fallback (Gemini primary, GROQ fallback) and rate limiting

import { createClient } from 'npm:@supabase/supabase-js@2';

// Simple token estimation without external dependency
function countTokens(text: string): number {
  // Approximate: ~4 characters per token for English text
  return Math.ceil(text.length / 4);
}
// Call tracking system
export const callTracking = {
  calls: [],
  lastMinute: Math.floor(Date.now() / 60000),
  addCall () {
    const currentMinute = Math.floor(Date.now() / 60000);
    if (currentMinute !== this.lastMinute) {
      // New minute started, log the previous minute's calls
      console.log(`Minute ${this.lastMinute}: ${this.calls.length} API calls`);
      this.calls = [];
      this.lastMinute = currentMinute;
    }
    this.calls.push(Date.now());
    console.log(`Current minute (${currentMinute}): ${this.calls.length} API calls`);
  }
};
// API Rate Limits Configuration
const API_CONFIG = {
  GEMINI: {
    DELAY_MS: 1000,
    MAX_RETRIES: 3,
    DAILY_LIMIT: 5000
  },
  GROQ: {
    DELAY_MS: 1000,
    MAX_RETRIES: 3,
    DAILY_LIMIT: 1000
  }
};
const endpointStatus = {
  GEMINI: {
    lastCallTime: 0,
    dailyCallCount: 0,
    failureCount: 0,
    isDisabled: false,
    resetTime: undefined
  },
  GROQ: {
    lastCallTime: 0,
    dailyCallCount: 0,
    failureCount: 0,
    isDisabled: false,
    resetTime: undefined
  }
};
// Reset daily counters at midnight UTC
function scheduleCounterReset() {
  const now = Date.now();
  const tomorrow = new Date();
  tomorrow.setUTCHours(24, 0, 0, 0);
  const timeUntilReset = tomorrow.getTime() - now;
  setTimeout(()=>{
    Object.keys(endpointStatus).forEach((endpoint)=>{
      endpointStatus[endpoint].dailyCallCount = 0;
      endpointStatus[endpoint].failureCount = 0;
      endpointStatus[endpoint].isDisabled = false;
      endpointStatus[endpoint].resetTime = undefined;
    });
    scheduleCounterReset(); // Schedule next reset
  }, timeUntilReset);
}
scheduleCounterReset();
// Input validation
function validateInput(system, user) {
  if (!system?.trim()) {
    throw new Error('System prompt cannot be empty');
  }
  if (!user?.trim()) {
    throw new Error('User prompt cannot be empty');
  }
}
// Rate limiting helper
async function enforceRateLimit(endpoint) {
  const status = endpointStatus[endpoint];
  const config = API_CONFIG[endpoint];
  const now = Date.now();
  // Check if enough time has passed since last call
  const timeSinceLastCall = now - status.lastCallTime;
  if (timeSinceLastCall < config.DELAY_MS) {
    const waitTime = config.DELAY_MS - timeSinceLastCall;
    await new Promise((resolve)=>setTimeout(resolve, waitTime));
  }
  status.lastCallTime = Date.now();
  status.dailyCallCount++;
}
// Check if endpoint should be used
function canUseEndpoint(endpoint) {
  const status = endpointStatus[endpoint];
  const config = API_CONFIG[endpoint];
  if (status.isDisabled) return false;
  if (status.dailyCallCount >= config.DAILY_LIMIT) {
    status.isDisabled = true;
    return false;
  }
  if (status.failureCount >= config.MAX_RETRIES) {
    status.isDisabled = true;
    return false;
  }
  return true;
}
// Handle API response
function handleApiResponse(endpoint, response, responseText) {
  const status = endpointStatus[endpoint];
  if (response.status === 429) {
    status.failureCount++;
    if (responseText.includes('per day') || responseText.includes('daily limit')) {
      status.isDisabled = true;
      status.resetTime = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    }
  } else if (!response.ok) {
    status.failureCount++;
  }
}

// Options for tool calling support
export interface LLMCallOptions {
  tools?: any[];
  tool_choice?: any;
}

// Extract tool call result from response JSON
function extractToolCallResult(json: any): string {
  const toolCalls = json.choices?.[0]?.message?.tool_calls;
  if (toolCalls && toolCalls.length > 0) {
    const args = toolCalls[0].function?.arguments;
    if (typeof args === 'string') {
      return args; // Return raw JSON string for caller to parse
    }
    return JSON.stringify(args);
  }
  // Fallback to regular content
  return json.choices?.[0]?.message?.content;
}

// Gemini API call via Lovable AI Gateway
async function callGeminiAPI(system, user, options?: LLMCallOptions) {
  if (!canUseEndpoint('GEMINI')) {
    throw new Error('Gemini API is currently disabled');
  }
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not found');
  await enforceRateLimit('GEMINI');

  const body: any = {
    model: 'google/gemini-2.5-flash',
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ],
    temperature: 0.7,
    max_tokens: 2000
  };
  if (options?.tools) body.tools = options.tools;
  if (options?.tool_choice) body.tool_choice = options.tool_choice;

  const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  const responseText = await resp.text();
  handleApiResponse('GEMINI', resp, responseText);
  if (!resp.ok) {
    throw new Error(`Gemini API failed: ${resp.status} ${responseText}`);
  }
  try {
    const json = JSON.parse(responseText);
    return extractToolCallResult(json);
  } catch (e) {
    throw new Error(`Failed to parse Gemini response: ${e.message}`);
  }
}
// GROQ API call
async function callGROQAPI(system, user, options?: LLMCallOptions) {
  if (!canUseEndpoint('GROQ')) {
    throw new Error('GROQ API is currently disabled');
  }
  const GROQ_API_KEY = Deno.env.get('GROQ');
  if (!GROQ_API_KEY) throw new Error('GROQ API key not found');
  await enforceRateLimit('GROQ');

  const body: any = {
    // Replaces compound-beta-mini, which answers `400 tool calling is not
    // supported with this model`. AI_ENHANCER — the elevator pitch, the three
    // improvement themes, the grade explanation — is a tool call, so this
    // fallback could never serve it: whenever Gemini was unavailable the
    // enhancer fell through to empty content without raising an error.
    model: 'openai/gpt-oss-120b',
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ],
    temperature: 0.7,
    // Was 500 against the Gemini primary's 2000, so even the non-tool paths
    // came back quartered whenever this branch served them.
    max_tokens: 2000
  };
  if (options?.tools) body.tools = options.tools;
  if (options?.tool_choice) body.tool_choice = options.tool_choice;

  const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  const responseText = await resp.text();
  handleApiResponse('GROQ', resp, responseText);
  if (!resp.ok) {
    throw new Error(`GROQ API failed: ${resp.status} ${responseText}`);
  }
  try {
    const json = JSON.parse(responseText);
    return extractToolCallResult(json);
  } catch (e) {
    throw new Error(`Failed to parse GROQ response: ${e.message}`);
  }
}
// Call queue system
const callQueue = {
  queue: [] as Array<() => Promise<any>>,
  processing: false,
  async add(fn: () => Promise<any>) {
    this.queue.push(fn);
    if (!this.processing) {
      await this.process();
    }
  },
  async process() {
    if (this.queue.length === 0) {
      this.processing = false;
      return;
    }
    this.processing = true;
    const fn = this.queue.shift();
    if (fn) {
      try {
        await fn();
      } catch (error) {
        console.error('Error processing queue item:', error);
      }
    }
    // Short delay between processing queue items
    await new Promise(resolve => setTimeout(resolve, 2000));
    await this.process();
  }
};
// Main LLM API call function with smart endpoint selection
export async function callLLMAPI(system, user, label = "LLM", options?: LLMCallOptions) {
  validateInput(system, user);
  callTracking.addCall();
  const n = countTokens(system + user);
  console.log(`[${label}] Prompt uses ${n} tokens`);
  
  // Get available endpoints - Gemini first, then fallbacks
  const preferredOrder = ['GEMINI', 'GROQ'];
  
  // Filter available endpoints in the preferred order
  const availableEndpoints = preferredOrder.filter(canUseEndpoint);
  
  if (availableEndpoints.length === 0) {
    throw new Error('No API endpoints are currently available');
  }

  // Wrap the API call in a queue
  return new Promise((resolve, reject) => {
    callQueue.add(async () => {
      // Try each available endpoint with a per-call timeout
      for (const endpoint of availableEndpoints) {
        try {
          const timeoutPromise = new Promise((_, timeoutReject) => 
            setTimeout(() => timeoutReject(new Error(`${endpoint} timed out after 15s`)), 15000)
          );
          let resultPromise;
          switch(endpoint) {
            case 'GEMINI':
              resultPromise = callGeminiAPI(system, user, options);
              break;
            case 'GROQ':
              resultPromise = callGROQAPI(system, user, options);
              break;
          }
          const result = await Promise.race([resultPromise, timeoutPromise]);
          console.log(`[${label}] Successfully used ${endpoint} endpoint`);
          resolve(result);
          return;
        } catch (error) {
          console.error(`[${label}] ${endpoint} API call failed:`, error);
          if (endpoint === availableEndpoints[availableEndpoints.length - 1]) {
            reject(error);
          }
        }
      }
    });
  });
}
// Retry wrapper with exponential backoff
export async function callLLMWithRetry(system, user, attempt = 1, maxAttempts = 3, label = "LLM", options?: LLMCallOptions): Promise<string> {
  try {
    return await callLLMAPI(system, user, label, options);
  } catch (error) {
    if (attempt >= maxAttempts) {
      throw error;
    }
    // Calculate backoff with jitter
    const baseDelay = Math.min(1000 * Math.pow(2, attempt), 10000);
    const jitter = Math.random() * 1000;
    const delay = baseDelay + jitter;
    console.log(`[${label}] Attempt ${attempt} failed, retrying in ${delay}ms`);
    await new Promise((resolve)=>setTimeout(resolve, delay));
    return callLLMWithRetry(system, user, attempt + 1, maxAttempts, label, options);
  }
}
// Export other utility functions
export const supabase = getSupabaseClient();
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info, apikey',
  'Access-Control-Allow-Credentials': 'true',
  'Content-Type': 'application/json',
  'Access-Control-Max-Age': '86400'
};
// Utility functions
export function handleOptions(req) {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  return null;
}
function getSupabaseClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase credentials');
  }
  return createClient(supabaseUrl, supabaseKey);
}
// Export endpoint status checking functions
export function getEndpointStatus() {
  return Object.entries(endpointStatus).map(([endpoint, status])=>({
      endpoint,
      isAvailable: canUseEndpoint(endpoint),
      dailyCallCount: status.dailyCallCount,
      failureCount: status.failureCount,
      isDisabled: status.isDisabled,
      resetTime: status.resetTime
    }));
}
export function resetEndpoint(endpoint) {
  if (endpoint in endpointStatus) {
    endpointStatus[endpoint] = {
      lastCallTime: 0,
      dailyCallCount: 0,
      failureCount: 0,
      isDisabled: false
    };
  }
}
