
console.log('Resume scoring and feedback function hit');
import { corsHeaders, callGroqWithRetry } from './utils.ts';
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
// function formatResponse(raw) {
//   if (!raw) return '';
//   let text = raw;
//   console.log("Before formatting: ", raw);
  
//   // Create an object to directly extract and return the required content
//   const extractedContent = {
//     elevatorPitch: '',
//     themes: [],
//     explanation: ''
//   };
  
//   // Match the elevator pitch - follows "1. Professional elevator pitch:" pattern
//   const elevatorPitchMatch = text.match(/1\.\s*Professional elevator pitch:?\s*([^]*?)(?=\n\s*\d\.|\n\s*$)/i);
//   if (elevatorPitchMatch && elevatorPitchMatch[1]) {
//     extractedContent.elevatorPitch = elevatorPitchMatch[1].trim();
//   }
  
//   // Match the themes section
//   const themesMatch = text.match(/2\.\s*Three specific improvement themes:?\s*([^]*?)(?=\n\s*\d\.|\n\s*$)/i);
//   if (themesMatch && themesMatch[1]) {
//     // Extract individual bullet points from themes
//     const themesText = themesMatch[1];
    
//     // Try to match bullet points with asterisks first
//     let bulletPoints = themesText.match(/\*\s*(.*?)(?=\n\*|\n\s*\d\.|\s*$)/g) || [];
    
//     // If no asterisk bullets found, try dash/hyphen bullets
//     if (bulletPoints.length === 0) {
//       bulletPoints = themesText.match(/-\s*(.*?)(?=\n-|\n\s*\d\.|\s*$)/g) || [];
//     }
    
//     // If still no bullets found, try to extract lines as potential themes
//     if (bulletPoints.length === 0) {
//       const lines = themesText.split('\n').filter(line => line.trim().length > 0);
//       extractedContent.themes = lines.map(line => line.trim());
//     } else {
//       // Process each bullet point (works for both * and - bullets)
//       extractedContent.themes = bulletPoints.map(point => {
//         // Clean up the bullet point - remove * or - at beginning
//         return point.replace(/^[\*\-]\s*/, '').trim();
//       }).filter(theme => theme.length > 0);
//     }
//   }
  
//   // Match the explanation
//   const explanationMatch = text.match(/3\.\s*Brief explanation of the resume grade:?\s*([^]*?)(?=\n\s*\d\.|\s*$)/i);
//   if (explanationMatch && explanationMatch[1]) {
//     extractedContent.explanation = explanationMatch[1].trim();
//   }
  
//   // console.log("Extracted content: ", extractedContent);
  
//   // Return the extracted content directly
//   return extractedContent;
// }

    
// function formatResponse(raw: string) {
//   if (!raw) return { elevatorPitch: '', themes: [], explanation: '' };

//   // 0) Normalize line endings
//   let text = raw.replace(/\r\n/g, '\n');

//   // 1) Fix unbalanced bold markers: **…* or *…** → **…**
//   text = text.replace(/\*\*(.+?)\*/g, '**$1**');
//   text = text.replace(/\*(.+?)\*\*/g, '**$1**');

//   // 2) Convert leading "* " or "+ " into "- " bullets
//   text = text.replace(/^[\s]*[\*\+]\s+/gm, '- ');

//   // 3) Convert numbered lists into bullet points
//   text = text.replace(/^[\s]*\d+\.\s+/gm, '- ');

//   // 4) Turn bold‐only lines into Markdown headers
//   text = text.replace(/^\s*\*\*(.+?)\*\*\s*$/gm, '\n## $1\n');

//   // 5) Strip noisy inline labels
//   text = text.replace(/([A-Za-z\s]+)(?::|-)?\s*\*+(?:\s*-?\s*\*+)*/g, '$1:');

//   // 6) Remove known noise patterns
//   const noisy = [
//     /Resume Grade Explanation:\*?.*/gi,
//     /Brief Explanation of the Resume Grade:\*?.*/gi,
//     /Three Specific Improvement Themes:\*?.*/gi,
//     /Specific Improvement Themes:\*?.*/gi,
//     /Professional Elevator Pitch:\*?.*/gi,
//     /\*?Resume Grade[^:]*:\*?/gi,
//     /\*?Three Specific Improvement Themes[^:]*:?\*?/gi,
//     /\*?Professional Elevator Pitch[^:]*:\*?/gi,
//     /\*?Detailed Explanation:\*?/gi,
//     /\*?Key Improvement Themes:\*?/gi,
//     /\*?([A-Za-z\s]+)\s*\(max\s*\d+\s*sentences?\):\*?/gi,
//   ];
//   for (const r of noisy) text = text.replace(r, '');

