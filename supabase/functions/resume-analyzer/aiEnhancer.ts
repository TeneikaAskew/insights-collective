
// Use GROQ API to enhance analysis with AI
export async function enhanceWithGroq(resumeText: string, analysis: any): Promise<any> {
  try {
    const apiKey = Deno.env.get('GROQ');
    if (!apiKey) {
      console.log("GROQ API key not found. Returning basic analysis.");
      return analysis;
    }
    
    // Limit the text to send to GROQ to reduce token usage
    const maxResumeLength = 2500; // Limit resume text to ~2500 chars
    const truncatedResume = resumeText.length > maxResumeLength ? 
      resumeText.substring(0, maxResumeLength) + "..." : 
      resumeText;
    
    // For bullet analysis, just send a summary of the scores
    const bulletSummary = analysis.bullets.map((b: any) => {
      return {
        text: b.original.substring(0, 100), // First 100 chars of each bullet
        score: b.bullet_total,
        issues: b.tips
      };
    }).slice(0, 5); // Only include up to 5 bullets to save tokens
    
    // Prepare a condensed version of the analysis to send to GROQ
    const condensedAnalysis = {
      resume_percent: analysis.resume_percent,
      letter_grade: analysis.letter_grade,
      bullet_count: analysis.bullets.length,
      bullet_samples: bulletSummary
    };
    
    // Call the GROQ API
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama3-8b-8192', // Using a smaller model to reduce costs
        messages: [
          {
            role: 'system',
            content: `You are an expert resume analyst. Based on the provided resume text and basic analysis, 
            provide three key outputs:
            1. A professional elevator pitch (max 2 sentences)
            2. Three specific improvement themes (one sentence each)
            3. A brief explanation of the resume grade (max 2 sentences)
            
            Be specific, professional, and concise. Focus on actionable advice.`
          },
          {
            role: 'user',
            content: `Resume text (truncated): ${truncatedResume}\n\nBasic Analysis: ${JSON.stringify(condensedAnalysis)}`
          }
        ],
        max_tokens: 500, // Limiting tokens for efficiency
        temperature: 0.4, // Lower temperature for more consistent results
      })
    });
    
    if (!response.ok) {
      throw new Error(`GROQ API returned ${response.status}`);
    }
    
    const data = await response.json();
    const aiResponse = data.choices[0].message.content;
    
    // Parse AI response - simple approach, in production would use more robust parsing
    const sections = aiResponse.split(/\d+\.\s+/);
    
    if (sections.length >= 4) {
      // Extract elevator pitch from section 1 (after the split)
      const elevatorPitch = sections[1].trim();
      
      // Extract themes - assuming they're in section 2, split by newlines or bullet points
      const themeText = sections[2].trim();
      const themeMatches = themeText.match(/[^.!?]+[.!?]+/g) || [];
      const themes = themeMatches.map(t => t.trim()).filter(t => t.length > 10);
      
      // Extract explanation from section 3
      const explanation = sections[3].trim();
      
      // Update the analysis with AI-generated content
      if (elevatorPitch) analysis.elevator_pitch = elevatorPitch;
      if (themes.length > 0) analysis.themes = themes.slice(0, 3);
      if (explanation) analysis.explanation = explanation;
    }
    
    return analysis;
  } catch (error) {
    console.error("Error enhancing analysis with GROQ:", error);
    return analysis; // Return original analysis on error
  }
}
