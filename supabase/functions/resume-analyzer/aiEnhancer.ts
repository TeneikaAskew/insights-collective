
// Use GROQ API to enhance analysis with AI
export async function enhanceWithGroq(resumeText: string, analysis: any): Promise<any> {
  try {
    const apiKey = Deno.env.get('GROQ');
    if (!apiKey) {
      console.log("GROQ API key not found. Returning basic analysis.");
      return analysis;
    }
    
    // Limit the text to send to GROQ to reduce token usage
    const maxResumeLength = 3500; // Limit resume text to ~3500 chars
    const truncatedResume = resumeText.length > maxResumeLength ? 
      resumeText.substring(0, maxResumeLength) + "..." : 
      resumeText;
    
    // For bullet analysis, just send a summary of the scores and most critical bullets
    // Select only high and low scoring bullets to give AI a sample of the range
    const sortedBullets = [...analysis.bullets].sort((a, b) => b.bullet_total - a.bullet_total);
    const topBullets = sortedBullets.slice(0, 2); // 2 best bullets
    const bottomBullets = sortedBullets.slice(-2); // 2 worst bullets
    const selectedBullets = [...topBullets, ...bottomBullets];
    
    const bulletSummary = selectedBullets.map((b: any) => {
      return {
        text: b.original.substring(0, 100), // First 100 chars of each bullet
        score: b.bullet_total,
        issues: b.tips ? b.tips.substring(0, 150) : "" // First 150 chars of tips
      };
    });
    
    // Prepare a condensed version of the analysis to send to GROQ
    const condensedAnalysis = {
      resume_percent: analysis.resume_percent,
      letter_grade: analysis.letter_grade,
      bullet_count: analysis.bullets.length,
      bullet_samples: bulletSummary,
      strong_bullets: topBullets.length > 0 ? topBullets.map((b: any) => b.original.substring(0, 100)).join("\n") : "",
      weak_bullets: bottomBullets.length > 0 ? bottomBullets.map((b: any) => b.original.substring(0, 100)).join("\n") : "",
    };

    // formatting the response
    function formatResponse(raw: string): string {
      if (!raw) return "";
      
      let text = raw;
    
      // Balanced bold
      text = text.replace(/\*\*(.+?)\*/g, '**$1**');
      text = text.replace(/\*(.+?)\*\*/g, '**$1**');
    
      // Leading * or + → bullets
      text = text.replace(/^[\s]*[\*\+]\s+/gm, '- ');
    
      // Numbered → bullets
      text = text.replace(/^[\s]*\d+\.\s+/gm, '- ');
    
      // Bold‑only lines → headings
      text = text.replace(/^\s*\*\*(.+?)\*\*\s*$/gm, '\n## $1\n');
    
      // Collapse 3+ blank lines to 2
      text = text.replace(/\n{3,}/g, '\n\n');
    
      // Trim line ends and overall
      return text
        .split('\n')
        .map(l => l.trimEnd())
        .join('\n')
        .trim();
    }
    
    // Call the GROQ API with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout
    
    try {
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
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`GROQ API returned ${response.status}`);
      }
      
      const data = await response.json();
      const aiResponse = data.choices[0].message.content;
      
      // Parse AI response - simple approach, in production would use more robust parsing
      const sections = formatResponse(aiResponse).split(/\d+\.\s+/);
      
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
        const enhancedAnalysis = { ...analysis }; // Create a copy to avoid mutation
        if (elevatorPitch) enhancedAnalysis.elevator_pitch = elevatorPitch;
        if (themes.length > 0) enhancedAnalysis.themes = themes.slice(0, 3);
        if (explanation) enhancedAnalysis.explanation = explanation;
        
        return enhancedAnalysis;
      }
    } catch (fetchError) {
      console.error("GROQ API fetch error:", fetchError);
      // If there's a timeout or other fetch error, continue with the basic analysis
      clearTimeout(timeoutId);
    }
    
    // Return the original analysis if we couldn't enhance it
    return analysis;
  } catch (error) {
    console.error("Error enhancing analysis with GROQ:", error);
    // Return original analysis on any error
    return analysis;
  }
}
