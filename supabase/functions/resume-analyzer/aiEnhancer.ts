import { corsHeaders, callGroqWithRetry } from './utils.ts';
console.log('Resume scoring and feedback function hit');
// Use GROQ API to enhance analysis with AI
export async function enhanceWithGroq(resumeText, analysis) {
  try {
    const apiKey = Deno.env.get('GROQ');
    if (!apiKey) {
      console.log("GROQ API key not found. Returning basic analysis.");
      return analysis;
    }
    // Limit the text to send to GROQ to reduce token usage
    const maxResumeLength = 3000; // Limit resume text to ~3500 chars
    const truncatedResume = resumeText.length > maxResumeLength ? resumeText.substring(50, maxResumeLength) + "..." : resumeText;
    console.log("Truncated Resume: ", truncatedResume);
    // For bullet analysis, just send a summary of the scores and most critical bullets
    // Select only high and low scoring bullets to give AI a sample of the range
    const sortedBullets = [
      ...analysis.bullets
    ].sort((a, b)=>b.bullet_total - a.bullet_total);
    const topBullets = sortedBullets.slice(0, 2); // 2 best bullets
    const bottomBullets = sortedBullets.slice(-2); // 2 worst bullets
    const selectedBullets = [
      ...topBullets,
      ...bottomBullets
    ];
    const bulletSummary = selectedBullets.map((b)=>{
      return {
        text: b.original.substring(0, 100),
        score: b.bullet_total,
        issues: (b.tips && typeof b.tips === 'string') ? b.tips.substring(0, 150) : "" //issues: b.tips ? b.tips.substring(0, 150) : "" // First 150 chars of tips
      };
    });
    console.log("Bullet Summary: ", bulletSummary);
    // Prepare a condensed version of the analysis to send to GROQ
    const condensedAnalysis = {
      resume_percent: analysis.resume_percent,
      letter_grade: analysis.letter_grade,
      bullet_count: analysis.bullets.length,
      bullet_samples: bulletSummary,
      strong_bullets: topBullets.length > 0 ? topBullets.map((b)=>b.original.substring(0, 100)).join("\n") : "",
      weak_bullets: bottomBullets.length > 0 ? bottomBullets.map((b)=>b.original.substring(0, 100)).join("\n") : ""
    };
    console.log("Condensed Analysis:", JSON.stringify(condensedAnalysis, null, 2));
    // Improved function for formatting and extracting AI response content
function formatResponse(raw) {
  if (!raw) return '';
  let text = raw;
  console.log("Before formatting: ", raw);
  
  // Create an object to directly extract and return the required content
  const extractedContent = {
    elevatorPitch: '',
    themes: [],
    explanation: ''
  };
  
  // Match the elevator pitch - follows "1. Professional elevator pitch:" pattern
  const elevatorPitchMatch = text.match(/1\.\s*Professional elevator pitch:?\s*([^]*?)(?=\n\s*\d\.|\n\s*$)/i);
  if (elevatorPitchMatch && elevatorPitchMatch[1]) {
    extractedContent.elevatorPitch = elevatorPitchMatch[1].trim();
  }
  
  // Match the themes section
  const themesMatch = text.match(/2\.\s*Three specific improvement themes:?\s*([^]*?)(?=\n\s*\d\.|\n\s*$)/i);
  if (themesMatch && themesMatch[1]) {
    // Extract individual bullet points from themes
    const themesText = themesMatch[1];
    
    // Try to match bullet points with asterisks first
    let bulletPoints = themesText.match(/\*\s*(.*?)(?=\n\*|\n\s*\d\.|\s*$)/g) || [];
    
    // If no asterisk bullets found, try dash/hyphen bullets
    if (bulletPoints.length === 0) {
      bulletPoints = themesText.match(/-\s*(.*?)(?=\n-|\n\s*\d\.|\s*$)/g) || [];
    }
    
    // If still no bullets found, try to extract lines as potential themes
    if (bulletPoints.length === 0) {
      const lines = themesText.split('\n').filter(line => line.trim().length > 0);
      extractedContent.themes = lines.map(line => line.trim());
    } else {
      // Process each bullet point (works for both * and - bullets)
      extractedContent.themes = bulletPoints.map(point => {
        // Clean up the bullet point - remove * or - at beginning
        return point.replace(/^[\*\-]\s*/, '').trim();
      }).filter(theme => theme.length > 0);
    }
  }
  
  // Match the explanation
  const explanationMatch = text.match(/3\.\s*Brief explanation of the resume grade:?\s*([^]*?)(?=\n\s*\d\.|\s*$)/i);
  if (explanationMatch && explanationMatch[1]) {
    extractedContent.explanation = explanationMatch[1].trim();
  }
  
  console.log("Extracted content: ", extractedContent);
  
  // Return the extracted content directly
  return extractedContent;
}

// Call the GROQ API with timeout
const controller = new AbortController();
const timeoutId = setTimeout(()=>controller.abort(), 8000); // 8 second timeout
try {
  const requestBody = {
    model: 'llama3-8b-8192',
    messages: [
      {
        role: 'system',
        content: `You are an expert resume analyst. Based on the provided resume text and basic analysis, 
        provide three key outputs:
        1. A professional elevator pitch (max 2 sentences) based on the resume text
        2. Three specific improvement themes (one sentence each) based on the resume text
        3. A brief explanation of the resume grade (max 2 sentences) based on the resume text
        
        Be specific, professional, and concise. Focus on actionable advice. Format your response with no markdown, just clean text.`
      },
      {
        role: 'user',
        content: `Resume text (truncated): ${truncatedResume}\n\nBasic Analysis: ${JSON.stringify(condensedAnalysis)}`
      }
    ],
    max_tokens: 500,
    temperature: 0.4
  };
  
  // Add the signal to the retry function
  const data = await callGroqWithRetry(apiKey, requestBody, 3, controller.signal);
  clearTimeout(timeoutId);
  
  const aiResponse = data.choices[0].message.content;
  console.log("AI Response: ", aiResponse);
  
  // Use our new format function which returns an object with extracted content
  const extractedContent = formatResponse(aiResponse);
  
  // Update the analysis with AI-generated content
  const enhancedAnalysis = {
    ...analysis
  }; // Create a copy to avoid mutation
  
  // Directly set the extracted values
  if (extractedContent.elevatorPitch) {
    enhancedAnalysis.elevator_pitch = extractedContent.elevatorPitch;
  }
  
  if (extractedContent.themes && extractedContent.themes.length > 0) {
    enhancedAnalysis.themes = extractedContent.themes.slice(0, 3);
  }
  
  if (extractedContent.explanation) {
    enhancedAnalysis.explanation = extractedContent.explanation;
  }
  
//   console.log("Enhanced Analysis: ", enhancedAnalysis);
//   return enhancedAnalysis;
// } catch (error) {
//   console.error('Error processing AI response:', error);
//   clearTimeout(timeoutId);
//   // Return the original analysis if there was an error
//   return analysis;
// }}}
    //   function formatResponse(raw) {
    //     if (!raw) return '';
    //     let text = raw;
    //     console.log("Before formatting: ", raw);
        
    //     // 1) Fix unbalanced bold markers: **…* or *…** → **…**
    //     text = text.replace(/\*\*(.+?)\*/g, '**$1**');
    //     text = text.replace(/\*(.+?)\*\*/g, '**$1**');
        
    //     // 2) Convert leading "* " or "+ " into "- " bullets
    //     text = text.replace(/^[\s]*[\*\+]\s+/gm, '- ');
        
    //     // 3) Convert numbered lists into bullet points
    //     text = text.replace(/^[\s]*\d+\.\s+/gm, '- ');
        
    //     // 4) Ensure bold-only lines become headers
    //     text = text.replace(/^\s*\*\*(.+?)\*\*\s*$/gm, '\n## $1\n');
        
    //     // 5) Remove noisy markdown-like labels (flexible pattern)
    //     text = text.replace(/([A-Za-z\s]+)(?::|-)?\s*\*+(?:\s*-?\s*\*+)*/g, '$1:');
        
    //     // 6) Remove known noise patterns - CONSOLIDATED with section patterns
    //     const noisyPatterns = [
    //       // Original noise patterns
    //       /Resume Grade Explanation:\*?.*/gi,
    //       /Brief Explanation of the Resume Grade:\*?.*/gi,
    //       /Three Specific Improvement Themes:\*?.*/gi,
    //       /Quantifiable Results:\*?.*/gi,
    //       /IStronger Action Verbs:k:.*/gi,
    //       /Specific Improvement Themes:\*?.*/gi,
    //       /Concise Language:\*?.*/gi,
    //       /Professional Elevator Pitch:\*?.*/gi,
    //       /Resume Grade and Explanation:\*?.*/gi,
          
    //       // Added consolidated section patterns
    //       /\*?Professional Elevator Pitch[^:]*:\*?/gi,
    //       /\*?Resume Grade[^:]*:\*?/gi,
    //       /\*?Three Specific Improvement Themes[^:]*:?\*?/gi,
    //       /\*?Detailed Explanation:\*?/gi,
    //       /\*?Key Improvement Themes:\*?/gi,
          
    //       // General section pattern with max sentences
    //       /\*?([A-Za-z\s]+)\s*\(max\s*\d+\s*sentences?\):\*?/gi
    //     ];
        
    //     for (const pattern of noisyPatterns) {
    //       text = text.replace(pattern, '');
    //     }
        
    //     // 7) Remove markdown-like noise lines
    //     text = text.replace(/^##\s*\*/gm, '');
    //     text = text.replace(/-\s*\*+[A-Za-z\s]+:\*+/g, '-');
    //     text = text.replace(/\*+[A-Za-z\s]+:\*+/g, '');
        
    //     // 8) Remove floating bold/italic markers (e.g., **, ***, etc.)
    //     text = text.replace(/(?<=\s|^)\*{2,}(?=\s|$)/g, '');
    //     text = text.replace(/(?<=\s|^)_+(?=\s|$)/g, '');
        
    //     // 9) Clean up bullet points with special formatting
    //     text = text.replace(/^-\s*\*?([A-Za-z\s]+\*?:)\s*(.*?)$/gm, '- $2');
        
    //     // 10) Clean up asterisks around text
    //     text = text.replace(/\*([^*]+)\*/g, '$1');
        
    //     // 11) Collapse 3+ blank lines → 2
    //     text = text.replace(/\n{3,}/g, '\n\n');
        
    //     // 12) Trim trailing spaces and outer whitespace
    //     return text.split('\n').map((line) => line.trimEnd()).join('\n').trim();
    //   }
    // // Call the GROQ API with timeout
    // const controller = new AbortController();
    // const timeoutId = setTimeout(()=>controller.abort(), 8000); // 8 second timeout
    // try {
    //   // const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    //   //   method: 'POST',
    //   //   headers: {
    //   //     'Authorization': `Bearer ${apiKey}`,
    //   //     'Content-Type': 'application/json'
    //   //   },
    //   //   body: JSON.stringify({
    //   //     model: 'llama3-8b-8192',
    //   //     messages: [
    //   //       {
    //   //         role: 'system',
    //   //         content: `You are an expert resume analyst. Based on the provided resume text and basic analysis, 
    //   //         provide three key outputs:
    //   //         1. A professional elevator pitch (max 2 sentences) based on the resume text
    //   //         2. Three specific improvement themes (one sentence each) based on the resume text
    //   //         3. A brief explanation of the resume grade (max 2 sentences) based on the resume text
              
    //   //         Be specific, professional, and concise. Focus on actionable advice.`
    //   //       },
    //   //       {
    //   //         role: 'user',
    //   //         content: `Resume text (truncated): ${truncatedResume}\n\nBasic Analysis: ${JSON.stringify(condensedAnalysis)}`
    //   //       }
    //   //     ],
    //   //     max_tokens: 500,
    //   //     temperature: 0.4
    //   //   }),
    //   //   signal: controller.signal
    //   // });
    //   // clearTimeout(timeoutId);
    //   // if (!response.ok) {
    //   //   throw new Error(`GROQ API returned ${response.status}`);
    //   // }
    //   // const data = await response.json(); 

    //  const requestBody = {
    //     model: 'llama3-8b-8192',
    //     messages: [
    //       {
    //         role: 'system',
    //         content: `You are an expert resume analyst. Based on the provided resume text and basic analysis, 
    //         provide three key outputs:
    //         1. A professional elevator pitch (max 2 sentences) based on the resume text
    //         2. Three specific improvement themes (one sentence each) based on the resume text
    //         3. A brief explanation of the resume grade (max 2 sentences) based on the resume text
            
    //         Be specific, professional, and concise. Focus on actionable advice. Format your response with no markdown, just clean text.`
    //       },
    //       {
    //         role: 'user',
    //         content: `Resume text (truncated): ${truncatedResume}\n\nBasic Analysis: ${JSON.stringify(condensedAnalysis)}`
    //       }
    //     ],
    //     max_tokens: 500,
    //     temperature: 0.4
    //   };
      
    //   // Add the signal to the retry function
    //   const data = await callGroqWithRetry(apiKey, requestBody, 3, controller.signal);
    //   clearTimeout(timeoutId);
      
    //   const aiResponse = data.choices[0].message.content;
    //   console.log("AI Response: ", aiResponse);
    //   // Parse AI response - simple approach, in production would use more robust parsing
    //   const sections = formatResponse(aiResponse).split(/\d+\.\s+/);
    //   console.log("Sections after formatting: ", sections);
    //   if (sections.length >= 4) {
    //     // Extract elevator pitch from section 1 (after the split)
    //     const elevatorPitch = sections[1].trim();
    //     console.log("Elevator Pitch: ", elevatorPitch);
    //     // Extract themes - assuming they're in section 2, split by newlines or bullet points
    //     const themeText = sections[2].trim();
    //     const themeMatches = themeText.match(/[^.!?]+[.!?]+/g) || [];
    //     const themes = themeMatches.map((t)=>t.trim()).filter((t)=>t.length > 10);
    //     console.log("Themes: ", themes);
    //     // Extract explanation from section 3
    //     const explanation = sections[3].trim();
    //     console.log("Explanation: ", explanation);
    //     // Update the analysis with AI-generated content
    //     const enhancedAnalysis = {
    //       ...analysis
    //     }; // Create a copy to avoid mutation
    //     if (elevatorPitch) enhancedAnalysis.elevator_pitch = elevatorPitch;
    //     if (themes.length > 0) enhancedAnalysis.themes = themes.slice(0, 3);
    //     if (explanation) enhancedAnalysis.explanation = explanation;



        
        console.log("Enhanced Analysis: ", enhancedAnalysis);
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
// }