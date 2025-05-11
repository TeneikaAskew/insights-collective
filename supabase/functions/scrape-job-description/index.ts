
// Follow Deno and Edge Functions v2 URL imports
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import * as cheerio from "https://esm.sh/cheerio@1.0.0-rc.12";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ error: "URL is required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Fetch the URL content
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Extract job description - this is a simplified approach
    // Different job boards have different structures, so this is a basic implementation
    // that looks for common job description containers
    
    // Common selectors for job descriptions across various job boards
    const possibleSelectors = [
      // LinkedIn
      '.description__text',
      '.show-more-less-html',
      // Indeed
      '#jobDescriptionText',
      // Glassdoor
      '.jobDescriptionContent',
      '.desc',
      // ZipRecruiter
      '.job_description',
      // General
      '[data-automation="jobDescription"]',
      '.job-description',
      '#job-description',
      '.description',
      'section.description',
      'div[class*="description"]',
      'div[id*="description"]'
    ];

    let jobDescription = '';
    
    // Try each selector until we find content
    for (const selector of possibleSelectors) {
      const element = $(selector);
      if (element.length > 0) {
        jobDescription = element.text().trim();
        if (jobDescription) break;
      }
    }

    // If standard selectors didn't work, try a more generic approach
    if (!jobDescription) {
      // Look for h2 elements that might indicate a job description section
      $('h2, h3').each((_, element) => {
        const heading = $(element).text().toLowerCase();
        if (
          heading.includes('job description') || 
          heading.includes('description') || 
          heading.includes('about the role') ||
          heading.includes('responsibilities') ||
          heading.includes('requirements')
        ) {
          // Get the next sibling elements until the next heading
          let currentElement = $(element).next();
          let tempDescription = '';
          
          while (currentElement.length && !['h1', 'h2', 'h3'].includes(currentElement.prop('tagName')?.toLowerCase())) {
            tempDescription += currentElement.text() + ' ';
            currentElement = currentElement.next();
          }
          
          if (tempDescription.trim()) {
            jobDescription += tempDescription.trim() + '\n\n';
          }
        }
      });
    }

    // Last resort: just grab all paragraphs from the page
    if (!jobDescription) {
      jobDescription = $('p').map((_, element) => $(element).text().trim()).get().join('\n\n');
    }

    // Clean up the description
    jobDescription = jobDescription
      .replace(/\s+/g, ' ')
      .trim();

    if (!jobDescription) {
      return new Response(
        JSON.stringify({ error: "Could not extract job description from the provided URL" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 422 }
      );
    }

    return new Response(
      JSON.stringify({ jobDescription }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error scraping job description:", error);
    
    return new Response(
      JSON.stringify({ error: error.message || "Failed to scrape job description" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
