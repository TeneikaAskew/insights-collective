import { CareerReportData } from './types';

// Helper function to clean text from markdown and special characters
const cleanText = (text: string): string => {
  if (!text) return '';
  return text
    .replace(/\*\*/g, '') // Remove bold markdown
    .replace(/\*/g, '')    // Remove italic markdown
    .replace(/---+/g, '')  // Remove horizontal rules
    .replace(/`/g, '')     // Remove code blocks
    .replace(/#+\s/g, '')  // Remove heading markers
    .replace(/\n{3,}/g, '\n\n') // Normalize multiple newlines
    .trim();
};

// Helper function to clean list items
const cleanListItem = (item: string): string => {
  return item
    .replace(/^[-*•]\s*/, '') // Remove list markers
    .replace(/^\d+\.\s*/, '') // Remove numbered list markers
    .replace(/\*\*/g, '')     // Remove bold markdown
    .replace(/\*/g, '')       // Remove italic markdown
    .trim();
};

export const parseCareerReport = (reportData: any): CareerReportData => {
  if (!reportData) {
    console.error("No report data provided to parser");
    return {
      userName: 'there',
      summary: 'No career report data available.',
      recommendedRoles: [],
      skillsAndCourses: [],
      careerPathSteps: [],
      keyTakeaways: [],
      nextStepRecommendations: "",
      potentialRoles: []
    };
  }

  try {
    // Handle case when reportData is already an object
    const reportText = typeof reportData === 'object' && reportData.report 
      ? reportData.report 
      : typeof reportData === 'string'
        ? reportData
        : JSON.stringify(reportData);

    console.log("Report text for parsing:", reportText);

    // Clean the entire text first
    const cleanedText = cleanText(reportText);

    // Extract sections using regex patterns
    const summaryMatch = /Summary:(.+?)(?=Recommended Roles:|$)/s.exec(cleanedText);
    const recommendedRolesMatch = /Recommended Roles:(.+?)(?=Skills and Matching Courses:|$)/s.exec(cleanedText);
    const skillsMatch = /Skills and Matching Courses:(.+?)(?=Next-Step Career Recommendations:|$)/s.exec(cleanedText);
    const pathStepsMatch = /Path to Your Aspirational Role:(.+?)(?=Remote Work Considerations:|By following|$)/s.exec(cleanedText);
    
    // Extract roles from the text
    const recommendedRoles = extractNumberedItems(recommendedRolesMatch ? recommendedRolesMatch[1] : '')
      .map(role => {
        const [title, ...descParts] = role.split(':');
        const description = descParts.join(':').trim();
        const salaryMatch = description.match(/\$[\d,]+ *- *\$?[\d,]+K?/i) || 
                          description.match(/\$[\d,.]+ *[KMB]? *(?:per|a|\/|\-) *year/i);
        
        return {
          title: cleanText(title || role.trim()),
          description: cleanText(description || ''),
          salaryRange: salaryMatch ? salaryMatch[0] : '$80-120K',
          matchPercentage: 85 // Default match percentage
        };
      });
    
    // Extract skills and courses
    const skillsAndCourses = extractSkillsAndCourses(skillsMatch ? skillsMatch[1] : '');
    
    // Extract career path steps with better cleaning
    const careerPathSteps = extractNumberedItems(pathStepsMatch ? pathStepsMatch[1] : '')
      .map(step => {
        const [title, ...descParts] = step.split(':');
        return {
          title: cleanText(title || 'Career Step'),
          description: cleanText(descParts.join(':') || step),
          timeframe: extractTimeframe(step)
        };
      });

    // Sanitize summary
    const summary = cleanText(summaryMatch ? summaryMatch[1] : 'Based on your responses, we\'ve created a personalized career pathway report.');

    return {
      userName: 'there', // Default name
      summary,
      recommendedRoles,
      skillsAndCourses,
      careerPathSteps,
      keyTakeaways: [],
      nextStepRecommendations: "Follow these recommended steps to advance your career.",
      potentialRoles: ["Data Analyst", "Business Analyst", "Data Scientist"]
    };
  } catch (error) {
    console.error("Error parsing career report:", error);
    return {
      userName: 'there',
      summary: 'There was an error processing your career report.',
      recommendedRoles: [],
      skillsAndCourses: [],
      careerPathSteps: [],
      keyTakeaways: [],
      nextStepRecommendations: "",
      potentialRoles: []
    };
  }
};

// Helper function to extract timeframe from text
function extractTimeframe(text: string): string {
  const timeframeMatch = text.match(/(\d+[-\s]?\d*\s*(?:weeks?|months?|years?))/i);
  return timeframeMatch ? timeframeMatch[1] : '';
}

// Helper function to extract numbered items from text
function extractNumberedItems(text: string): string[] {
  if (!text || text.trim().length === 0) return [];
  
  // Look for numbered items (1. Item, 2. Item, etc.) or bullet points
  const matches = text.match(/(?:\d+\.|\*|-)\s*([^\n]+)/g);
  
  if (!matches) {
    // If no numbered items found, just return the text as a single item
    return [cleanText(text)];
  }
  
  return matches.map(item => cleanListItem(item))
    .filter(item => item.length > 0);
}

// Helper function to extract skills and courses from table or text
function extractSkillsAndCourses(skillsText: string): Array<{skill: string, course: string, level?: string, provider?: string}> {
  if (!skillsText || skillsText.trim().length === 0) return [];
  
  // Clean the text first
  const cleanedText = cleanText(skillsText);
  
  // Check if there's a markdown table
  const tableRows = cleanedText.match(/\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|/g);
  
  if (tableRows) {
    // Extract rows from markdown table
    return tableRows.slice(1) // Skip header row
      .map(row => {
        const cells = row.split('|')
          .map(cell => cleanText(cell))
          .filter(cell => cell.length > 0);
        
        if (cells.length < 2) return null;
        
        const [skill, courseInfo] = cells;
        const providerMatch = courseInfo.match(/\((.*?)\)/);
        
        return {
          skill: skill.trim(),
          course: courseInfo.replace(/\(.*?\)/, '').trim(), // Remove provider info from course
          provider: providerMatch ? providerMatch[1] : undefined,
          level: 'Intermediate' // Default level
        };
      })
      .filter(item => item !== null);
  } else {
    // Handle case without table format
    const items = cleanedText.split('\n')
      .map(line => cleanListItem(line))
      .filter(line => line.length > 0);
      
    return items.map(item => {
      const [skill, ...rest] = item.split(':');
      const courseInfo = rest.join(':').trim();
      const providerMatch = courseInfo.match(/\((.*?)\)/);
      
      return {
        skill: skill.trim(),
        course: courseInfo.replace(/\(.*?\)/, '').trim(),
        provider: providerMatch ? providerMatch[1] : undefined,
        level: 'Intermediate' // Default level
      };
    });
  }
}

// Function to format career pathway report as HTML
export const formatCareerPathwayReport = (reportText: string): string => {
  // Clean up line breaks and extra spaces
  let cleanText = reportText
    .replace(/\n+/g, '\n')
    .replace(/\*\*/g, '')
    .trim();
  
  // Get the main sections
  const sections = {
    title: 'Personalized Career Pathway Report for You',
    summary: extractSection(cleanText, 'Summary:', 'Recommended Roles:'),
    recommendedRoles: extractRoles(cleanText, 'Recommended Roles:', 'Skills and Matching Courses:'),
    skills: extractSkillsTable(cleanText),
    nextSteps: extractNumberedList(cleanText, 'Next-Step Career Recommendations:', 'Roles that Might be Right for You:'),
    rightRoles: extractRoles(cleanText, 'Roles that Might be Right for You:', 'Path to Your Aspirational Role:'),
    pathSteps: extractNumberedList(cleanText, 'Path to Your Aspirational Role:', 'Remote Work Considerations:'),
    remote: extractSection(cleanText, 'Remote Work Considerations:', 'By following'),
    conclusion: extractSection(cleanText, 'By following', '')
  };

  return `
  <div class="career-pathway-report">
    <h1 class="text-xl font-bold text-blue-600 mb-4">${sections.title}</h1>
    
    <section class="mb-6">
      <h2 class="text-lg font-semibold text-blue-700 mb-2">Summary</h2>
      <p class="mb-2">${sections.summary}</p>
    </section>
    
    <section class="mb-6">
      <h2 class="text-lg font-semibold text-blue-700 mb-2">Recommended Roles</h2>
      ${sections.recommendedRoles}
    </section>
    
    <section class="mb-6">
      <h2 class="text-lg font-semibold text-blue-700 mb-2">Skills and Matching Courses</h2>
      <div class="overflow-x-auto">
        ${sections.skills}
      </div>
    </section>
    
    <section class="mb-6">
      <h2 class="text-lg font-semibold text-blue-700 mb-2">Next-Step Career Recommendations</h2>
      ${sections.nextSteps}
    </section>
    
    <section class="mb-6">
      <h2 class="text-lg font-semibold text-blue-700 mb-2">Roles that Might be Right for You</h2>
      ${sections.rightRoles}
    </section>
    
    <section class="mb-6">
      <h2 class="text-lg font-semibold text-blue-700 mb-2">Path to Your Aspirational Role</h2>
      ${sections.pathSteps}
    </section>
    
    ${sections.remote ? `
    <section class="mb-6">
      <h2 class="text-lg font-semibold text-blue-700 mb-2">Remote Work Considerations</h2>
      <p class="pl-2">${sections.remote}</p>
    </section>
    ` : ''}
    
    ${sections.conclusion ? `
    <section class="mt-6 p-4 bg-blue-50 border-l-4 border-blue-500">
      <p class="italic">${sections.conclusion}</p>
    </section>
    ` : ''}
  </div>`;
};

// Helper function to extract a section from the report
const extractSection = (text: string, startMarker: string, endMarker: string): string => {
  const startIndex = text.indexOf(startMarker);
  if (startIndex === -1) return '';
  
  const start = startIndex + startMarker.length;
  const endIndex = endMarker ? text.indexOf(endMarker, start) : text.length;
  
  return endIndex === -1 
    ? text.substring(start).trim() 
    : text.substring(start, endIndex).trim();
};

// Helper function to extract and format numbered items
const extractNumberedList = (text: string, startMarker: string, endMarker: string): string => {
  const sectionText = extractSection(text, startMarker, endMarker);
  if (!sectionText) return '';
  
  const items = sectionText.split(/\d+\./).filter(item => item.trim());
  
  return items.map((item, i) => `
    <div class="flex items-start mb-3">
      <div class="flex-shrink-0 bg-blue-100 rounded-full w-6 h-6 flex items-center justify-center mr-3 text-blue-800 font-medium">
        ${i + 1}
      </div>
      <div>${item.trim()}</div>
    </div>
  `).join('');
};

// Helper function specifically for extracting roles
const extractRoles = (text: string, startMarker: string, endMarker: string): string => {
  const sectionText = extractSection(text, startMarker, endMarker);
  if (!sectionText) return '';
  
  const roles = sectionText.split(/\d+\./).filter(role => role.trim());
  
  return roles.map((role, i) => {
    // Split role by colon if it exists
    const parts = role.split(':');
    const roleTitle = parts.length > 1 ? parts[0].trim() : role.trim();
    const roleDesc = parts.length > 1 ? parts.slice(1).join(':').trim() : '';
    
    return `
      <div class="flex items-start mb-3">
        <div class="flex-shrink-0 bg-blue-100 rounded-full w-6 h-6 flex items-center justify-center mr-3 text-blue-800 font-medium">
          ${i + 1}
        </div>
        <div>
          <div class="font-medium">${roleTitle}</div>
          ${roleDesc ? `<div class="text-gray-600">${roleDesc}</div>` : ''}
        </div>
      </div>
    `;
  }).join('');
};

// Helper function to extract skills table
const extractSkillsTable = (text: string): string => {
  const tableSection = extractSection(text, 'Skills and Matching Courses:', 'Next-Step Career Recommendations:');
  
  // Check if we have a markdown table
  const tableMatch = tableSection.match(/\|\s*Skill\s*\|\s*Course\s*\|[\s\S]*?(?=\n\n|$)/i);
  
  if (tableMatch) {
    // Parse markdown table
    const tableRows = tableMatch[0].split('\n')
      .filter(line => line.trim().startsWith('|') && !line.includes('---'));
    
    let tableHtml = `
      <table class="min-w-full bg-white border border-gray-200">
        <thead class="bg-blue-50">
          <tr>
            <th class="py-2 px-4 border border-gray-200 font-medium text-left">Skill</th>
            <th class="py-2 px-4 border border-gray-200 font-medium text-left">Course</th>
          </tr>
        </thead>
        <tbody>
    `;
    
    // Skip header row
    for (let i = 1; i < tableRows.length; i++) {
      const cells = tableRows[i].split('|')
        .map(cell => cell.trim())
        .filter(cell => cell !== '');
      
      if (cells.length >= 2) {
        tableHtml += `
          <tr>
            <td class="py-2 px-4 border border-gray-200">${cells[0]}</td>
            <td class="py-2 px-4 border border-gray-200">${cells[1]}</td>
          </tr>
        `;
      }
    }
    
    tableHtml += `
        </tbody>
      </table>
    `;
    
    return tableHtml;
  }
  
  // Fallback for non-table format
  return `<p class="text-gray-500 italic">Skills data not available in table format.</p>`;
};