//   // 7) Remove leftover Markdown noise
//   text = text.replace(/^##\s*\*/gm, '');
//   text = text.replace(/-\s*\*+[A-Za-z\s]+:\*+/g, '-');
//   text = text.replace(/\*+[A-Za-z\s]+:\*+/g, '');

//   // 8) Strip floating ** or __
//   text = text.replace(/(?<=\s|^)\*{2,}(?=\s|$)/g, '');
//   text = text.replace(/(?<=\s|^)_+(?=\s|$)/g, '');

//   // 9) Simplify bullets like "- *Title*: description"
//   text = text.replace(/^-\s*\*?([A-Za-z\s]+\*?:)\s*(.*?)$/gm, '- $2');

//   // 10) Remove any remaining single *…*
//   text = text.replace(/\*([^*]+)\*/g, '$1');

//   // 11) Collapse 3+ blank lines to 2
//   text = text.replace(/\n{3,}/g, '\n\n');

//   // 12) Trim each line and outer whitespace
//   text = text
//     .split('\n')
//     .map(l => l.trimEnd())
//     .join('\n')
//     .trim();

//   // --- now extract the three sections ---

//   const extractedContent = {
//     elevatorPitch: '',
//     themes: [] as string[],
//     explanation: ''
//   };

//   // Elevator pitch: "**Professional Elevator Pitch:**" or "1. Professional elevator pitch:"
//   let m = text.match(
//     /(?:\*\*Professional Elevator Pitch:\*\*|1\.\s*Professional elevator pitch:)\s*([\s\S]*?)(?=\n\s*(?:\*\*Improvement Themes:\*\*|2\.)|\n{2,})/i
//   );
//   if (m) extractedContent.elevatorPitch = m[1].trim();

//   // Improvement themes: "**Improvement Themes:**" or "2. Three specific improvement themes:"
//   m = text.match(
//     /(?:\*\*Improvement Themes:\*\*|2\.\s*Three specific improvement themes:)\s*([\s\S]*?)(?=\n\s*(?:\*\*Resume Grade Explanation:\*\*|3\.)|\n{2,})/i
//   );
//   if (m) {
//     const block = m[1];
//     // match lines like "1. **Specificity**: …"
//     const items = Array.from(block.matchAll(
//       /\d+\.\s*\*\*(.*?)\*\*:\s*([\s\S]*?)(?=\n\s*\d+\.|\n|$)/g
//     ));
//     if (items.length) {
//       extractedContent.themes = items.map(([, title, desc]) => `${title.trim()}: ${desc.trim()}`);
//     } else {
//       // fallback: non-empty lines
//       extractedContent.themes = block
//         .split('\n')
//         .map(l => l.trim())
//         .filter(l => l);
//     }
//   }

//   // Explanation: "**Resume Grade Explanation:**" or "3. Brief explanation of the resume grade:"
//   m = text.match(
//     /(?:\*\*Resume Grade Explanation:\*\*|3\.\s*Brief explanation of the resume grade:)\s*([\s\S]*)$/i
//   );
//   if (m) extractedContent.explanation = m[1].trim();

//   return extractedContent;
// }
// interface Extraction {
//   elevatorPitch: string;
//   themes: string[];
//   explanation: string;
// }

// function formatResponse(raw: string): Extraction {
//   const extractedContent: Extraction = {
//     elevatorPitch: '',
//     themes: [],
//     explanation: ''
//   };

//   if (!raw) return extractedContent;

//   console.log("Before formatting:", raw);

//   // 1) Grab elevator pitch
//   //    Matches "**Professional Elevator Pitch:** ..." or "1. Professional elevator pitch: ..."
//   let m = raw.match(
//     /(?:\*\*Professional Elevator Pitch:\*\*|1\.\s*Professional elevator pitch:?)\s*([\s\S]*?)(?=\n{2,}|\n[*\d]|$)/i
//   );
//   if (m) {
//     extractedContent.elevatorPitch = m[1].trim();
//   }

//   // 2) Grab themes block
//   //    Matches "**Improvement Themes:**" or "2. Three specific improvement themes:"
//   m = raw.match(
//     /(?:\*\*Improvement Themes:\*\*|2\.\s*Three specific improvement themes:?)\s*([\s\S]*?)(?=\n{2,}|\n[*\d]|$)/i
//   );
//   if (m) {
//     const block = m[1].trim();
//     // Try asterisk bullets
//     let lines = Array.from(block.matchAll(/^[ *\-]+\s*(.+)$/gm), a => a[1].trim());
//     if (!lines.length) {
//       // fallback: any non-empty line
//       lines = block
//         .split(/\r?\n/)
//         .map(l => l.trim())
//         .filter(l => l.length);
//     }
//     extractedContent.themes = lines;
//   }

