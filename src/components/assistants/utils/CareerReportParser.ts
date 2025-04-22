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
}

/**
 * Parses a static text report into structured data
 * This function handles the transformation of the raw text format
 * into a structured object the interactive UI can use
 */
export function parseCareerReport(reportText: string): CareerReportData {
  const report: CareerReportData = {
    userName: extractUserName(reportText),
    summary: extractSummary(reportText),
    recommendedRoles: extractRecommendedRoles(reportText),
    skillsAndCourses: extractSkillsAndCourses(reportText),
    nextStepRecommendations: extractNextStepRecommendations(reportText),
    potentialRoles: extractPotentialRoles(reportText),
    careerPathSteps: extractCareerPathSteps(reportText),
    keyTakeaways: extractKeyTakeaways(reportText)
  };
  
  // Add match percentages if they don't exist in the original report
  if (report.recommendedRoles.length > 0) {
    report.recommendedRoles = report.recommendedRoles.map((role, index) => {
      if (!role.matchPercentage) {
        // Generate decreasing percentages for roles (95%, 88%, 81%, etc.)
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
        // Randomly assign skill levels with a bias toward intermediate
        const levelIndex = Math.floor(Math.random() * 3);
        item.level = levels[levelIndex];
      }
      if (!item.provider) {
        // Assign default providers based on common platforms
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
  const match = text.match(/Personalized Career Advice Report for ([\w\s\.]+)/i);
  return match ? match[1].trim() : "User";
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
function extractSkillsAndCourses(text: string): SkillCourse[] {
  const skillsCourses: SkillCourse[] = [];
  
  // Find the skills and courses section
  const skillsSection = text.match(/Skills and Matching Courses:(.*?)(?=Next-Step Career Recommendations:|$)/is);
  
  if (skillsSection) {
    // Try to extract table data
    // Look for markdown table format
    const tableLines = skillsSection[1].split('\n')
      .map(line => line.trim())
      .filter(line => line.startsWith('|') && line.endsWith('|'));
    
    if (tableLines.length >= 3) {
      // Skip header and separator lines
      for (let i = 2; i < tableLines.length; i++) {
        const cells = tableLines[i].split('|')
          .map(cell => cell.trim())
          .filter(cell => cell !== '');
        
        if (cells.length >= 2) {
          const item: SkillCourse = {
            skill: cells[0],
            course: cells[1],
          };
          
          // If there's a third column, consider it the provider
          if (cells.length >= 3) {
            const providerMatch = cells[1].match(/\((.*?)\)$/);
            if (providerMatch) {
              item.provider = providerMatch[1];
              item.course = cells[1].replace(/\s*\(.*?\)$/, '');
            } else {
              item.provider = cells[2];
            }
          }
          
          skillsCourses.push(item);
        }
      }
    }
    
    // If table parsing failed, try alternative approach with bullet points
    if (skillsCourses.length === 0) {
      const listItemRegex = /[•*-]\s+([^:]+):\s+([^\n]+)/g;
      const matches = [...skillsSection[1].matchAll(listItemRegex)];
      
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