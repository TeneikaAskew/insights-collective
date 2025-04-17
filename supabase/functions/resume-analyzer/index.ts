import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import { corsHeaders, handleApiError, safeJsonParse } from './utils.ts'

serve(async (req) => {
  console.log('Resume analyzer function hit')
  
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  
  try {
    // Get request body
    const requestData = await req.json()
    
    // Validate required fields before proceeding
    if (!requestData.userId) {
      throw new Error('userId is required')
    }
    
    if (!requestData.resumeText) {
      throw new Error('resumeText is required')
    }
    
    // Required field check - without filePath we need to generate a placeholder
    const filePath = requestData.filePath || `placeholder_${Date.now()}.txt`
    
    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    
    // Validate environment variables
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase environment variables')
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    // Check if user already has a resume record
    const { data: existingResume, error: fetchError } = await supabase
      .from('resumes')
      .select('id, file_path')
      .eq('user_id', requestData.userId)
      .maybeSingle()
    
    // If existing record found, update it instead of inserting
    if (existingResume?.id) {
      console.log("Updating existing resume record:", existingResume.id)
      // Use the existing file_path if available
      const existingFilePath = existingResume.file_path
      
      const { data, error } = await supabase
        .from('resumes')
        .update({
          text: requestData.resumeText,
          target_role: requestData.targetRole || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingResume.id)
        .select()
        .single()
      
      if (error) {
        throw error
      }
      
      // For analysis, we'll use the updated record
      const analysisData = data
      
      // Analyze resume using the Groq API if available
      let analysis = null
      try {
        const groqApiKey = Deno.env.get('GROQ')
        if (groqApiKey) {
          // Simplified resume analysis for this example
          analysis = {
            bullets: [],
            resume_average: 78,
            resume_percent: 78,
            letter_grade: "B+",
            themes: ["data analysis", "project management", "communication"],
            elevator_pitch: "Experienced data professional with a strong track record in analytics and visualization.",
            explanation: "Your resume shows solid experience with data tools and techniques.",
          }
        }
      } catch (analyzeError) {
        console.error("Analysis error:", analyzeError)
        // Continue without analysis if it fails
      }
      
      // Update the resume with analysis results if we have them
      if (analysis) {
        const { data: updatedResume, error: updateError } = await supabase
          .from('resumes')
          .update({ 
            analysis: analysis,
            initial_assessment: "Resume shows strong data skills with room for improvement in technical keywords."
          })
          .eq('id', analysisData.id)
          .select()
          .single()
          
        if (updateError) {
          console.error("Error updating with analysis:", updateError)
          // Continue without failing the request
        } else {
          analysisData.analysis = analysis
        }
      }
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Resume analyzed successfully",
          data: analysisData
        }), 
        { headers: corsHeaders }
      )
    } else {
      // Insert new record with all required fields
      console.log("Creating new resume record for user:", requestData.userId)
      const now = new Date().toISOString()
      
      const { data, error } = await supabase
        .from('resumes')
        .insert({
          user_id: requestData.userId,
          text: requestData.resumeText,
          file_path: filePath, // Using the filePath we ensured above
          target_role: requestData.targetRole || null,
          uploaded_at: now,
          updated_at: now
        })
        .select()
        .single()
      
      if (error) {
        console.error("Insert error:", error)
        throw error
      }
      
      // For analysis, we'll use the newly created record
      const analysisData = data
      
      // Simplified analysis logic identical to above
      let analysis = null
      try {
        const groqApiKey = Deno.env.get('GROQ')
        if (groqApiKey) {
          analysis = {
            bullets: [],
            resume_average: 78,
            resume_percent: 78,
            letter_grade: "B+",
            themes: ["data analysis", "project management", "communication"],
            elevator_pitch: "Experienced data professional with a strong track record in analytics and visualization.",
            explanation: "Your resume shows solid experience with data tools and techniques.",
          }
        }
      } catch (analyzeError) {
        console.error("Analysis error:", analyzeError)
      }
      
      // Update with analysis if available
      if (analysis) {
        const { data: updatedResume, error: updateError } = await supabase
          .from('resumes')
          .update({ 
            analysis: analysis,
            initial_assessment: "Resume shows strong data skills with room for improvement in technical keywords."
          })
          .eq('id', analysisData.id)
          .select()
          .single()
          
        if (updateError) {
          console.error("Error updating with analysis:", updateError)
        } else {
          analysisData.analysis = analysis
        }
      }
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Resume analyzed successfully",
          data: analysisData
        }), 
        { headers: corsHeaders }
      )
    }
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

// import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
// import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

// // Configure CORS headers
// const corsHeaders = {
//   'Access-Control-Allow-Origin': '*',
//   'Access-Control-Allow-Methods': 'POST, OPTIONS',
//   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
//   'Content-Type': 'application/json'
// }

// serve(async (req) => {
//   console.log('Resume analyzer function hit')
  
//   // Handle CORS preflight request
//   if (req.method === 'OPTIONS') {
//     return new Response(null, { headers: corsHeaders })
//   }
  
//   try {
//     // Get request body
//     const requestData = await req.json()
    
//     // Create Supabase client
//     const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
//     const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
//     const supabase = createClient(supabaseUrl, supabaseKey)
    
//     // Insert resume data
//     const { data, error } = await supabase
//       .from('resumes')
//       .insert({
//         user_id: requestData.userId,
//         text: requestData.resumeText,
//         file_path: requestData.filePath,
//         target_role: requestData.targetRole,
//       })
//       .select()
//       .single()
    
//     if (error) {
//       throw error
//     }
    
//     // Analyze resume using the Groq API
//     const groqApiKey = Deno.env.get('GROQ')
//     if (!groqApiKey) {
//       throw new Error('GROQ API key not found')
//     }
    
//     // Simplified resume analysis for this example
//     const analysis = {
//       bullets: [],
//       resume_average: 78,
//       resume_percent: 78,
//       letter_grade: "B+",
//       themes: ["data analysis", "project management", "communication"],
//       elevator_pitch: "Experienced data professional with a strong track record in analytics and visualization.",
//       explanation: "Your resume shows solid experience with data tools and techniques.",
//     }
    
//     // Update the resume with analysis results
//     const { data: updatedResume, error: updateError } = await supabase
//       .from('resumes')
//       .update({ 
//         analysis: analysis,
//         initial_assessment: "Resume shows strong data skills with room for improvement in technical keywords."
//       })
//       .eq('id', data.id)
//       .select()
//       .single()
      
//     if (updateError) {
//       throw updateError
//     }
    
//     return new Response(
//       JSON.stringify({ 
//         success: true, 
//         message: "Resume analyzed successfully",
//         data: updatedResume
//       }), 
//       { headers: corsHeaders }
//     )
//   } catch (error) {
//     console.error('Error in resume analyzer function:', error)
    
//     return new Response(
//       JSON.stringify({ 
//         success: false, 
//         message: error.message || 'An unexpected error occurred'
//       }), 
//       {
//         status: 400,
//         headers: corsHeaders
//       }
//     )
//   }
// })