//   // 3) Grab explanation
//   //    Matches "**Resume Grade Explanation:**" or "3. Brief explanation of the resume grade:"
//   m = raw.match(
//     /(?:\*\*Resume Grade Explanation:\*\*|3\.\s*Brief explanation of the resume grade:?)\s*([\s\S]*?)$/i
//   );
//   if (m) {
//     extractedContent.explanation = m[1].trim();
//   }

//   console.log("Extracted Content:", extractedContent);
//   return extractedContent;
// }

// function formatResponse(raw) {
//   if (!raw) return { elevatorPitch: '', themes: [], explanation: '' };

//   const extractedContent = {
//     elevatorPitch: '',
//     themes: [],
//     explanation: ''
//   };

//   // Normalize text
//   let text = raw.replace(/\r\n/g, '\n').trim();

//   // Patterns for different formats of section headers
//   const elevatorPitchPatterns = [
//     /\*\*Professional Elevator Pitch:\*\*\s*([\s\S]*?)(?=\n\s*\*\*|\n\s*\d+\.|\n\s*$)/i,
//     /1\.\s*Professional Elevator Pitch:?\s*([\s\S]*?)(?=\n\s*\d+\.|\n\s*$)/i,
//     /Professional Elevator Pitch:?\s*([\s\S]*?)(?=\n\s*\*\*|\n\s*\d+\.|\n\s*$)/i,
//     /^Elevator Pitch:?\s*([\s\S]*?)(?=\n\s*\*\*|\n\s*\d+\.|\n\s*$)/im
//   ];

//   const themePatterns = [
//     /\*\*Improvement Themes:\*\*\s*([\s\S]*?)(?=\n\s*\*\*|\n\s*\d+\.|\n\s*$)/i,
//     /2\.\s*Three Specific Improvement Themes:?\s*([\s\S]*?)(?=\n\s*\d+\.|\n\s*$)/i,
//     /2\.\s*Improvement Themes:?\s*([\s\S]*?)(?=\n\s*\d+\.|\n\s*$)/i,
//     /Three Specific Improvement Themes:?\s*([\s\S]*?)(?=\n\s*\*\*|\n\s*\d+\.|\n\s*$)/i,
//     /Improvement Themes:?\s*([\s\S]*?)(?=\n\s*\*\*|\n\s*\d+\.|\n\s*$)/i
//   ];

//   const explanationPatterns = [
//     /\*\*Resume Grade Explanation:\*\*\s*([\s\S]*?)(?=\n\s*\*\*|\n\s*\d+\.|\n\s*$)/i,
//     /3\.\s*Brief Explanation of the Resume Grade:?\s*([\s\S]*?)(?=\n\s*\d+\.|\n\s*$)/i,
//     /3\.\s*Resume Grade Explanation:?\s*([\s\S]*?)(?=\n\s*\d+\.|\n\s*$)/i,
//     /Brief Explanation of the Resume Grade:?\s*([\s\S]*?)(?=\n\s*\*\*|\n\s*\d+\.|\n\s*$)/i,
//     /Resume Grade Explanation:?\s*([\s\S]*?)(?=\n\s*\*\*|\n\s*\d+\.|\n\s*$)/i,
//     /3\.\s*Explanation:?\s*([\s\S]*?)(?=\n\s*\d+\.|\n\s*$)/i
//   ];

//   // Extract elevator pitch
//   for (const pattern of elevatorPitchPatterns) {
//     const match = text.match(pattern);
//     if (match && match[1]) {
//       extractedContent.elevatorPitch = match[1].trim();
//       break;
//     }
//   }

//   // Extract themes
//   for (const pattern of themePatterns) {
//     const match = text.match(pattern);
//     if (match && match[1]) {
//       const themesText = match[1].trim();
      
//       // Try to extract bullet points (supports *, -, •, or numbered)
//       const bulletPatterns = [
//         /^\s*[\*\-•]\s*(.+?)(?=\n|$)/gm,    // Asterisk, dash, or bullet
//         /^\s*\d+[\.)]\s*(.+?)(?=\n|$)/gm,   // Numbered list
//         /^(.+?)(?=\n|$)/gm                  // Fallback: any non-empty line
//       ];

