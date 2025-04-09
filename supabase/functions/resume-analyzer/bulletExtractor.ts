
// Function to extract bullet points from resume text
export function extractBulletPoints(text: string): string[] {
  if (!text || typeof text !== 'string') {
    console.warn("Invalid text input for bullet extraction:", text);
    return [];
  }
  
  // Match lines that begin with bullet symbols (•, –, —, -, *) followed by whitespace
  const bulletRegex = /^[\s]*[•\-–—*][\s]+(.*)/gm;
  const matches = [...text.matchAll(bulletRegex)];
  
  // If no matches are found, try to find sentences that might be bullet points
  if (matches.length === 0) {
    // Look for sentences that start with action verbs (common in resumes)
    const actionRegex = /^(Managed|Developed|Created|Led|Implemented|Designed|Achieved|Increased|Reduced|Improved)[^.;:]*/gm;
    const actionMatches = [...text.matchAll(actionRegex)];
    return actionMatches.map(match => match[0].trim()).filter(Boolean);
  }
  
  return matches.map(match => match[1].trim()).filter(Boolean);
}

// Fallback function to extract content as bullets by splitting on newlines
export function fallbackExtractBullets(text: string): string[] {
  if (!text || typeof text !== 'string') {
    return [];
  }
  
  // Split by newlines and filter empty lines
  const lines = text.split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 15) // Minimum length for a meaningful bullet
    .filter(Boolean);
  
  // Further filter by removing very common headers and non-content lines
  const filteredLines = lines.filter(line => {
    const lowerLine = line.toLowerCase();
    
    // Skip common headers, contact info, etc.
    if (
      lowerLine.includes('resume') || 
      lowerLine.includes('curriculum vitae') ||
      lowerLine.includes('@') ||
      lowerLine.includes('phone:') ||
      lowerLine.includes('address:') ||
      lowerLine.includes('education') ||
      lowerLine.includes('skills') ||
      /^\d{3}[-.\s]?\d{3}[-.\s]?\d{4}$/.test(lowerLine) || // Phone number
      /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(lowerLine) // Email
    ) {
      return false;
    }
    
    return true;
  });
  
  // Return the filtered lines as bullets
  return filteredLines;
}
