/**
 * Utility functions to parse static career reports into structured data
 */

export interface RecommendedRole {
  title: string;
  description: string;
  salaryRange?: string;
  matchPercentage?: number;
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
  nextStepRecommendations: string[];
  potentialRoles: string[];
  careerPathSteps: CareerPathStep[];
  remoteConsiderations: string;
  conclusion: string;
}

/**
 * Clean text by removing markdown formatting and extra whitespace
 */
function cleanText(text: string): string {
  if (!text) return '';
  
  // Remove markdown formatting
  return text
    .trim()
    .replace(/\*\*/g, '')
    .replace(/\n\s*\n/g, '\n') // Remove multiple consecutive newlines
    .replace(/\n+/g, '\n') // Remove extra newlines
    .replace(/^\s+|\s+$/g, '') // Trim whitespace
    .replace(/\s+/g, ' '); // Normalize spaces
}

/**
 * Extract a section from the report with improved section finding
 */
function extractSection(text: string, startMarkers: string[], endMarkers?: string[]): string {
  // Try each start marker
  for (const startMarker of startMarkers) {
    let startIndex = text.indexOf(startMarker);
    
    if (startIndex !== -1) {
      const start = startIndex + startMarker.length;
      
      // Find the end marker if any
      let endIndex = text.length;
      
      if (endMarkers) {
        for (const endMarker of endMarkers) {
          const idx = text.indexOf(endMarker, start);
          if (idx !== -1 && idx < endIndex) {
            endIndex = idx;
          }
        }
      }
      
      return text.substring(start, endIndex).trim();
    }
  }
  
  return '';
}

/**
 * Parse numbered list items from text
 */
function parseNumberedList(text: string): string[] {
  if (!text) return [];
  
  // Split by numbers followed by period
  const items = text.split(/\d+\.\s+/).filter(item => item.trim());
  
  // Clean each item
  return items.map(item => cleanText(item));
}

/**
 * Parse roles with potential descriptions
 */
function parseRoles(text: string): RecommendedRole[] {
  if (!text) return [];
  
  const roles: RecommendedRole[] = [];
  
  // Split by numbers
  const items = text.split(/\d+\.\s+/).filter(item => item.trim());
  
  for (const item of items) {
    const colonIndex = item.indexOf(':');
    
    if (colonIndex !== -1) {
      // Role has title and description
      const title = cleanText(item.substring(0, colonIndex));
      const description = cleanText(item.substring(colonIndex + 1));
      
      // Check for salary range
      const salaryMatch = description.match(/Salary (?:band|range):\s*([^.\n]+)/i);
      let salaryRange: string | undefined;
      let finalDescription = description;
      
      if (salaryMatch) {
        salaryRange = salaryMatch[1].trim();
        finalDescription = description.replace(salaryMatch[0], '').trim();
      }
      
      roles.push({
        title,
        description: finalDescription,
        salaryRange
      });
    } else {
      // Simple role without description
      roles.push({
        title: cleanText(item),
        description: ''
      });
    }
  }
  
  return roles;
}

/**
 * Parse table data from markdown
 */
function parseMarkdownTable(text: string): SkillCourse[] {
  if (!text) return [];
  
  const skillCourses: SkillCourse[] = [];
  
  // Find table rows
  const rows = text.split('\n')
    .map(row => row.trim())
    .filter(row => row.startsWith('|') && row.endsWith('|') && !row.includes('---'));
  
  // Skip header row
  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i]
      .split('|')
      .map(cell => cell.trim())
      .filter(cell => cell);
    
    if (cells.length >= 2) {
      skillCourses.push({
        skill: cleanText(cells[0]),
        course: cleanText(cells[1])
      });
    }
  }
  
  return skillCourses;
}

/**
 * Parse career steps
 */
function parseCareerSteps(text: string): CareerPathStep[] {
  if (!text) return [];
  
  const steps: CareerPathStep[] = [];
  const items = text.split(/\d+\.\s+/).filter(item => item.trim());
  
  for (let i = 0; i < items.length; i++) {
    steps.push({
      title: `Step ${i + 1}`,
      description: cleanText(items[i])
    });
  }
  
  return steps;
}