//       let themes = [];
//       for (const bulletPattern of bulletPatterns) {
//         const matches = Array.from(themesText.matchAll(bulletPattern));
//         if (matches.length > 0) {
//           themes = matches.map(m => m[1].trim()).filter(line => line.length > 0);
//           break;
//         }
//       }

//       // If still no themes, split by newlines and clean up
//       if (themes.length === 0) {
//         themes = themesText
//           .split('\n')
//           .map(line => line.trim())
//           .filter(line => line.length > 0 && !line.match(/^[\*\-•\d]/));
//       }

//       extractedContent.themes = themes;
//       break;
//     }
//   }

//   // Extract explanation
//   for (const pattern of explanationPatterns) {
//     const match = text.match(pattern);
//     if (match && match[1]) {
//       extractedContent.explanation = match[1].trim();
//       break;
//     }
//   }

//   // Fallback extraction if sections weren't found but are present in the text
//   if (!extractedContent.elevatorPitch) {
//     // Look for content after "elevator pitch" mention
//     const fallbackMatch = text.match(/elevator pitch:?\s*([^]*?)(?=\n\s*(?:\d+\.|improvement|themes|brief|resume grade)|$)/i);
//     if (fallbackMatch) {
//       extractedContent.elevatorPitch = fallbackMatch[1].trim();
//     }
//   }

//   if (extractedContent.themes.length === 0) {
//     // Look for content after "improvement themes" mention
//     const fallbackMatch = text.match(/improvement themes:?\s*([^]*?)(?=\n\s*(?:\d+\.|brief|resume grade|explanation)|$)/i);
//     if (fallbackMatch) {
//       const themesText = fallbackMatch[1];
//       const matches = themesText.match(/(?:^|\n)\s*[\*\-•\d]+\.?\s*(.+?)(?=\n|$)/g);
//       if (matches) {
//         extractedContent.themes = matches.map(m => m.replace(/^[\s\*\-•\d.]+/, '').trim());
//       }
//     }
//   }

//   if (!extractedContent.explanation) {
//     // Look for content after "explanation" or "grade" mention
//     const fallbackMatch = text.match(/(?:explanation|grade explanation|resume grade):?\s*([^]*?)$/i);
//     if (fallbackMatch) {
//       extractedContent.explanation = fallbackMatch[1].trim();
//     }
//   }

//   // Clean up extracted content
//   extractedContent.elevatorPitch = extractedContent.elevatorPitch.replace(/^As a /, '');
//   extractedContent.themes = extractedContent.themes.map(theme => 
//     theme.replace(/^[\*\-•\d]+\.?\s*/, '').trim()
//   ).filter(theme => theme.length > 0);

