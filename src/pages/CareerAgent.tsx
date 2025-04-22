import { supabase } from '@/integrations/supabase/client';
import {  pathwayQuestions,   quickReplies,   starterMessages,   careerAdvicePrompt,   LOCAL_STORAGE_KEY} from '@/data/careerPathwayData';
import { useAuth } from '@/contexts/AuthContext';

// Updated function for saving answer to database
const saveAnswerToDatabase = async (questionId: string, answer: string) => {
  if (sessionId && user) {
    try {
      await supabase.from("career_pathway_answers").insert({
        user_id: user.id,
        session_id: sessionId,
        question: questionId,
        answer: answer,
      });
    } catch (error) {
      console.error("Error saving pathway answer:", error);
    }
  }
};

// Format the career pathway report to improve readability and structure
const formatCareerPathwayReport = (rawReport: string): string => {
  try {
    // First check if the report already contains HTML formatting
    if (rawReport.includes('<h') || rawReport.includes('<div') || rawReport.includes('<p>')) {
      return rawReport; // Already formatted with HTML
    }

    // Extract sections using regex for common section patterns
    const nameMatch = rawReport.match(/\*\*Personalized Career Advice Report for (.*?)\*\*/);
    const userName = nameMatch ? nameMatch[1] : "You";

    const sections = {
      summary: extractSection(rawReport, "Summary:", ["Recommended Roles:", "Skills and Matching Courses:"]),
      recommendedRoles: extractSection(rawReport, "Recommended Roles:", ["Skills and Matching Courses:"]),
      skills: extractSection(rawReport, "Skills and Matching Courses:", ["Next-Step Career Recommendations:"]),
      nextSteps: extractSection(rawReport, "Next-Step Career Recommendations:", ["Roles that Might be Right for You:"]),
      rightRoles: extractSection(rawReport, "Roles that Might be Right for You:", ["Path to Your Aspirational Role:"]),
      path: extractSection(rawReport, "Path to Your Aspirational Role:", ["Remote Work Considerations:", "By following"]),
      remote: extractSection(rawReport, "Remote Work Considerations:", ["By following"]),
      conclusion: rawReport.includes("By following") ? 
        rawReport.substring(rawReport.indexOf("By following")) : ""
    };

    // Parse skills table if it exists
    let skillsTable = '';
    if (sections.skills) {
      const tableMatch = sections.skills.match(/\| Skill \| Course \|[\s\S]*?(?=\*\*|$)/);
      if (tableMatch) {
        skillsTable = tableMatch[0];
      }
    }

    // Format the report with improved HTML
    return `
<div class="career-pathway-report">
  <h1 class="text-xl font-bold text-amber-600 mb-4">Personalized Career Pathway Report for ${userName}</h1>
  
  <section class="mb-6">
    <h2 class="text-lg font-semibold text-amber-700 mb-2">Summary</h2>
    <p class="mb-2">${cleanText(sections.summary)}</p>
  </section>
  
  <section class="mb-6">
    <h2 class="text-lg font-semibold text-amber-700 mb-2">Recommended Roles</h2>
    <div class="pl-4">
      ${formatNumberedList(sections.recommendedRoles)}
    </div>
  </section>
  
  <section class="mb-6">
    <h2 class="text-lg font-semibold text-amber-700 mb-2">Skills and Matching Courses</h2>
    <div class="overflow-x-auto">
      <table class="min-w-full border-collapse">
        <thead>
          <tr class="bg-amber-100">
            <th class="border border-amber-300 px-4 py-2 text-left">Skill</th>
            <th class="border border-amber-300 px-4 py-2 text-left">Course</th>
          </tr>
        </thead>
        <tbody>
          ${formatSkillsTable(skillsTable)}
        </tbody>
      </table>
    </div>
  </section>
  
  <section class="mb-6">
    <h2 class="text-lg font-semibold text-amber-700 mb-2">Next-Step Career Recommendations</h2>
    <div class="pl-4">
      ${formatNumberedList(sections.nextSteps)}
    </div>
  </section>
  
  <section class="mb-6">
    <h2 class="text-lg font-semibold text-amber-700 mb-2">Roles that Might be Right for You</h2>
    <div class="pl-4">
      ${formatNumberedList(sections.rightRoles)}
    </div>
  </section>
  
  <section class="mb-6">
    <h2 class="text-lg font-semibold text-amber-700 mb-2">Path to Your Aspirational Role</h2>
    <div class="pl-4">
      ${formatNumberedList(sections.path)}
    </div>
  </section>
  
  ${sections.remote ? `
  <section class="mb-6">
    <h2 class="text-lg font-semibold text-amber-700 mb-2">Remote Work Considerations</h2>
    <div class="pl-4">
      ${formatNumberedList(sections.remote)}
    </div>
  </section>
  ` : ''}
  
  <section class="mt-6 p-4 bg-amber-50 border-l-4 border-amber-500">
    <p class="italic">${cleanText(sections.conclusion)}</p>
  </section>
</div>
`;
  } catch (error) {
    console.error("Error formatting career pathway report:", error);
    return rawReport; // Return original if formatting fails
  }
};

