// // Usage
// const { html, sections } = parseformatCareerPathwayReport(rawReport);

/**
 * Utility functions to parse static career reports into structured data
 */

export interface RecommendedRole {
  title: string;
  description: string;
  salaryRange: string;
  matchPercentage: number;
}

export interface SkillCourse {
  skill: string;
  course: string;
  provider?: string;
  level?: string;
}

export interface CareerPathStep {
  title: string;
  description: string;
}

export interface CareerReportData {
  userName: string;
  summary: string;
  recommendedRoles: RecommendedRole[];
  skillsAndCourses: SkillCourse[];
  nextStepRecommendations: string;
  potentialRoles: string[];
  careerPathSteps: CareerPathStep[];
  keyTakeaways: string[];
  remoteWorkConsiderations?: string;
  conclusion?: string;
}

// Helper functions for formatting
export const cleanText = (text: string): string => text.replace(/\*\*/g, '').trim();

export const extractSection = (text: string, start: string, ends: string[]): string => {
  const i = text.indexOf(start);
  if (i === -1) return '';
  let endIdx = text.length;
  for (const marker of ends) {
    const idx = text.indexOf(marker, i + start.length);
    if (idx !== -1 && idx < endIdx) endIdx = idx;
  }
  return text.substring(i + start.length, endIdx).trim();
};

/**
 * Parses a static text report into structured data
 * This function handles the transformation of the raw text format
 * into a structured object the interactive UI can use
 */
export function parseCareerReport(reportText: string): CareerReportData {
  console.log(reportText)

  console.log("Passed into parseCareerReport: ", reportText)
  const report: CareerReportData = {
    userName: extractUserName(reportText),
    summary: extractSummary(reportText),
    recommendedRoles: extractRecommendedRoles(reportText),
    skillsAndCourses: extractSkillsAndCourses(reportText),
    nextStepRecommendations: extractNextStepRecommendations(reportText),
    potentialRoles: extractPotentialRoles(reportText),
    careerPathSteps: extractCareerPathSteps(reportText),
    keyTakeaways: extractKeyTakeaways(reportText),
    remoteWorkConsiderations: extractRemoteWorkConsiderations(reportText),
    conclusion: extractConclusion(reportText)
  };
  
  // Add match percentages if they don't exist
  if (report.recommendedRoles.length > 0) {
    report.recommendedRoles = report.recommendedRoles.map((role, index) => {
      if (!role.matchPercentage) {
        role.matchPercentage = Math.max(50, 95 - (index * 7));
      }
      return role;
    });
  }
  
  // Add skill levels if they don't exist
  if (report.skillsAndCourses.length > 0) {
    const levels = ['Beginner', 'Intermediate', 'Advanced', 'Expert'];
    report.skillsAndCourses = report.skillsAndCourses.map((item, index) => {
      if (!item.level) {
        const levelIndex = Math.floor(Math.random() * 3);
        item.level = levels[levelIndex];
      }
      if (!item.provider) {
        const providers = ['Coursera', 'edX', 'Udemy', 'LinkedIn Learning', 'Pluralsight'];
        item.provider = providers[index % providers.length];
      }
      return item;
    });
  }
  
  return report;
}

/**
 * Extract the user name from the report title
 */
function extractUserName(text: string): string {
  // Default username if we can't extract it from the report
  const defaultName = 'there';
  
  const match = text.match(/Personalized Career Advice Report for ([\w\s\.]+)/i);
  return match ? match[1].trim() : defaultName;
}

/**
 * Extract the summary section from the report
 */
function extractSummary(text: string): string {
  const summaryMatch = text.match(/Summary:(.*?)(?=Recommended Roles:|$)/is);
  return summaryMatch ? summaryMatch[1].trim() : "";
}

/**
 * Extract the recommended roles section
 */
