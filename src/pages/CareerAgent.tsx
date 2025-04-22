import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import {
  pathwayQuestions,
  quickReplies,
  starterMessages,
  careerAdvicePrompt,
  LOCAL_STORAGE_KEY
} from '@/data/careerPathwayData';

interface Message {
  id: string;
  sender: 'user' | 'bot';
  text: string;
}

const CareerAgent: React.FC = () => {
  // Authentication hook
  const { user, isAuthenticated } = useAuth();

  // Session and state
  const [sessionId, setSessionId] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [careerAdviceReport, setCareerAdviceReport] = useState<string>('');
  const reportRef = useRef<HTMLDivElement>(null);

  // Initialize or retrieve session ID
  useEffect(() => {
    let sid = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!sid) {
      sid = Date.now().toString();
      localStorage.setItem(LOCAL_STORAGE_KEY, sid);
    }
    setSessionId(sid);
  }, []);

  // Scroll to report when it's generated
  useEffect(() => {
    if (careerAdviceReport && reportRef.current) {
      setTimeout(() => {
        reportRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 500);
    }
  }, [careerAdviceReport]);

  // Guard: require authentication
  if (!isAuthenticated) {
    return <div>Please log in to access your career agent.</div>;
  }

  // Save individual answer to database
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

  // Generate career advice report
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

  // Render the component
  return (
    <AppLayout>
      <div className="career-agent-container">
        {/* Chat interface would go here */}
        
        {/* Career Report Section */}
        {careerAdviceReport && (
          <>
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
            <div 
              ref={reportRef}
              className="career-advice-report p-6 mt-6 rounded-lg bg-white border border-amber-300 max-w-full text-gray-900 text-sm shadow-lg hover:shadow-xl transition-shadow duration-300"
              dangerouslySetInnerHTML={{ __html: careerAdviceReport }}
            />
          </>
        )}
      </div>
    </AppLayout>
  );
};


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

    // const resultText = typeof data === "string" ? data : data.generatedText || JSON.stringify(data);
        const resultText = `
**Personalized Career Advice Report for Joshua B. Brown**

**Summary:**
Based on your quiz answers and resume, we've generated a comprehensive report to guide your career transition. You aim to leverage your analytical skills and experience in machine learning and AI to move into strategic roles that incorporate these areas, with a focus on private equity, social impact, or strategy at a director level. Your priorities include compensation, remote work, autonomy, and growth.

**Recommended Roles:**

1. **Strategy Director - Private Equity**: Lead strategic planning and implementation for private equity investments, leveraging your analytical skills and experience in program management. Salary band: $150,000 - $250,000.
2. **Director of Impact Investing**: Oversee impact investing initiatives, combining your analytical expertise with a focus on social impact. Salary band: $120,000 - $200,000.
3. **Strategic Development Manager**: Drive strategic development and growth initiatives for organizations, utilizing your analytical and program management skills. Salary band: $100,000 - $180,000.

**Skills and Matching Courses:**

| Skill | Course |
| --- | --- |
| Strategic Planning | Coursera - Strategic Management Specialization |
| Impact Investing | edX - Impact Investing Course |
| Data Analysis | DataCamp - Data Analysis with Python Course |
| Leadership | LinkedIn Learning - Leadership Course |

**Next-Step Career Recommendations:**

To achieve your aspirational role, focus on developing the following skills:

1. **Project Management**: Enhance your project management skills to overcome your identified weakness. Consider obtaining your PMP certification.
2. **Communication and Documentation**: Improve your documentation and communication skills to effectively convey strategic plans and results.
3. **Leadership and Team Management**: Develop your leadership skills to lead strategic teams and drive growth initiatives.

**Roles that Might be Right for You:**

1. **Program Director**: Oversee programs and drive strategic initiatives in industries like private equity, social impact, or strategy.
2. **Strategy Consultant**: Provide strategic guidance to organizations, leveraging your analytical expertise and experience in program management.
3. **Impact Investing Manager**: Lead impact investing initiatives, combining your analytical skills with a focus on social impact.

**Path to Your Aspirational Role:**

1. **Short-term (6-12 months)**: Develop your project management and communication skills. Network with professionals in your desired field and explore relevant courses.
2. **Mid-term (1-2 years)**: Take on leadership roles in program management or strategic development. Continue to build your skills and expertise.
3. **Long-term (2-5 years)**: Pursue director-level positions in private equity, social impact, or strategy, leveraging your analytical expertise and leadership skills.

**Remote Work Considerations:**
Given your preference for remote work, focus on developing skills that are transferable to remote environments, such as:

1. **Digital communication and collaboration tools**: Familiarize yourself with tools like Slack, Asana, or Trello.
2. **Virtual leadership and team management**: Develop skills to effectively lead and manage teams remotely.

By following this personalized career advice report, you'll be well on your way to achieving your career aspirations and transitioning into a role that aligns with your skills, experience, and priorities.`
    console.log(resultText)


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

