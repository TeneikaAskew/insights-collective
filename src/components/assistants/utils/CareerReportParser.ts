import { CareerReport } from '../types';

export interface CareerReportData {
  userName: string;
  summary: string;
  recommendedRoles: Array<{
    title: string;
    description: string;
    salaryRange: string;
  }>;
  skillsAndCourses: Array<{
    skill: string;
    course: string;
    level?: string;
  }>;
  careerPathSteps: Array<{
    title: string;
    description: string;
  }>;
  keyTakeaways: string[];
}

export const parseCareerReport = (reportData: any): CareerReportData => {
  if (!reportData) {
    console.error("No report data provided to parser");
    return {
      userName: 'there',
      summary: 'No career report data available.',
      recommendedRoles: [],
      skillsAndCourses: [],
      careerPathSteps: [],
      keyTakeaways: []
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

    // Extract sections using regex patterns
    const summaryMatch = /Summary:(.+?)(?=Recommended Roles:|$)/s.exec(reportText);
    const recommendedRolesMatch = /Recommended Roles:(.+?)(?=Skills and Matching Courses:|$)/s.exec(reportText);
    const skillsMatch = /Skills and Matching Courses:(.+?)(?=Next-Step Career Recommendations:|$)/s.exec(reportText);
    const pathStepsMatch = /Path to Your Aspirational Role:(.+?)(?=Remote Work Considerations:|By following|$)/s.exec(reportText);
    
    // Extract roles from the text
    const recommendedRoles = extractNumberedItems(recommendedRolesMatch ? recommendedRolesMatch[1] : '')
      .map(role => ({
        title: role.split(':')[0]?.trim() || role.trim(),
        description: role.split(':').slice(1).join(':').trim() || '',
        salaryRange: '$80-120K' // Default salary range
      }));
    
    // Extract skills and courses
    const skillsAndCourses = extractSkillsAndCourses(skillsMatch ? skillsMatch[1] : '');
    
    // Extract career path steps
    const careerPathSteps = extractNumberedItems(pathStepsMatch ? pathStepsMatch[1] : '')
      .map(step => ({
        title: step.split(/:(.+)/, 2)[0]?.trim() || `Career Step`,
        description: step.split(/:(.+)/, 2)[1]?.trim() || step.trim()
      }));

    // Sanitize summary
    const summary = summaryMatch 
      ? summaryMatch[1].trim() 
      : 'Based on your responses, we\'ve created a personalized career pathway report.';

    return {
      userName: 'there', // Default name
      summary,
      recommendedRoles,
      skillsAndCourses,
      careerPathSteps,
      keyTakeaways: []
    };
  } catch (error) {
    console.error("Error parsing career report:", error);
    return {
      userName: 'there',
      summary: 'There was an error processing your career report.',
      recommendedRoles: [],
      skillsAndCourses: [],
      careerPathSteps: [],
      keyTakeaways: []
    };
  }
};

// Helper function to extract numbered items from text
function extractNumberedItems(text: string): string[] {
  if (!text || text.trim().length === 0) return [];
  
  // Look for numbered items (1. Item, 2. Item, etc.)
  const matches = text.match(/\d+\.\s*([^\d]+?)(?=\d+\.|$)/g);
  
  if (!matches) {
    // If no numbered items found, just return the text as a single item
    return [text.trim()];
  }
  
  return matches.map(item => {
    // Remove the number and trim
    return item.replace(/^\d+\.?\s*/, '').trim();
  }).filter(item => item.length > 0);
}

// Helper function to extract skills and courses from table or text
function extractSkillsAndCourses(skillsText: string): Array<{skill: string, course: string, level?: string}> {
  if (!skillsText || skillsText.trim().length === 0) return [];
  
  // Check if there's a markdown table
  const tableRows = skillsText.match(/\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|/g);
  
  if (tableRows) {
    // Extract rows from markdown table
    return tableRows.slice(1) // Skip header row
      .map(row => {
        const [, skill = '', course = ''] = row.split('|').map(cell => cell.trim());
        return {
          skill,
          course,
          level: 'Intermediate' // Default level
        };
      })
      .filter(item => item.skill && item.course);
  } else {
    // Handle case without table format
    // Look for lines with a skill followed by a description
    const items = skillsText.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
      
    return items.map(item => {
      // Try to extract skill and course
      const [skill, ...rest] = item.split(':');
      const course = rest.join(':').trim();
      
      return {
        skill: skill.replace(/^[•-]\s*/, '').trim(),
        course: course || 'Recommended course not specified',
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
