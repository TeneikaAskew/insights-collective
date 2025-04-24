import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useResume } from '@/hooks/resume/useResume';
import { useToast } from '@/hooks/use-toast';
import {
  pathwayQuestions,
  quickReplies,
  starterMessages,
  careerAdvicePrompt
} from '@/data/careerPathwayData';

interface Message {
  id: string;
  sender: 'user' | 'bot';
  text: string;
}

const CareerAgent: React.FC = () => {
  // Hooks
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const { 
    resume, 
    loading: resumeLoading, 
    uploading: resumeUploading,
    uploadResume
  } = useResume();

  // State variables
  const [sessionId, setSessionId] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [careerAdviceReport, setCareerAdviceReport] = useState<string>('');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [reactingMessageId, setReactingMessageId] = useState<string | null>(null);
  const [showQuickReplies, setShowQuickReplies] = useState<boolean>(false);
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [inputValue, setInputValue] = useState<string>('');
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumePromptShown, setResumePromptShown] = useState<boolean>(false);
  const [resumeUseConfirmed, setResumeUseConfirmed] = useState<boolean | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Use proper coach avatar URL
  const coachAvatarUrl = "https://wp-aberdeen.s3.amazonaws.com/wp-content/uploads/2019/12/10043240/GettyImages-1017199998-e1654696271733.jpg";

  // Initialize conversation
  const initializeConversation = () => {
    setMessages(starterMessages.map((text, index) => ({
      id: `bot_starter_${index}`,
      sender: "bot",
      text,
    })));
    setShowQuickReplies(true);
    setCurrentQuestionIndex(0);
  };

  // Initialize session ID and conversation
  useEffect(() => {
    const sid = Date.now().toString();
    setSessionId(sid);
    initializeConversation();
  }, []);

  // No localStorage saving - all data saved to database

  // Scroll to bottom when messages change
  useEffect(() => {
    const scrollToBottom = () => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };
    
    // Delay to ensure new message is rendered
    const timeoutId = setTimeout(scrollToBottom, 100);
    
    return () => clearTimeout(timeoutId);
  }, [messages, isTyping]);

  // Scroll to report when ready
  useEffect(() => {
    if (careerAdviceReport && reportRef.current) {
      setTimeout(() => reportRef.current?.scrollIntoView({ behavior: 'smooth' }), 500);
    }
  }, [careerAdviceReport]);

  // Guard: require authentication
  if (!isAuthenticated) {
    return (
      <AppLayout>
        <div className="container mx-auto max-w-3xl p-6 flex flex-col min-h-screen justify-center items-center">
          <p className="text-lg text-center text-muted-foreground">
            Please log in to access Building Your Career Roadmap.
          </p>
        </div>
      </AppLayout>
    );
  }

  // Save answer to database
  const saveAnswerToDatabase = async (questionId: string, answer: string) => {
    console.log('Payload being sent to Supabase:', {
      user_id: user.id,
      session_id: sessionId,
      question: questionId,
      answer: answer
    });


    
    if (user && sessionId) {
      try {
        await supabase.from('career_pathway_answers').insert({
          user_id: user.id,
          session_id: sessionId,
          question: questionId,
          answer,
        });
      } catch (err) {
        console.error('Error saving answer:', err);
        toast({
          title: 'Error',
          description: 'Failed to save your answer. Please try again.',
          variant: 'destructive'
        });
      }
    }
  };

  // Helpers for report formatting
  const extractSection = (text: string, start: string, ends: string[]): string => {
    const i = text.indexOf(start);
    if (i === -1) return '';
    let endIdx = text.length;
    for (const marker of ends) {
      const idx = text.indexOf(marker, i + start.length);
      if (idx !== -1 && idx < endIdx) endIdx = idx;
    }
    return text.substring(i + start.length, endIdx).trim();
  };

  const cleanText = (text: string): string => text.replace(/\*\*/g, '').trim();

  const formatNumberedList = (content: string): string => {
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

  const formatSkillsTable = (tableText: string): string => {
    if (!tableText) return '<tr><td colspan="2" class="border border-blue-300 px-4 py-2">No skills data available</td></tr>';
    
    const rows = tableText.split('\n')
      .filter(r => r.startsWith('|') && !r.includes('---'));
      
    return rows.map(row => {
      const cells = row.split('|').filter(c => c.trim());
      return cells.length >= 2
        ? `<tr>
          <td class="border border-blue-300 px-4 py-2">${cells[0].trim()}</td>
          <td class="border border-blue-300 px-4 py-2">${cells[1].trim()}</td>
        </tr>`
        : '';
    }).join('');
  };

  const formatCareerPathwayReport = (raw: string): string => {
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
      const m = sections.skills.match(/\| Skill \| Course \|[\s\S]*?(?=\*\*|$)/);
      skillsTable = m?.[0] || '';
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
  };

  const handleReportError = (msg: string) => {
    // Format rate limit error messages
    let displayMessage = msg;
    if (msg.includes("Rate limit reached")) {
      const timeMatch = msg.match(/Please try again in (\d+m\d+\.\d+s)/);
      if (timeMatch && timeMatch[1]) {
        const waitTime = timeMatch[1].replace(/\.\d+s/, ' seconds');
        displayMessage = `API rate limit reached. Please try again in ${waitTime}.`;
      }
    }
    
    setMessages(prev => [...prev, { 
      id: `bot_error_${Date.now()}`, 
      sender: 'bot', 
      text: `Error: ${displayMessage}`
    }]);
  };

  // Generate career report

const generateCareerAdviceReport = async (resumeText?: string) => {
    setMessages(prev => [...prev, { 
      id: `bot_${Date.now()}`, 
      sender: 'bot', 
      text: "Thank you for your answers! I'm working on your career pathway report now; it may take about 2 minutes to generate additional insights..."
    }]);
    
    if (!user) return;
    
    // Format answers for API - ensure proper structure
    const pathwayAnswersPayload: Record<string, string> = {};
    pathwayQuestions.forEach((q) => {
      if (answers[q.id]) {
        pathwayAnswersPayload[q.id] = answers[q.id];
      }
    });

    // Ensure payload is properly formatted
    const payload = { 
      prompt: careerAdvicePrompt || '', 
      pathwayQuestions: pathwayQuestions || [], 
      pathwayAnswers: pathwayAnswersPayload || {}, 
      resumeText: resumeText || '' 
    };
    
    console.log('Sending payload:', JSON.stringify(payload, null, 2));
    
    try {
      const { data, error } = await supabase.functions.invoke('evaluateCareerAdvice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      if (error) throw error;
      
      const raw = typeof data === 'string' ? data : data.generatedText || data.message || JSON.stringify(data);
      console.log("Career Pathway Insights: ", raw);
      const html = formatCareerPathwayReport(raw);
      setCareerAdviceReport(html);
      
      // Save report to database
      try {
        await supabase.from("career_pathway_results").insert({
          user_id: user.id,
          session_id: sessionId,
          report: raw
        });
      } catch (saveError) {
        console.error("Error saving career pathway report:", saveError);
      }
      
      setMessages(prev => [...prev, { 
        id: `bot_done_${Date.now()}`, 
        sender: 'bot', 
        text: "Your personalized career pathway report is ready! I've prepared it below based on your answers and resume."
      }]);
    } catch(e) { 
      console.error("Full error:", e);
      handleReportError(e instanceof Error ? e.message : 'Failed to get career advice'); 
    }
  };

  // const generateCareerAdviceReport = async (resumeText?: string) => {
  //   setMessages(prev => [...prev, { 
  //     id: `bot_${Date.now()}`, 
  //     sender: 'bot', 
  //     text: "Thank you for your answers! I'm working on your career pathway report now; it may take about 2 minutes to generate additional insights..."
  //   }]);
    
  //   if (!user) return;
    
  //   // Format answers for API - ensure proper structure
  //   const pathwayAnswersPayload: Record<string, string> = {};
  //   pathwayQuestions.forEach((q) => {
  //     if (answers[q.id]) {
  //       pathwayAnswersPayload[q.id] = answers[q.id];
  //     }
  //   });

  //   // Ensure payload is properly formatted
  //   const payload = { 
  //     prompt: careerAdvicePrompt || '', 
  //     pathwayQuestions: pathwayQuestions || [], 
  //     pathwayAnswers: pathwayAnswersPayload || {}, 
  //     resumeText: resumeText || '' 
  //   };
  //   // const payload = "this is a test"
  //   console.log('Sending payload:', payload);
    
  //   try {
  //      // const response = await fetch(`${supabase.supabaseUrl}/functions/v1/evaluateCareerAdvice`, {
        
  //     const { data, error } = await supabase.functions.invoke('evaluateCareerAdvice', {
  //       method: 'POST',
  //       // headers: {
  //       //   'Content-Type': 'application/json'
  //       //   // 'Authorization': `Bearer ${supabase.supabaseKey}`,
  //       //   // 'x-client-info': 'supabase-js-web/2.49.4'
  //       // },
  //       body: payload //JSON.stringify(payload)
  //     });
      
  //     if (error) throw error;
      
  //     const raw = typeof data === 'string' ? data : data.generatedText || data.message || JSON.stringify(data);
  //     console.log("Career Pathway Insights: ", raw);
  //     const html = formatCareerPathwayReport(raw);
  //     setCareerAdviceReport(html);
      
  //     // Save report to database
  //     try {
  //       await supabase.from("career_pathway_results").insert({
  //         user_id: user.id,
  //         session_id: sessionId,
  //         report: raw
  //       });
  //     } catch (saveError) {
  //       console.error("Error saving career pathway report:", saveError);
  //     }
      
  //     setMessages(prev => [...prev, { 
  //       id: `bot_done_${Date.now()}`, 
  //       sender: 'bot', 
  //       text: "Your personalized career pathway report is ready! I've prepared it below based on your answers and resume."
  //     }]);
  //   } catch(e) { 
  //     console.error("Full error:", e);
  //     handleReportError(e instanceof Error ? e.message : 'Failed to get career advice'); 
  //   }
  // };

  // Handle quick reply selection for first question
  const handleQuickReply = (replyText: string) => {
    if (isTyping) return;

    const userMessage: Message = {
      id: `user_${Date.now()}`,
      sender: "user",
      text: replyText,
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsTyping(true);
    setShowQuickReplies(false);

    setAnswers((prev) => ({
      ...prev,
      [pathwayQuestions[0].id]: replyText,
    }));

    // Save answer to database
    saveAnswerToDatabase(pathwayQuestions[0].id, replyText);

    // Send next question after delay
    setTimeout(() => {
      const nextQuestion = pathwayQuestions[1];
      const botMessage: Message = {
        id: `bot_${Date.now()}`,
        sender: "bot",
        text: `Next question: ${nextQuestion.label}. ${nextQuestion.placeholder}`,
      };
      setMessages((prev) => [...prev, botMessage]);
      setIsTyping(false);
      setCurrentQuestionIndex(1);
    }, 700);
  };

  // Handle resume use confirmation
  const handleResumeUseConfirm = (useExisting: boolean) => {
    setResumeUseConfirmed(useExisting);
    const userText = useExisting ? "Use existing resume" : "Upload new resume";
    const userMessage: Message = {
      id: `user_resume_confirm_${Date.now()}`,
      sender: "user",
      text: userText,
    };
    setMessages((prev) => [...prev, userMessage]);
    setShowQuickReplies(false);

    if (useExisting && resume) {
      // Use existing resume
      const botMsg: Message = {
        id: `bot_resume_use_confirm_${Date.now()}`,
        sender: "bot",
        text: "Using your existing resume on file for personalized career advice.",
      };
      setMessages((prev) => [...prev, botMsg]);
      
      // Generate report with existing resume
      generateCareerAdviceReport(resume.text);
    } else {
      // Show upload prompt for new resume
      const botMsg: Message = {
        id: `bot_resume_upload_prompt_${Date.now()}`,
        sender: "bot",
        text: "Please upload your resume to receive personalized career advice.",
      };
      setMessages((prev) => [...prev, botMsg]);
    }
  };

  // Handle what happens when assessment is complete
  const handleAssessmentCompletion = () => {
    if (resume && !resumePromptShown) {
      // If user has a resume, show the resume options
      const resumeFoundMsg: Message = {
        id: `bot_resume_found_${Date.now()}`,
        sender: "bot",
        text: "I found an existing resume on file. Would you like to use this resume or upload a new one?",
      };
      setMessages((prev) => [...prev, resumeFoundMsg]);
      setResumePromptShown(true);
      setShowQuickReplies(true);
    } else if (!resume) {
      // If no existing resume, show upload prompt
      const noResumeMsg: Message = {
        id: `bot_no_resume_${Date.now()}`,
        sender: "bot",
        text: "Please upload your resume to receive personalized career advice.",
      };
      setMessages((prev) => [...prev, noResumeMsg]);
    }
  };

  // Chat input handling
  const handleSubmit = async () => {
    if (isTyping) return;

    if (currentQuestionIndex >= 0 && currentQuestionIndex < pathwayQuestions.length) {
      if (!inputValue.trim()) return;

      const userMessage: Message = {
        id: `user_${Date.now()}`,
        sender: "user",
        text: inputValue.trim(),
      };
      setMessages((prev) => [...prev, userMessage]);
      setIsTyping(true);

      const currentQuestion = pathwayQuestions[currentQuestionIndex];
      setAnswers((prev) => ({ ...prev, [currentQuestion.id]: inputValue.trim() }));
      
      // Save answer to database
      await saveAnswerToDatabase(currentQuestion.id, inputValue.trim());
      
      setInputValue("");

      setTimeout(() => {
        const nextIndex = currentQuestionIndex + 1;
        setIsTyping(false);
        setCurrentQuestionIndex(nextIndex);

        if (nextIndex < pathwayQuestions.length) {
          // Show next question
          const nextQ = pathwayQuestions[nextIndex];
          const botMessage: Message = {
            id: `bot_${Date.now()}`,
            sender: "bot",
            text: `Next question: ${nextQ.label}. ${nextQ.placeholder}`,
          };
          setMessages((prev) => [...prev, botMessage]);
        } else {
          // We've reached the end of questions
          handleAssessmentCompletion();
        }
      }, 1200);
    } else if (currentQuestionIndex === pathwayQuestions.length && resumeFile) {
      // Handle resume upload using existing functionality
      handleResumeUpload();
    }
  };

  // Handle resume upload using existing functionality
  const handleResumeUpload = async () => {
    if (!resumeFile) {
      toast({
        title: 'No file selected',
        description: 'Please select a file to upload.',
        variant: 'destructive'
      });
      return;
    }

    setIsTyping(true);

    try {
      // Use the existing uploadResume function from useResume hook
      const uploadSuccess = await uploadResume(resumeFile);
      
      if (uploadSuccess && resume?.text) {
        const botMessage: Message = {
          id: `bot_${Date.now()}`,
          sender: "bot",
          text: "Resume uploaded successfully! Based on your inputs, here are some career recommendations:",
        };

        setMessages((prev) => [...prev, botMessage]);
        
        // Generate report with resume text
        generateCareerAdviceReport(resume.text);
      } else {
        const botMessage: Message = {
          id: `bot_${Date.now()}`,
          sender: "bot",
          text: "Failed to upload resume. Please try again.",
        };
        setMessages((prev) => [...prev, botMessage]);
      }
    } catch (error) {
      console.error("Error uploading resume:", error);
      const botMessage: Message = {
        id: `bot_${Date.now()}`,
        sender: "bot",
        text: "An error occurred uploading your resume. Please try again later.",
      };
      setMessages((prev) => [...prev, botMessage]);
    } finally {
      setIsTyping(false);
      setResumeFile(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.type === 'application/pdf' || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      setResumeFile(file);
    } else {
      toast({
        title: 'Invalid file type',
        description: 'Only PDF or DOCX files are allowed.',
        variant: 'destructive'
      });
    }
  };

  // Handle emoji reaction
  const handleEmojiClick = (msgId: string, emoji: string) => {
    // Store the reaction (you'll need to implement this later with your database)
    console.log(`User reacted to message ${msgId} with ${emoji}`);
    // Optionally, you can show a toast/notification here instead of an alert
    setReactingMessageId(null);
  };

  // Handle keyboard input
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (inputValue.trim()) {
        void handleSubmit();
      }
    }
  };

  // Get user initials for avatar
  const getUserInitials = (name?: string) => {
    if (!name) return "U";
    const parts = name.trim().split(" ");
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
  };

  // Determine if quick replies should be shown
  const showQuickRepliesAtCorrectPlace = () => {
    if (!showQuickReplies) return false;
    
    // Show the initial quick replies for the first question
    if (currentQuestionIndex === 0) {
      const botThirdMsg = messages.find((m) => m.text === starterMessages[2] && m.sender === "bot");
      return !!botThirdMsg;
    }
    
    // Show resume options at the end
    return currentQuestionIndex === pathwayQuestions.length && resume && resumePromptShown && resumeUseConfirmed === null;
  };

  // Reset chat to initial state
  const handleResetChat = () => {
    setMessages(starterMessages.map((text, index) => ({
      id: `bot_starter_${index}`,
      sender: "bot",
      text,
    })));
    setShowQuickReplies(true);
    setCurrentQuestionIndex(0);
    setAnswers({});
    setInputValue("");
    setResumeFile(null);
    setResumeUseConfirmed(null);
    setCareerAdviceReport('');
    setResumePromptShown(false);
  };

  return (
 <AppLayout>
      <div className="flex flex-col min-h-screen items-center justify-start pt-[8rem] pb-[5rem] px-4">
        {/* Sticky Header (offset to sit below the top navbar) */}
        <div className="sticky top-[-1.55rem] z-10 bg-gray-50 border-b border-gray-200 w-full">
          {/* <div className="fixed top-[3.5rem] left-0 right-0 z-10 bg-gray-50 border-b border-gray-200"> */}
          {/* <div className="mx-auto w-full max-w-2xl px-4 py-3 flex justify-between items-center"> */}
          <div className="mx-auto max-w-2xl px-4 py-3 flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full overflow-hidden">
                <img
                  src={coachAvatarUrl}
                  alt="Career Coach"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const target = e.currentTarget;
                    target.style.display = "none";
                    if (target.parentElement) {
                      target.parentElement.textContent = "CC";
                    }
                  }}
                />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">Career Coach</h1>
                <p className="text-sm text-green-500">Online</p>
              </div>
            </div>
            <Button
              variant="ghost"
              onClick={handleResetChat}
              size="sm"
              className="text-blue-600 hover:text-blue-700"
            >
              Reset Chat
            </Button>
          </div>
        </div>
        {/* Chat Messages Area */}
        <div 
          ref={scrollAreaRef}
          className="flex-1 overflow-y-auto pt-20 pb-20 px-2"
        >
          <div className="space-y-4 max-w-xl mx-auto">
            {messages.map((msg) => {
              const isBot = msg.sender === "bot";
              const isUser = msg.sender === "user";

              return (
                <div
                  key={msg.id}
                  className={`flex ${isBot ? "justify-start" : "justify-end"} items-end space-x-2`}
                >
                  {isBot && (
                    <div className="w-8 h-8 rounded-full overflow-hidden">
                      <img
                        src={coachAvatarUrl}
                        alt="Career Coach Avatar"
                        className="w-full h-full object-cover"
                        draggable={false}
                        onError={(e) => {
                          const target = e.currentTarget;
                          target.style.display = "none";
                          if (target.parentElement) {
                            target.parentElement.textContent = "CC";
                          }
                        }}
                      />
                    </div>
                  )}

                  <div
                    className={`relative max-w-[75%] px-4 py-2 rounded-2xl text-sm
                      ${isBot
                        ? "bg-gray-100 text-gray-900 rounded-bl-none"
                        : "bg-blue-500 text-white rounded-br-none"
                      }
                    `}
                  >
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                    {reactingMessageId === msg.id && isBot && (
                      <div className="absolute -top-8 left-0 flex space-x-1 bg-white rounded-md shadow-lg p-1 text-lg select-none z-50">
                        {["👍", "❤️", "💡"].map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => handleEmojiClick(msg.id, emoji)}
                            className="hover:bg-gray-200 rounded-md p-1"
                            type="button"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                                      {isUser && (
                    <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
                      {user?.user_metadata?.avatar_url ? (
                        <img
                          src={user.user_metadata.avatar_url}
                          alt="User Avatar"
                          className="w-full h-full object-cover"
                          draggable={false}
                          onError={(e) => {
                            const target = e.currentTarget;
                            target.style.display = "none";
                            if (target.parentElement) {
                              target.parentElement.textContent = getUserInitials(user?.user_metadata?.name);
                            }
                          }}
                        />
                      ) : (
                        <span className="text-gray-700 font-semibold text-sm">
                          {getUserInitials(user?.user_metadata?.name)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            
            {isTyping && (
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-full overflow-hidden">
                  <img
                    src={coachAvatarUrl}
                    alt="Career Coach Avatar"
                    className="w-full h-full object-cover"
                    draggable={false}
                    onError={(e) => {
                      const target = e.currentTarget;
                      target.style.display = "none";
                      if (target.parentElement) {
                        target.parentElement.textContent = "CC";
                      }
                    }}
                  />
                </div>
                <div className="bg-gray-100 rounded-2xl rounded-bl-none px-4 py-2">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </div>
            )}
            
            {/* First question quick replies */}
            {showQuickRepliesAtCorrectPlace() && currentQuestionIndex === 0 && (
              <div className="flex flex-col space-y-3 mb-4">
                {quickReplies.map((reply, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleQuickReply(reply)}
                    className="rounded-full px-6 py-3 border border-blue-500 text-blue-500 text-left hover:bg-blue-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300 max-w-full sm:max-w-md mx-auto"
                    type="button"
                  >
                    {reply}
                  </button>
                ))}
              </div>
            )}

            {/* Resume options at the end of assessment */}
            {showQuickRepliesAtCorrectPlace() && currentQuestionIndex === pathwayQuestions.length && (
              <div className="flex flex-col space-y-2 mt-4">
                <Button
                  variant="outline"
                  className="w-full justify-start text-left border-blue-500 text-blue-500 hover:bg-blue-50"
                  type="button"
                  onClick={() => handleResumeUseConfirm(true)}
                >
                  Use existing resume
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left border-blue-500 text-blue-500 hover:bg-blue-50"
                  type="button"
                  onClick={() => handleResumeUseConfirm(false)}
                >
                  Upload new resume
                </Button>
              </div>
            )}

            {/* Resume upload form when a new resume is needed */}
            {currentQuestionIndex === pathwayQuestions.length && 
             ((!resume) || (resumeUseConfirmed === false)) && (
              <div className="flex flex-col space-y-4 mt-4">
                <label className="text-sm font-medium">Upload your resume (PDF or DOCX):</label>
                <input
                  type="file"
                  accept=".pdf,.docx"
                  onChange={handleFileChange}
                  disabled={isTyping || resumeUploading}
                  className="block w-full text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                />
                <Button
                  onClick={() => void handleSubmit()}
                  disabled={isTyping || resumeUploading || !resumeFile}
                  className="bg-blue-500 hover:bg-blue-600 text-white"
                >
                  {resumeUploading ? "Uploading..." : "Upload Resume"}
                </Button>
              </div>
            )}

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
                  className="career-advice-report p-6 mt-6 rounded-lg bg-white border border-blue-300 max-w-3xl mx-auto text-gray-900 text-sm shadow-lg hover:shadow-xl transition-shadow duration-300"
                  dangerouslySetInnerHTML={{ __html: careerAdviceReport }}
                />
              </>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Fixed Bottom Input */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200">
          <div className="container mx-auto max-w-2xl px-4 py-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleSubmit();
              }}
              className="flex items-center space-x-3"
            >
              <input
                className="flex-grow rounded-full border border-gray-300 px-4 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-300 text-sm"
                type="text"
                placeholder="Type your response…"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleInputKeyDown}
                disabled={isTyping || resumeUploading || (currentQuestionIndex === pathwayQuestions.length && showQuickReplies)}
                autoComplete="off"
                aria-label="Chat input"
              />
              <Button
                type="submit"
                disabled={
                  isTyping ||
                  resumeUploading ||
                  !inputValue.trim() ||
                  (currentQuestionIndex === pathwayQuestions.length && showQuickReplies)
                }
                className="bg-blue-500 hover:bg-blue-600 text-white rounded-full"
              >
                Send
              </Button>
            </form>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default CareerAgent;