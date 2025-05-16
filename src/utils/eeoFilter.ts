
/**
 * Utility functions for filtering EEO (Equal Employment Opportunity) statements
 * and other hiring-related language from job descriptions and resumes
 */

// Common EEO statement patterns
export const eeoPatterns = [
  /equal.*opportunity.*employer/i,
  /eeo|eeoc/i,
  /discriminat(e|ion|ing|ory)/i,
  /protect(ed)?\s*(class|status|veteran|characteristics)/i,
  /diversity.*inclusion/i,
  /inclusion.*diversity/i,
  /affirmative\s*action/i,
  /(regard|irrespective|regardless)\s*of\s*(race|gender|religion|age|disability|orientation)/i,
  /we\s*(are|provide)\s*an\s*equal\s*opportunity/i,
  /qualified\s*(applicants|candidates)/i,
  /without\s*regard\s*to/i,
  /prohibit(s|ed)?\s*discrimination/i
];

// EEO-related terms that should be excluded from keyword extraction
export const eeoTerms = [
  // Protected classes and related terms
  "race", "color", "religion", "sex", "gender", "national", "origin", 
  "age", "disability", "genetic", "veteran", "citizenship", "marital",
  "sexual", "orientation", "identity", "pregnancy", "ancestry",
  
  // Legal phrases
  "equal", "opportunity", "employer", "eeo", "eeoc", "discriminate",
  "protected", "legally", "status", "accommodation", "reasonable",
  "affirmative", "action", "retaliation", "harassment",
  
  // Common phrases in EEO statements
  "qualified", "regardless", "irrespective", "prohibited", "diversity", 
  "inclusion", "minority", "minorities", "applicant", "recruiter"
];

// Geographic and location terms often in job descriptions but not relevant skills
export const locationTerms = [
  "los angeles", "angeles county", "york city", "san francisco", "chicago", 
  "boston", "seattle", "austin", "remote", "hybrid", "onsite", "in-office"
];

// Employment relationship terms that aren't relevant skills
export const employmentTerms = [
  "employees supervisors", "supervisors staff", "staff members", "reports to",
  "direct reports", "team lead", "team leads", "management team", "executive team"
];

// Company culture boilerplate often in job descriptions
export const cultureBoilerplate = [
  "outfit athletes", "athletes explore", "explore potential", "potential obliterate",
  "obliterate boundaries", "boundaries push", "push edges", "edges looks",
  "looks people", "people grow", "grow dream", "dream create", "create culture",
  "culture thrives", "thrives embracing", "embracing diversity", "diversity rewarding",
  "rewarding imagination", "imagination brand", "brand seeks", "seeks achievers",
  "achievers leaders", "leaders visionaries", "visionaries nike", "nike bringing",
  "bringing skills", "skills passion", "passion challenging", "challenging constantly",
  "constantly evolving", "specialist production", "production icon"
];

// Job benefits and compensation terms
export const benefitsTerms = [
  "competitive salary", "benefits package", "health insurance", "dental", "vision",
  "401k", "pto", "paid time", "vacation", "bonus", "compensation", "salary range"
];

/**
 * Checks if text contains EEO statements
 */
export function containsEEOStatement(text: string): boolean {
  return eeoPatterns.some(pattern => pattern.test(text));
}

/**
 * Filters EEO statements from job description text
 * Returns the filtered text with EEO statements removed
 */
export function filterEEOStatements(text: string): string {
  // Split text into paragraphs
  const paragraphs = text.split(/\n\n|\r\n\r\n/);
  
  // Filter out paragraphs that match EEO patterns
  const filteredParagraphs = paragraphs.filter(paragraph => {
    return !eeoPatterns.some(pattern => pattern.test(paragraph));
  });
  
  return filteredParagraphs.join('\n\n');
}

/**
 * Filters out EEO terms from a list of keywords
 */
export function filterEEOKeywords(keywords: string[]): string[] {
  const allFilterTerms = [...eeoTerms, ...locationTerms.flatMap(t => t.split(' ')), ...benefitsTerms];
  
  return keywords.filter(keyword => {
    const lowerKeyword = keyword.toLowerCase();
    // Check if keyword is in the filter terms
    if (allFilterTerms.includes(lowerKeyword)) return false;
    
    // Check if keyword is part of a multi-word phrase to exclude
    const multiWordPhrases = [...locationTerms, ...employmentTerms, ...cultureBoilerplate];
    return !multiWordPhrases.some(phrase => phrase.includes(lowerKeyword));
  });
}