/**
 * Parse a career report from text
 */
export function parseCareerReport(reportText: string): CareerReportData {
  // Clean the report text
  const cleanReport = reportText
    .replace(/\n\s+/g, '\n') // Remove leading spaces
    .replace(/\s+\n/g, '\n') // Remove trailing spaces
    .trim();
  
  // Extract user name
  const nameMatch = cleanReport.match(/(?:Personalized Career (?:Advice |Pathway )?Report(?: for ([^*\n]+))?)/i);
  const userName = nameMatch && nameMatch[1] ? cleanText(nameMatch[1]) : 'You';
  
  // Extract sections
  const summary = extractSection(cleanReport, 
    ['Summary:', 'Summary :', '**Summary:**', '**Summary **:'], 
    ['Recommended Roles:', '**Recommended Roles:**']
  );
  
  const recommendedRolesText = extractSection(cleanReport,
    ['Recommended Roles:', 'Recommended Roles :', '**Recommended Roles:**'],
    ['Skills and Matching Courses:', '**Skills and Matching Courses:**']
  );
  
  const skillsTableText = extractSection(cleanReport,
    ['Skills and Matching Courses:', '**Skills and Matching Courses:**'],
    ['Next-Step Career Recommendations:', '**Next-Step Career Recommendations:**']
  );
  
  const nextStepsText = extractSection(cleanReport,
    ['Next-Step Career Recommendations:', '**Next-Step Career Recommendations:**'],
    ['Roles that Might be Right for You:', '**Roles that Might be Right for You:**']
  );
  
  const potentialRolesText = extractSection(cleanReport,
    ['Roles that Might be Right for You:', '**Roles that Might be Right for You:**'],
    ['Path to Your Aspirational Role:', '**Path to Your Aspirational Role:**']
  );
  
  const careerPathText = extractSection(cleanReport,
    ['Path to Your Aspirational Role:', '**Path to Your Aspirational Role:**'],
    ['Remote Work Considerations:', '**Remote Work Considerations:**', 'By following']
  );
  
  const remoteConsiderations = extractSection(cleanReport,
    ['Remote Work Considerations:', '**Remote Work Considerations:**'],
    ['By following']
  );
  
  const conclusion = extractSection(cleanReport,
    ['By following these recommendations'],
    []
  );
  
  // Parse each section
  return {
    userName,
    summary: cleanText(summary),
    recommendedRoles: parseRoles(recommendedRolesText),
    skillsAndCourses: parseMarkdownTable(skillsTableText),
    nextStepRecommendations: parseNumberedList(nextStepsText),
    potentialRoles: parseNumberedList(potentialRolesText),
    careerPathSteps: parseCareerSteps(careerPathText),
    remoteConsiderations: cleanText(remoteConsiderations),
    conclusion: cleanText(conclusion)
  };
}

/**
 * Format the parsed report into HTML
 */