const CareerAgent = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [answers, setAnswers] = useState<{ [key: string]: string }>({});
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [careerAdviceReport, setCareerAdviceReport] = useState<string>('');
  const { user } = useUser();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [resumeText, setResumeText] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    const storedChat = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (storedChat) {
      const parsedChat = JSON.parse(storedChat);
      setMessages(parsedChat.messages || []);
      setAnswers(parsedChat.answers || {});
      setSessionId(parsedChat.sessionId || null);
      setCurrentQuestionIndex(parsedChat.currentQuestionIndex || 0);
    } else {
      // Start a new session if no chat history is found
      startNewSession();
    }
  }, []);

  useEffect(() => {
    // Save chat to local storage whenever messages or answers change
    localStorage.setItem(
      LOCAL_STORAGE_KEY,
      JSON.stringify({ messages, answers, sessionId, currentQuestionIndex })
    );
  }, [messages, answers, sessionId, currentQuestionIndex]);

  const startNewSession = async () => {
    const newSessionId = generateSessionId();
    setSessionId(newSessionId);

    // Initialize the chat with starter messages
    const initialMessages = starterMessages.map((text, index) => ({
      id: `bot_init_${index}`,
      sender: "bot",
      text: text,
    }));
    setMessages(initialMessages);
  };

  const generateSessionId = () => {
    return Math.random().toString(36).substring(2, 15);
  };

  const handleQuickReply = (reply: string) => {
    handleUserMessage(reply);
  };

  const handleUserMessage = async (text: string) => {
    const userMessage: Message = {
      id: `user_${Date.now()}`,
      sender: "user",
      text: text,
    };
    setMessages((prev) => [...prev, userMessage]);

    // Save the answer to the state
    const currentQuestionId = pathwayQuestions[currentQuestionIndex].id;
    setAnswers((prevAnswers) => ({
      ...prevAnswers,
      [currentQuestionId]: text,
    }));

    // Save the answer to the database
    await saveAnswerToDatabase(currentQuestionId, text);

    // Move to the next question or generate the report
    if (currentQuestionIndex < pathwayQuestions.length - 1) {
      setCurrentQuestionIndex((prevIndex) => prevIndex + 1);
    } else {
      // All questions answered, generate the career advice report
      generateCareerAdviceReport(resumeText);
    }
  };

  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const text = e.target?.result as string;
        setResumeText(text);
        // Optionally, generate the report immediately after upload
        // generateCareerAdviceReport(text);
      };
      reader.readAsText(file);
    } catch (error) {
      console.error("Error reading file:", error);
    } finally {
      setIsUploading(false);
    }
  };

  const currentQuestion = pathwayQuestions[currentQuestionIndex];

  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (careerAdviceReport && reportRef.current) {
      setTimeout(() => {
        reportRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 500);
    }
  }, [careerAdviceReport]);

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-gray-900">Career Agent</h1>
          <p className="mt-1 text-sm text-gray-500">
            Let's explore your career pathway.
          </p>
        </div>
      </header>

      <main className="flex-grow overflow-auto p-4">
        <div className="max-w-3xl mx-auto">
          {/* Chat Messages */}
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`chat-message ${message.sender === "user" ? "user-message" : "bot-message"
                  }`}
              >
                <div
                  className={`px-4 py-2 rounded-lg ${message.sender === "user"
                      ? "bg-blue-500 text-white ml-auto"
                      : "bg-gray-200 text-gray-800 mr-auto"
                    }`}
                >
                  {message.text}
                </div>
              </div>
            ))}
          </div>

          {/* Upload Resume Section */}
          {currentQuestionIndex === 0 && (
            <div className="mt-6 p-4 bg-white rounded-lg shadow-md">
              <h2 className="text-lg font-semibold text-gray-700 mb-3">
                Upload Your Resume (Optional)
              </h2>
              <input
                type="file"
                accept=".pdf,.doc,.docx,.txt"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleFileUpload(e.target.files[0]);
                  }
                }}
                className="mb-3"
              />
              {isUploading && <p>Uploading...</p>}
              {resumeText && (
                <p className="text-sm text-gray-500">
                  Resume uploaded. Analyzing...
                </p>
              )}
            </div>
          )}

          {/* Question and Input Section */}
          {currentQuestion && (
            <div className="mt-6 p-4 bg-white rounded-lg shadow-md">
              <h2 className="text-lg font-semibold text-gray-700 mb-3">
                {currentQuestion.label}
              </h2>
              <input
                type="text"
                placeholder={currentQuestion.placeholder}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleUserMessage(e.target.value);
                    (e.target as HTMLInputElement).value = ""; // Clear the input after sending
                  }
                }}
                className="w-full p-2 border rounded-md text-gray-700 focus:ring-blue-500 focus:border-blue-500"
              />

              {/* Quick Replies */}
              {currentQuestionIndex === 0 && (
                <div className="mt-4">
                  {quickReplies.map((reply, index) => (
                    <button
                      key={index}
                      onClick={() => handleQuickReply(reply)}
                      className="bg-blue-100 hover:bg-blue-200 text-blue-800 font-medium py-2 px-4 rounded-full mr-2 mb-2"
                    >
                      {reply}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
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
    </div>
  );
};


export default CareerAgent;