// Helper function to extract sections from the raw text
function extractSection(text: string, sectionStart: string, possibleEnds: string[]): string {
  if (!text.includes(sectionStart)) return '';
  
  const startIdx = text.indexOf(sectionStart) + sectionStart.length;
  let endIdx = text.length;
  
  for (const endMarker of possibleEnds) {
    const idx = text.indexOf(endMarker, startIdx);
    if (idx !== -1 && idx < endIdx) {
      endIdx = idx;
    }
  }
  
  return text.substring(startIdx, endIdx).trim();
}

// Helper function to clean text
function cleanText(text: string): string {
  if (!text) return '';
  return text.replace(/\*\*/g, '').trim();
}

// Helper function to format numbered lists
function formatNumberedList(content: string): string {
  if (!content) return '';
  
  // Check if the content already has numbers (1., 2., etc.)
  const hasNumbers = /\d+\.\s/.test(content);
  
  if (hasNumbers) {
    // Split by numbered items
    const items = content.split(/\d+\.\s/).filter(item => item.trim());
    return items.map((item, index) => 
      `<div class="mb-2">
        <span class="inline-block bg-amber-200 text-amber-800 rounded-full w-6 h-6 text-center mr-2">${index + 1}</span>
        ${cleanText(item)}
      </div>`
    ).join('');
  } else {
    // Return as a paragraph if not a numbered list
    return `<p>${cleanText(content)}</p>`;
  }
}

// Helper function to format the skills table
function formatSkillsTable(tableText: string): string {
  if (!tableText) return '<tr><td colspan="2" class="border border-amber-300 px-4 py-2">No skills data available</td></tr>';
  
  // Split the table into rows
  const rows = tableText.split('\n')
    .filter(line => line.trim().startsWith('|'))
    .filter(line => !line.includes('---'));
    
  return rows.map(row => {
    const cells = row.split('|').filter(cell => cell.trim());
    if (cells.length >= 2) {
      return `<tr>
        <td class="border border-amber-300 px-4 py-2">${cells[0].trim()}</td>
        <td class="border border-amber-300 px-4 py-2">${cells[1].trim()}</td>
      </tr>`;
    }
    return '';
  }).join('');
}
// Handle report generation error with specific error message
const handleReportError = (errorMessage: string) => {
  setCareerAdviceReport('');
  
  // Format the error message for the UI
  let displayMessage = errorMessage;
  
  // Check for rate limit errors and format them better
  if (errorMessage.includes("Rate limit reached")) {
    const timeMatch = errorMessage.match(/Please try again in (\d+m\d+\.\d+s)/);
    if (timeMatch && timeMatch[1]) {
      const waitTime = timeMatch[1].replace(/\.\d+s/, ' seconds');
      displayMessage = `API rate limit reached. Please try again in ${waitTime}.`;
    }
  }
  
  const botMessage: Message = {
    id: `bot_error_${Date.now()}`,
    sender: "bot",
    text: `Error: ${displayMessage}`,
  };
  
  setMessages((prev) => [...prev, botMessage]);
};


// Updated generateCareerAdviceReport function
// const generateCareerAdviceReport = async (resumeText?: string) => {
//   // Start report generation
//   const botMessageLoading: Message = {
//     id: `bot_${Date.now()}`,
//     sender: "bot",
//     text: "Thank you for your answers! I'm working on your career pathway report now; it may take about 2 minutes to generate additional insights...",
//   };
//   setMessages((prev) => [...prev, botMessageLoading]);
  
//   if (!user) return;
  