function extractRecommendedRoles(text: string): RecommendedRole[] {
  const roles: RecommendedRole[] = [];
  
  // Find the recommended roles section
  const rolesSection = text.match(/Recommended Roles:(.*?)(?=Skills and Matching Courses:|$)/is);
  
  if (rolesSection) {
    // Extract each numbered role
    const roleRegex = /\d+\.\s+\*\*([^*:]+)\*\*:\s+([^.]+)[^\n]*Salary band:\s+([^\n]+)/g;
    const matches = [...rolesSection[1].matchAll(roleRegex)];
    
    for (const match of matches) {
      roles.push({
        title: match[1].trim(),
        description: match[2].trim(),
        salaryRange: match[3].trim(),
        matchPercentage: 0 // Will be populated later
      });
    }
    
    // Fallback parsing if the regex didn't match
    if (roles.length === 0) {
      const lines = rolesSection[1].split('\n');
      let currentRole: Partial<RecommendedRole> = {};
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;
        
        if (trimmedLine.match(/^\d+\./)) {
          // New role starts
          if (currentRole.title) {
            roles.push(currentRole as RecommendedRole);
          }
          currentRole = {};
          
          const titleMatch = trimmedLine.match(/^\d+\.\s+\*\*([^*:]+)\*\*:/);
          if (titleMatch) {
            currentRole.title = titleMatch[1].trim();
            const descriptionMatch = trimmedLine.match(/\*\*:\s+([^.]+)/);
            if (descriptionMatch) {
              currentRole.description = descriptionMatch[1].trim();
            }
          } else {
            const simpleTitleMatch = trimmedLine.match(/^\d+\.\s+([^:]+):/);
            if (simpleTitleMatch) {
              currentRole.title = simpleTitleMatch[1].trim();
            }
          }
        } else if (trimmedLine.toLowerCase().includes('salary band') || 
                  trimmedLine.toLowerCase().includes('salary range')) {
          const salaryMatch = trimmedLine.match(/(?:Salary band|Salary range):\s+([^.]+)/i);
          if (salaryMatch && currentRole) {
            currentRole.salaryRange = salaryMatch[1].trim();
          }
        } else if (!currentRole.description) {
          currentRole.description = trimmedLine;
        }
      }
      
      // Add the last role if not added
      if (currentRole.title && !roles.some(r => r.title === currentRole.title)) {
        roles.push(currentRole as RecommendedRole);
      }
    }
  }
  
  return roles;
}

/**
 * Extract skills and courses table
 */
// function extractSkillsAndCourses(text: string): SkillCourse[] {
//   const skillsCourses: SkillCourse[] = [];
  
//   // Find the skills and courses section
//   const skillsSection = text.match(/Skills and Matching Courses:(.*?)(?=Next-Step Career Recommendations:|$)/is);
  
//   if (skillsSection) {
//     // Look for markdown table format with more flexible matching
//     const tableContent = skillsSection[1].trim();
//     const lines = tableContent.split('\n').map(line => line.trim());
    
//     // Find table data lines (skipping header and separator)
//     let inTable = false;
//     for (let i = 0; i < lines.length; i++) {
//       const line = lines[i];
      
//       // Skip header and separator lines
//       if (line.includes('| Skill | Course |') || line.includes('| ----- | ------ |')) {
//         inTable = true;
//         continue;
//       }
      
//       // Process table rows
//       if (inTable && line.startsWith('|') && line.endsWith('|')) {
//         const cells = line.split('|')
//           .map(cell => cell.trim())
//           .filter(cell => cell !== '');
        
//         if (cells.length >= 2) {
//           const item: SkillCourse = {
//             skill: cells[0],
//             course: cells[1],
//           };
          
//           // If there's a third column, consider it the provider
//           if (cells.length >= 3) {
//             item.provider = cells[2];
//           }
          
//           // Check if provider is embedded in course name
//           const providerMatch = item.course.match(/\((.*?)\)$/);
//           if (providerMatch) {
//             item.provider = providerMatch[1];
//             item.course = item.course.replace(/\s*\(.*?\)$/, '');
//           }
          
//           skillsCourses.push(item);
//         }
//       }
//     }
//   }
  
