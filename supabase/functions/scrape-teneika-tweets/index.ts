
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Environment variables
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const BEARER_TOKEN = Deno.env.get('TWITTER_BEARER_TOKEN')?.trim()

// Twitter API configuration
const TARGET_USERNAME = 'teneikaask_you'
const BASE_URL = 'https://api.twitter.com/2'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

function validateEnvironmentVariables() {
  console.log('Validating environment variables...')
  console.log('BEARER_TOKEN present:', !!BEARER_TOKEN)
  
  if (!BEARER_TOKEN) {
    throw new Error('Missing TWITTER_BEARER_TOKEN environment variable')
  }
}

async function getUserId(username: string): Promise<string> {
  const url = `${BASE_URL}/users/by/username/${username}`
  
  console.log(`Fetching user ID for ${username}`)
  console.log('Request URL:', url)

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${BEARER_TOKEN}`,
      'Content-Type': 'application/json',
    },
  });

  console.log('Response status:', response.status)
  
  if (!response.ok) {
    const errorText = await response.text()
    console.error('Error response:', errorText)
    throw new Error(`Failed to get user ID: ${response.status} ${errorText}`)
  }

  const data = await response.json()
  console.log('User data:', data)
  return data.data.id
}

async function fetchTweets(userId: string, sinceId?: string): Promise<any[]> {
  const params = new URLSearchParams({
    'tweet.fields': 'created_at,public_metrics,author_id',
    'user.fields': 'username,name',
    'expansions': 'author_id',
    'max_results': '100'
  })

  if (sinceId) {
    params.append('since_id', sinceId)
  }

  const url = `${BASE_URL}/users/${userId}/tweets?${params.toString()}`
  
  console.log(`Fetching tweets for user ${userId}`)
  console.log('Request URL:', url)
  console.log('Since ID:', sinceId)

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${BEARER_TOKEN}`,
      'Content-Type': 'application/json',
    },
  });

  console.log('Response status:', response.status)

  if (!response.ok) {
    const errorText = await response.text()
    console.error('Error response:', errorText)
    throw new Error(`Failed to fetch tweets: ${response.status} ${errorText}`)
  }

  const data = await response.json()
  console.log('Tweets data:', data)
  return data.data || []
}

async function getLastScrapedTweetId(): Promise<string | null> {
  const { data, error } = await supabase
    .from('scrape_metadata')
    .select('value')
    .eq('key', 'last_scraped_tweet_id')
    .single()

  if (error && error.code !== 'PGRST116') { // Not found error is OK
    console.error('Error getting last scraped tweet ID:', error)
    return null
  }

  return data?.value || null
}

async function updateLastScrapedTweetId(tweetId: string): Promise<void> {
  const { error } = await supabase
    .from('scrape_metadata')
    .upsert({
      key: 'last_scraped_tweet_id',
      value: tweetId
    })

  if (error) {
    console.error('Error updating last scraped tweet ID:', error)
    throw error
  }
}

async function storeTweets(tweets: any[], userInfo: any): Promise<void> {
  if (tweets.length === 0) {
    console.log('No tweets to store')
    return
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
  }))

  console.log(`Storing ${tweetsToInsert.length} tweets`)

  const { error } = await supabase
    .from('tweets')
    .upsert(tweetsToInsert, {
      onConflict: 'tweet_id',
      ignoreDuplicates: false
    })

  if (error) {
    console.error('Error storing tweets:', error)
    throw error
  }

  console.log(`Successfully stored ${tweetsToInsert.length} tweets`)
}

async function scrapeTweets(): Promise<{ newTweets: number; totalTweets: number }> {
  validateEnvironmentVariables()

  console.log('Starting tweet scrape for', TARGET_USERNAME)

  // Get user ID
  const userId = await getUserId(TARGET_USERNAME)
  console.log('User ID:', userId)

  // Get last scraped tweet ID for incremental updates
  const lastScrapedTweetId = await getLastScrapedTweetId()
  console.log('Last scraped tweet ID:', lastScrapedTweetId)

  // Fetch tweets
  const tweets = await fetchTweets(userId, lastScrapedTweetId || undefined)
  console.log(`Fetched ${tweets.length} tweets`)

  if (tweets.length === 0) {
    return { newTweets: 0, totalTweets: 0 }
  }

  // Get user info for storing
  const userInfo = {
    username: TARGET_USERNAME,
    name: 'Teneika Askew'
  }

  // Store tweets
  await storeTweets(tweets, userInfo)

  // Update last scraped tweet ID with the most recent tweet
  const mostRecentTweet = tweets.reduce((latest, current) => 
    new Date(current.created_at) > new Date(latest.created_at) ? current : latest
  )
  
  if (mostRecentTweet) {
    await updateLastScrapedTweetId(mostRecentTweet.id)
  }

  // Get total tweet count
  const { count } = await supabase
    .from('tweets')
    .select('*', { count: 'exact', head: true })

  return { newTweets: tweets.length, totalTweets: count || 0 }
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('Tweet scraping function called')
    
    const result = await scrapeTweets()
    
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
    console.error('Error in tweet scraping:', error)
    
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