//   // Format pathway answers for API
//   const pathwayAnswersPayload: Record<number, string> = {};
//   pathwayQuestions.forEach((q) => {
//     if (answers[q.id]) {
//       pathwayAnswersPayload[q.id] = answers[q.id];
//     }
//   });

//   const payload = {
//     prompt: careerAdvicePrompt,
//     PathwayQuestions: pathwayQuestions,
//     pathwayAnswers: pathwayAnswersPayload,
//     resumeText: resumeText || null,
//   };

//   try {
//     const { data, error } = await supabase.functions.invoke('evaluateCareerAdvice', {
//       method: 'POST',
//       body: JSON.stringify(payload),
//     });

//     if (error) {
//       console.error("Error invoking evaluateCareerAdvice:", error);
//       handleReportError("Failed to get career advice. Please try again later.");
//       return;
//     }

//     // const resultText = typeof data === "string" ? data : data.generatedText || JSON.stringify(data);
//     const resultText = `
// **Personalized Career Advice Report for Joshua B. Brown**

// **Summary:**
// Based on your quiz answers and resume, we've generated a comprehensive report to guide your career transition. You aim to leverage your analytical skills and experience in machine learning and AI to move into strategic roles that incorporate these areas, with a focus on private equity, social impact, or strategy at a director level. Your priorities include compensation, remote work, autonomy, and growth.

// **Recommended Roles:**

// 1. **Strategy Director - Private Equity**: Lead strategic planning and implementation for private equity investments, leveraging your analytical skills and experience in program management. Salary band: $150,000 - $250,000.
// 2. **Director of Impact Investing**: Oversee impact investing initiatives, combining your analytical expertise with a focus on social impact. Salary band: $120,000 - $200,000.
// 3. **Strategic Development Manager**: Drive strategic development and growth initiatives for organizations, utilizing your analytical and program management skills. Salary band: $100,000 - $180,000.

// **Skills and Matching Courses:**

// | Skill | Course |
// | --- | --- |
// | Strategic Planning | Coursera - Strategic Management Specialization |
// | Impact Investing | edX - Impact Investing Course |
// | Data Analysis | DataCamp - Data Analysis with Python Course |
// | Leadership | LinkedIn Learning - Leadership Course |

// **Next-Step Career Recommendations:**

// To achieve your aspirational role, focus on developing the following skills:

// 1. **Project Management**: Enhance your project management skills to overcome your identified weakness. Consider obtaining your PMP certification.
// 2. **Communication and Documentation**: Improve your documentation and communication skills to effectively convey strategic plans and results.
// 3. **Leadership and Team Management**: Develop your leadership skills to lead strategic teams and drive growth initiatives.

// **Roles that Might be Right for You:**

// 1. **Program Director**: Oversee programs and drive strategic initiatives in industries like private equity, social impact, or strategy.
// 2. **Strategy Consultant**: Provide strategic guidance to organizations, leveraging your analytical expertise and experience in program management.
// 3. **Impact Investing Manager**: Lead impact investing initiatives, combining your analytical skills with a focus on social impact.

// **Path to Your Aspirational Role:**

// 1. **Short-term (6-12 months)**: Develop your project management and communication skills. Network with professionals in your desired field and explore relevant courses.
// 2. **Mid-term (1-2 years)**: Take on leadership roles in program management or strategic development. Continue to build your skills and expertise.
// 3. **Long-term (2-5 years)**: Pursue director-level positions in private equity, social impact, or strategy, leveraging your analytical expertise and leadership skills.

// **Remote Work Considerations:**
// Given your preference for remote work, focus on developing skills that are transferable to remote environments, such as:

// 1. **Digital communication and collaboration tools**: Familiarize yourself with tools like Slack, Asana, or Trello.
// 2. **Virtual leadership and team management**: Develop skills to effectively lead and manage teams remotely.

// By following this personalized career advice report, you'll be well on your way to achieving your career aspirations and transitioning into a role that aligns with your skills, experience, and priorities.`
//     console.log(resultText)

//     // Format the report to improve readability and structure
//     const formattedReport = formatCareerPathwayReport(resultText);
    
//     // setCareerAdviceReport(resultText);
//     setCareerAdviceReport(formattedReport);

//     // Save the report to the database
//     try {
//       await supabase.from("career_pathway_results").insert({
//         user_id: user.id,
//         session_id: sessionId,
//         report: resultText
//       });
//     } catch (saveError) {
//       console.error("Error saving career pathway report:", saveError);
//       // Continue even if saving fails - we don't want to block the user experience
//     }