//   return skillsCourses;
// }
function extractSkillsAndCourses(text: string): SkillCourse[] {
  const skillsCourses: SkillCourse[] = [];
  
  // Use the same extraction logic as your parseformatCareerPathwayReport
  const skillsSection = extractSection(text, 'Skills and Matching Courses:', ['Next-Step Career Recommendations:']);
  console.log("Skills found? ",skillsSection)
  if (skillsSection) {
    // Look for markdown table format with more flexible matching
    const tableContent = skillsSection.trim();
    const lines = tableContent.split('\n').map(line => line.trim());
    
    // Find table data lines (skipping header and separator)
    let inTable = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Skip header and separator lines
      if (line.includes('| Skill | Course |') || line.includes('| ----- | ------ |')) {
        inTable = true;
        continue;
      }
      
      // Process table rows
      if (inTable && line.startsWith('|') && line.endsWith('|')) {
        const cells = line.split('|')
          .map(cell => cell.trim())
          .filter(cell => cell !== '');
        
        if (cells.length >= 2) {
          const item: SkillCourse = {
            skill: cells[0],
            course: cells[1],
          };
          
          // If there's a third column, consider it the provider
          if (cells.length >= 3) {
            item.provider = cells[2];
          }
          
          // Check if provider is embedded in course name
          const providerMatch = item.course.match(/\((.*?)\)$/);
          if (providerMatch) {
            item.provider = providerMatch[1];
            item.course = item.course.replace(/\s*\(.*?\)$/, '');
          }
          
          skillsCourses.push(item);
        }
      }
    }
  }
  
  // If no skills were found in the table format, try alternative approaches
  if (skillsCourses.length === 0 && skillsSection) {
    const listItemRegex = /[•*-]\s+([^:]+):\s+([^\n]+)/g;
    const matches = [...skillsSection.matchAll(listItemRegex)];
    
    for (const match of matches) {
      const item: SkillCourse = {
        skill: match[1].trim(),
        course: match[2].trim(),
      };
      
      // Try to extract provider if it's in parentheses
      const providerMatch = item.course.match(/\((.*?)\)$/);
      if (providerMatch) {
        item.provider = providerMatch[1];
        item.course = item.course.replace(/\s*\(.*?\)$/, '');
      }
      
      skillsCourses.push(item);
    }
  }
  
  return skillsCourses;
}

/**
 * Extract next-step career recommendations
 */
function extractNextStepRecommendations(text: string): string {
  const recommendationsMatch = text.match(/Next-Step Career Recommendations:(.*?)(?=Roles that Might be Right for You:|$)/is);
  return recommendationsMatch ? recommendationsMatch[1].trim() : "";
}

/**
 * Extract potential roles list
 */
function extractPotentialRoles(text: string): string[] {
  const potentialRoles: string[] = [];
  const rolesSection = text.match(/Roles that Might be Right for You:(.*?)(?=Path to Your Aspirational Role:|$)/is);
  
  if (rolesSection) {
    // Extract numbered or bulleted items
    const rolesRegex = /[•*\d-]+\s+\*\*([^*]+)\*\*:|[•*\d-]+\s+([^:]+):/g;
    const matches = [...rolesSection[1].matchAll(rolesRegex)];
    
    for (const match of matches) {
      potentialRoles.push((match[1] || match[2]).trim());
    }
    
    // If regex didn't find any roles, try splitting by lines and filtering
    if (potentialRoles.length === 0) {
      const lines = rolesSection[1].split('\n');
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine.match(/^[•*\d-]/)) {
          const roleMatch = trimmedLine.match(/^[•*\d-]\s+\*\*([^*]+)\*\*:|^[•*\d-]\s+([^:]+):|^[•*\d-]\s+(.*?)$/);
          if (roleMatch) {
            potentialRoles.push((roleMatch[1] || roleMatch[2] || roleMatch[3]).trim());
          }
        }
      }
    }
  }
  
  return potentialRoles;
}

/**
 * Extract career path steps
 */
function extractCareerPathSteps(text: string): CareerPathStep[] {
  const pathSteps: CareerPathStep[] = [];
  const pathSection = text.match(/Path to Your Aspirational Role:(.*?)(?=Key Takeaways:|$)/is);
  
  if (pathSection) {
    // Extract numbered steps
    const stepsRegex = /(\d+)\.\s+\*\*([^*:]+)\*\*:\s+([^\n]+)|(\d+)\.\s+\*\*([^*]+)\*\*\s+([^\n]+)|(\d+)\.\s+([^:]+):\s+([^\n]+)/g;
    const matches = [...pathSection[1].matchAll(stepsRegex)];
    
    for (const match of matches) {
      pathSteps.push({
        title: (match[2] || match[5] || match[8] || "").trim(),
        description: (match[3] || match[6] || match[9] || "").trim()
      });
    }
    
    // If regex didn't find steps, try simple numbered list approach
    if (pathSteps.length === 0) {
      const lines = pathSection[1].split('\n');
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine.match(/^\d+\./)) {
          const firstColonIndex = trimmedLine.indexOf(':');
          if (firstColonIndex > 0) {
            const title = trimmedLine.substring(trimmedLine.indexOf('.') + 1, firstColonIndex).trim();
            const description = trimmedLine.substring(firstColonIndex + 1).trim();
            if (title && description) {
              pathSteps.push({
                title: title.replace(/^\*\*|\*\*$/g, ''),
                description
              });
            }
          } else {
            // If no colon, try to split on the first space after a word
            const parts = trimmedLine.split(/^(\d+\.\s+\w+)\s+(.+)$/);
            if (parts.length >= 3) {
              const title = parts[1].substring(parts[1].indexOf('.') + 1).trim();
              const description = parts[2].trim();
              if (title && description) {
                pathSteps.push({ title, description });
              }
            }
          }
        }
      }
    }
  }
  
  // If we still don't have steps, create default ones based on common patterns
  if (pathSteps.length === 0) {
    pathSteps.push(
      {
        title: "Upskill",
        description: "Enhance your skills through relevant courses and certifications."
      },
      {
        title: "Network",
        description: "Connect with professionals in your target industry."
      },
      {
        title: "Gain Experience",
        description: "Seek opportunities to apply your skills in real-world settings."
      }
    );
  }
  
  return pathSteps;
}

