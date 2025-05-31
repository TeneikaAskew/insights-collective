
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { createHmac } from "node:crypto";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Environment variables
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const API_KEY = Deno.env.get('TWITTER_API_KEY')?.trim()
const API_SECRET = Deno.env.get('TWITTER_API_KEY_SECRET')?.trim()

// Twitter API configuration
const TARGET_USERNAME = 'teneikaask_you'
const BASE_URL = 'https://api.twitter.com/2'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

function validateEnvironmentVariables() {
  console.log('Validating environment variables...')
  console.log('API_KEY present:', !!API_KEY)
  console.log('API_SECRET present:', !!API_SECRET)
  
  if (!API_KEY) {
    throw new Error('Missing TWITTER_API_KEY environment variable')
  }
  if (!API_SECRET) {
    throw new Error('Missing TWITTER_API_KEY_SECRET environment variable')
  }
}

// OAuth 1.0a signature generation for Twitter API
function generateOAuthSignature(
  method: string,
  url: string,
  params: Record<string, string>,
  consumerSecret: string,
  tokenSecret: string = ''
): string {
  // Create signature base string
  const sortedParams = Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  
  const signatureBaseString = [
    method.toUpperCase(),
    encodeURIComponent(url),
    encodeURIComponent(sortedParams)
  ].join('&');
  
  console.log('Signature base string:', signatureBaseString);
  
  // Create signing key
  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;
  
  // Generate signature
  const hmacSha1 = createHmac('sha1', signingKey);
  const signature = hmacSha1.update(signatureBaseString).digest('base64');
  
  console.log('Generated signature:', signature);
  return signature;
}

function generateOAuthHeader(method: string, url: string, additionalParams: Record<string, string> = {}): string {
  const oauthParams = {
    oauth_consumer_key: API_KEY!,
    oauth_nonce: Math.random().toString(36).substring(2, 15),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_version: '1.0',
    ...additionalParams
  };

  const signature = generateOAuthSignature(method, url, oauthParams, API_SECRET!);

  const signedOAuthParams = {
    ...oauthParams,
    oauth_signature: signature,
  };

  const headerParts = Object.entries(signedOAuthParams)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${encodeURIComponent(key)}="${encodeURIComponent(value)}"`)
    .join(', ');

  return `OAuth ${headerParts}`;
}

async function getUserId(username: string): Promise<string> {
  const url = `${BASE_URL}/users/by/username/${username}`;
  const method = 'GET';
  
  console.log(`Fetching user ID for ${username}`);
  console.log('Request URL:', url);
  
  const oauthHeader = generateOAuthHeader(method, url);
  console.log('OAuth header:', oauthHeader);

  const response = await fetch(url, {
    method,
    headers: {
      'Authorization': oauthHeader,
      'Content-Type': 'application/json',
    },
  });

  console.log('Response status:', response.status);
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Error response:', errorText);
    throw new Error(`Failed to get user ID: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  console.log('User data:', data);
  return data.data.id;
}

async function fetchTweets(userId: string, sinceId?: string): Promise<any[]> {
  const baseUrl = `${BASE_URL}/users/${userId}/tweets`;
  const params: Record<string, string> = {
    'tweet.fields': 'created_at,public_metrics,author_id',
    'user.fields': 'username,name',
    'expansions': 'author_id',
    'max_results': '100'
  };

  if (sinceId) {
    params.since_id = sinceId;
  }

  const queryString = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

  const url = `${baseUrl}?${queryString}`;
  const method = 'GET';
  
  console.log(`Fetching tweets for user ${userId}`);
  console.log('Request URL:', url);
  console.log('Since ID:', sinceId);

  const oauthHeader = generateOAuthHeader(method, baseUrl, params);
  console.log('OAuth header:', oauthHeader);

  const response = await fetch(url, {
    method,
    headers: {
      'Authorization': oauthHeader,
      'Content-Type': 'application/json',
    },
  });

  console.log('Response status:', response.status);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Error response:', errorText);
    throw new Error(`Failed to fetch tweets: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  console.log('Tweets data:', data);
  return data.data || [];
}

async function getLastScrapedTweetId(): Promise<string | null> {
  const { data, error } = await supabase
    .from('scrape_metadata')
    .select('value')
    .eq('key', 'last_scraped_tweet_id')
    .single();

  if (error && error.code !== 'PGRST116') { // Not found error is OK
    console.error('Error getting last scraped tweet ID:', error);
    return null;
  }

  return data?.value || null;
}

async function updateLastScrapedTweetId(tweetId: string): Promise<void> {
  const { error } = await supabase
    .from('scrape_metadata')
    .upsert({
      key: 'last_scraped_tweet_id',
      value: tweetId
    });

  if (error) {
    console.error('Error updating last scraped tweet ID:', error);
    throw error;
  }
}

async function storeTweets(tweets: any[], userInfo: any): Promise<void> {
  if (tweets.length === 0) {
    console.log('No tweets to store');
    return;
  }

  const tweetsToInsert = tweets.map(tweet => ({
    tweet_id: tweet.id,
    content: tweet.text,
    author_username: userInfo.username,
    author_display_name: userInfo.name,
    tweeted_at: tweet.created_at,
    like_count: tweet.public_metrics?.like_count || 0,
    retweet_count: tweet.public_metrics?.retweet_count || 0,
    reply_count: tweet.public_metrics?.reply_count || 0,
    quote_count: tweet.public_metrics?.quote_count || 0,
  }));

  console.log(`Storing ${tweetsToInsert.length} tweets`);

  const { error } = await supabase
    .from('tweets')
    .upsert(tweetsToInsert, {
      onConflict: 'tweet_id',
      ignoreDuplicates: false
    });

  if (error) {
    console.error('Error storing tweets:', error);
    throw error;
  }

  console.log(`Successfully stored ${tweetsToInsert.length} tweets`);
}

async function scrapeTweets(): Promise<{ newTweets: number; totalTweets: number }> {
  validateEnvironmentVariables();

  console.log('Starting tweet scrape for', TARGET_USERNAME);

  // Get user ID
  const userId = await getUserId(TARGET_USERNAME);
  console.log('User ID:', userId);

  // Get last scraped tweet ID for incremental updates
  const lastScrapedTweetId = await getLastScrapedTweetId();
  console.log('Last scraped tweet ID:', lastScrapedTweetId);

  // Fetch tweets
  const tweets = await fetchTweets(userId, lastScrapedTweetId || undefined);
  console.log(`Fetched ${tweets.length} tweets`);

  if (tweets.length === 0) {
    return { newTweets: 0, totalTweets: 0 };
  }

  // Get user info for storing
  const userInfo = {
    username: TARGET_USERNAME,
    name: 'Teneika Askew'
  };

  // Store tweets
  await storeTweets(tweets, userInfo);

  // Update last scraped tweet ID with the most recent tweet
  const mostRecentTweet = tweets.reduce((latest, current) => 
    new Date(current.created_at) > new Date(latest.created_at) ? current : latest
  );
  
  if (mostRecentTweet) {
    await updateLastScrapedTweetId(mostRecentTweet.id);
  }

  // Get total tweet count
  const { count } = await supabase
    .from('tweets')
    .select('*', { count: 'exact', head: true });

  return { newTweets: tweets.length, totalTweets: count || 0 };
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('Tweet scraping function called');
    
    const result = await scrapeTweets();
    
    return new Response(
      JSON.stringify({
        success: true,
        message: `Scraped ${result.newTweets} new tweets. Total tweets: ${result.totalTweets}`,
        data: result
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )
  } catch (error: any) {
    console.error('Error in tweet scraping:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        details: error.stack
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})
