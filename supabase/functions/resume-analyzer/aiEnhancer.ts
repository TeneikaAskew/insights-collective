
// AI enhancement module for resume analysis
import { callLLMWithRetry } from '../_shared/utils.ts';

// Enhance analysis results with AI
export async function enhanceWithGroq(resumeText, basicAnalysis) {
  try {
    console.log('Running AI enhancement with Groq');
    
    // Create a system prompt for the AI
    const system = `You are an AI resume analysis expert. Your task is to analyze a resume and provide insightful feedback.
    You'll receive basic analysis data and need to enhance it with:
    1. Career themes based on the bullet points
    2. A professional elevator pitch
    3. A clear explanation of the resume's strengths and weaknesses`;
    
    // Create a user prompt with the resume text and basic analysis
    const user = `
    RESUME TEXT:
    ${resumeText.substring(0, 3000)}
    
    BASIC ANALYSIS:
    ${JSON.stringify(basicAnalysis)}
    
    Based on this information:
    1. Generate 3-5 concise career themes highlighting this person's core strengths
    2. Create a brief elevator pitch (~50 words) that summarizes their professional profile
    3. Provide a clear explanation of the resume's strengths and areas for improvement
    
    Format your response as a valid JSON object with these fields:
    {
      "themes": ["theme1", "theme2", ...],
      "elevator_pitch": "concise pitch here",
      "explanation": "analysis explanation here"
    }
    
    Return ONLY the JSON object without any additional text or explanations.
    `;
    
    // Call the LLM with retry logic
    const aiResponse = await callLLMWithRetry(system, user);
    
    // Extract and parse the JSON response
    let jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('Could not extract JSON from AI response');
      return basicAnalysis;
    }
    
    const enhancedData = JSON.parse(jsonMatch[0]);
    
    // Merge the enhanced data with the basic analysis
    return {
      ...basicAnalysis,
      themes: enhancedData.themes || basicAnalysis.themes || [],
      elevator_pitch: enhancedData.elevator_pitch || 'Experienced professional with a track record of achievements.',
      explanation: enhancedData.explanation || `Your resume received a ${basicAnalysis.letter_grade} grade.`
    };
  } catch (err) {
    console.error('AI enhancement error:', err);
    return basicAnalysis;
  }
}