/**
 * Extract key takeaways bullets
 */
function extractKeyTakeaways(text: string): string[] {
  const takeaways: string[] = [];
  const takeawaysSection = text.match(/Key Takeaways:(.*?)$/is);
  
  if (takeawaysSection) {
    // Extract bullet points
    const bulletRegex = /[•*-]\s+([^\n]+)/g;
    const matches = [...takeawaysSection[1].matchAll(bulletRegex)];
    
    for (const match of matches) {
      takeaways.push(match[1].trim());
    }
    
    // If regex didn't find any bullets, try splitting by lines
    if (takeaways.length === 0) {
      const lines = takeawaysSection[1].split('\n');
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine && trimmedLine !== 'Key Takeaways:') {
          // Remove bullet point markers if they exist
          takeaways.push(trimmedLine.replace(/^[•*-]\s+/, ''));
        }
      }
    }
  }
  
  return takeaways;
}

/**
 * Extract remote work considerations
 */
function extractRemoteWorkConsiderations(text: string): string {
  const remoteMatch = text.match(/Remote Work Considerations:(.*?)(?=By following|$)/is);
  return remoteMatch ? remoteMatch[1].trim() : "";
}

/**
 * Extract conclusion
 */
function extractConclusion(text: string): string {
  const conclusionMatch = text.match(/By following(.*?)$/s);
  return conclusionMatch ? "By following" + conclusionMatch[1].trim() : "";
}

// Update formatSkillsTable to be more robust
export const formatSkillsTable = (tableText: string): string => {
  if (!tableText) return '<tr><td colspan="2" class="border border-blue-300 px-4 py-2">No skills data available</td></tr>';
  
  const lines = tableText.split('\n').map(line => line.trim());
  const rows: string[] = [];
  
  for (const line of lines) {
    // Skip header and separator rows
    if (line.includes('| Skill | Course |') || line.includes('| ----- | ------ |')) {
      continue;
    }
    
    if (line.startsWith('|') && line.endsWith('|')) {
      const cells = line.split('|')
        .map(cell => cell.trim())
        .filter(cell => cell !== '');
      
      if (cells.length >= 2) {
        rows.push(`<tr>
          <td class="border border-blue-300 px-4 py-2">${cells[0]}</td>
          <td class="border border-blue-300 px-4 py-2">${cells[1]}</td>
        </tr>`);
      }
    }
  }
  
  return rows.length > 0 ? rows.join('') : '<tr><td colspan="2" class="border border-blue-300 px-4 py-2">No skills data available</td></tr>';
};


export const formatNumberedList = (content: string): string => {
  if (!content) return '';
  const hasNumbers = /\d+\.\s/.test(content);
  
  if (hasNumbers) {
    const items = content.split(/\d+\.\s/).filter(item => item.trim());
    return items.map((item, i) =>
      `<div class="mb-2">
        <span class="inline-block bg-blue-100 text-blue-800 rounded-full w-6 h-6 text-center mr-2">${i + 1}</span>
        ${cleanText(item)}
      </div>`
    ).join('');
  } else {
    return `<p>${cleanText(content)}</p>`;
  }
};