//   return extractedContent;
// }
function formatResponse(raw) {
  if (!raw) return { elevatorPitch: '', themes: [], explanation: '' };

  const extractedContent = {
    elevatorPitch: '',
    themes: [],
    explanation: ''
  };

  // Normalize text
  let text = raw.replace(/\r\n/g, '\n').trim();

  // Remove common noise
  text = text.replace(/Here are the three key outputs:/i, '');

  // === Extract Elevator Pitch ===
  const elevatorPitchPatterns = [
    /(?:\*\*)?Professional Elevator Pitch(?:\*\*)?:?\s*([\s\S]*?)(?=\n\s*(?:\*\*)?(?:Three Specific |Key )?Improvement Themes|(?:\*\*)?Improvement Themes|\n\s*\d+\.|\n\s*\*\*|$)/i,
    /(?:\*\*)?Elevator Pitch(?:\*\*)?:?\s*([\s\S]*?)(?=\n\s*(?:\*\*)?(?:Three Specific |Key )?Improvement Themes|(?:\*\*)?Improvement Themes|\n\s*\d+\.|\n\s*\*\*|$)/i,
    /1\.\s*Professional (?:E|e)levator (?:P|p)itch:?\s*([\s\S]*?)(?=\n\s*\d+\.|\n\s*$)/i,
    /Professional (?:E|e)levator (?:P|p)itch:?\s*([\s\S]*?)(?=\n\s*\*\*|\n\s*\d+\.|\n\s*$)/i,
  ];

  for (const pattern of elevatorPitchPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      let pitch = match[1].trim();
      // Clean up by removing line breaks and preserving space between paragraphs if needed
      pitch = pitch.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
      extractedContent.elevatorPitch = pitch;
      break;
    }
  }

  // === Extract Themes ===
  const themePatterns = [
    /(?:\*\*)?(?:Three Specific )?Improvement Themes(?:\*\*)?:?\s*([\s\S]*?)(?=\n\s*(?:\*\*)?(?:Resume Grade Explanation|Detailed Explanation|Brief Explanation|Explanation|Resume Grade)|\n\s*(?:\*\*)?Resume Grade:|\n\s*$)/i,
    /(?:\*\*)?Key Improvement Themes(?:\*\*)?:?\s*([\s\S]*?)(?=\n\s*(?:\*\*)?(?:Resume Grade Explanation|Detailed Explanation|Brief Explanation|Explanation|Resume Grade)|\n\s*$)/i,
    /2\.\s*(?:Three Specific )?Improvement Themes:?\s*([\s\S]*?)(?=\n\s*\d+\.|\n\s*$)/i,
  ];

  for (const pattern of themePatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const themesText = match[1].trim();
      let themes = [];
      
      // Try different theme extraction patterns
      const themeRegexes = [
        // Format: "1. **Title:** Description" or "1. Description"
        /^\s*\d+\.\s*(?:\*\*(.*?)\*\*\s*[:\-]?\s*)?([\s\S]*?)(?=\n\s*\d+\.|\n\s*\*\*|\n\s*$|$)/gm,
        // Format: "- Theme" or "* Theme"
        /^\s*[\*\-•]\s*([\s\S]*?)(?=\n\s*[\*\-•]|\n\s*\*\*|\n\s*$|$)/gm,
      ];

      for (const regex of themeRegexes) {
        const matches = Array.from(themesText.matchAll(regex));
        if (matches.length > 0) {
          if (matches[0].length === 3 && matches[0][1]) {
            // Has title and description
            themes = matches.map(m => {
              const title = m[1].trim();
              const description = (m[2] || '').trim();
              if (title && description) {
                return `${title}: ${description}`;
              } else if (title) {
                return title;
              } else {
                return description;
              }
            });
          } else {
            // Just description
            themes = matches.map(m => m[1] ? m[1].trim() : m[2].trim());
          }
          break;
        }
      }

      // If no matches found, try line-by-line extraction
      if (themes.length === 0) {
        const lines = themesText.split('\n');
        let currentTheme = '';
        
        for (const line of lines) {
          const trimmedLine = line.trim();
          
          if (!trimmedLine) continue;
          
          // Check if it's a new numbered or bulleted item
          if (trimmedLine.match(/^[\d]+\./) || trimmedLine.match(/^[\*\-•]/)) {
            if (currentTheme) {
              themes.push(currentTheme.trim());
            }
            currentTheme = trimmedLine.replace(/^[\d]+\.\s*|^[\*\-•]\s*/, '');
          } else if (currentTheme) {
            // Continuation of current theme
            currentTheme += ' ' + trimmedLine;
          } else {
            themes.push(trimmedLine);
          }
        }
        
        if (currentTheme) {
          themes.push(currentTheme.trim());
        }
      }

      // Clean up themes
      themes = themes
        .map(theme => 
          theme
            .replace(/^[\*\-•\d]+\.?\s*/, '')
            .replace(/\*\*/g, '')
            .trim()
        )
        .filter(theme => theme.length > 5);

      extractedContent.themes = themes;
      break;
    }
  }

  // === Extract Explanation ===
  const explanationPatterns = [
    /(?:\*\*)?Resume Grade(?: Explanation)?(?:\*\*)?:?\s*([\s\S]*?)(?=\n\s*(?:\*\*)?|$)/i,
    /(?:\*\*)?Brief (?:E|e)xplanation of the (?:R|r)esume (?:G|g)rade(?:\*\*)?:?\s*([\s\S]*?)(?=\n\s*(?:\*\*)?|$)/i,
    /3\.\s*Brief (?:E|e)xplanation of the (?:R|r)esume (?:G|g)rade:?\s*([\s\S]*?)(?=\n\s*\d+\.|\n\s*$)/i,
  ];

  for (const pattern of explanationPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      let explanation = match[1].trim();
      // Clean up line breaks
      explanation = explanation.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
      extractedContent.explanation = explanation;
      break;
    }
  }

  return extractedContent;
}




