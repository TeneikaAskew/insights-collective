
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.31.0"

// Initialize Supabase client for database operations
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
export const supabase = createClient(supabaseUrl, supabaseKey);

// In-memory cache for bullet points
export const bulletCache = new Map();

// Database operations
export async function getResumeById(userId: string) {
  try {
    const { data: existingResume, error: fetchError } = await supabase
      .from('resumes')
      .select('id, text')
      .eq('user_id', userId)
      .maybeSingle();
    
    if (fetchError) {
      console.error("Error fetching existing resume:", fetchError);
    }
    
    return existingResume;
  } catch (fetchError) {
    console.error("Error fetching resume data:", fetchError);
    return null;
  }
}

export async function updateResumeAnalysis(resumeId: string, analysis: any) {
  try {
    const { error } = await supabase
      .from('resumes')
      .update({ 
        analysis: analysis,
        updated_at: new Date().toISOString()
      })
      .eq('id', resumeId);
    
    if (error) {
      console.error("Error updating resume analysis:", error);
      return false;
    } else {
      console.log("Successfully updated resume analysis in database");
      return true;
    }
  } catch (updateError) {
    console.error("Error updating resume analysis:", updateError);
    return false;
  }
}