// Formatting function for the career report
export function formatCareerPathwayReport(raw: string): string {
  if (/<h|<div|<p>/.test(raw)) return raw;
  
  const nameMatch = raw.match(/\*\*Personalized Career Advice Report for (.*?)\*\*/);
  const userName = nameMatch?.[1] || 'You';
  
  const sections = {
    summary: extractSection(raw, 'Summary:', ['Recommended Roles:', 'Skills and Matching Courses:']),
    recommendedRoles: extractSection(raw, 'Recommended Roles:', ['Skills and Matching Courses:']),
    skills: extractSection(raw, 'Skills and Matching Courses:', ['Next-Step Career Recommendations:']),
    nextSteps: extractSection(raw, 'Next-Step Career Recommendations:', ['Roles that Might be Right for You:']),
    rightRoles: extractSection(raw, 'Roles that Might be Right for You:', ['Path to Your Aspirational Role:']),
    path: extractSection(raw, 'Path to Your Aspirational Role:', ['Remote Work Considerations:', 'By following']),
    remote: extractSection(raw, 'Remote Work Considerations:', ['By following']),
    conclusion: raw.includes('By following') ? raw.substring(raw.indexOf('By following')) : ''
  };
  
  let skillsTable = '';
  if (sections.skills) {
    // More flexible regex pattern to match the table
    const tablePattern = /\|\s*Skill\s*\|\s*Course\s*\|[\s\S]*?\n\s*\|\s*-+\s*\|\s*-+\s*\|[\s\S]*?(?:\n\s*\|[^\n]+\|)+/;
    const tableMatch = sections.skills.match(tablePattern);
    
    if (tableMatch) {
      skillsTable = tableMatch[0];
    } else {
      // Fallback: try to extract by finding lines that start and end with pipes
      const lines = sections.skills.split('\n');
      const tableLines = lines.filter(line => line.trim().startsWith('|') && line.trim().endsWith('|'));
      if (tableLines.length > 0) {
        skillsTable = tableLines.join('\n');
      }
    }
  }
  
  return `
<div class="career-pathway-report">
  <h1 class="text-xl font-bold text-blue-600 mb-4">Personalized Career Pathway Report for ${userName}</h1>
  
  <section class="mb-6">
    <h2 class="text-lg font-semibold text-blue-700 mb-2">Summary</h2>
    <p class="mb-2">${cleanText(sections.summary)}</p>
  </section>
  
  <section class="mb-6">
    <h2 class="text-lg font-semibold text-blue-700 mb-2">Recommended Roles</h2>
    <div class="pl-4">
      ${formatNumberedList(sections.recommendedRoles)}
    </div>
  </section>
  
  <section class="mb-6">
    <h2 class="text-lg font-semibold text-blue-700 mb-2">Skills and Matching Courses</h2>
    <div class="overflow-x-auto">
      <table class="min-w-full border-collapse">
        <thead>
          <tr class="bg-blue-100">
            <th class="border border-blue-300 px-4 py-2 text-left">Skill</th>
            <th class="border border-blue-300 px-4 py-2 text-left">Course</th>
          </tr>
        </thead>
        <tbody>
          ${formatSkillsTable(skillsTable)}
        </tbody>
      </table>
    </div>
  </section>
  
  <section class="mb-6">
    <h2 class="text-lg font-semibold text-blue-700 mb-2">Next-Step Career Recommendations</h2>
    <div class="pl-4">
      ${formatNumberedList(sections.nextSteps)}
    </div>
  </section>
  
  <section class="mb-6">
    <h2 class="text-lg font-semibold text-blue-700 mb-2">Roles that Might be Right for You</h2>
    <div class="pl-4">
      ${formatNumberedList(sections.rightRoles)}
    </div>
  </section>
  
  <section class="mb-6">
    <h2 class="text-lg font-semibold text-blue-700 mb-2">Path to Your Aspirational Role</h2>
    <div class="pl-4">
      ${formatNumberedList(sections.path)}
    </div>
  </section>
  
  ${sections.remote ? `
  <section class="mb-6">
    <h2 class="text-lg font-semibold text-blue-700 mb-2">Remote Work Considerations</h2>
    <div class="pl-4">
      ${formatNumberedList(sections.remote)}
    </div>
  </section>
  ` : ''}
  
  <section class="mt-6 p-4 bg-blue-50 border-l-4 border-blue-500">
    <p class="italic">${cleanText(sections.conclusion)}</p>
  </section>
</div>`;
}


