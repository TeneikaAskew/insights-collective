
// Function to extract bullet points from resume text
export function extractBulletPoints(text: string): string[] {
  // Match lines that begin with bullet symbols (•, –, —, -, *) followed by whitespace
  const bulletRegex = /^[\s]*[•\-–—*][\s]+(.*)/gm;
  const matches = [...text.matchAll(bulletRegex)];
  
  // If no matches are found, try to find sentences that might be bullet points
  if (matches.length === 0) {
    // Look for sentences that start with action verbs (common in resumes)
    const actionRegex = /^(Managed|Developed|Created|Led|Implemented|Designed|Achieved|Increased|Reduced|Improved)[^.;:]*/gm;
    const actionMatches = [...text.matchAll(actionRegex)];
    return actionMatches.map(match => match[0].trim());
  }
  
  return matches.map(match => match[1].trim());
}
