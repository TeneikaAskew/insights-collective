// Changes to import statements at the top of CareerAgent.tsx
import {
  pathwayQuestions, 
  quickReplies, 
  starterMessages, 
  careerAdvicePrompt, 
  LOCAL_STORAGE_KEY
} from '@/data/careerPathwayData';

// Replace any references to assessmentQuestions with pathwayQuestions
// Replace any references to quizAnswers with pathwayAnswers
// Replace any references to "career_assessments" with "career_pathway_answers"

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
      handleReportError("Failed to get career advice. Please try again later.");
      return;
    }

    const resultText = typeof data === "string" ? data : data.generatedText || JSON.stringify(data);

    // Format the report to improve readability and structure
    const formattedReport = formatCareerPathwayReport(resultText);
    
    // setCareerAdviceReport(resultText);
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

    const botMessageReport: Message = {
      id: `bot_report_${Date.now()}`,
      sender: "bot",
      text: resultText,
    };

    setMessages((prev) => [...prev, botMessageReport]);
  } catch (e) {
    console.error("Error during career advice evaluation:", e);
    handleReportError("Failed to get career advice. Please try again later.");
  }
};