
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

  let retries = 0
  const maxRetries = 3
  
  while (retries < maxRetries) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${BEARER_TOKEN}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('Response status:', response.status)

      if (response.status === 429) {
        // Rate limited - wait and retry
        const retryAfter = parseInt(response.headers.get('x-rate-limit-reset') || '900')
        console.log(`Rate limited. Retrying after ${retryAfter} seconds`)
        await new Promise(resolve => setTimeout(resolve, Math.min(retryAfter * 1000, 60000))) // Max 1 minute wait
        retries++
        continue
      }

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Error response:', errorText)
        
        if (retries < maxRetries - 1) {
          console.log(`Retrying... Attempt ${retries + 1}/${maxRetries}`)
          retries++
          await new Promise(resolve => setTimeout(resolve, 2000 * (retries))) // Exponential backoff
          continue
        }
        
        throw new Error(`Failed to fetch tweets: ${response.status} ${errorText}`)
      }

      const data = await response.json()
      console.log('Tweets data:', data)
      return data.data || []
      
    } catch (error) {
      if (retries < maxRetries - 1) {
        console.log(`Request failed, retrying... Attempt ${retries + 1}/${maxRetries}`, error)
        retries++
        await new Promise(resolve => setTimeout(resolve, 2000 * retries))
        continue
      }
      throw error
    }
  }
  
  return []
}

async function getLastScrapedTweetId(): Promise<string | null> {
  const { data, error } = await supabase
    .from('scrape_metadata')
    .select('value')
    .eq('key', 'last_scraped_tweet_id')
    .maybeSingle()

  if (error && error.code !== 'PGRST116') { // Not found error is OK
    console.error('Error getting last scraped tweet ID:', error)
    return null
  }

  return data?.value || null
}

async function updateLastScrapedTweetId(tweetId: string): Promise<void> {
  console.log(`Updating last scraped tweet ID to: ${tweetId}`)
  
  // First try to update existing record
  const { data: updateData, error: updateError } = await supabase
    .from('scrape_metadata')
    .update({ value: tweetId, updated_at: new Date().toISOString() })
    .eq('key', 'last_scraped_tweet_id')
    .select()

  if (updateError) {
    console.error('Error updating last scraped tweet ID:', updateError)
    throw updateError
  }

  // If no rows were updated, insert a new record
  if (!updateData || updateData.length === 0) {
    console.log('No existing record found, inserting new one')
    const { error: insertError } = await supabase
      .from('scrape_metadata')
      .insert({
        key: 'last_scraped_tweet_id',
        value: tweetId
      })

    if (insertError) {
      // Check if it's a duplicate key error (race condition)
      if (insertError.code === '23505') {
        console.log('Duplicate key detected during insert, trying update again')
        const { error: retryUpdateError } = await supabase
          .from('scrape_metadata')
          .update({ value: tweetId, updated_at: new Date().toISOString() })
          .eq('key', 'last_scraped_tweet_id')
        
        if (retryUpdateError) {
          console.error('Error on retry update:', retryUpdateError)
          throw retryUpdateError
        }
      } else {
        console.error('Error inserting last scraped tweet ID:', insertError)
        throw insertError
      }
    }
  }
  
  console.log('Successfully updated last scraped tweet ID')
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

async function logCronExecution(jobName: string, success: boolean, responseData?: any, errorMessage?: string): Promise<void> {
  try {
    await supabase
      .from('cron_job_logs')
      .insert({
        job_name: jobName,
        success,
        response_data: responseData || null,
        error_message: errorMessage || null
      })
  } catch (error) {
    console.error('Failed to log cron execution:', error)
  }
}

async function scrapeTweets(isAutomated = false, source = 'manual'): Promise<{ newTweets: number; totalTweets: number }> {
  validateEnvironmentVariables()

  console.log(`Starting tweet scrape for ${TARGET_USERNAME} (${isAutomated ? 'automated' : 'manual'} - ${source})`)

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
    console.log('No new tweets found')
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
    
    const body = await req.json().catch(() => ({}))
    const isAutomated = body.automated || false
    const source = body.source || 'manual'
    
    const result = await scrapeTweets(isAutomated, source)
    
    // Log cron execution if automated
    if (isAutomated) {
      await logCronExecution('daily-tweet-scraper', true, result)
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        message: `Scraped ${result.newTweets} new tweets. Total tweets: ${result.totalTweets}`,
        data: result,
        automated: isAutomated,
        source: source
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )
  } catch (error: any) {
    console.error('Error in tweet scraping:', error)
    
    // Log cron execution failure if automated
    const body = await req.json().catch(() => ({}))
    if (body.automated) {
      await logCronExecution('daily-tweet-scraper', false, null, error.message)
    }
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        details: error.stack,
        automated: body.automated || false,
        source: body.source || 'manual'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})
