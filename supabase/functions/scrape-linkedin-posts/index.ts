
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
  // Try the existing access token first
  let accessToken = LINKEDIN_ACCESS_TOKEN!
  
  try {
    // Test the token with a simple API call
    const testResponse = await fetch(`${BASE_URL}/people/~?projection=(id)`, {
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

async function getPersonId(accessToken: string): Promise<string> {
  const url = `${BASE_URL}/people/~?projection=(id)`
  
  console.log('Fetching person ID')

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
    throw new Error(`Failed to get person ID: ${response.status} ${errorText}`)
  }

  const data = await response.json()
  console.log('Person data:', data)
  return data.id
}

async function fetchPosts(accessToken: string, personId: string, sinceDate?: string): Promise<any[]> {
  let url = `${BASE_URL}/shares?q=owners&owners=urn:li:person:${personId}&sharesPerOwner=50&sortBy=CREATED&projection=(elements*(id,text,createdTime,distribution,content,commentary,activity))`
  
  if (sinceDate) {
    // Add date filter if available
    url += `&createdTimeRange.start=${new Date(sinceDate).getTime()}`
  }

  console.log(`Fetching LinkedIn posts for person ${personId}`)
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
    throw new Error(`Failed to fetch posts: ${response.status} ${errorText}`)
  }

  const data = await response.json()
  console.log('Posts data:', data)
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

async function storePosts(posts: any[], userInfo: any): Promise<void> {
  if (posts.length === 0) {
    console.log('No posts to store')
    return
  }

  const postsToInsert = posts.map(post => {
    // Extract content from LinkedIn post structure
    const content = post.commentary || post.text || ''
    const createdTime = new Date(post.createdTime || Date.now())
    
    return {
      post_id: post.id,
      content: content,
      author_username: userInfo.username || 'teneikaaskew',
      author_display_name: userInfo.name || 'Teneika Askew',
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
    
    // Get person ID
    const personId = await getPersonId(accessToken)
    console.log('Person ID:', personId)

    // Get last scraped date for incremental updates
    const lastScrapedDate = await getLastScrapedDate()
    console.log('Last scraped date:', lastScrapedDate)

    // Fetch posts
    const posts = await fetchPosts(accessToken, personId, lastScrapedDate || undefined)
    console.log(`Fetched ${posts.length} posts`)

    if (posts.length === 0) {
      return { newPosts: 0, totalPosts: 0 }
    }

    // Get user info for storing
    const userInfo = {
      username: 'teneikaaskew',
      name: 'Teneika Askew'
    }

    // Store posts
    await storePosts(posts, userInfo)

    // Update last scraped date with the most recent post
    const mostRecentPost = posts.reduce((latest, current) => 
      new Date(current.createdTime) > new Date(latest.createdTime) ? current : latest
    )
    
    if (mostRecentPost) {
      await updateLastScrapedDate(new Date(mostRecentPost.createdTime).toISOString())
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
