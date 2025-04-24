
import React, { useEffect, useState } from 'react';
import { pathwayQuestions } from '@/data/careerPathwayData';
import { supabase } from '@/integrations/supabase/client';
import { Spinner } from '@/components/ui/spinner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { parseCareerReport } from '@/components/assistants/utils/CareerReportParser';

type CareerPathwaySectionProps = {
  pathwayAnswers: Record<number, number | string>;
};

const CareerPathwaySection: React.FC<CareerPathwaySectionProps> = ({ pathwayAnswers }) => {
  const { user } = useAuth();
  const [careerAdviceReport, setCareerAdviceReport] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [resumeFound, setResumeFound] = useState(false);

  useEffect(() => {
    const allAnswersProvided = Object.keys(pathwayAnswers).length === pathwayQuestions.length;
    if (!allAnswersProvided || !user) {
      setCareerAdviceReport('');
      setResumeFound(false);
      return;
    }

    const fetchSavedCareerAdvice = async () => {
      setLoading(true);
      try {
        // Check if resume exists
        const { data: resumeData, error: resumeError } = await supabase
          .from('resumes')
          .select('text')
          .eq('user_id', user.id)
          .limit(1)
          .maybeSingle();

        if (resumeError) {
          console.error('Error checking resume for career advice:', resumeError);
        } else if (resumeData && resumeData.text) {
          setResumeFound(true);
        } else {
          setResumeFound(false);
        }

        // Fetch the latest career advice report from the database
        const { data: adviceData, error: adviceError } = await supabase
          .from('career_pathway_results')
          .select('report')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (adviceError) {
          console.error('Error fetching career advice:', adviceError);
          setCareerAdviceReport('Failed to get career advice. Please try again later.');
          return;
        }

        if (adviceData && adviceData.report) {
          const rawReport = typeof adviceData.report === 'string' 
            ? adviceData.report 
            : JSON.stringify(adviceData.report);
          
          // Format the report using our improved formatter
          const formattedReport = formatCareerPathwayReport(rawReport.trim());
          setCareerAdviceReport(formattedReport);
        } else {
          setCareerAdviceReport('No career pathway report found. Please complete the career pathway chat first.');
        }
      } catch (err) {
        console.error('Unknown error fetching career advice:', err);
        setCareerAdviceReport('Failed to get career advice. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchSavedCareerAdvice();
  }, [pathwayAnswers, user]);

  // Enhanced formatting function for the career report
  const formatCareerPathwayReport = (reportText: string): string => {
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

  return (
    <Card id="career-pathway-report" className="mt-6">
      <CardHeader>
        <CardTitle>Personalized Career Pathway Report</CardTitle>
        <CardDescription>
          Based on your pathway answers and data analysis, here is your personalized career pathway report.
        </CardDescription>
      </CardHeader>
      <CardContent className="min-h-[150px]">
        {loading ? (
          <div className="flex justify-center items-center h-full">
            <Spinner className="w-8 h-8" />
            <span className="ml-2 text-muted-foreground">Loading report...</span>
          </div>
        ) : (
          <>
            {resumeFound && (
              <div className="mb-4 p-2 bg-green-100 text-green-700 rounded border border-green-300">
                Resume found and incorporated into career advice.
              </div>
            )}
            <div 
              className="career-advice-report prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: careerAdviceReport }}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default CareerPathwaySection;