export function formatCareerReport(reportData: CareerReportData): string {
  return `
    <div class="career-pathway-report">
      <h1 class="text-2xl font-bold text-blue-600 mb-6">Personalized Career Pathway Report for ${reportData.userName}</h1>
      
      <section class="mb-8">
        <h2 class="text-xl font-semibold text-blue-700 mb-3">Summary</h2>
        <p class="text-gray-700 leading-relaxed">${reportData.summary}</p>
      </section>
      
      <section class="mb-8">
        <h2 class="text-xl font-semibold text-blue-700 mb-3">Recommended Roles</h2>
        <div class="space-y-4">
          ${reportData.recommendedRoles.map((role, i) => `
            <div class="flex items-start gap-3">
              <div class="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-800 font-medium">
                ${i + 1}
              </div>
              <div>
                <h3 class="font-medium text-gray-900">${role.title}</h3>
                ${role.description ? `<p class="text-gray-600 mt-1">${role.description}</p>` : ''}
                ${role.salaryRange ? `<p class="text-sm text-gray-500 mt-1">Salary: ${role.salaryRange}</p>` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </section>
      
      <section class="mb-8">
        <h2 class="text-xl font-semibold text-blue-700 mb-3">Skills and Matching Courses</h2>
        <div class="overflow-x-auto">
          <table class="min-w-full bg-white border border-gray-200 rounded-lg overflow-hidden">
            <thead class="bg-blue-50">
              <tr>
                <th class="py-3 px-4 text-left font-medium text-gray-700 border-b">Skill</th>
                <th class="py-3 px-4 text-left font-medium text-gray-700 border-b">Course</th>
              </tr>
            </thead>
            <tbody>
              ${reportData.skillsAndCourses.map((item, i) => `
                <tr class="${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}">
                  <td class="py-3 px-4 border-b">${item.skill}</td>
                  <td class="py-3 px-4 border-b">${item.course}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </section>
      
      <section class="mb-8">
        <h2 class="text-xl font-semibold text-blue-700 mb-3">Next-Step Career Recommendations</h2>
        <div class="space-y-4">
          ${reportData.nextStepRecommendations.map((step, i) => `
            <div class="flex items-start gap-3">
              <div class="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-800 font-medium">
                ${i + 1}
              </div>
              <p class="text-gray-700">${step}</p>
            </div>
          `).join('')}
        </div>
      </section>
      
      <section class="mb-8">
        <h2 class="text-xl font-semibold text-blue-700 mb-3">Roles that Might be Right for You</h2>
        <div class="space-y-4">
          ${reportData.potentialRoles.map((role, i) => `
            <div class="flex items-start gap-3">
              <div class="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-800 font-medium">
                ${i + 1}
              </div>
              <p class="text-gray-700">${role}</p>
            </div>
          `).join('')}
        </div>
      </section>
      
      <section class="mb-8">
        <h2 class="text-xl font-semibold text-blue-700 mb-3">Path to Your Aspirational Role</h2>
        <div class="space-y-4">
          ${reportData.careerPathSteps.map((step, i) => `
            <div class="flex items-start gap-3">
              <div class="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-800 font-medium">
                ${i + 1}
              </div>
              <p class="text-gray-700">${step.description}</p>
            </div>
          `).join('')}
        </div>
      </section>
      
      ${reportData.remoteConsiderations ? `
      <section class="mb-8">
        <h2 class="text-xl font-semibold text-blue-700 mb-3">Remote Work Considerations</h2>
        <p class="text-gray-700 leading-relaxed">${reportData.remoteConsiderations}</p>
      </section>
      ` : ''}
      
      ${reportData.conclusion ? `
      <section class="mt-8 p-6 bg-blue-50 border-l-4 border-blue-500 rounded-r-md">
        <p class="text-gray-700 italic">${reportData.conclusion}</p>
      </section>
      ` : ''}
    </div>
  `;
}

// /**
//  * Utility functions to parse static career reports into structured data
//  */

// export interface RecommendedRole {
//   title: string;
//   description: string;
//   salaryRange: string;
//   matchPercentage: number;
// }

// export interface SkillCourse {
//   skill: string;
//   course: string;
//   provider?: string;
//   level?: string;
// }

// export interface CareerPathStep {
//   title: string;
//   description: string;
// }

// export interface CareerReportData {
//   userName: string;
//   summary: string;
//   recommendedRoles: RecommendedRole[];
//   skillsAndCourses: SkillCourse[];
//   nextStepRecommendations: string;
//   potentialRoles: string[];
//   careerPathSteps: CareerPathStep[];
//   keyTakeaways: string[];
// }

// /**
//  * Parses a static text report into structured data
//  * This function handles the transformation of the raw text format
//  * into a structured object the interactive UI can use
//  */
// export function parseCareerReport(reportText: string): CareerReportData {
//   const report: CareerReportData = {
//     userName: extractUserName(reportText),
//     summary: extractSummary(reportText),
//     recommendedRoles: extractRecommendedRoles(reportText),
//     skillsAndCourses: extractSkillsAndCourses(reportText),
//     nextStepRecommendations: extractNextStepRecommendations(reportText),
//     potentialRoles: extractPotentialRoles(reportText),
//     careerPathSteps: extractCareerPathSteps(reportText),
//     keyTakeaways: extractKeyTakeaways(reportText)
//   };
  
//   // Add match percentages if they don't exist in the original report
//   if (report.recommendedRoles.length > 0) {
//     report.recommendedRoles = report.recommendedRoles.map((role, index) => {
//       if (!role.matchPercentage) {
//         // Generate decreasing percentages for roles (95%, 88%, 81%, etc.)
//         role.matchPercentage = Math.max(50, 95 - (index * 7));
//       }
//       return role;
//     });
//   }
  
//   // Add skill levels if they don't exist
//   if (report.skillsAndCourses.length > 0) {
//     const levels = ['Beginner', 'Intermediate', 'Advanced', 'Expert'];
//     report.skillsAndCourses = report.skillsAndCourses.map((item, index) => {
//       if (!item.level) {
//         // Randomly assign skill levels with a bias toward intermediate
//         const levelIndex = Math.floor(Math.random() * 3);
//         item.level = levels[levelIndex];
//       }
//       if (!item.provider) {
//         // Assign default providers based on common platforms
//         const providers = ['Coursera', 'edX', 'Udemy', 'LinkedIn Learning', 'Pluralsight'];
//         item.provider = providers[index % providers.length];
//       }
//       return item;
//     });
//   }
  
//   return report;
// }

// /**
//  * Extract the user name from the report title
//  */
// function extractUserName(text: string): string {
//   const match = text.match(/Personalized Career Advice Report for ([\w\s\.]+)/i);
//   return match ? match[1].trim() : "User";
// }

// /**
//  * Extract the summary section from the report
//  */
// function extractSummary(text: string): string {
//   const summaryMatch = text.match(/Summary:(.*?)(?=Recommended Roles:|$)/is);
//   return summaryMatch ? summaryMatch[1].trim() : "";
// }

// /**
//  * Extract the recommended roles section
//  */
// function extractRecommendedRoles(text: string): RecommendedRole[] {
//   const roles: RecommendedRole[] = [];
  
//   // Find the recommended roles section
//   const rolesSection = text.match(/Recommended Roles:(.*?)(?=Skills and Matching Courses:|$)/is);
  
//   if (rolesSection) {
//     // Extract each numbered role
//     const roleRegex = /\d+\.\s+\*\*([^*:]+)\*\*:\s+([^.]+)[^\n]*Salary band:\s+([^\n]+)/g;
//     const matches = [...rolesSection[1].matchAll(roleRegex)];
    
//     for (const match of matches) {
//       roles.push({
//         title: match[1].trim(),
//         description: match[2].trim(),
//         salaryRange: match[3].trim(),
//         matchPercentage: 0 // Will be populated later
//       });
//     }
    
//     // Fallback parsing if the regex didn't match
//     if (roles.length === 0) {
//       const lines = rolesSection[1].split('\n');
//       let currentRole: Partial<RecommendedRole> = {};
      
//       for (const line of lines) {
//         const trimmedLine = line.trim();
//         if (!trimmedLine) continue;
        
//         if (trimmedLine.match(/^\d+\./)) {
//           // New role starts
//           if (currentRole.title) {
//             roles.push(currentRole as RecommendedRole);
//           }
//           currentRole = {};
          
//           const titleMatch = trimmedLine.match(/^\d+\.\s+\*\*([^*:]+)\*\*:/);
//           if (titleMatch) {
//             currentRole.title = titleMatch[1].trim();
//             const descriptionMatch = trimmedLine.match(/\*\*:\s+([^.]+)/);
//             if (descriptionMatch) {
//               currentRole.description = descriptionMatch[1].trim();
//             }
//           } else {
//             const simpleTitleMatch = trimmedLine.match(/^\d+\.\s+([^:]+):/);
//             if (simpleTitleMatch) {
//               currentRole.title = simpleTitleMatch[1].trim();
//             }
//           }
//         } else if (trimmedLine.toLowerCase().includes('salary band') || 
//                   trimmedLine.toLowerCase().includes('salary range')) {
//           const salaryMatch = trimmedLine.match(/(?:Salary band|Salary range):\s+([^.]+)/i);
//           if (salaryMatch && currentRole) {
//             currentRole.salaryRange = salaryMatch[1].trim();
//           }
//         } else if (!currentRole.description) {
//           currentRole.description = trimmedLine;
//         }
//       }
      
//       // Add the last role if not added
//       if (currentRole.title && !roles.some(r => r.title === currentRole.title)) {
//         roles.push(currentRole as RecommendedRole);
//       }
//     }
//   }
  
//   return roles;
// }

// /**
//  * Extract skills and courses table
//  */
// function extractSkillsAndCourses(text: string): SkillCourse[] {
//   const skillsCourses: SkillCourse[] = [];
  
//   // Find the skills and courses section
//   const skillsSection = text.match(/Skills and Matching Courses:(.*?)(?=Next-Step Career Recommendations:|$)/is);
  
//   if (skillsSection) {
//     // Try to extract table data
//     // Look for markdown table format
//     const tableLines = skillsSection[1].split('\n')
//       .map(line => line.trim())
//       .filter(line => line.startsWith('|') && line.endsWith('|'));
    
//     if (tableLines.length >= 3) {
//       // Skip header and separator lines
//       for (let i = 2; i < tableLines.length; i++) {
//         const cells = tableLines[i].split('|')
//           .map(cell => cell.trim())
//           .filter(cell => cell !== '');
        
//         if (cells.length >= 2) {
//           const item: SkillCourse = {
//             skill: cells[0],
//             course: cells[1],
//           };
          
//           // If there's a third column, consider it the provider
//           if (cells.length >= 3) {
//             const providerMatch = cells[1].match(/\((.*?)\)$/);
//             if (providerMatch) {
//               item.provider = providerMatch[1];
//               item.course = cells[1].replace(/\s*\(.*?\)$/, '');
//             } else {
//               item.provider = cells[2];
//             }
//           }
          
//           skillsCourses.push(item);
//         }
//       }
//     }
    
//     // If table parsing failed, try alternative approach with bullet points
//     if (skillsCourses.length === 0) {
//       const listItemRegex = /[•*-]\s+([^:]+):\s+([^\n]+)/g;
//       const matches = [...skillsSection[1].matchAll(listItemRegex)];
      
//       for (const match of matches) {
//         const item: SkillCourse = {
//           skill: match[1].trim(),
//           course: match[2].trim(),
//         };
        
//         // Try to extract provider if it's in parentheses
//         const providerMatch = item.course.match(/\((.*?)\)$/);
//         if (providerMatch) {
//           item.provider = providerMatch[1];
//           item.course = item.course.replace(/\s*\(.*?\)$/, '');
//         }
        
//         skillsCourses.push(item);
//       }
//     }
//   }
  
//   return skillsCourses;
// }

// /**
//  * Extract next-step career recommendations
//  */
// function extractNextStepRecommendations(text: string): string {
//   const recommendationsMatch = text.match(/Next-Step Career Recommendations:(.*?)(?=Roles that Might be Right for You:|$)/is);
//   return recommendationsMatch ? recommendationsMatch[1].trim() : "";
// }

// /**
//  * Extract potential roles list
//  */
// function extractPotentialRoles(text: string): string[] {
//   const potentialRoles: string[] = [];
//   const rolesSection = text.match(/Roles that Might be Right for You:(.*?)(?=Path to Your Aspirational Role:|$)/is);
  
//   if (rolesSection) {
//     // Extract numbered or bulleted items
//     const rolesRegex = /[•*\d-]+\s+\*\*([^*]+)\*\*:|[•*\d-]+\s+([^:]+):/g;
//     const matches = [...rolesSection[1].matchAll(rolesRegex)];
    
//     for (const match of matches) {
//       potentialRoles.push((match[1] || match[2]).trim());
//     }
    
//     // If regex didn't find any roles, try splitting by lines and filtering
//     if (potentialRoles.length === 0) {
//       const lines = rolesSection[1].split('\n');
//       for (const line of lines) {
//         const trimmedLine = line.trim();
//         if (trimmedLine.match(/^[•*\d-]/)) {
//           const roleMatch = trimmedLine.match(/^[•*\d-]\s+\*\*([^*]+)\*\*:|^[•*\d-]\s+([^:]+):|^[•*\d-]\s+(.*?)$/);
//           if (roleMatch) {
//             potentialRoles.push((roleMatch[1] || roleMatch[2] || roleMatch[3]).trim());
//           }
//         }
//       }
//     }
//   }
  
//   return potentialRoles;
// }

// /**
//  * Extract career path steps
//  */
// function extractCareerPathSteps(text: string): CareerPathStep[] {
//   const pathSteps: CareerPathStep[] = [];
//   const pathSection = text.match(/Path to Your Aspirational Role:(.*?)(?=Key Takeaways:|$)/is);
  
//   if (pathSection) {
//     // Extract numbered steps
//     const stepsRegex = /(\d+)\.\s+\*\*([^*:]+)\*\*:\s+([^\n]+)|(\d+)\.\s+\*\*([^*]+)\*\*\s+([^\n]+)|(\d+)\.\s+([^:]+):\s+([^\n]+)/g;
//     const matches = [...pathSection[1].matchAll(stepsRegex)];
    
//     for (const match of matches) {
//       pathSteps.push({
//         title: (match[2] || match[5] || match[8] || "").trim(),
//         description: (match[3] || match[6] || match[9] || "").trim()
//       });
//     }
    
//     // If regex didn't find steps, try simple numbered list approach
//     if (pathSteps.length === 0) {
//       const lines = pathSection[1].split('\n');
//       for (const line of lines) {
//         const trimmedLine = line.trim();
//         if (trimmedLine.match(/^\d+\./)) {
//           const firstColonIndex = trimmedLine.indexOf(':');
//           if (firstColonIndex > 0) {
//             const title = trimmedLine.substring(trimmedLine.indexOf('.') + 1, firstColonIndex).trim();
//             const description = trimmedLine.substring(firstColonIndex + 1).trim();
//             if (title && description) {
//               pathSteps.push({
//                 title: title.replace(/^\*\*|\*\*$/g, ''),
//                 description
//               });
//             }
//           } else {
//             // If no colon, try to split on the first space after a word
//             const parts = trimmedLine.split(/^(\d+\.\s+\w+)\s+(.+)$/);
//             if (parts.length >= 3) {
//               const title = parts[1].substring(parts[1].indexOf('.') + 1).trim();
//               const description = parts[2].trim();
//               if (title && description) {
//                 pathSteps.push({ title, description });
//               }
//             }
//           }
//         }
//       }
//     }
//   }
  
//   // If we still don't have steps, create default ones based on common patterns
//   if (pathSteps.length === 0) {
//     pathSteps.push(
//       {
//         title: "Upskill",
//         description: "Enhance your skills through relevant courses and certifications."
//       },
//       {
//         title: "Network",
//         description: "Connect with professionals in your target industry."
//       },
//       {
//         title: "Gain Experience",
//         description: "Seek opportunities to apply your skills in real-world settings."
//       }
//     );
//   }
  
//   return pathSteps;
// }

// /**
//  * Extract key takeaways bullets
//  */
// function extractKeyTakeaways(text: string): string[] {
//   const takeaways: string[] = [];
//   const takeawaysSection = text.match(/Key Takeaways:(.*?)$/is);
  
//   if (takeawaysSection) {
//     // Extract bullet points
//     const bulletRegex = /[•*-]\s+([^\n]+)/g;
//     const matches = [...takeawaysSection[1].matchAll(bulletRegex)];
    
//     for (const match of matches) {
//       takeaways.push(match[1].trim());
//     }
    
//     // If regex didn't find any bullets, try splitting by lines
//     if (takeaways.length === 0) {
//       const lines = takeawaysSection[1].split('\n');
//       for (const line of lines) {
//         const trimmedLine = line.trim();
//         if (trimmedLine && trimmedLine !== 'Key Takeaways:') {
//           // Remove bullet point markers if they exist
//           takeaways.push(trimmedLine.replace(/^[•*-]\s+/, ''));
//         }
//       }
//     }
//   }
  
//   return takeaways;
// }