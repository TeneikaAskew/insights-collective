import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { requireAdminOrService } from '../_shared/auth.ts'
//test
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

// Your LinkedIn user ID
const LINKEDIN_USER_ID = '8WyM7mYjqF'

function validateEnvironmentVariables() {
  console.log('Validating environment variables...')
  console.log('LINKEDIN_CLIENT_ID present:', !!LINKEDIN_CLIENT_ID)
  console.log('LINKEDIN_CLIENT_SECRET present:', !!LINKEDIN_CLIENT_SECRET)
  console.log('LINKEDIN_ACCESS_TOKEN present:', !!LINKEDIN_ACCESS_TOKEN)
  console.log('LINKEDIN_REFRESH_TOKEN present:', !!LINKEDIN_REFRESH_TOKEN)
  
  if (!LINKEDIN_CLIENT_ID || !LINKEDIN_CLIENT_SECRET || !LINKEDIN_ACCESS_TOKEN || !LINKEDIN_REFRESH_TOKEN) {
    throw new Error('Missing required LinkedIn environment variables')
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
  let accessToken = LINKEDIN_ACCESS_TOKEN!
  
  try {
    // Use the /me endpoint to test token validity and get user info
    const testResponse = await fetch(`${BASE_URL}/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0'
      },
    })

    if (testResponse.ok) {
      const userData = await testResponse.json()
      console.log('Existing access token is valid for user:', userData.id)
      return accessToken
    } else if (testResponse.status === 401) {
      console.log('Access token expired, refreshing...')
      return await refreshAccessToken()
    } else if (testResponse.status === 429) {
      throw new Error('Rate limit exceeded - please wait before trying again')
    } else {
      throw new Error(`Token validation failed: ${testResponse.status}`)
    }
  } catch (error) {
    console.log('Error testing access token:', error)
    if (error instanceof Error && error.message.includes('Rate limit')) {
      throw error
    }
    return await refreshAccessToken()
  }
}

async function fetchPosts(accessToken: string, sinceDate?: string): Promise<any[]> {
  console.log('Fetching posts using member permissions...')

  // Since the error says "Member permissions must be used when using member as author"
  // Let's try different approaches for member posts

  // Method 1: Try without specifying author (should default to authenticated user)
  try {
    console.log('Method 1: Trying posts endpoint without author parameter...')
    
    let url = `https://api.linkedin.com/rest/posts?q=author&sortBy=LAST_MODIFIED&count=50`

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0'
      },
    })

    console.log('Method 1 response status:', response.status)

    if (response.ok) {
      const data = await response.json()
      console.log('Method 1 success:', data.elements?.length || 0)
      return processPostsData(data.elements || [], sinceDate)
    } else {
      const errorText = await response.text()
      console.log('Method 1 error:', errorText)
    }
  } catch (error) {
    console.log('Method 1 failed:', error)
  }

  // Method 2: Try with "me" as author
  try {
    console.log('Method 2: Trying with "me" as author...')
    
    let url = `https://api.linkedin.com/rest/posts?q=author&author=me&sortBy=LAST_MODIFIED&count=50`

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0'
      },
    })

    console.log('Method 2 response status:', response.status)

    if (response.ok) {
      const data = await response.json()
      console.log('Method 2 success:', data.elements?.length || 0)
      return processPostsData(data.elements || [], sinceDate)
    } else {
      const errorText = await response.text()
      console.log('Method 2 error:', errorText)
    }
  } catch (error) {
    console.log('Method 2 failed:', error)
  }

  // Method 3: Try the Analytics API since you have r_member_postAnalytics
  try {
    console.log('Method 3: Trying analytics endpoint for posts...')
    
    let url = `https://api.linkedin.com/rest/socialMetadata?q=post&sortBy=LAST_MODIFIED&count=50`

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0'
      },
    })

    console.log('Method 3 response status:', response.status)

    if (response.ok) {
      const data = await response.json()
      console.log('Method 3 success:', data.elements?.length || 0)
      return processPostsData(data.elements || [], sinceDate)
    } else {
      const errorText = await response.text()
      console.log('Method 3 error:', errorText)
    }
  } catch (error) {
    console.log('Method 3 failed:', error)
  }

  // Method 4: Try member-specific finder
  try {
    console.log('Method 4: Trying member-specific posts finder...')
    
    let url = `https://api.linkedin.com/rest/posts?q=memberPosts&sortBy=LAST_MODIFIED&count=50`

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0'
      },
    })

    console.log('Method 4 response status:', response.status)

    if (response.ok) {
      const data = await response.json()
      console.log('Method 4 success:', data.elements?.length || 0)
      return processPostsData(data.elements || [], sinceDate)
    } else {
      const errorText = await response.text()
      console.log('Method 4 error:', errorText)
    }
  } catch (error) {
    console.log('Method 4 failed:', error)
  }

  // Method 5: Try v2 API for member posts
  return await fetchPostsV2Member(accessToken, sinceDate)
}

