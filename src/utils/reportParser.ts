
/**
 * Parse the career pathway report text into a structured format
 */
export function parseReport(reportText: string): {
  summary: string;
  recommendedRoles: string[];
  skills: Array<{ skill: string; course: string }>;
  nextSteps: string[];
  potentialRoles: string[];
  careerPath: string[];
  remoteConsiderations: string;
} {
  // Clean up the report text
  const cleanedReport = reportText.replace(/\\n/g, '\n').trim();

  // Extract sections
  const sections: Record<string, string> = {};
  
  // Define section patterns
  const sectionPatterns = [
    { key: 'summary', pattern: /Summary:\s*([\s\S]*?)(?=\n\s*Recommended Roles:|$)/i },
    { key: 'recommendedRoles', pattern: /Recommended Roles:\s*([\s\S]*?)(?=\n\s*Skills and Matching Courses:|$)/i },
    { key: 'skillsAndCourses', pattern: /Skills and Matching Courses:\s*([\s\S]*?)(?=\n\s*Next-Step Career Recommendations:|$)/i },
    { key: 'nextSteps', pattern: /Next-Step Career Recommendations:\s*([\s\S]*?)(?=\n\s*Roles that Might be Right for You:|$)/i },
    { key: 'potentialRoles', pattern: /Roles that Might be Right for You:\s*([\s\S]*?)(?=\n\s*Path to Your Aspirational Role:|$)/i },
    { key: 'careerPath', pattern: /Path to Your Aspirational Role:\s*([\s\S]*?)(?=\n\s*Remote Work Considerations:|$)/i },
    { key: 'remoteConsiderations', pattern: /Remote Work Considerations:\s*([\s\S]*?)(?=$)/i },
  ];
  
  // Extract each section using regex
  sectionPatterns.forEach(({ key, pattern }) => {
    const match = cleanedReport.match(pattern);
    sections[key] = match ? match[1].trim() : '';
  });

  // Parse numbered lists
  const parseNumberedList = (text: string): string[] => {
    if (!text) return [];
    
    // Split by numbered items (1., 2., 3., etc.)
    const items = text.split(/\d+\.\s+/).filter(item => item.trim().length > 0);
    return items.map(item => item.trim());
  };
  
  // Parse skills and courses table
  const parseSkillsTable = (tableText: string): Array<{ skill: string; course: string }> => {
    if (!tableText) return [];
    
    // Skip the header row and | ----- | ------ | line
    const tableRows = tableText.split('\n')
      .filter(line => line.trim().length > 0)
      .filter(line => !line.includes('-----') && !line.includes('Skill | Course'));
    
    return tableRows.map(row => {
      const parts = row.split('|').map(part => part.trim()).filter(Boolean);
      return {
        skill: parts[0] || '',
        course: parts[1] || ''
      };
    });
  };

  // Construct the parsed report
  return {
    summary: sections.summary || '',
    recommendedRoles: parseNumberedList(sections.recommendedRoles),
    skills: parseSkillsTable(sections.skillsAndCourses),
    nextSteps: parseNumberedList(sections.nextSteps),
    potentialRoles: parseNumberedList(sections.potentialRoles),
    careerPath: parseNumberedList(sections.careerPath),
    remoteConsiderations: sections.remoteConsiderations || ''
  };
}
