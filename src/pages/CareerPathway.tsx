import React, { useEffect, useState } from 'react';
import { pathwayQuestions } from '@/data/careerPathwayData';
import { supabase } from '@/integrations/supabase/client';
import { Spinner } from '@/components/ui/spinner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';

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
    // Check if it's already formatted HTML
    if (/<h|<div|<p>/.test(reportText)) return reportText;
    
    // Clean up the input text
    const cleanedText = reportText
      .replace(/\n\s+/g, '\n') // Remove leading spaces
      .replace(/\s+\n/g, '\n') // Remove trailing spaces
      .replace(/\n{3,}/g, '\n\n') // Replace multiple newlines with double newline
      .trim();
    
    // Extract sections using improved parsing
    const extractSection = (text: string, startMarkers: string[], endMarkers?: string[]): string => {
      for (const startMarker of startMarkers) {
        let startIndex = text.indexOf(startMarker);
        
        if (startIndex !== -1) {
          const start = startIndex + startMarker.length;
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
    };
    
    // Clean text by removing markdown formatting
    const cleanText = (text: string): string => {
      if (!text) return '';
      
      return text
        .trim()
        .replace(/\*\*/g, '')
        .replace(/\n\s*\n/g, '\n')
        .replace(/\n+/g, '\n')
        .replace(/^\s+|\s+$/g, '')
        .replace(/\s+/g, ' ');
    };
    
    // Parse numbered lists
    const parseNumberedList = (text: string): string => {
      if (!text) return '';
      
      const items = text.split(/\d+\.\s+/).filter(item => item.trim());
      
      return items.map((item, i) => `
        <div class="flex items-start gap-3 mb-3">
          <div class="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-800 font-medium">
            ${i + 1}
          </div>
          <p class="text-gray-700 flex-1">${cleanText(item)}</p>
        </div>
      `).join('');
    };
    
    // Parse roles with descriptions
    const parseRoles = (text: string): string => {
      if (!text) return '';
      
      const items = text.split(/\d+\.\s+/).filter(item => item.trim());
      
      return items.map((item, i) => {
        const colonIndex = item.indexOf(':');
        if (colonIndex !== -1) {
          const title = cleanText(item.substring(0, colonIndex));
          const description = cleanText(item.substring(colonIndex + 1));
          
          // Check for salary range
          const salaryMatch = description.match(/Salary (?:band|range):\s*([^.\n]+)/i);
          let salaryRange = '';
          let mainDescription = description;
          
          if (salaryMatch) {
            salaryRange = salaryMatch[1].trim();
            mainDescription = description.replace(salaryMatch[0], '').trim();
          }
          
          return `
            <div class="flex items-start gap-3 mb-4">
              <div class="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-800 font-medium">
                ${i + 1}
              </div>
              <div>
                <h3 class="font-medium text-gray-900">${title}</h3>
                ${mainDescription ? `<p class="text-gray-600 mt-1">${mainDescription}</p>` : ''}
                ${salaryRange ? `<p class="text-sm text-gray-500 mt-1">Salary: ${salaryRange}</p>` : ''}
              </div>
            </div>
          `;
        } else {
          return `
            <div class="flex items-start gap-3 mb-3">
              <div class="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-800 font-medium">
                ${i + 1}
              </div>
              <p class="text-gray-700">${cleanText(item)}</p>
            </div>
          `;
        }
      }).join('');
    };
    
    // Parse markdown table
    const parseMarkdownTable = (text: string): string => {
      if (!text) return '<p class="text-gray-500 italic">No skills data available</p>';
      
      const rows = text.split('\n')
        .map(row => row.trim())
        .filter(row => row.startsWith('|') && row.endsWith('|') && !row.includes('---'));
      
      if (rows.length <= 1) return '<p class="text-gray-500 italic">No skills data available</p>';
      
      let tableHtml = `
        <table class="min-w-full bg-white border border-gray-200 rounded-lg overflow-hidden">
          <thead class="bg-blue-50">
            <tr>
              <th class="py-3 px-4 text-left font-medium text-gray-700 border-b">Skill</th>
              <th class="py-3 px-4 text-left font-medium text-gray-700 border-b">Course</th>
            </tr>
          </thead>
          <tbody>
      `;
      
      for (let i = 1; i < rows.length; i++) {
        const cells = rows[i]
          .split('|')
          .map(cell => cell.trim())
          .filter(cell => cell);
        
        if (cells.length >= 2) {
          tableHtml += `
            <tr class="${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}">
              <td class="py-3 px-4 border-b">${cleanText(cells[0])}</td>
              <td class="py-3 px-4 border-b">${cleanText(cells[1])}</td>
            </tr>
          `;
        }
      }
      
      tableHtml += `
          </tbody>
        </table>
      `;
      
      return tableHtml;
    };
    
    // Extract all sections
    const nameMatch = cleanedText.match(/(?:Personalized Career (?:Advice |Pathway )?Report)(?: for ([^*\n]+))?/i);
    const userName = nameMatch && nameMatch[1] ? cleanText(nameMatch[1]) : 'You';
    
    const sections = {
      summary: extractSection(cleanedText, 
        ['Summary:', '**Summary:**'], 
        ['Recommended Roles:', '**Recommended Roles:**']
      ),
      recommendedRoles: extractSection(cleanedText,
        ['Recommended Roles:', '**Recommended Roles:**'],
        ['Skills and Matching Courses:', '**Skills and Matching Courses:**']
      ),
      skills: extractSection(cleanedText,
        ['Skills and Matching Courses:', '**Skills and Matching Courses:**'],
        ['Next-Step Career Recommendations:', '**Next-Step Career Recommendations:**']
      ),
      nextSteps: extractSection(cleanedText,
        ['Next-Step Career Recommendations:', '**Next-Step Career Recommendations:**'],
        ['Roles that Might be Right for You:', '**Roles that Might be Right for You:**']
      ),
      rightRoles: extractSection(cleanedText,
        ['Roles that Might be Right for You:', '**Roles that Might be Right for You:**'],
        ['Path to Your Aspirational Role:', '**Path to Your Aspirational Role:**']
      ),
      path: extractSection(cleanedText,
        ['Path to Your Aspirational Role:', '**Path to Your Aspirational Role:**'],
        ['Remote Work Considerations:', '**Remote Work Considerations:**', 'By following']
      ),
      remote: extractSection(cleanedText,
        ['Remote Work Considerations:', '**Remote Work Considerations:**'],
        ['By following']
      ),
      conclusion: extractSection(cleanedText,
        ['By following'],
        []
      )
    };

    // Return formatted HTML with all sections
    return `
      <div class="career-pathway-report bg-white rounded-lg shadow-lg p-6">
        <h1 class="text-2xl font-bold text-blue-600 mb-6">Personalized Career Pathway Report for ${userName}</h1>
        
        ${sections.summary ? `
        <section class="mb-8">
          <h2 class="text-xl font-semibold text-blue-700 mb-3">Summary</h2>
          <p class="text-gray-700 leading-relaxed">${cleanText(sections.summary)}</p>
        </section>
        ` : ''}
        
        ${sections.recommendedRoles ? `
        <section class="mb-8">
          <h2 class="text-xl font-semibold text-blue-700 mb-3">Recommended Roles</h2>
          <div class="space-y-2">
            ${parseRoles(sections.recommendedRoles)}
          </div>
        </section>
        ` : ''}
        
        ${sections.skills ? `
        <section class="mb-8">
          <h2 class="text-xl font-semibold text-blue-700 mb-3">Skills and Matching Courses</h2>
          <div class="overflow-x-auto">
            ${parseMarkdownTable(sections.skills)}
          </div>
        </section>
        ` : ''}
        
        ${sections.nextSteps ? `
        <section class="mb-8">
          <h2 class="text-xl font-semibold text-blue-700 mb-3">Next-Step Career Recommendations</h2>
          <div class="space-y-2">
            ${parseNumberedList(sections.nextSteps)}
          </div>
        </section>
        ` : ''}
        
        ${sections.rightRoles ? `
        <section class="mb-8">
          <h2 class="text-xl font-semibold text-blue-700 mb-3">Roles that Might be Right for You</h2>
          <div class="space-y-2">
            ${parseNumberedList(sections.rightRoles)}
          </div>
        </section>
        ` : ''}
        
        ${sections.path ? `
        <section class="mb-8">
          <h2 class="text-xl font-semibold text-blue-700 mb-3">Path to Your Aspirational Role</h2>
          <div class="space-y-2">
            ${parseNumberedList(sections.path)}
          </div>
        </section>
        ` : ''}
        
        ${sections.remote ? `
        <section class="mb-8">
          <h2 class="text-xl font-semibold text-blue-700 mb-3">Remote Work Considerations</h2>
          <p class="text-gray-700 leading-relaxed">${cleanText(sections.remote)}</p>
        </section>
        ` : ''}
        
        ${sections.conclusion ? `
        <section class="mt-8 p-6 bg-blue-50 border-l-4 border-blue-500 rounded-r-md">
          <p class="text-gray-700 italic">${cleanText(sections.conclusion)}</p>
        </section>
        ` : ''}
      </div>
    `;
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
// import React from 'react';
// import { motion } from 'framer-motion';
// import { useNavigate } from 'react-router-dom';
// import { ChevronLeft, ChevronRight, FileText } from 'lucide-react';
// import AppLayout from '@/components/layout/AppLayout';
// import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
// import { Button } from '@/components/ui/button';
// import { useCareerPathwayResults } from '@/hooks/useCareerPathwayResults';
// import { Skeleton } from '@/components/ui/skeleton';
// import { usePageVisibility } from '@/contexts/PageVisibilityContext';

// const CareerPathway: React.FC = () => {
//   const navigate = useNavigate();
//   const { data: report, isLoading, error } = useCareerPathwayResults();
//   const { isPageVisible } = usePageVisibility();
  
//   // Check if the page is visible
//   const pageIsVisible = isPageVisible('/career-pathway');

//   // If page is not visible, render nothing or a coming soon message
//   if (!pageIsVisible && !error) {
//     return (
//       <AppLayout>
//         <div className="container mx-auto py-6 px-4">
//           <Card className="text-center p-6">
//             <CardTitle className="mb-4">Coming Soon</CardTitle>
//             <p className="text-muted-foreground mb-6">
//               This feature is currently under development.
//             </p>
//           </Card>
//         </div>
//       </AppLayout>
//     );
//   }

//   if (error) {
//     return (
//       <AppLayout>
//         <div className="container mx-auto py-6 px-4">
//           <Card className="text-center p-6">
//             <CardTitle className="mb-4">No Career Report Found</CardTitle>
//             <p className="text-muted-foreground mb-6">
//               Please complete the career pathway chat to generate your personalized report.
//             </p>
//             <Button onClick={() => navigate('/career-agent')}>
//               Take Career Assessment
//             </Button>
//           </Card>
//         </div>
//       </AppLayout>
//     );
//   }

//   return (
//     <AppLayout>
//       <div className="container mx-auto py-6 space-y-8 px-4">
//         <motion.div
//           initial={{ opacity: 0, y: 20 }}
//           animate={{ opacity: 1, y: 0 }}
//           transition={{ duration: 0.5 }}
//         >
//           <Card className="bg-gradient-to-r from-blue-50 to-purple-50">
//             <CardContent className="py-10">
//               <div className="flex flex-col items-center text-center space-y-4 max-w-2xl mx-auto">
//                 <div className="h-20 w-20 rounded-full bg-blue-100 flex items-center justify-center">
//                   <FileText className="h-10 w-10 text-blue-600" />
//                 </div>
//                 <h1 className="text-3xl font-bold">Hey {report?.userName || 'there'}, here are your career insights</h1>
//                 <p className="text-muted-foreground">
//                   {report?.summary || 'Begin a journey of self-discovery to align your professional goals with your personal strengths and interests.'}
//                 </p>
//               </div>
//             </CardContent>
//           </Card>
//         </motion.div>

//         {/* Skills Section */}
//         <motion.div
//           initial={{ opacity: 0, x: -20 }}
//           animate={{ opacity: 1, x: 0 }}
//           transition={{ delay: 0.2 }}
//         >
//           <Card>
//             <CardHeader>
//               <CardTitle>Recommended Skills</CardTitle>
//               <p className="text-sm text-muted-foreground">
//                 These recommendations are based on current market trends and the requirements of your desired roles.
//               </p>
//             </CardHeader>
//             <CardContent>
//               <div className="grid gap-4">
//                 {isLoading ? (
//                   <SkillsSkeleton />
//                 ) : (
//                   report?.skillsAndCourses.map((skill, index) => (
//                     <motion.div
//                       key={skill.skill}
//                       initial={{ opacity: 0, x: -20 }}
//                       animate={{ opacity: 1, x: 0 }}
//                       transition={{ delay: index * 0.1 }}
//                       className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg"
//                     >
//                       <div className="flex items-center gap-3">
//                         <div className="bg-white p-2 rounded">
//                           📚
//                         </div>
//                         <div>
//                           <h3 className="font-medium">{skill.skill}</h3>
//                           <span className="text-xs text-muted-foreground">{skill.level}</span>
//                         </div>
//                       </div>
//                       <p className="text-sm text-muted-foreground">{skill.course}</p>
//                     </motion.div>
//                   ))
//                 )}
//               </div>
//             </CardContent>
//           </Card>
//         </motion.div>

//         {/* Career Path Section */}
//         <motion.div
//           initial={{ opacity: 0, x: 20 }}
//           animate={{ opacity: 1, x: 0 }}
//           transition={{ delay: 0.4 }}
//         >
//           <Card>
//             <CardHeader>
//               <CardTitle>Path to Your Aspirational Role</CardTitle>
//               <p className="text-sm text-muted-foreground">
//                 A clear path to your dream role—with a simple, step-by-step plan.
//               </p>
//             </CardHeader>
//             <CardContent>
//               <div className="relative">
//                 <div className="overflow-hidden">
//                   {isLoading ? (
//                     <CareerPathSkeleton />
//                   ) : (
//                     <div className="space-y-4">
//                       {report?.careerPathSteps.map((step, index) => (
//                         <motion.div
//                           key={index}
//                           initial={{ opacity: 0 }}
//                           animate={{ opacity: 1 }}
//                           transition={{ delay: index * 0.2 }}
//                           className="flex items-center justify-between p-4 bg-muted/50 rounded-lg"
//                         >
//                           <div>
//                             <h3 className="font-medium">{step.title}</h3>
//                             <p className="text-sm text-muted-foreground mt-1">{step.description}</p>
//                           </div>
//                         </motion.div>
//                       ))}
//                     </div>
//                   )}
//                 </div>
//                 <div className="flex justify-end gap-2 mt-4">
//                   <Button variant="outline" size="icon">
//                     <ChevronLeft className="h-4 w-4" />
//                   </Button>
//                   <Button variant="outline" size="icon">
//                     <ChevronRight className="h-4 w-4" />
//                   </Button>
//                 </div>
//               </div>
//             </CardContent>
//           </Card>
//         </motion.div>
//       </div>
//     </AppLayout>
//   );
// };

// const SkillsSkeleton = () => (
//   <>
//     {[1, 2, 3].map((i) => (
//       <div key={i} className="p-4 bg-muted/50 rounded-lg">
//         <Skeleton className="h-6 w-32 mb-2" />
//         <Skeleton className="h-4 w-48" />
//       </div>
//     ))}
//   </>
// );

// const CareerPathSkeleton = () => (
//   <>
//     {[1, 2, 3].map((i) => (
//       <div key={i} className="p-4 bg-muted/50 rounded-lg">
//         <Skeleton className="h-6 w-48 mb-2" />
//         <Skeleton className="h-4 w-full" />
//       </div>
//     ))}
//   </>
// );

// export default CareerPathway;
