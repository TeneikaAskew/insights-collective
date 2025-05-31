
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Environment variables
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const LINKEDIN_CLIENT_ID = Deno.env.get('LINKEDIN_CLIENT_ID')?.trim()
const LINKEDIN_CLIENT_SECRET = Deno.env.get('LINKEDIN_CLIENT_SECRET')?.trim()
const LINKEDIN_ACCESS_TOKEN = Deno.env.get('LINKEDIN_ACCESS_TOKEN')?.trim()
const LINKEDIN_REFRESH_TOKEN = Deno.env.get('LINKEDIN_REFRESH_TOKEN')?.trim()

// LinkedIn API configuration
const BASE_URL = 'https://api.linkedin.com/v2'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

function validateEnvironmentVariables() {
  console.log('Validating environment variables...')
  console.log('LINKEDIN_CLIENT_ID present:', !!LINKEDIN_CLIENT_ID)
  console.log('LINKEDIN_CLIENT_SECRET present:', !!LINKEDIN_CLIENT_SECRET)
  console.log('LINKEDIN_ACCESS_TOKEN present:', !!LINKEDIN_ACCESS_TOKEN)
  console.log('LINKEDIN_REFRESH_TOKEN present:', !!LINKEDIN_REFRESH_TOKEN)
  
  if (!LINKEDIN_CLIENT_ID) {
    throw new Error('Missing LINKEDIN_CLIENT_ID environment variable')
  }
  
  if (!LINKEDIN_CLIENT_SECRET) {
    throw new Error('Missing LINKEDIN_CLIENT_SECRET environment variable')
  }

  if (!LINKEDIN_ACCESS_TOKEN) {
    throw new Error('Missing LINKEDIN_ACCESS_TOKEN environment variable')
  }

  if (!LINKEDIN_REFRESH_TOKEN) {
    throw new Error('Missing LINKEDIN_REFRESH_TOKEN environment variable')
  }
}

async function refreshAccessToken(): Promise<string> {
  console.log('Refreshing LinkedIn access token...')
  
  const response = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: LINKEDIN_REFRESH_TOKEN!,
      client_id: LINKEDIN_CLIENT_ID!,
      client_secret: LINKEDIN_CLIENT_SECRET!,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('Failed to refresh token:', errorText)
    throw new Error(`Failed to refresh LinkedIn access token: ${response.status} ${errorText}`)
  }

  const data = await response.json()
  console.log('Token refreshed successfully')
  return data.access_token
}

async function getValidAccessToken(): Promise<string> {
  // Try the existing access token first with a simple, safe API call
  let accessToken = LINKEDIN_ACCESS_TOKEN!
  
  try {
    // Test the token with the most basic profile call - only first name
    const testResponse = await fetch(`${BASE_URL}/people/~?projection=(localizedFirstName)`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })

    if (testResponse.ok) {
      console.log('Existing access token is valid')
      return accessToken
    } else {
      console.log('Access token expired, refreshing...')
      return await refreshAccessToken()
    }
  } catch (error) {
    console.log('Error testing access token, attempting refresh:', error)
    return await refreshAccessToken()
  }
}

async function fetchPosts(accessToken: string, sinceDate?: string): Promise<any[]> {
  // Use the UGC Posts API directly without needing person ID
  let url = `${BASE_URL}/ugcPosts?q=authors&authors=List(urn:li:person:~)&sortBy=CREATED_TIME&count=50&projection=(elements*(id,specificContent,lifecycleState,lastModified,created,ugcPostHeader,author))`
  
  if (sinceDate) {
    // Add date filter if available
    const sinceTimestamp = new Date(sinceDate).getTime()
    url += `&createdTimeRange.start=${sinceTimestamp}`
  }

  console.log('Fetching LinkedIn posts using UGC Posts API')
  console.log('Request URL:', url)
  console.log('Since date:', sinceDate)

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  })

  console.log('Response status:', response.status)

  if (!response.ok) {
    const errorText = await response.text()
    console.error('Error response:', errorText)
    
    // Fallback to simplified shares endpoint if UGC Posts fails
    console.log('UGC Posts failed, trying simplified shares endpoint...')
    return await fetchPostsSimplified(accessToken, sinceDate)
  }

  const data = await response.json()
  console.log('Posts data:', data)
  return data.elements || []
}

async function fetchPostsSimplified(accessToken: string, sinceDate?: string): Promise<any[]> {
  // Use simplified shares endpoint without person ID requirement
  let url = `${BASE_URL}/shares?q=owners&owners=List(urn:li:person:~)&sharesPerOwner=50&sortBy=CREATED&projection=(elements*(id,text,createdTime,content,commentary))`
  
  if (sinceDate) {
    const sinceTimestamp = new Date(sinceDate).getTime()
    url += `&createdTimeRange.start=${sinceTimestamp}`
  }

  console.log('Fetching LinkedIn posts using simplified shares API')
  console.log('Request URL:', url)

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  })

  console.log('Simplified shares response status:', response.status)

  if (!response.ok) {
    const errorText = await response.text()
    console.error('Simplified shares error response:', errorText)
    throw new Error(`Failed to fetch posts: ${response.status} ${errorText}`)
  }

  const data = await response.json()
  console.log('Simplified shares posts data:', data)
  return data.elements || []
}