export function parseformatCareerPathwayReport(raw: string): { html: string; sections: Record<string, string> } {
  if (/<h|<div|<p>/.test(raw)) return { html: raw, sections: {} };
  
  const nameMatch = raw.match(/\*\*Personalized Career Advice Report for (.*?)\*\*/);
  const userName = nameMatch?.[1] || 'You';
  
  const sections = {
    userName: userName,
    summary: extractSection(raw, 'Summary:', ['Recommended Roles:', 'Skills and Matching Courses:']),
    recommendedRoles: extractSection(raw, 'Recommended Roles:', ['Skills and Matching Courses:']),
    skills: extractSection(raw, 'Skills and Matching Courses:', ['Next-Step Career Recommendations:']),
    nextSteps: extractSection(raw, 'Next-Step Career Recommendations:', ['Roles that Might be Right for You:']),
    rightRoles: extractSection(raw, 'Roles that Might be Right for You:', ['Path to Your Aspirational Role:']),
    path: extractSection(raw, 'Path to Your Aspirational Role:', ['Remote Work Considerations:', 'By following']),
    keyTakeaways: extractSection(raw, 'Key Takeaways:', ['Remote Work Considerations:', 'By following']),
    remote: extractSection(raw, 'Remote Work Considerations:', ['By following']),
    conclusion: raw.includes('By following') ? raw.substring(raw.indexOf('By following')) : ''
  };

  // Add match percentages if they don't exist
  if (report.recommendedRoles.length > 0) {
    report.recommendedRoles = report.recommendedRoles.map((role, index) => {
      if (!role.matchPercentage) {
        role.matchPercentage = Math.max(50, 95 - (index * 7));
      }
      return role;
    });
  }
  
  let skillsTable = '';
  if (sections.skills) {
    const tablePattern = /\|\s*Skill\s*\|\s*Course\s*\|[\s\S]*?\n\s*\|\s*-+\s*\|\s*-+\s*\|[\s\S]*?(?:\n\s*\|[^\n]+\|)+/;
    const tableMatch = sections.skills.match(tablePattern);
    
    if (tableMatch) {
      skillsTable = tableMatch[0];
    } else {
      const lines = sections.skills.split('\n');
      const tableLines = lines.filter(line => line.trim().startsWith('|') && line.trim().endsWith('|'));
      if (tableLines.length > 0) {
        skillsTable = tableLines.join('\n');
      }
    }
  }
  
  const html = `
<div class="career-pathway-report">
  <h1 class="text-xl font-bold text-blue-600 mb-4">Personalized Career Pathway Report for ${userName}</h1>
  
  <section class="mb-6">
    <h2 class="text-lg font-semibold text-blue-700 mb-2">Summary</h2>
    <p class="mb-2">${cleanText(sections.summary)}</p>
  </section>
  
  <section class="mb-6">
    <h2 class="text-lg font-semibold text-blue-700 mb-2">Recommended Roles</h2>
    <div class="pl-4">
      ${formatNumberedList(sections.recommendedRoles)}
    </div>
  </section>
  
  <section class="mb-6">
    <h2 class="text-lg font-semibold text-blue-700 mb-2">Skills and Matching Courses</h2>
    <div class="overflow-x-auto">
      <table class="min-w-full border-collapse">
        <thead>
          <tr class="bg-blue-100">
            <th class="border border-blue-300 px-4 py-2 text-left">Skill</th>
            <th class="border border-blue-300 px-4 py-2 text-left">Course</th>
          </tr>
        </thead>
        <tbody>
          ${formatSkillsTable(skillsTable)}
        </tbody>
      </table>
    </div>
  </section>
  
  <section class="mb-6">
    <h2 class="text-lg font-semibold text-blue-700 mb-2">Next-Step Career Recommendations</h2>
    <div class="pl-4">
      ${formatNumberedList(sections.nextSteps)}
    </div>
  </section>
  
  <section class="mb-6">
    <h2 class="text-lg font-semibold text-blue-700 mb-2">Roles that Might be Right for You</h2>
    <div class="pl-4">
      ${formatNumberedList(sections.rightRoles)}
    </div>
  </section>
  
  <section class="mb-6">
    <h2 class="text-lg font-semibold text-blue-700 mb-2">Path to Your Aspirational Role</h2>
    <div class="pl-4">
      ${formatNumberedList(sections.path)}
    </div>
  </section>
  
  ${sections.remote ? `
  <section class="mb-6">
    <h2 class="text-lg font-semibold text-blue-700 mb-2">Remote Work Considerations</h2>
    <div class="pl-4">
      ${formatNumberedList(sections.remote)}
    </div>
  </section>
  ` : ''}
  
  <section class="mt-6 p-4 bg-blue-50 border-l-4 border-blue-500">
    <p class="italic">${cleanText(sections.conclusion)}</p>
  </section>
</div>`;

  return {
    html,
    sections // Fixed: return sections, not report
  };
}
