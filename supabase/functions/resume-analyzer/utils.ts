// This function sets up Supabase client with service role key credentials from env
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

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
  ANWAN: {
    DELAY_MS: 2000,
    MAX_RETRIES: 3,
    DAILY_LIMIT: 1000
  },
  GROQ: {
    DELAY_MS: 1000,
    MAX_RETRIES: 3,
    DAILY_LIMIT: 1000
  },
  TOGETHER: {
    DELAY_MS: 10000, // 10 seconds between calls to stay under 6 RPM
    MAX_RETRIES: 3,
    DAILY_LIMIT: 1000,
    MAX_CONCURRENT: 1 // Only allow one concurrent request
  },
  TOGETHER2: {
    DELAY_MS: 10000, // 10 seconds between calls to stay under 6 RPM
    MAX_RETRIES: 3,
    DAILY_LIMIT: 1000,
    MAX_CONCURRENT: 1 // Only allow one concurrent request
  }
};
const endpointStatus = {
  ANWAN: {
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
  },
  TOGETHER: {
    lastCallTime: 0,
    dailyCallCount: 0,
    failureCount: 0,
    isDisabled: false,
    resetTime: undefined
  },
  TOGETHER2: {
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
// ANWAN API call
async function callANWANAPI(system, user) {
  if (!canUseEndpoint('ANWAN')) {
    throw new Error('ANWAN API is currently disabled');
  }
  const ANWAN_API_KEY = Deno.env.get('ANWAN');
  if (!ANWAN_API_KEY) throw new Error('ANWAN API key not found');
  await enforceRateLimit('ANWAN');
  const resp = await fetch('https://api.awanllm.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ANWAN_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'Meta-Llama-3-8B-Instruct',
      messages: [
        {
          role: 'system',
          content: system
        },
        {
          role: 'user',
          content: user
        }
      ],
      temperature: 0.7,
      max_tokens: 500
    })
  });
  const responseText = await resp.text();
  handleApiResponse('ANWAN', resp, responseText);
  if (!resp.ok) {
    throw new Error(`ANWAN API failed: ${resp.status} ${responseText}`);
  }
  try {
    const json = JSON.parse(responseText);
    return json.choices?.[0]?.message?.content;
  } catch (e) {
    throw new Error(`Failed to parse ANWAN response: ${e.message}`);
  }
}
// GROQ API call
async function callGROQAPI(system, user) {
  if (!canUseEndpoint('GROQ')) {
    throw new Error('GROQ API is currently disabled');
  }
  const GROQ_API_KEY = Deno.env.get('GROQ');
  if (!GROQ_API_KEY) throw new Error('GROQ API key not found');
  await enforceRateLimit('GROQ');
  const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'compound-beta-mini',
      messages: [
        {
          role: 'system',
          content: system
        },
        {
          role: 'user',
          content: user
        }
      ],
      temperature: 0.7,
      max_tokens: 500
    })
  });
  const responseText = await resp.text();
  handleApiResponse('GROQ', resp, responseText);
  if (!resp.ok) {
    throw new Error(`GROQ API failed: ${resp.status} ${responseText}`);
  }
  try {
    const json = JSON.parse(responseText);
    return json.choices?.[0]?.message?.content;
  } catch (e) {
    throw new Error(`Failed to parse GROQ response: ${e.message}`);
  }
}
// TOGETHER API call
async function callTOGETHERAPI(system, user) {
  if (!canUseEndpoint('TOGETHER')) {
    throw new Error('TOGETHER API is currently disabled');
  }
  const TOGETHER_API_KEY = Deno.env.get('TOGETHER_API_KEY');
  if (!TOGETHER_API_KEY) throw new Error('TOGETHER API key not found');
  await enforceRateLimit('TOGETHER');
  const resp = await fetch('https://api.together.xyz/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOGETHER_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo-Free',
      messages: [
        {
          role: 'system',
          content: system
        },
        {
          role: 'user',
          content: user
        }
      ],
      temperature: 0.7,
      max_tokens: 500
    })
  });
  const responseText = await resp.text();
  handleApiResponse('TOGETHER', resp, responseText);
  if (!resp.ok) {
    throw new Error(`TOGETHER API failed: ${resp.status} ${responseText}`);
  }
  try {
    const json = JSON.parse(responseText);
    return json.choices?.[0]?.message?.content;
  } catch (e) {
    throw new Error(`Failed to parse TOGETHER response: ${e.message}`);
  }
}
async function callTOGETHERAPI2(system, user) {
  if (!canUseEndpoint('TOGETHER')) {
    throw new Error('TOGETHER API is currently disabled');
  }
  const TOGETHER_API_KEY = Deno.env.get('TOGETHER_API_KEY');
  if (!TOGETHER_API_KEY) throw new Error('TOGETHER API key not found');
  await enforceRateLimit('TOGETHER');
  const resp = await fetch('https://api.together.xyz/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOGETHER_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'deepseek-ai/DeepSeek-R1-Distill-Llama-70B-free',
      messages: [
        {
          role: 'system',
          content: system + 'Follow the instructions and do not speak in first person'
        },
        {
          role: 'user',
          content: user
        }
      ],
      temperature: 0.7,
      max_tokens: 500
    })
  });
  const responseText = await resp.text();
  handleApiResponse('TOGETHER', resp, responseText);
  if (!resp.ok) {
    throw new Error(`TOGETHER API 2 failed: ${resp.status} ${responseText}`);
  }
  try {
    const json = JSON.parse(responseText);
    return json.choices?.[0]?.message?.content;
  } catch (e) {
    throw new Error(`Failed to parse TOGETHER response: ${e.message}`);
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
    // Add delay between processing queue items to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 10000));
    await this.process();
  }
};
// Main LLM API call function with smart endpoint selection
export async function callLLMAPI(system, user) {
  validateInput(system, user);
  callTracking.addCall();
  const n = countTokens(system + user);
  console.log(`Prompt uses ${n} tokens`);
  
  // Get available endpoints
  const preferredOrder = ['TOGETHER', 'TOGETHER2', 'GROQ', 'ANWAN'];
  
  // Filter available endpoints in the preferred order
  const availableEndpoints = preferredOrder.filter(canUseEndpoint);
  
  if (availableEndpoints.length === 0) {
    throw new Error('No API endpoints are currently available');
  }

  // Wrap the API call in a queue
  return new Promise((resolve, reject) => {
    callQueue.add(async () => {
      // Try each available endpoint
      for (const endpoint of availableEndpoints) {
        try {
          let result;
          switch(endpoint) {
            case 'TOGETHER':
              result = await callTOGETHERAPI(system, user);
              break;
            case 'TOGETHER2':
              result = await callTOGETHERAPI2(system, user);
              break;
            case 'GROQ':
              result = await callGROQAPI(system, user);
              break;
            case 'ANWAN':
              result = await callANWANAPI(system, user);
              break;
          }
          resolve(result);
          return;
        } catch (error) {
          console.error(`${endpoint} API call failed:`, error);
          if (endpoint === availableEndpoints[availableEndpoints.length - 1]) {
            reject(error);
          }
        }
      }
    });
  });
}
// Retry wrapper with exponential backoff
export async function callLLMWithRetry(system, user, attempt = 1, maxAttempts = 3) {
  try {
    return await callLLMAPI(system, user);
  } catch (error) {
    if (attempt >= maxAttempts) {
      throw error;
    }
    // Calculate backoff with jitter
    const baseDelay = Math.min(1000 * Math.pow(2, attempt), 10000);
    const jitter = Math.random() * 1000;
    const delay = baseDelay + jitter;
    console.log(`Attempt ${attempt} failed, retrying in ${delay}ms`);
    await new Promise((resolve)=>setTimeout(resolve, delay));
    return callLLMWithRetry(system, user, attempt + 1, maxAttempts);
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