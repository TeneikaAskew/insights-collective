import { corsHeaders, callLLMWithRetry } from './utils.ts';
// Use GROQ API to enhance analysis with AI-
export async function enhanceWithGroq(resumeText, analysis) {
  console.log('Resume scoring and feedback function hit');
  const startTime = Date.now();
  try {
    const apiKey = Deno.env.get('GROQ');
    if (!apiKey) {
      throw new Error("GROQ API key not found");
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

// function formatResponse(raw: string): { elevatorPitch: string, themes: string[], explanation: string } {
//   if (!raw) {
//     return { elevatorPitch: "", themes: [], explanation: "" };
//   }

//   const extractedContent = {
//     elevatorPitch: "",
//     themes: [],
//     explanation: ""
//   };

//   // Normalize text
//   let text = raw.replace(/\\n/g, '\n').replace(/\r\n/g, '\n').trim();
//   text = text.replace(/Here are the three key outputs:?/i, '');
//   text = text.replace(/Here are three key outputs:?/i, '');
//   text = text.replace(/based on the provided resume text and basic analysis:/i, '');

//   // Elevator pitch patterns
//   const elevatorPatterns = [
//     /(?:\*\*)?Professional Elevator Pitch(?:\*\*)?:?\s*[\r\n]+([\s\S]*?)(?=\n\s*(?:\*\*)?(?:Three Specific |Key )?Improvement Themes|(?:\*\*)?Improvement Themes|\n\s*\d+\.|\n\s*\*\*|$)/i,
//     /(?:\*\*)?Elevator Pitch(?:\*\*)?:?\s*[\r\n]+([\s\S]*?)(?=\n\s*(?:\*\*)?(?:Three Specific |Key )?Improvement Themes|(?:\*\*)?Improvement Themes|\n\s*\d+\.|\n\s*\*\*|$)/i,
//     /A professional elevator pitch based on the resume text:?\s*[\r\n]+([\s\S]*?)(?=\n\s*(?:Three specific improvement themes|Improvement Themes|2\.|Resume Grade|$))/i,
//     /1\.\s*Professional (?:E|e)levator (?:P|p)itch:?\s*[\r\n]+([\s\S]*?)(?=\n\s*\d+\.|\n\s*$)/i,
//     /\*\*Professional Elevator Pitch:\*\*\s*[\r\n]+([\s\S]*?)(?=\n\s*\*\*|\n\s*\d+\.|\n\s*$)/i,
//     /1\.\s*Professional Elevator Pitch:?\s*[\r\n]+([\s\S]*?)(?=\n\s*\d+\.|\n\s*$)/i,
//     /Professional Elevator Pitch:?\s*[\r\n]+([\s\S]*?)(?=\n\s*\*\*|\n\s*\d+\.|\n\s*$)/i,
//     /^Elevator Pitch:?\s*[\r\n]+([\s\S]*?)(?=\n\s*\*\*|\n\s*\d+\.|\n\s*$)/mi,
//     /Here are the three key outputs:\s*\\n+([\s\S]{40,500}?)(?=\\n+Here are|\\n+(?:Three|three) specific improvement themes|\\n+The resume|\\n+\*\*|\\n+$)/i,
//     /^As\s+a\s+[^\n]{10,250}?(?=\n{2,}|\nHere are|\nThree|\nThe resume|\nResume Grade|$)/im,
//     /Here are the three key outputs:\s*\n+([^\n]{40,500}.*?)(?=\n{2,}|Here are|Three specific improvement themes|The resume|Resume Grade|$)/i,
//     /([A-Z][\s\S]{30,800}?)(?=\n{2,}|\n+(Here are|Three|The resume|Resume Grade|A brief explanation|Explanation|Improvement Themes|$))/i
//   ];

//   for (const pattern of elevatorPatterns) {
//     const match = text.match(pattern);
//     if (match) {
//       let pitch = match[1].trim();
//       pitch = pitch.replace(/^\*\*\s*|\s*\*\*$/g, '');
//       pitch = pitch.replace(/\n+/g, ' ');
//       pitch = pitch.replace(/\s+/g, ' ').trim();
//       extractedContent.elevatorPitch = pitch;
//       break;
//     }
//   }

//   // Improvement themes patterns
//   const themePatterns = [
//     /\*\*Three Specific Improvement Themes:\*\*\s*([\s\S]*?)(?=\n\s*\*\*Resume Grade|\n\s*$)/i,
//     /(?:\*\*)?(?:Three Specific )?Improvement Themes(?:\*\*)?:?\s*([\s\S]*?)(?=\n\s*(?:\*\*)?(?:Resume Grade Explanation|Resume Grade)|\n\s*(?:\*\*)?Resume Grade:|\n\s*$)/i,
//     /2\.\s*(?:Three Specific )?Improvement Themes:?\s*([\s\S]*?)(?=\n\s*\d+\.|\n\s*$)/i,
//     /(?:\*\*)?Key Improvement Themes(?:\*\*)?:?\s*([\s\S]*?)(?=\n\s*(?:\*\*)?(?:Resume Grade Explanation|Resume Grade)|\n\s*$)/i,
//     /Three specific improvement themes:?\s*([\s\S]*?)(?=\n\s*(?:A brief explanation of the resume grade|Resume Grade|3\.|$))/i,
//     /Three Specific Improvement Themes:?\s*([\s\S]*?)(?=\n\s*\*\*|\n\s*\d+\.|\n\s*$)/i,
//     /\*\*Improvement Themes:\*\*\s*([\s\S]*?)(?=\n\s*\*\*|\n\s*\d+\.|\n\s*$)/i,
//     /Improvement Themes:?\s*([\s\S]*?)(?=\n\s*\*\*|\n\s*\d+\.|\n\s*$)/i,
//     /2\.\s*[Tt]hree specific improvement themes:?\s*([\s\S]*?)(?=\n\s*3\.|\n\s*\*\*Brief Explanation|\n\s*Resume Grade|$)/i,
//     /^(?=.*\b(improve|strengthen|enhance|suggestions)\b)[^\n:]{5,250}:\s*([\s\S]*?)(?=\n+(?:The resume|Resume Grade|A brief explanation|Explanation|$))/im,
//     /three\s+specific\s+improvement\s+themes?\b\s*[:\-]?\s*([\s\S]*?)(?=\n\s*(?:the resume|resume grade|a brief explanation|explanation|\d+\.\s|\*\*|$))/i,
//     /three specific improvement themes\s*(?:are|include)?\s*:\s*([\s\S]*?)(?=\n\s*(?:The resume|Resume Grade|$))/i,
//     /three\s+specific\s+improvement\s+themes?\b[\s\S]*?(?=\n{2,}|$)/i,
//   ];

//   for (const pattern of themePatterns) {
//     const match = text.match(pattern);
//     if (match) {
//       const themesText = match[1].trim();
//       let themes: string[] = [];

//       // Try extracting structured bullet points or lines
//       const lines = themesText.split('\n');
//       let currentTheme = '';
//       for (const line of lines) {
//         const trimmedLine = line.trim();
//         if (!trimmedLine) continue;
        
//         if (/^[\d]+\./.test(trimmedLine) || /^[\*\-•]/.test(trimmedLine)) {
//           if (currentTheme) {
//             themes.push(currentTheme.trim());
//           }
//           currentTheme = trimmedLine.replace(/^[\d]+\.\s*|^[\*\-•]\s*/, '');
//         } else {
//           currentTheme += ' ' + trimmedLine;
//         }
//       }
//       if (currentTheme) {
//         themes.push(currentTheme.trim());
//       }

//       // Clean up extracted themes
//       themes = themes
//         .map(theme => theme.replace(/\*\*/g, '').trim())
//         .filter(theme => theme.length > 5);

//       // Fallback: If no themes were split (single long blob), try line-by-line
//       if (themes.length <= 1 && themesText.includes('\n')) {
//         themes = [];
//         for (const line of themesText.split('\n')) {
//           const cleaned = line.trim().replace(/•/g, '').replace(/\*/g, '').replace(/-/g, '');
//           if (cleaned.length > 10) {
//             themes.push(cleaned);
//           }
//         }
//       }

//       themes = themes
//         .map(theme => theme.replace(/\*\*/g, '').trim())
//         .filter(theme => theme.length > 5);
      
//       extractedContent.themes = themes;
//       break;
//     }
//   }

//   const explanationPatterns = [
//     /(The resume grade of [A-F][+-]?\s+[^.]+\.[\s\S]*?(?=\n\s*))/,
//         /\*\*Resume Grade:\*\*\s*([\s\S]*?)(?=\n\s*\*\*|\n\s*)/,
//         /(?:\*\*)?Resume Grade(?:\*\*)?:?\s*\n?([\s\S]*?)(?=\n\s*)/,
//         /(?:\*\*)?Brief (?:E|e)xplanation of the (?:R|r)esume (?:G|g)rade(?:\*\*)?:?\s*\n?([\s\S]*?)(?=\n\s*)/,
//         /3\.\s*(?:Brief )?(?:E|e)xplanation of the (?:R|r)esume (?:G|g)rade:?\s*\n?([\s\S]*?)(?=\n\s*)/,
//         /\*\*Resume Grade Explanation:\*\*\s*([\s\S]*?)(?=\n\s*\*\*|\n\s*\d+\.|\n\s*$)/,
//         /Resume Grade Explanation:?\s*([\s\S]*?)(?=\n\s*\*\*|\n\s*\d+\.|\n\s*$)/,
//         /3\.\s*Explanation:?\s*([\s\S]*?)(?=\n\s*\d+\.|\n\s*$)/,
//         /(The resume grade of [A-F][+-]?\s+[^.]+\.[\s\S]*?(?=\n\s*))/,
//         /([Tt]he\s+[A-F][+-]?\s+grade\s+[^.]+?\.)/, 
//       ];

//   for (const pattern of explanationPatterns) {
//     const match = text.match(pattern);
//     if (match) {
//       let explanation = match[1].trim();
//       explanation = explanation.replace(/^\*\*\s*|\s*\*\*$/g, '');
//       explanation = explanation.replace(/\n+/g, ' ');
//       explanation = explanation.replace(/\s+/g, ' ').trim();
//       extractedContent.explanation = explanation;
//       break;
//     }
//   }
//   /* ---------- Fallback if no pattern matched ---------- */
//   if (!extractedContent.explanation) {
//     const paragraphs = text
//       .split(/\n{2,}/)          // split on blank-line breaks
//       .map(p => p.trim())
//       .filter(Boolean);         // remove empty strings
  
//     if (paragraphs.length) {
//       // grab the last paragraph
//       extractedContent.explanation = paragraphs[paragraphs.length - 1];
//     }
//   }
//   return extractedContent;
// }

// Improved function for formatting and extracting AI response content
function formatResponse(raw) {
  if (!raw) {
    return {
      elevatorPitch: "",
      themes: [],
      explanation: ""
    };
  }
  const extractedContent = {
    elevatorPitch: "",
    themes: [],
    explanation: ""
  };

  // console.log("Raw AI Response: ", raw)
  // Normalize text
  let text = raw.replace(/\\n/g, '\n').replace(/\r\n/g, '\n').trim();
  text = text.replace(/Here are the three key outputs:?/i, '');
  text = text.replace(/Here are three key outputs:?/i, '');
  text = text.replace(/based on the provided resume text and basic analysis:/i, '');
  text = text.replace(/Can be addressed:?/i, '');

  const aiPhrases = [
    /Here is a professional elevator pitch based on the resume text[:\s]*/gi,
    /Here is a professional elevator pitch[:\s]*/gi,
    /Based on the resume text are[:\s]*/gi,
    /Based on the resume text[:\s]*/gi,
    /For the resume are[:\s]*/gi,
    /For the resume[:\s]*/gi
  ];
  function stripPhrases(str: string) {
    let out = str;
    for (const re of aiPhrases) out = out.replace(re, '');
    return out;
  }
  
  // Elevator pitch patterns (unchanged)
  const elevatorPatterns = [
    /(?:\*\*)?Professional Elevator Pitch(?:\*\*)?:?\s*[\r\n]+([\s\S]*?)(?=\n\s*(?:\*\*)?(?:Three Specific |Key )?Improvement Themes|(?:\*\*)?Improvement Themes|\n\s*\d+\.|\n\s*\*\*|$)/i,
    /(?:\*\*)?Elevator Pitch(?:\*\*)?:?\s*[\r\n]+([\s\S]*?)(?=\n\s*(?:\*\*)?(?:Three Specific |Key )?Improvement Themes|(?:\*\*)?Improvement Themes|\n\s*\d+\.|\n\s*\*\*|$)/i,
    /A professional elevator pitch based on the resume text:?\s*[\r\n]+([\s\S]*?)(?=\n\s*(?:Three specific improvement themes|Improvement Themes|2\.|Resume Grade|$))/i,
    /1\.\s*Professional (?:E|e)levator (?:P|p)itch:?\s*[\r\n]+([\s\S]*?)(?=\n\s*\d+\.|\n\s*$)/i,
    /\*\*Professional Elevator Pitch:\*\*\s*[\r\n]+([\s\S]*?)(?=\n\s*\*\*|\n\s*\d+\.|\n\s*$)/i,
    /1\.\s*Professional Elevator Pitch:?\s*[\r\n]+([\s\S]*?)(?=\n\s*\d+\.|\n\s*$)/i,
    /Professional Elevator Pitch:?\s*[\r\n]+([\s\S]*?)(?=\n\s*\*\*|\n\s*\d+\.|\n\s*$)/i,
    /^Elevator Pitch:?\s*[\r\n]+([\s\S]*?)(?=\n\s*\*\*|\n\s*\d+\.|\n\s*$)/mi,
    /Here are the three key outputs:\s*\\n+([\s\S]{40,500}?)(?=\\n+Here are|\\n+(?:Three|three) specific improvement themes|\\n+The resume|\\n+\*\*|\\n+$)/i,
    /^As\s+a\s+[^\n]{10,250}?(?=\n{2,}|\nHere are|\nThree|\nThe resume|\nResume Grade|$)/im,
    /Here are the three key outputs:\s*\n+([^\n]{40,500}.*?)(?=\n{2,}|Here are|Three specific improvement themes|The resume|Resume Grade|$)/i,
    /([A-Z][\s\S]{30,800}?)(?=\n{2,}|\n+(Here are|Three|The resume|Resume Grade|A brief explanation|Explanation|Improvement Themes|$))/i,
    /A\s+professional\s+elevator\s+pitch\s+based\s+on\s+the\s+resume\s+text\s+could\s+be:?\s*(.+?)(?=\n{2,}|\n+Three\s+specific\s+improvement\s+themes|\n+The\s+resume|$)/is,
    /A\s+professional\s+elevator\s+pitch[^:]{0,80}:?\s*(.+?)(?=\n{2,}|\n+Three\s+specific\s+improvement\s+themes|\n+The\s+resume|$)/is,
    /To improve the resume, three key themes emerge:([\s\S]*?)(?=\n\s*The resume grade|$)/i, // <-- added as a pattern

  ];
  
  for (const pattern of elevatorPatterns){
    const match = text.match(pattern);
    if (match) {
      let pitch = match[1].trim();
      pitch = pitch.replace(/^\*\*\s*|\s*\*\*$/g, '');
      pitch = pitch.replace(/\n+/g, ' ');
      pitch = pitch.replace(/\s+/g, ' ').trim();
      pitch = pitch.replace(/^Elevator Pitch:?/i, '');
      pitch = stripPhrases(pitch);  
      extractedContent.elevatorPitch = pitch;
      
      break;
    }
  }
  
  // Add this helper function before the themePatterns array
  function capitalizeFirstWord(text) {
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  // Improvement themes patterns - FIXED VERSION
  const themePatterns = [
    /\*\*Three Specific Improvement Themes:\*\*\s*([\s\S]*?)(?=\n\s*\*\*Resume Grade|\n\s*$)/i,
    /(?:\*\*)?(?:Three Specific )?Improvement Themes(?:\*\*)?:?\s*([\s\S]*?)(?=\n\s*(?:\*\*)?(?:Resume Grade Explanation|Resume Grade|The resume)|\n\s*(?:\*\*)?Resume Grade:|\n\s*$)/i,
    /2\.\s*(?:Three Specific )?Improvement Themes:?\s*([\s\S]*?)(?=\n\s*\d+\.|\n\s*$)/i,
    /(?:\*\*)?Key Improvement Themes(?:\*\*)?:?\s*([\s\S]*?)(?=\n\s*(?:\*\*)?(?:Resume Grade Explanation|Resume Grade)|\n\s*$)/i,
    /Three specific improvement themes:?\s*([\s\S]*?)(?=\n\s*(?:A brief explanation of the resume grade|Resume Grade|3\.|$))/i,
    /Three Specific Improvement Themes:?\s*([\s\S]*?)(?=\n\s*\*\*|\n\s*\d+\.|\n\s*$)/i,
    /\*\*Improvement Themes:\*\*\s*([\s\S]*?)(?=\n\s*\*\*|\n\s*\d+\.|\n\s*$)/i,
    /Improvement Themes:?\s*([\s\S]*?)(?=\n\s*\*\*|\n\s*\d+\.|\n\s*$)/i,
    /2\.\s*[Tt]hree specific improvement themes:?\s*([\s\S]*?)(?=\n\s*3\.|\n\s*\*\*Brief Explanation|\n\s*Resume Grade|$)/i,
    /^(?=.*\b(improve|strengthen|enhance|suggestions)\b)[^\n:]{5,250}:\s*([\s\S]*?)(?=\n+(?:The resume|Resume Grade|A brief explanation|Explanation|$))/im,
    /three\s+specific\s+improvement\s+themes?\b\s*[:\-]?\s*([\s\S]*?)(?=\n\s*(?:the resume|resume grade|a brief explanation|explanation|\d+\.\s|\*\*|$))/i,
    /three\s+specific\s+improvement\s+themes?\s*(?:are|include)?\s*:\s*([\s\S]*?)(?=\n\s*(?:The resume|Resume Grade|$))/i,
    /[Tt]hree specific improvement themes are:\s*([\s\S]*?)(?=\n\s*(?:The resume|Resume Grade|$))/i,
    /[Tt]hree specific improvement themes?\s*(?:are)?:?\s*([\s\S]*?)(?=\n\s*(?:The resume|Resume Grade|$))/i,
    /To improve the resume, three key themes\s*([\s\S]*?)(?=\n\s*(?:The resume|Resume Grade|$))/i,
    /To improve the resume, three key themes can be addressed:\s*([\s\S]*?)(?=\n\s*(?:The resume|Resume Grade|$))/i,
    /Three\s+specific\s+improvement\s+themes\s+are:\s*([\s\S]*?)(?=\n\s*(?:The resume|Resume Grade|$))/i,
    /Three\s+specific\s+improvement\s+themes\s+are\s*:\s*([\s\S]*?)(?=\n\s*(?:The resume|Resume Grade|$))/i,  
    /Three\s+specific\s+improvement\s+themes\s+based\s+on\s+the\s+resume\s+text\s+are:?\s*([\s\S]*?)(?=\n{2,}|\n+The\s+resume\s+grade|\n+\*\*|$)/i,

    
  ];
  
  for (const pattern of themePatterns){
    const match = text.match(pattern);
    if (match) {
      // let themesText = match[1].trim();
      let themesText = match.slice(1).find(g => g && g.trim())?.trim() || '';
      themesText = stripPhrases(themesText); 
      let themes = [];
      
      // NEW APPROACH: Look for specific patterns in the GROQ response format
      if (themesText.includes("\n")) {
        // Split by newlines for bullet-style themes
        const lines = themesText.split("\n").map(line => line.trim()).filter(Boolean);
        
        
        // Process each line to clean up bullet points and numbering
        themes = lines.map(line => {
          // Remove bullet points and numbers, but preserve the theme content
          return capitalizeFirstWord(line.replace(/^[\d]+\.\s*|^[-•*]\s*/, '')
                   .trim());
        }).filter(theme => theme.length > 10);
      } 
      
      // If no lines were found, try detecting sentence-based themes
      if (themes.length === 0) {
        // Look for patterns like "1. Theme one. 2. Theme two." in a single paragraph
        const sentenceSplit = themesText.split(/\.\s+/).map(s => capitalizeFirstWord(s.trim())).filter(Boolean);
        themes = sentenceSplit.filter(s => s.length > 10);
      }
      
      // If still no themes, just take the whole text as one theme
      if (themes.length === 0 && themesText.length > 10) {
        themes = [capitalizeFirstWord(themesText.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim())];
      }
      
      extractedContent.themes = themes;
      break;
    }
  }

      // Special case for the format in your example
  if (extractedContent.themes.length === 0) {
    const specialFormatMatch = text.match(/Three specific improvement themes(?:\s+are)?:?\s*\n*(.*?)(?=\n\s*The resume grade|$)/is);
    if (specialFormatMatch) {
      let themeText = specialFormatMatch[1].trim();
      if (themeText) {
        // Try to split on bullet points or numbered items
        const themesWithBullets = themeText.split(/\n/).map(line => {
          return line.trim().replace(/^[\d]+\.\s*|^[-•*]\s*/, '').trim();
        }).filter(t => t.length > 10);
        
        if (themesWithBullets.length > 0) {
          extractedContent.themes = themesWithBullets;
        }
      }
    }
  }
  
  // Extra fallback for the specific format in your example
  if (extractedContent.themes.length === 0) {
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].match(/Three specific improvement themes/i)) {
        // Get the next three non-empty lines as themes
        const potentialThemes = [];
        let j = i + 1;
        while (potentialThemes.length < 3 && j < lines.length) {
          const line = lines[j].trim();
          if (line && !line.match(/The resume grade/i)) {
            potentialThemes.push(line);
          }
          j++;
        }
        if (potentialThemes.length > 0) {
          extractedContent.themes = potentialThemes;
          break;
        }
      }
    }
  }
  
  // Explanation patterns (unchanged)
  const explanationPatterns = [
    /(The resume grade of [A-F][+-]?\s+[^.]+\.[\s\S]*?(?=\n\s*))/,
    /\*\*Resume Grade:\*\*\s*([\s\S]*?)(?=\n\s*\*\*|\n\s*)/,
    /(?:\*\*)?Resume Grade(?:\*\*)?:?\s*\n?([\s\S]*?)(?=\n\s*)/,
    /(?:\*\*)?Brief (?:E|e)xplanation of the (?:R|r)esume (?:G|g)rade(?:\*\*)?:?\s*\n?([\s\S]*?)(?=\n\s*)/,
    /3\.\s*(?:Brief )?(?:E|e)xplanation of the (?:R|r)esume (?:G|g)rade:?\s*\n?([\s\S]*?)(?=\n\s*)/,
    /\*\*Resume Grade Explanation:\*\*\s*([\s\S]*?)(?=\n\s*\*\*|\n\s*\d+\.|\n\s*$)/,
    /Resume Grade Explanation:?\s*([\s\S]*?)(?=\n\s*\*\*|\n\s*\d+\.|\n\s*$)/,
    /3\.\s*Explanation:?\s*([\s\S]*?)(?=\n\s*\d+\.|\n\s*$)/,
    /(The resume grade of [A-F][+-]?\s+[^.]+\.[\s\S]*?(?=\n\s*))/,
    /([Tt]he\s+[A-F][+-]?\s+grade\s+[^.]+?\.)/,
    /The\s+resume\s+grade\s+is\s+[A-F][+-]?[^.]*?\.[\s\S]*?(?=\n{2,}|\n\s*$)/i,

  ];
  
  for (const pattern of explanationPatterns){
    const match = text.match(pattern);
    if (match) {
      let explanation = match[1].trim();
      explanation = explanation.replace(/^\*\*\s*|\s*\*\*$/g, '');
      explanation = explanation.replace(/\n+/g, ' ');
      explanation = explanation.replace(/\s+/g, ' ').trim();
      explanation = stripPhrases(explanation); 
      extractedContent.explanation = explanation;
      break;
    }
  }
  
  /* ---------- Fallback if no pattern matched ---------- */ 
  if (!extractedContent.explanation) {
    const paragraphs = text.split(/\n{2,}/) // split on blank-line breaks
                          .map((p)=>p.trim()).filter(Boolean); // remove empty strings
    if (paragraphs.length) {
      // grab the last paragraph
      extractedContent.explanation = paragraphs[paragraphs.length - 1];
    }
  }
  
  // Debug what we extracted
  // console.log("Extracted content:", JSON.stringify(extractedContent, null, 2));
  
  return extractedContent;
}

function jsonFormatResponse(raw) {
  if (!raw) return { elevatorPitch: "", themes: [], explanation: "" };
  let json;
  try {
    // Remove code block markers if present
    const cleaned = raw.replace(/```(json)?/g, '').trim();
    json = JSON.parse(cleaned);
    // Optionally: validate keys here
    return {
      elevatorPitch: json.elevatorPitch || "",
      themes: Array.isArray(json.themes) ? json.themes : [],
      explanation: json.explanation || ""
    };
  } catch (e) {
    // Fallback: your old parsing logic or return empty/defaults
    return { elevatorPitch: "", themes: [], explanation: "" };
  }
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
  // const data = await callLLMWithRetry(apiKey, requestBody, 3, controller.signal);
  const system =`You are an expert resume analyst. Based on the provided resume text and basic analysis, 
              provide three key outputs:
            1. A professional elevator pitch (max 2 sentences) based on the resume text
            2. Three specific improvement themes (one sentence each) based on the resume text
            3. A brief explanation of the resume grade (max 2 sentences) based on the resume text
            Be specific, professional, and concise. Focus on actionable advice. Format your response with no markdown, just clean text.`
  // const system =`You are an expert resume analyst. Based on the provided resume text and basic analysis, 
  //           provide three key outputs:
  //           1. A professional elevator pitch (max 2 sentences) based on the resume text
  //           2. Three specific improvement themes (one sentence each) based on the resume text
  //           3. A brief explanation of the resume grade (max 2 sentences) based on the resume text
  //           Be specific, professional, and concise. Focus on actionable advice. Format your response with no markdown, just clean text.
  //           Return your response as a single valid JSON object, with no extra text, markdown, or explanations. 
  //           The JSON should have the following structure:
  //           {
  //           "elevatorPitch": "string",
  //           "themes": ["string", "string", "string"],
  //           "explanation": "string"
  //           }
  //           Do not include any markdown, code blocks, or commentary. Only output the JSON object.
  //           `
  // JSON response format


 // const data = await callLLMWithRetry(system, user);
 const user = `Resume text (truncated): ${truncatedResume}\n\nBasic Analysis: ${JSON.stringify(condensedAnalysis)}`
 
  
  const aiResponse = await callLLMWithRetry(system, user);
  clearTimeout(timeoutId);
  
  // const aiResponse = data.choices[0].message.content;
  console.log("AI Response: ", aiResponse);

  // Use our new format function which returns an object with extracted content
  const extractedContent = formatResponse(aiResponse);
  // const extractedContent = jsonFormatResponse(aiResponse);
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
  
  console.log("Enhanced Analysis: ", enhancedAnalysis);
  const endTime = Date.now();
  console.log(`[enhanceWithGroq]: Function completed in ${(endTime - startTime)/1000}s`);
  return enhancedAnalysis;
} catch (fetchError) {
  console.error("GROQ API fetch error:", fetchError);
  // If there's a timeout or other fetch error, continue with the basic analysis
  clearTimeout(timeoutId);
  throw fetchError; // Throw the error instead of returning fallback
}
    
} catch (error) {
  console.error("Error enhancing analysis with GROQ:", error);
  // Return original analysis on any error
  throw error; // Throw the error instead of returning fallback
}
} // End of enhanceWithGroq function