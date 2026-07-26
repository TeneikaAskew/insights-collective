import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createHmac } from "node:crypto";
import { requireAdminOrService } from '../_shared/auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const TWITTER_API_KEY = Deno.env.get('TWITTER_API_KEY')?.trim();
const TWITTER_API_KEY_SECRET = Deno.env.get('TWITTER_API_KEY_SECRET')?.trim();

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const TARGET_USERNAME = 'teneikaask_you';

function validateEnvironmentVariables() {
  if (!TWITTER_API_KEY) {
    throw new Error("Missing TWITTER_API_KEY environment variable");
  }
  if (!TWITTER_API_KEY_SECRET) {
    throw new Error("Missing TWITTER_API_KEY_SECRET environment variable");
  }
}

function generateOAuthSignature(
  method: string,
  url: string,
  params: Record<string, string>,
  consumerSecret: string,
  tokenSecret: string = ''
): string {
  const signatureBaseString = `${method}&${encodeURIComponent(
    url
  )}&${encodeURIComponent(
    Object.entries(params)
      .sort()
      .map(([k, v]) => `${k}=${v}`)
      .join("&")
  )}`;
  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;
  const hmacSha1 = createHmac("sha1", signingKey);
  const signature = hmacSha1.update(signatureBaseString).digest("base64");
  return signature;
}

function generateOAuthHeader(method: string, url: string, additionalParams: Record<string, string> = {}): string {
  const oauthParams = {
    oauth_consumer_key: TWITTER_API_KEY!,
    oauth_nonce: Math.random().toString(36).substring(2),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_version: "1.0",
    ...additionalParams
  };

  const signature = generateOAuthSignature(
    method,
    url,
    oauthParams,
    TWITTER_API_KEY_SECRET!
  );

  const signedOAuthParams = {
    ...oauthParams,
    oauth_signature: signature,
  };

  const entries = Object.entries(signedOAuthParams).sort((a, b) =>
    a[0].localeCompare(b[0])
  );

  return (
    "OAuth " +
    entries
      .map(([k, v]) => `${encodeURIComponent(k)}="${encodeURIComponent(v)}"`)
      .join(", ")
  );
}

