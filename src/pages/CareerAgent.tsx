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
    setCareerAdviceReport(resultText);

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