async function fetchPostsV2Member(accessToken: string, sinceDate?: string): Promise<any[]> {
  console.log('Method 5: Trying v2 API for member posts...')
  
  try {
    // Try v2 people endpoint for current user's posts
    let url = `https://api.linkedin.com/v2/people/~/posts?sortBy=LAST_MODIFIED&count=50`

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0'
      },
    })

    console.log('V2 member posts response status:', response.status)

    if (response.ok) {
      const data = await response.json()
      console.log('V2 member posts success:', data.elements?.length || 0)
      return processPostsData(data.elements || [], sinceDate)
    } else {
      const errorText = await response.text()
      console.log('V2 member posts error:', errorText)
    }
  } catch (error) {
    console.log('V2 member posts failed:', error)
  }

  // Method 6: Try ugcPosts with ~ (current user)
  try {
    console.log('Method 6: Trying ugcPosts with current user...')
    
    let url = `https://api.linkedin.com/v2/ugcPosts?q=authors&authors=List(urn:li:person:~)&sortBy=LAST_MODIFIED&count=50`

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0'
      },
    })

    console.log('UGC Posts current user response status:', response.status)

    if (response.ok) {
      const data = await response.json()
      console.log('UGC Posts current user success:', data.elements?.length || 0)
      return processPostsData(data.elements || [], sinceDate)
    } else {
      const errorText = await response.text()
      console.log('UGC Posts current user error:', errorText)
    }
  } catch (error) {
    console.log('UGC Posts current user failed:', error)
  }

  throw new Error(`
    Unable to retrieve your posts despite having r_member_postAnalytics scope.
    
    All attempted methods failed:
    1. Posts API without author parameter
    2. Posts API with "me" as author  
    3. Social Metadata API
    4. Member-specific posts finder
    5. V2 people posts endpoint
    6. UGC Posts with current user

    Your available scopes include r_member_postAnalytics which should allow post retrieval.
    This might indicate:
    1. The scope description is misleading
    2. Additional app configuration is required
    3. A bug in LinkedIn's API
    
    Please contact LinkedIn Developer Support for clarification on the r_member_postAnalytics scope.
  `)
}

function processPostsData(posts: any[], sinceDate?: string): any[] {
  console.log(`Processing ${posts.length} posts...`)
  
  // Apply date filtering if sinceDate is provided
  if (sinceDate && posts.length > 0) {
    const sinceTimestamp = new Date(sinceDate).getTime()
    posts = posts.filter(post => {
      const postTime = post.lastModifiedAt || post.createdAt || post.publishedAt || post.created?.time || 0
      return postTime >= sinceTimestamp
    })
    console.log(`Filtered to ${posts.length} posts since ${sinceDate}`)
  }
  
  return posts
}

async function getLastScrapedDate(): Promise<string | null> {
  const { data, error } = await supabase
    .from('scrape_metadata')
    .select('value')
    .eq('key', 'last_scraped_linkedin_post_date')
    .single()

  if (error && error.code !== 'PGRST116') {
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
    let content = ''
    let createdTime = new Date()
    let postId = post.id || ''
    
    // Handle LinkedIn Posts API response structure
    if (post.commentary) {
      content = post.commentary
    } else if (post.text) {
      content = post.text
    }
    
    // Get the most appropriate timestamp
    if (post.publishedAt) {
      createdTime = new Date(post.publishedAt)
    } else if (post.createdAt) {
      createdTime = new Date(post.createdAt)
    } else if (post.lastModifiedAt) {
      createdTime = new Date(post.lastModifiedAt)
    }
    
    // Extract media info if available
    let mediaUrls = []
    if (post.content?.media?.id) {
      mediaUrls.push(`LinkedIn Media: ${post.content.media.id}`)
    }
    
    return {
      post_id: postId,
      content: content,
      author_username: 'teneikaaskew',
      author_display_name: 'Teneika Askew',
      posted_at: createdTime.toISOString(),
      like_count: 0, // Analytics data would be separate API calls
      comment_count: 0,
      share_count: 0,
      media_urls: mediaUrls,
      post_url: `https://www.linkedin.com/feed/update/${postId}/`,
      raw_data: JSON.stringify(post) // Store raw data for debugging
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

    // Get valid access token
    const accessToken = await getValidAccessToken()
    console.log('Access token validated successfully')

    // Get last scraped date for incremental updates
    const lastScrapedDate = await getLastScrapedDate()
    console.log('Last scraped date:', lastScrapedDate)

    // Fetch posts
    const posts = await fetchPosts(accessToken, lastScrapedDate || undefined)
    console.log(`Fetched ${posts.length} posts`)

    if (posts.length === 0) {
      return { newPosts: 0, totalPosts: 0 }
    }

    // Store posts
    await storePosts(posts)

    // Update last scraped date with the most recent post
    const mostRecentPost = posts.reduce((latest, current) => {
      const currentTime = current.created?.time || current.createdTime || current.lastModified?.time || 0
      const latestTime = latest.created?.time || latest.createdTime || latest.lastModified?.time || 0
      return new Date(currentTime) > new Date(latestTime) ? current : latest
    })
    
    if (mostRecentPost) {
      const mostRecentTime = mostRecentPost.created?.time || mostRecentPost.createdTime || mostRecentPost.lastModified?.time
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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Deployed with verify_jwt=false and holding a service-role client.
  const auth = await requireAdminOrService(req);
  if (auth.response) return auth.response;

  try {
    console.log('LinkedIn post scraping function called')
    
    const result = await scrapePosts()

    // BEHAVIOR CHANGE (silent-failure audit): scrapePosts() converts internal
    // errors into `result.error`, but this handler previously returned HTTP 200
    // either way. Failed scrapes now get a non-2xx status.
    return new Response(
      JSON.stringify({
        success: !result.error,
        message: result.error || `Scraped ${result.newPosts} new posts. Total posts: ${result.totalPosts}`,
        data: result
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: result.error ? 502 : 200
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