async function getUserByUsername(username: string) {
  const url = `https://api.twitter.com/2/users/by/username/${username}`;
  const method = "GET";
  const oauthHeader = generateOAuthHeader(method, url);

  const response = await fetch(url, {
    method: method,
    headers: {
      Authorization: oauthHeader,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get user: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.data;
}

async function getUserTweets(userId: string, sinceId?: string, maxResults: number = 100) {
  let url = `https://api.twitter.com/2/users/${userId}/tweets?tweet.fields=created_at,public_metrics&max_results=${maxResults}`;
  
  if (sinceId) {
    url += `&since_id=${sinceId}`;
  }

  const method = "GET";
  const oauthHeader = generateOAuthHeader(method, url);

  const response = await fetch(url, {
    method: method,
    headers: {
      Authorization: oauthHeader,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get tweets: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data;
}

async function getLastScrapedTweetId(): Promise<string | null> {
  const { data, error } = await supabase
    .from('scrape_metadata')
    .select('value')
    .eq('key', 'last_scraped_tweet_id')
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
    console.error('Error getting last scraped tweet ID:', error);
    return null;
  }

  return data?.value || null;
}

// Returns false when the cursor update fails so the caller can report it
// honestly (the next run will re-fetch and dedupe via upsert on tweet_id).
async function updateLastScrapedTweetId(tweetId: string): Promise<boolean> {
  const { error } = await supabase
    .from('scrape_metadata')
    .upsert({
      key: 'last_scraped_tweet_id',
      value: tweetId
    });

  if (error) {
    console.error('Error updating last scraped tweet ID:', error);
    return false;
  }
  return true;
}

async function storeTweets(tweets: any[], userInfo: any) {
  const tweetData = tweets.map(tweet => ({
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

  const { error } = await supabase
    .from('tweets')
    .upsert(tweetData, { onConflict: 'tweet_id' });

  if (error) {
    console.error('Error storing tweets:', error);
    throw error;
  }

  console.log(`Stored ${tweetData.length} tweets`);
  return tweetData.length;
}

async function scrapeTweets() {
  try {
    validateEnvironmentVariables();
    
    console.log('Starting tweet scraping process...');
    
    // Get user info
    const userInfo = await getUserByUsername(TARGET_USERNAME);
    console.log('User info:', userInfo);
    
    // Get last scraped tweet ID for incremental updates
    const lastScrapedTweetId = await getLastScrapedTweetId();
    console.log('Last scraped tweet ID:', lastScrapedTweetId);
    
    let allTweets: any[] = [];
    let hasMoreTweets = true;
    let nextToken: string | undefined;
    // Records a mid-pagination failure so partial results are reported honestly
    let fetchWarning: string | null = null;

    // For full scrape (first run), we'll get more tweets
    const maxResults = lastScrapedTweetId ? 100 : 200;

    while (hasMoreTweets) {
      try {
        const tweetsResponse = await getUserTweets(
          userInfo.id, 
          lastScrapedTweetId || undefined,
          Math.min(maxResults - allTweets.length, 100)
        );
        
        if (!tweetsResponse.data || tweetsResponse.data.length === 0) {
          console.log('No more tweets found');
          break;
        }
        
        allTweets.push(...tweetsResponse.data);
        console.log(`Fetched ${tweetsResponse.data.length} tweets, total: ${allTweets.length}`);
        
        // Check if we have more tweets and haven't reached our limit
        if (tweetsResponse.meta?.next_token && allTweets.length < maxResults) {
          nextToken = tweetsResponse.meta.next_token;
          // Add a small delay to respect rate limits
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
          hasMoreTweets = false;
        }
        
      } catch (error) {
        // BEHAVIOR CHANGE (silent-failure audit): a fetch failure used to just
        // `break`, and the run was reported as an unqualified success. If the
        // FIRST batch fails we now surface the failure; if a later batch fails
        // we keep the partial results but attach an explicit warning.
        console.error('Error fetching tweets batch:', error);
        if (allTweets.length === 0) {
          throw error;
        }
        fetchWarning = `Stopped early after ${allTweets.length} tweets: ${(error as Error)?.message || String(error)}`;
        break;
      }
    }
    
    console.log(`Total tweets fetched: ${allTweets.length}`);
    
    if (allTweets.length > 0) {
      // Store tweets in database
      const storedCount = await storeTweets(allTweets, userInfo);
      
      // Update last scraped tweet ID with the most recent tweet
      const mostRecentTweet = allTweets.reduce((latest, current) => 
        new Date(current.created_at) > new Date(latest.created_at) ? current : latest
      );
      
      const cursorUpdated = await updateLastScrapedTweetId(mostRecentTweet.id);

      // Honest reporting: include partial-failure warnings instead of a clean success
      const warnings: string[] = [];
      if (fetchWarning) warnings.push(fetchWarning);
      if (!cursorUpdated) warnings.push('Failed to persist last_scraped_tweet_id; the next run will re-fetch and dedupe');

      return {
        success: true,
        tweetsProcessed: storedCount,
        isFirstRun: !lastScrapedTweetId,
        lastTweetId: mostRecentTweet.id,
        ...(warnings.length > 0 ? { warnings } : {})
      };
    } else {
      return {
        success: true,
        tweetsProcessed: 0,
        isFirstRun: !lastScrapedTweetId,
        message: 'No new tweets found'
      };
    }
    
  } catch (error: any) {
    console.error('Error in scraping process:', error);
    throw error;
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Deployed with verify_jwt=false and holding a service-role client, so this
  // was an unauthenticated write path into the database.
  const auth = await requireAdminOrService(req);
  if (auth.response) return auth.response;

  try {
    console.log('Twitter scraper function called');
    const result = await scrapeTweets();
    
    return new Response(JSON.stringify(result), {
      headers: { 
        ...corsHeaders,
        "Content-Type": "application/json" 
      },
    });
  } catch (error: any) {
    console.error('Twitter scraper error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }), 
      {
        status: 500,
        headers: { 
          ...corsHeaders,
          "Content-Type": "application/json" 
        },
      }
    );
  }
});