function formatResponse(raw) {
  if (!raw) return { elevatorPitch: '', themes: [], explanation: '' };

  const extractedContent = {
    elevatorPitch: '',
    themes: [],
    explanation: ''
  };

  // Normalize text
  let text = raw.replace(/\r\n/g, '\n').trim();

  // Remove common noise
  text = text.replace(/Here are the three key outputs:?/i, '');
  text = text.replace(/based on the provided resume text and basic analysis:/i, '');

  // === Extract Elevator Pitch ===
  const elevatorPitchPatterns = [
    /(?:\*\*)?Professional Elevator Pitch(?:\*\*)?:?\s*\n?([\s\S]*?)(?=\n\s*(?:\*\*)?(?:Three Specific |Key )?Improvement Themes|(?:\*\*)?Improvement Themes|\n\s*\d+\.|\n\s*\*\*|$)/i,
    /(?:\*\*)?Elevator Pitch(?:\*\*)?:?\s*\n?([\s\S]*?)(?=\n\s*(?:\*\*)?(?:Three Specific |Key )?Improvement Themes|(?:\*\*)?Improvement Themes|\n\s*\d+\.|\n\s*\*\*|$)/i,
    /1\.\s*Professional (?:E|e)levator (?:P|p)itch:?\s*\n?([\s\S]*?)(?=\n\s*\d+\.|\n\s*$)/i,
  ];

  for (const pattern of elevatorPitchPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      let pitch = match[1].trim();
      // Remove asterisks and clean up
      pitch = pitch.replace(/^\*\*\s*/, '').replace(/\s*\*\*$/, '');
      pitch = pitch.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
      extractedContent.elevatorPitch = pitch;
      break;
    }
  }

  // === Extract Themes ===
  const themePatterns = [
    /(?:\*\*)?(?:Three Specific )?Improvement Themes(?:\*\*)?:?\s*([\s\S]*?)(?=\n\s*(?:\*\*)?(?:Resume Grade Explanation|Resume Grade)|\n\s*(?:\*\*)?Resume Grade:|\n\s*$)/i,
    /2\.\s*(?:Three Specific )?Improvement Themes:?\s*([\s\S]*?)(?=\n\s*\d+\.|\n\s*$)/i,
  ];

  for (const pattern of themePatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const themesText = match[1].trim();
      let themes = [];
      
      // Comprehensive regex patterns for various theme formats
      const themeRegexes = [
        // Format: "1. **Title:** Description" or "1. **Title** Description"
        /^\s*\d+\.\s*\*\*(.*?)\*\*\s*[:\-]?\s*([\s\S]*?)(?=\n\s*\d+\.|\n\s*[\*\-•]|\n\s*\*\*|\n\s*$|$)/gm,
        
        // Format: "1. Title: Description" (no bold)
        /^\s*\d+\.\s*([^:\n\*]+?):\s*([\s\S]*?)(?=\n\s*\d+\.|\n\s*[\*\-•]|\n\s*\*\*|\n\s*$|$)/gm,
        
        // Format: "1. Description" (numbered without title)
        /^\s*\d+\.\s*((?![*\d]).+?)(?=\n\s*\d+\.|\n\s*[\*\-•]|\n\s*\*\*|\n\s*$|$)/gm,
        
        // Format: "- **Title:** Description" or "* **Title:** Description"
        /^\s*[\*\-•]\s*\*\*(.*?)\*\*\s*[:\-]?\s*([\s\S]*?)(?=\n\s*[\*\-•]|\n\s*\d+\.|\n\s*\*\*|\n\s*$|$)/gm,
        
        // Format: "- Title: Description" or "* Title: Description" (no bold)
        /^\s*[\*\-•]\s*([^:\n\*]+?):\s*([\s\S]*?)(?=\n\s*[\*\-•]|\n\s*\d+\.|\n\s*\*\*|\n\s*$|$)/gm,
        
        // Format: "- Description" or "* Description" (bullets without title)
        /^\s*[\*\-•]\s*((?![*\d]).+?)(?=\n\s*[\*\-•]|\n\s*\d+\.|\n\s*\*\*|\n\s*$|$)/gm,
      ];

      // Try each regex pattern
      for (const regex of themeRegexes) {
        const matches = Array.from(themesText.matchAll(regex));
        if (matches.length > 0) {
          themes = matches.map(m => {
            if (m.length === 3 && m[1] && m[2]) {
              // Has title and description
              const title = m[1].trim();
              const description = m[2].trim();
              return description ? `${title}: ${description}` : title;
            } else if (m[1]) {
              // Just description (or title without description)
              return m[1].trim();
            }
            return '';
          }).filter(theme => theme.length > 5);
          
          if (themes.length > 0) break;
        }
      }

      // If no matches found, try line-by-line extraction
      if (themes.length === 0) {
        const lines = themesText.split('\n');
        let currentTheme = '';
        
        for (const line of lines) {
          const trimmedLine = line.trim();
          
          if (!trimmedLine) continue;
          
          // Check if it's a new item (numbered, bulleted)
          if (trimmedLine.match(/^[\d]+\./) || trimmedLine.match(/^[\*\-•]/)) {
            if (currentTheme) {
              themes.push(currentTheme.trim());
            }
            currentTheme = trimmedLine.replace(/^[\d]+\.\s*|^[\*\-•]\s*/, '').replace(/\*\*/g, '');
          } else if (currentTheme) {
            // Continuation of current theme
            currentTheme += ' ' + trimmedLine.replace(/\*\*/g, '');
          } else {
            themes.push(trimmedLine.replace(/\*\*/g, ''));
          }
        }
        
        if (currentTheme) {
          themes.push(currentTheme.trim());
        }
      }

      // Final cleanup
      themes = themes
        .map(theme => theme.replace(/\*\*/g, '').trim())
        .filter(theme => theme.length > 5);

      extractedContent.themes = themes;
      break;
    }
  }

  // === Extract Explanation ===
  const explanationPatterns = [
    /(?:\*\*)?Resume Grade(?:\*\*)?:?\s*\n?([\s\S]*?)(?=\n\s*$|$)/i,
    /(?:\*\*)?Brief (?:E|e)xplanation of the (?:R|r)esume (?:G|g)rade(?:\*\*)?:?\s*\n?([\s\S]*?)(?=\n\s*$|$)/i,
    /3\.\s*(?:Brief )?(?:E|e)xplanation of the (?:R|r)esume (?:G|g)rade:?\s*\n?([\s\S]*?)(?=\n\s*$|$)/i,
  ];

  for (const pattern of explanationPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      let explanation = match[1].trim();
      // Remove asterisks and clean up
      explanation = explanation.replace(/^\*\*\s*/, '').replace(/\s*\*\*$/, '');
      explanation = explanation.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
      extractedContent.explanation = explanation;
      break;
    }
  }

  return extractedContent;
}    
// Call the GROQ API with timeout
const controller = new AbortController();
const timeoutId = setTimeout(()=>controller.abort(), 8000); // 8 second timeout
try {
  // const requestBody = {
  //   model: 'compound-beta-mini', //'llama3-8b-8192',
  //   messages: [
  //     {
  //       role: 'system',
  //       content: `You are an expert resume analyst. Based on the provided resume text and basic analysis, 
  //       provide three key outputs:
  //       1. A professional elevator pitch (max 2 sentences) based on the resume text
  //       2. Three specific improvement themes (one sentence each) based on the resume text
  //       3. A brief explanation of the resume grade (max 2 sentences) based on the resume text
        
  //       Be specific, professional, and concise. Focus on actionable advice. Format your response with no markdown, just clean text.`
  //     },
  //     {
  //       role: 'user',
  //       content: `Resume text (truncated): ${truncatedResume}\n\nBasic Analysis: ${JSON.stringify(condensedAnalysis)}`
  //     }
  //   ],
  //   max_tokens: 500,
  //   temperature: 0.4
  // };
  
  // // Add the signal to the retry function
  // const data = await callGroqWithRetry(apiKey, requestBody, 3, controller.signal);
  const system =`You are an expert resume analyst. Based on the provided resume text and basic analysis, 
              provide three key outputs:
            1. A professional elevator pitch (max 2 sentences) based on the resume text
            2. Three specific improvement themes (one sentence each) based on the resume text
            3. A brief explanation of the resume grade (max 2 sentences) based on the resume text
            Be specific, professional, and concise. Focus on actionable advice. Format your response with no markdown, just clean text.`
 const user = `Resume text (truncated): ${truncatedResume}\n\nBasic Analysis: ${JSON.stringify(condensedAnalysis)}`
  // const data = await callGroqWithRetry(system, user);
  
  const aiResponse = await callGroqWithRetry(system, user);
  clearTimeout(timeoutId);
  
  // const aiResponse = data.choices[0].message.content;
  console.log("AI Response: ", aiResponse);
  
  // Use our new format function which returns an object with extracted content
  const extractedContent = formatResponse(aiResponse);
  console.log("Extracted Content: ", extractedContent)
  
  // Update the analysis with AI-generated content
  const enhancedAnalysis = {
    ...analysis
  }; // Create a copy to avoid mutation
  
  // Directly set the extracted values
  if (extractedContent.elevatorPitch) {
    enhancedAnalysis.elevator_pitch = extractedContent.elevatorPitch;
    console.log("Elevator pitch: ", enhancedAnalysis.elevator_pitch )
  }
  
  if (extractedContent.themes && extractedContent.themes.length > 0) {
    enhancedAnalysis.themes = extractedContent.themes.slice(0, 4);
    console.log("Themes: ", extractedContent.themes )
  }
  
  if (extractedContent.explanation) {
    enhancedAnalysis.explanation = extractedContent.explanation;
    console.log("Overall Explanation: ", enhancedAnalysis.explanation )
  }
  
//   console.log("Enhanced Analysis: ", enhancedAnalysis);
//   return enhancedAnalysis;
// } catch (error) {
//   console.error('Error processing AI response:', error);
//   clearTimeout(timeoutId);
//   // Return the original analysis if there was an error
//   return analysis;
// }}}
//       function formatResponse(raw) {
//         if (!raw) return '';
//         let text = raw;
//         console.log("Before formatting: ", raw);
        
//         // 1) Fix unbalanced bold markers: **…* or *…** → **…**
//         text = text.replace(/\*\*(.+?)\*/g, '**$1**');
//         text = text.replace(/\*(.+?)\*\*/g, '**$1**');
        
//         // 2) Convert leading "* " or "+ " into "- " bullets
//         text = text.replace(/^[\s]*[\*\+]\s+/gm, '- ');
        
//         // 3) Convert numbered lists into bullet points
//         text = text.replace(/^[\s]*\d+\.\s+/gm, '- ');
        
//         // 4) Ensure bold-only lines become headers
//         text = text.replace(/^\s*\*\*(.+?)\*\*\s*$/gm, '\n## $1\n');
        
//         // 5) Remove noisy markdown-like labels (flexible pattern)
//         text = text.replace(/([A-Za-z\s]+)(?::|-)?\s*\*+(?:\s*-?\s*\*+)*/g, '$1:');
        
//         // 6) Remove known noise patterns - CONSOLIDATED with section patterns
//         const noisyPatterns = [
//           // Original noise patterns
//           /Resume Grade Explanation:\*?.*/gi,
//           /Brief Explanation of the Resume Grade:\*?.*/gi,
//           /Three Specific Improvement Themes:\*?.*/gi,
//           /Quantifiable Results:\*?.*/gi,
//           /IStronger Action Verbs:k:.*/gi,
//           /Specific Improvement Themes:\*?.*/gi,
//           /Concise Language:\*?.*/gi,
//           /Professional Elevator Pitch:\*?.*/gi,
//           /Resume Grade and Explanation:\*?.*/gi,
          
//           // Added consolidated section patterns
//           /\*?Professional Elevator Pitch[^:]*:\*?/gi,
//           /\*?Resume Grade[^:]*:\*?/gi,
//           /\*?Three Specific Improvement Themes[^:]*:?\*?/gi,
//           /\*?Detailed Explanation:\*?/gi,
//           /\*?Key Improvement Themes:\*?/gi,
          
//           // General section pattern with max sentences
//           /\*?([A-Za-z\s]+)\s*\(max\s*\d+\s*sentences?\):\*?/gi
//         ];
        
//         for (const pattern of noisyPatterns) {
//           text = text.replace(pattern, '');
//         }
        
//         // 7) Remove markdown-like noise lines
//         text = text.replace(/^##\s*\*/gm, '');
//         text = text.replace(/-\s*\*+[A-Za-z\s]+:\*+/g, '-');
//         text = text.replace(/\*+[A-Za-z\s]+:\*+/g, '');
        
//         // 8) Remove floating bold/italic markers (e.g., **, ***, etc.)
//         text = text.replace(/(?<=\s|^)\*{2,}(?=\s|$)/g, '');
//         text = text.replace(/(?<=\s|^)_+(?=\s|$)/g, '');
        
//         // 9) Clean up bullet points with special formatting
//         text = text.replace(/^-\s*\*?([A-Za-z\s]+\*?:)\s*(.*?)$/gm, '- $2');
        
//         // 10) Clean up asterisks around text
//         text = text.replace(/\*([^*]+)\*/g, '$1');
        
//         // 11) Collapse 3+ blank lines → 2
//         text = text.replace(/\n{3,}/g, '\n\n');
        
//         // 12) Trim trailing spaces and outer whitespace
//         return text.split('\n').map((line) => line.trimEnd()).join('\n').trim();
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
    } catch (fetchError) {
      console.error("GROQ API fetch error:", fetchError);
      // If there's a timeout or other fetch error, continue with the basic analysis
      clearTimeout(timeoutId);
      return analysis;
    }
    
  } catch (error) {
    console.error("Error enhancing analysis with GROQ:", error);
    // Return original analysis on any error
    return analysis;
  }
} // End of enhanceWithGroq function