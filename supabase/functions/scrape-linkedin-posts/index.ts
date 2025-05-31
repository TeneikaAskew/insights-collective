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
    if (error.message.includes('Rate limit')) {
      throw error
    }
    return await refreshAccessToken()
  }
}

async function fetchPosts(accessToken: string, sinceDate?: string): Promise<any[]> {
  // Use your specific LinkedIn user ID to build the person URN
  const personUrn = `urn:li:person:${LINKEDIN_USER_ID}`
  
  console.log('Using person URN:', personUrn)
  console.log('Fetching posts using LinkedIn Posts API...')

  // Use the official Posts API "Find Posts by Authors" endpoint
  // Try with current 2025 API version (February 2025)
  let url = `https://api.linkedin.com/rest/posts?q=author&author=${encodeURIComponent(personUrn)}&sortBy=LAST_MODIFIED&count=50`

  console.log('Request URL:', url)

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
      'LinkedIn-Version': '202502' // Current 2025 February version
    },
  })

  console.log('Response status:', response.status)

  if (response.status === 429) {
    throw new Error('Rate limit exceeded. Please wait 24 hours before trying again.')
  }

  if (response.status === 426) {
    console.log('API version not supported, trying different versions...')
    return await fetchPostsWithDifferentVersions(accessToken, personUrn, sinceDate)
  }

  if (response.status === 403) {
    const errorText = await response.text()
    console.error('Access denied error:', errorText)
    
    // If modern API fails, try legacy v2 endpoints
    return await fetchPostsLegacyV2(accessToken, personUrn, sinceDate)
  }

  if (!response.ok) {
    const errorText = await response.text()
    console.error('Error response:', errorText)
    
    // Try alternative approaches
    return await fetchPostsWithDifferentVersions(accessToken, personUrn, sinceDate)
  }

  const data = await response.json()
  console.log('Posts fetched successfully:', data.elements?.length || 0)
  
  let posts = data.elements || []
  
  // Apply date filtering if sinceDate is provided
  if (sinceDate && posts.length > 0) {
    const sinceTimestamp = new Date(sinceDate).getTime()
    posts = posts.filter(post => {
      const postTime = post.lastModifiedAt || post.createdAt || post.publishedAt || 0
      return postTime >= sinceTimestamp
    })
    console.log(`Filtered to ${posts.length} posts since ${sinceDate}`)
  }
  
  return posts
}

async function fetchPostsWithDifferentVersions(accessToken: string, personUrn: string, sinceDate?: string): Promise<any[]> {
  console.log('Trying different API versions...')
  
  // Try different recent versions
  const versions = ['202501', '202412', '202411', '202410']
  
  for (const version of versions) {
    try {
      console.log(`Trying LinkedIn-Version: ${version}`)
      
      let url = `https://api.linkedin.com/rest/posts?q=author&author=${encodeURIComponent(personUrn)}&sortBy=LAST_MODIFIED&count=50`

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0',
          'LinkedIn-Version': version
        },
      })

      console.log(`Version ${version} response status:`, response.status)

      if (response.ok) {
        const data = await response.json()
        console.log(`Version ${version} success:`, data.elements?.length || 0)
        
        let posts = data.elements || []
        
        // Apply date filtering if sinceDate is provided
        if (sinceDate && posts.length > 0) {
          const sinceTimestamp = new Date(sinceDate).getTime()
          posts = posts.filter(post => {
            const postTime = post.lastModifiedAt || post.createdAt || post.publishedAt || 0
            return postTime >= sinceTimestamp
          })
          console.log(`Filtered to ${posts.length} posts since ${sinceDate}`)
        }
        
        return posts
      } else if (response.status === 403) {
        console.log(`Version ${version} gave 403, trying next version...`)
        continue
      } else if (response.status === 426) {
        console.log(`Version ${version} not supported, trying next...`)
        continue
      }
    } catch (error) {
      console.log(`Version ${version} failed:`, error)
      continue
    }
  }
  
  // If all versions fail, try legacy approach
  return await fetchPostsLegacyV2(accessToken, personUrn, sinceDate)
}

async function fetchPostsLegacyV2(accessToken: string, personUrn: string, sinceDate?: string): Promise<any[]> {
  console.log('Trying legacy v2 API as final fallback...')
  
  // Try the legacy v2 API without versioning requirements
  let url = `https://api.linkedin.com/v2/shares?q=owners&owners=List(${encodeURIComponent(personUrn)})&sortBy=CREATED&count=50`

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0'
      // No LinkedIn-Version header for legacy v2
    },
  })

  console.log('Legacy v2 response status:', response.status)

  if (response.status === 429) {
    throw new Error('Rate limit exceeded. Please wait 24 hours before trying again.')
  }

  if (!response.ok) {
    const errorText = await response.text()
    console.error('Legacy v2 error response:', errorText)
    
    // One final attempt with different endpoint
    return await fetchPostsBasicProfile(accessToken)
  }

  const data = await response.json()
  console.log('Legacy v2 posts fetched successfully:', data.elements?.length || 0)
  return data.elements || []
}

async function fetchPostsBasicProfile(accessToken: string): Promise<any[]> {
  console.log('Final attempt: checking what data we can access...')
  
  // Just verify what we can access with current permissions
  try {
    const profileResponse = await fetch(`https://api.linkedin.com/v2/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0'
      },
    })

    if (profileResponse.ok) {
      const profileData = await profileResponse.json()
      console.log('Profile data accessible:', profileData)
    }
  } catch (error) {
    console.log('Profile check failed:', error)
  }
  
  throw new Error(`
    Unable to retrieve posts with r_member_postAnalytics scope using any available API endpoint.
    
    Attempted methods:
    1. Modern Posts API with multiple versions (202502, 202501, 202412, etc.)
    2. Legacy v2 shares API
    3. Profile verification
    
    The scope may not actually provide post retrieval access, or additional app permissions may be required.
    
    Please verify in LinkedIn Developer Portal:
    1. Your app has the correct Products enabled
    2. The r_member_postAnalytics scope actually includes post content retrieval
    3. Consider applying for r_member_social scope if available
  `)
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