//     const botMessageReport: Message = {
//       id: `bot_report_${Date.now()}`,
//       sender: "bot",
//       text: resultText,
//     };

//     setMessages((prev) => [...prev, botMessageReport]);
//   } catch (e) {
//     console.error("Error during career advice evaluation:", e);
//     handleReportError("Failed to get career advice. Please try again later.");
//   }
// };
// Updated generateCareerAdviceReport function
const generateCareerAdviceReport = async (resumeText?: string) => {
  // Start report generation
  const botMessageLoading: Message = {
    id: `bot_${Date.now()}`,
    sender: "bot",
    text: "Thank you for your answers! I'm working on your career pathway report now; it may take about 2 minutes to generate additional insights...",
  };
  setMessages((prev) => [...prev, botMessageLoading]);
  
  if (!user) return;
  
  // Format pathway answers for API
  const pathwayAnswersPayload: Record<number, string> = {};
  pathwayQuestions.forEach((q) => {
    if (answers[q.id]) {
      pathwayAnswersPayload[q.id] = answers[q.id];
    }
  });

  const payload = {
    prompt: careerAdvicePrompt,
    PathwayQuestions: pathwayQuestions,
    pathwayAnswers: pathwayAnswersPayload,
    resumeText: resumeText || null,
  };

  try {
    const { data, error } = await supabase.functions.invoke('evaluateCareerAdvice', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (error) {
      console.error("Error invoking evaluateCareerAdvice:", error);
      // Show the actual error message in the chat
      const errorMsg = error.message || "Failed to get career advice. Please try again later.";
      handleReportError(errorMsg);
      return;
    }

    const resultText = typeof data === "string" ? data : data.generatedText || JSON.stringify(data);

    // Format the report to improve readability and structure
    const formattedReport = formatCareerPathwayReport(resultText);
    
    // Set the formatted report to display below the chat
    setCareerAdviceReport(formattedReport);

    // Save the report to the database
    try {
      await supabase.from("career_pathway_results").insert({
        user_id: user.id,
        session_id: sessionId,
        report: resultText
      });
    } catch (saveError) {
      console.error("Error saving career pathway report:", saveError);
      // Continue even if saving fails - we don't want to block the user experience
    }

    // Only show a notification message in the chat, not the full report
    const botMessageReport: Message = {
      id: `bot_report_${Date.now()}`,
      sender: "bot",
      text: "Your personalized career pathway report is ready! I've prepared it below based on your answers and resume.",
    };

    setMessages((prev) => [...prev, botMessageReport]);
  } catch (e) {
    console.error("Error during career advice evaluation:", e);
    // Show the specific error message
    const errorMsg = e instanceof Error ? e.message : "Failed to get career advice. Please try again later.";
    handleReportError(errorMsg);
  }
};
// {careerAdviceReport && (
//   <div 
//     className="career-advice-report p-4 mt-4 rounded-md bg-amber-50 border border-amber-200 max-w-full text-gray-900 text-sm shadow-md"
//     dangerouslySetInnerHTML={{ __html: careerAdviceReport }}
//   />
// )}

const reportRef = useRef<HTMLDivElement>(null);

// Add this useEffect hook somewhere in your component
useEffect(() => {
  if (careerAdviceReport && reportRef.current) {
    setTimeout(() => {
      reportRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 500);
  }
}, [careerAdviceReport]);

// Then update your JSX to include the ref
// {careerAdviceReport && (
//   <div 
//     ref={reportRef}
//     className="career-advice-report p-4 mt-4 rounded-md bg-amber-50 border border-amber-200 max-w-full text-gray-900 text-sm shadow-md"
//     dangerouslySetInnerHTML={{ __html: careerAdviceReport }}
//   />
// )}
<style jsx>{`
  @keyframes slideInUp {
    from {
      transform: translateY(20px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }
  
  .career-advice-report {
    animation: slideInUp 0.5s ease-out forwards;
  }
`}</style>
{careerAdviceReport && (
  <div 
    ref={reportRef}
    className="career-advice-report p-6 mt-6 rounded-lg bg-white border border-amber-300 max-w-full text-gray-900 text-sm shadow-lg hover:shadow-xl transition-shadow duration-300"
    dangerouslySetInnerHTML={{ __html: careerAdviceReport }}
  />
)}
export default CareerAgent;