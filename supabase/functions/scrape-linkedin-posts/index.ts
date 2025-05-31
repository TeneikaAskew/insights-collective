
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

// LinkedIn API configuration
const BASE_URL = 'https://api.linkedin.com/v2'
const TARGET_USER_URN = 'urn:li:person:teneikaaskew' // This will need to be the actual LinkedIn URN

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

function validateEnvironmentVariables() {
  console.log('Validating environment variables...')
  console.log('LINKEDIN_CLIENT_ID present:', !!LINKEDIN_CLIENT_ID)
  console.log('LINKEDIN_CLIENT_SECRET present:', !!LINKEDIN_CLIENT_SECRET)
  
  if (!LINKEDIN_CLIENT_ID) {
    throw new Error('Missing LINKEDIN_CLIENT_ID environment variable')
  }
  
  if (!LINKEDIN_CLIENT_SECRET) {
    throw new Error('Missing LINKEDIN_CLIENT_SECRET environment variable')
  }
}

// For now, we'll need to implement OAuth flow to get access token
// This is a simplified version that assumes we have a valid access token
async function getAccessToken(): Promise<string> {
  // In a production environment, you would:
  // 1. Implement OAuth 2.0 flow to get initial token
  // 2. Store refresh token in database
  // 3. Refresh token when needed
  
  // For now, we'll return a placeholder - this needs OAuth implementation
  throw new Error('OAuth implementation required - please implement LinkedIn OAuth flow first')
}

async function getPersonId(accessToken: string): Promise<string> {
  const url = `${BASE_URL}/people/~?projection=(id)`
  
  console.log('Fetching person ID')
  console.log('Request URL:', url)

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

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
  let url = `${BASE_URL}/shares?q=owners&owners=${personId}&sharesPerOwner=50&sortBy=CREATED&projection=(elements*(id,text,createdTime,distribution,content,commentary,activity))`
  
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
  });

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

    // Note: This requires OAuth implementation
    // For now, we'll return an informative error
    return {
      newPosts: 0,
      totalPosts: 0,
      error: 'LinkedIn OAuth implementation required. Please set up OAuth 2.0 flow to obtain access tokens.'
    }

    // Uncomment and modify the code below once OAuth is implemented:
    /*
    // Get access token (requires OAuth implementation)
    const accessToken = await getAccessToken()
    
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
    */
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
