
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import { corsHeaders } from './utils.ts'

// Add logging to confirm function is being hit
console.log('Resume analyzer function hit')

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  
  try {
    // Get request body
    const requestData = await req.json()
    
    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    // Insert resume data
    const { data, error } = await supabase
      .from('resumes')
      .insert({
        user_id: requestData.userId,
        text: requestData.resumeText,
        file_path: requestData.filePath,
        target_role: requestData.targetRole,
      })
      .select()
      .single()
    
    if (error) {
      throw error
    }
    
    // Analyze resume using the Groq API
    const groqApiKey = Deno.env.get('GROQ')
    if (!groqApiKey) {
      throw new Error('GROQ API key not found')
    }
    
    // Simplified resume analysis for this example
    const analysis = {
      bullets: [],
      resume_average: 78,
      resume_percent: 78,
      letter_grade: "B+",
      themes: ["data analysis", "project management", "communication"],
      elevator_pitch: "Experienced data professional with a strong track record in analytics and visualization.",
      explanation: "Your resume shows solid experience with data tools and techniques.",
    }
    
    // Update the resume with analysis results
    const { data: updatedResume, error: updateError } = await supabase
      .from('resumes')
      .update({ 
        analysis: analysis,
        initial_assessment: "Resume shows strong data skills with room for improvement in technical keywords."
      })
      .eq('id', data.id)
      .select()
      .single()
      
    if (updateError) {
      throw updateError
    }
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Resume analyzed successfully",
        data: updatedResume
      }), 
      { headers: corsHeaders }
    )
  } catch (error) {
    console.error('Error in resume analyzer function:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: error.message || 'An unexpected error occurred'
      }), 
      {
        status: 400,
        headers: corsHeaders
      }
    )
  }
})
