
/**
 * Utility file for filtering out EEO (Equal Employment Opportunity) statements
 * and other hiring boilerplate from job descriptions
 */

// List of phrases commonly found in EEO statements
const eeoKeyPhrases = [
  'equal opportunity',
  'equal employment',
  'eeo',
  'diversity',
  'inclusion',
  'protected veteran',
  'disability',
  'qualified applicants',
  'regardless of',
  'discrimination',
  'equal access',
  'affirmative action',
  'race, color',
  'gender identity',
  'sexual orientation',
  'national origin',
  'religion',
  'age, disability',
  'marital status',
  'discriminate',
  'diverse workforce',
  'diverse workplace',
  'veteran status',
  'accommodation',
  'federal law',
  'title vii'
];

// Check if a line of text appears to be an EEO statement
export const isEEOorHiringStatement = (text: string): boolean => {
  const lowerText = text.toLowerCase();
  
  // Check for EEO key phrases
  if (eeoKeyPhrases.some(phrase => lowerText.includes(phrase))) {
    return true;
  }
  
  // Check for typical legal/disclaimer patterns
  if (
    (lowerText.includes('inc.') && lowerText.includes('right')) ||
    (lowerText.includes('llc') && lowerText.includes('opportunity')) ||
    (lowerText.includes('©') || lowerText.includes('copyright')) ||
    (lowerText.includes('terms') && lowerText.includes('conditions')) ||
    (lowerText.includes('policy') && lowerText.includes('privacy'))
  ) {
    return true;
  }
  
  // Check for boilerplate hiring statements
  if (
    (lowerText.includes('qualifi') && lowerText.includes('apply')) ||
    (lowerText.includes('please') && lowerText.includes('resume')) ||
    (lowerText.includes('drug') && lowerText.includes('test'))
  ) {
    return true;
  }
  
  return false;
};

// Filter out EEO and hiring statements from job description text
export const filterEEOStatements = (jobText: string): string => {
  if (!jobText) return '';
  
  const lines = jobText.split('\n');
  const filteredLines = lines.filter(line => !isEEOorHiringStatement(line.trim()));
  
  return filteredLines.join('\n');
};
