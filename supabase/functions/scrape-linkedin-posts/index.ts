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

// Rate limiting helpers
async function checkRateLimit(): Promise<boolean> {
  const { data, error } = await supabase
    .from('scrape_metadata')
    .select('value, updated_at')
    .eq('key', 'linkedin_rate_limit_reset')
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('Error checking rate limit:', error)
    return true // Assume we can proceed if we can't check
  }

  if (!data) return true

  const resetTime = new Date(data.updated_at)
  const now = new Date()
  const hoursSinceReset = (now.getTime() - resetTime.getTime()) / (1000 * 60 * 60)

  // Reset daily (24 hours)
  return hoursSinceReset >= 24
}

async function recordRateLimit(): Promise<void> {
  await supabase
    .from('scrape_metadata')
    .upsert({
      key: 'linkedin_rate_limit_reset',
      value: 'rate_limited',
      updated_at: new Date().toISOString()
    })
}

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
    // Use the r_basicprofile scope to test token validity
    const testResponse = await fetch(`${BASE_URL}/people/~:(id,localizedFirstName)`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0'
      },
    })

    if (testResponse.ok) {
      console.log('Existing access token is valid')
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
    if (error.message.includes('Rate limit')) {
      throw error
    }
    return await refreshAccessToken()
  }
}

async function fetchPosts(accessToken: string, sinceDate?: string): Promise<any[]> {
  // First, get the user's profile to get their person URN
  const profileResponse = await fetch(`${BASE_URL}/people/~:(id)`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0'
    },
  })

  if (!profileResponse.ok) {
    throw new Error(`Failed to get profile: ${profileResponse.status}`)
  }

  const profileData = await profileResponse.json()
  const personUrn = `urn:li:person:${profileData.id}`
  
  console.log('User person URN:', personUrn)

  // Use the Social Actions API with postAnalytics scope
  let url = `${BASE_URL}/socialActions?q=roleAssignee&roleAssignee=${encodeURIComponent(personUrn)}&start=0&count=50`
  
  if (sinceDate) {
    const sinceTimestamp = new Date(sinceDate).getTime()
    url += `&createdAfter=${sinceTimestamp}`
  }

  console.log('Fetching LinkedIn posts using Social Actions API')
  console.log('Request URL:', url)

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0'
    },
  })

  console.log('Response status:', response.status)

  if (response.status === 429) {
    await recordRateLimit()
    throw new Error('Rate limit exceeded. Please wait 24 hours before trying again.')
  }

  if (response.status === 403) {
    console.error('Access denied - trying alternative endpoint')
    return await fetchPostsAlternative(accessToken, personUrn, sinceDate)
  }

  if (!response.ok) {
    const errorText = await response.text()
    console.error('Error response:', errorText)
    throw new Error(`Failed to fetch posts: ${response.status} ${errorText}`)
  }

  const data = await response.json()
  console.log('Posts fetched successfully:', data.elements?.length || 0)
  return data.elements || []
}

async function fetchPostsAlternative(accessToken: string, personUrn: string, sinceDate?: string): Promise<any[]> {
  // Alternative: Use UGC Posts API which works with r_member_postAnalytics
  let url = `${BASE_URL}/ugcPosts?q=authors&authors=List(${encodeURIComponent(personUrn)})&sortBy=LAST_MODIFIED&count=50`
  
  if (sinceDate) {
    const sinceTimestamp = new Date(sinceDate).getTime()
    url += `&modifiedSince=${sinceTimestamp}`
  }

  console.log('Trying UGC Posts API as alternative')
  console.log('Request URL:', url)

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0'
    },
  })

  console.log('Alternative response status:', response.status)

  if (response.status === 429) {
    await recordRateLimit()
    throw new Error('Rate limit exceeded. Please wait 24 hours before trying again.')
  }

  if (!response.ok) {
    const errorText = await response.text()
    console.error('Alternative error response:', errorText)
    throw new Error(`Failed to fetch posts with alternative method: ${response.status} ${errorText}`)
  }

  const data = await response.json()
  console.log('Alternative posts fetched successfully:', data.elements?.length || 0)
  return data.elements || []
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
    let postId = post.id || post.activity || ''
    
    // Handle UGC Posts API response structure
    if (post.specificContent && post.specificContent['com.linkedin.ugc.ShareContent']) {
      const shareContent = post.specificContent['com.linkedin.ugc.ShareContent']
      content = shareContent.shareCommentary?.text || shareContent.shareText?.text || ''
      createdTime = new Date(post.created?.time || post.lastModified?.time || Date.now())
    }
    // Handle Social Actions API response structure
    else if (post.object && post.object['com.linkedin.ugc.ShareContent']) {
      const shareContent = post.object['com.linkedin.ugc.ShareContent']
      content = shareContent.shareCommentary?.text || shareContent.shareText?.text || ''
      createdTime = new Date(post.created?.time || Date.now())
    }
    // Handle other response structures
    else {
      content = post.commentary || post.text || post.content?.description || ''
      createdTime = new Date(post.createdTime || post.created?.time || post.lastModified?.time || Date.now())
    }
    
    return {
      post_id: postId,
      content: content,
      author_username: 'teneikaaskew',
      author_display_name: 'Teneika Askew',
      posted_at: createdTime.toISOString(),
      like_count: 0, // r_member_postAnalytics provides analytics data
      comment_count: 0,
      share_count: 0,
      media_urls: [], 
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

    // Check rate limiting first
    const canProceed = await checkRateLimit()
    if (!canProceed) {
      throw new Error('Rate limit in effect. Please wait 24 hours since last rate limit before trying again.')
    }

    console.log('Starting LinkedIn post scrape')

    // Get valid access token
    const accessToken = await getValidAccessToken()
    console.log('Access token validated successfully')

    // Fetch posts
    const posts = await fetchPosts(accessToken)
    console.log(`Fetched ${posts.length} posts`)

    if (posts.length === 0) {
      return { newPosts: 0, totalPosts: 0 }
    }

    // Store posts
    await storePosts(posts)

    // Update last scraped date
    if (posts.length > 0) {
      const mostRecentTime = posts[0].createdTime || new Date().toISOString()
      await updateLastScrapedDate(mostRecentTime)
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