async function getLastScrapedDate(): Promise<string | null> {
  const { data, error } = await supabase
    .from('scrape_metadata')
    .select('value')
    .eq('key', 'last_scraped_linkedin_post_date')
    .single()

  if (error && error.code !== 'PGRST116') { // Not found error is OK
    console.error('Error getting last scraped date:', error)
    return null
  }

  return data?.value || null
}

async function updateLastScrapedDate(date: string): Promise<void> {
  const { error } = await supabase
    .from('scrape_metadata')
    .upsert({
      key: 'last_scraped_linkedin_post_date',
      value: date
    })

  if (error) {
    console.error('Error updating last scraped date:', error)
    throw error
  }
}

async function storePosts(posts: any[]): Promise<void> {
  if (posts.length === 0) {
    console.log('No posts to store')
    return
  }

  const postsToInsert = posts.map(post => {
    // Extract content from different LinkedIn post structures
    let content = ''
    let createdTime = new Date()
    
    // Handle UGC Posts API response structure
    if (post.specificContent && post.specificContent['com.linkedin.ugc.ShareContent']) {
      const shareContent = post.specificContent['com.linkedin.ugc.ShareContent']
      content = shareContent.shareCommentary?.text || ''
      createdTime = new Date(post.created?.time || post.lastModified?.time || Date.now())
    }
    // Handle traditional shares API response structure
    else {
      content = post.commentary || post.text || ''
      createdTime = new Date(post.createdTime || Date.now())
    }
    
    return {
      post_id: post.id,
      content: content,
      author_username: 'teneikaaskew',
      author_display_name: 'Teneika Askew',
      posted_at: createdTime.toISOString(),
      like_count: 0, // LinkedIn API doesn't provide engagement metrics in basic plan
      comment_count: 0,
      share_count: 0,
      media_urls: [], // Extract from content if available
      post_url: `https://www.linkedin.com/feed/update/${post.id}/`,
    }
  })

  console.log(`Storing ${postsToInsert.length} posts`)

  const { error } = await supabase
    .from('linkedin_posts')
    .upsert(postsToInsert, {
      onConflict: 'post_id',
      ignoreDuplicates: false
    })

  if (error) {
    console.error('Error storing posts:', error)
    throw error
  }

  console.log(`Successfully stored ${postsToInsert.length} posts`)
}

async function scrapePosts(): Promise<{ newPosts: number; totalPosts: number; error?: string }> {
  try {
    validateEnvironmentVariables()

    console.log('Starting LinkedIn post scrape')

    // Get valid access token (refresh if needed)
    const accessToken = await getValidAccessToken()
    console.log('Access token validated successfully')

    // Get last scraped date for incremental updates
    const lastScrapedDate = await getLastScrapedDate()
    console.log('Last scraped date:', lastScrapedDate)

    // Fetch posts directly - no need for person ID
    const posts = await fetchPosts(accessToken, lastScrapedDate || undefined)
    console.log(`Fetched ${posts.length} posts`)

    if (posts.length === 0) {
      return { newPosts: 0, totalPosts: 0 }
    }

    // Store posts
    await storePosts(posts)

    // Update last scraped date with the most recent post
    const mostRecentPost = posts.reduce((latest, current) => {
      const currentTime = current.created?.time || current.createdTime || 0
      const latestTime = latest.created?.time || latest.createdTime || 0
      return new Date(currentTime) > new Date(latestTime) ? current : latest
    })
    
    if (mostRecentPost) {
      const mostRecentTime = mostRecentPost.created?.time || mostRecentPost.createdTime
      await updateLastScrapedDate(new Date(mostRecentTime).toISOString())
    }

    // Get total post count
    const { count } = await supabase
      .from('linkedin_posts')
      .select('*', { count: 'exact', head: true })

    return { newPosts: posts.length, totalPosts: count || 0 }
  } catch (error: any) {
    console.error('Error in scraping process:', error)
    return {
      newPosts: 0,
      totalPosts: 0,
      error: error.message
    }
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('LinkedIn post scraping function called')
    
    const result = await scrapePosts()
    
    return new Response(
      JSON.stringify({
        success: !result.error,
        message: result.error || `Scraped ${result.newPosts} new posts. Total posts: ${result.totalPosts}`,
        data: result
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: result.error ? 500 : 200
      }
    )
  } catch (error: any) {
    console.error('Error in LinkedIn post scraping:', error)
    
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
