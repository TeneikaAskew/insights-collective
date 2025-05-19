export async function detectSentences(text, userId) {
  console.log(`Detecting sentences for ${userId || 'anonymous'}`);
  
  // Input validation
  if (!text || typeof text !== 'string') {
    console.warn("detectSentences: Invalid text input");
    return [];
  }
  
  try {
    // Clean text - replace multiple line breaks and excessive spaces
    const cleanedText = text
      .replace(/\r\n/g, '\n')
      .replace(/\n+/g, '\n')
      .replace(/\s+/g, ' ');
      
    // Patterns to detect non-bullet sections
    const headerPatterns = [
      /\b(?:EDUCATION|EXPERIENCE|SKILLS|PROJECTS|WORK|EMPLOYMENT|HISTORY|PROFESSIONAL|SUMMARY|OBJECTIVE|CONTACT|REFERENCES|CERTIFICATIONS|AWARDS|LANGUAGES|INTERESTS|ACTIVITIES)\s*(?:\:|\n)/gi,
    ];
    
    // Remove headers and detect bullet-like structures
    let processedText = cleanedText;
    for (const pattern of headerPatterns) {
      processedText = processedText.replace(pattern, '\n');
    }
    
    // Split into paragraphs/sections
    const paragraphs = processedText.split(/\n+/);
    
    // Find paragraphs that appear to be bullet points by looking for common patterns
    const bulletPatterns = [
      // Look for traditional bullet point formats
      /^[\s]*[•\-–—*][\s]+/,
      // Look for numbered bullets (1., 1), etc.)
      /^[\s]*\d+[\.\)][\s]+/,
      // Look for sentences starting with action verbs
      /^[\s]*(Achieved|Led|Managed|Developed|Created|Implemented|Increased|Reduced|Improved|Collaborated|Designed|Established|Maintained|Coordinated|Analyzed|Conducted|Delivered|Generated|Organized|Produced)/i
    ];
    
    // Extract bullet-like content
    let potentialBullets = paragraphs
      .filter(p => p.trim().length > 20) // Minimum length filter
      .filter(p => 
        // Either matches a bullet pattern
        bulletPatterns.some(pattern => pattern.test(p)) ||
        // Or likely to be a standalone accomplishment statement
        (p.trim().length < 200 && !p.includes(':') && /\b(led|created|managed|developed|improved|increased|achieved)\b/i.test(p))
      )
      .map(p => p.trim().replace(/^[\s]*[•\-–—*\d\.)][\s]+/, '')); // Clean up bullet markers
    
    // If we didn't find many potential bullets, try splitting sentences
    if (potentialBullets.length < 5) {
      const sentenceRegEx = /([^.!?]+[.!?]+)/g;
      const allSentences = [];
      
      // Extract sentences from each paragraph
      paragraphs.forEach(paragraph => {
        const sentences = paragraph.match(sentenceRegEx);
        if (sentences) {
          allSentences.push(...sentences);
        }
      });
      
      // Filter sentences to those that look like accomplishments
      const actionVerbPattern = /^[\s]*(Achieved|Led|Managed|Developed|Created|Implemented|Increased|Reduced|Improved|Collaborated|Designed|Established|Maintained|Coordinated|Analyzed|Conducted|Delivered|Generated|Organized|Produced)/i;
      
      const accomplishmentSentences = allSentences
        .map(s => s.trim())
        .filter(s => s.length > 30 && s.length < 200) // Reasonable sentence length
        .filter(s => 
          actionVerbPattern.test(s) || // Starts with action verb
          /\b(increased|decreased|improved|reduced|achieved|won|delivered)\b.+\d+/i.test(s) // Has metric
        );
      
      // Add these to our potential bullets
      potentialBullets = [...potentialBullets, ...accomplishmentSentences];
    }
    
    // Final filtering to remove duplicates and very similar sentences
    const uniqueBullets = [];
    const seen = new Set();
    
    for (const bullet of potentialBullets) {
      // Create a fingerprint of the bullet by keeping only the first 30 chars
      const fingerprint = bullet.substring(0, 30).toLowerCase();
      
      if (!seen.has(fingerprint)) {
        seen.add(fingerprint);
        uniqueBullets.push(bullet);
      }
    }
    
    console.log(`Found ${uniqueBullets.length} potential bullet points`);
    return uniqueBullets;
  } catch (error) {
    console.error("Error detecting sentences:", error);
    return [];
  }
}
