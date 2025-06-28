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
  careerAdvicePrompt,
  PathwayQuestion
} from '@/data/careerPathwayData';
import { useNavigate } from 'react-router-dom';
// CareerAgent.tsx
import { formatCareerPathwayReport } from '@/components/assistants/utils/CareerReportParser';

interface Message {
  id: string;
  sender: 'user' | 'bot';
  text: string;
}

// Define the type for the structured report
interface StructuredCareerReport {
  summary: string;
  recommendedRoles: Array<{
    title: string;
    description: string;
    salaryRange: string;
  }>;
  skillsAndCourses: Array<{
    skill: string;
    course: string;
    provider: string;
    level: string;
  }>;
  nextStepRecommendations: string;
  potentialRoles: Array<{
    title: string;
    description: string;
  }>;
  careerPathSteps: Array<{
    step: string;
    action: string;
    timeline: string;
  }>;
  keyTakeaways: string[];
  error?: string;
  raw?: string;
}

const CareerAgent: React.FC = () => {
  const navigate = useNavigate();

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
  const [previousChatLoaded, setPreviousChatLoaded] = useState<boolean>(false);
  const [edgeFunctionError, setEdgeFunctionError] = useState<boolean>(false);
  const reportRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [structuredReport, setStructuredReport] = useState<StructuredCareerReport | null>(null);

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

  // Initialize session ID
  useEffect(() => {
    const sid = Date.now().toString();
    setSessionId(sid);
  }, []);

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

  // Load previous answers and chat history
  useEffect(() => {
    if (user?.id && !previousChatLoaded) {
      loadPreviousCareerPathwayData();
    }
  }, [user,previousChatLoaded]);

  // Load previous career pathway data
  const loadPreviousCareerPathwayData = async () => {
    if (!user?.id) return;

    console.log('loadPreviousCareerPathwayData called');
    // Only load answers for the user where is_reset is false
    const { data: previousAnswers, error: answersError } = await supabase
      .from('career_pathway_answers')
      .select('question, answer, created_at, is_reset')
      .eq('user_id', user.id)
      .eq('is_reset', false)
      .order('created_at', { ascending: true });
    console.log('previousAnswers loaded:', previousAnswers);
    
    if (answersError) {
      console.error('Error loading previous answers:', answersError);
      initializeConversation();
      return;
    }

    if (previousAnswers && previousAnswers.length > 0) {
      // Map answers
      const answersMap: Record<string, string> = {};
      previousAnswers.forEach(item => {
        answersMap[item.question] = item.answer;
      });
      setAnswers(answersMap);
      
      // Calculate how far they got in the quiz
      const questionCount = Math.min(previousAnswers.length, pathwayQuestions.length);
      setCurrentQuestionIndex(questionCount);
      
      // Load the latest report
      const { data: reportData, error: reportError } = await supabase
        .from('career_pathway_results')
        .select('report')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
        
      if (!reportError && reportData?.report) {
        const raw = typeof reportData.report === 'string' ? reportData.report : JSON.stringify(reportData.report);
        let parsed: StructuredCareerReport | null = null;
        try {
          parsed = JSON.parse(raw);
        } catch {
          parsed = { summary: '', recommendedRoles: [], skillsAndCourses: [], nextStepRecommendations: '', potentialRoles: [], careerPathSteps: [], keyTakeaways: [], error: 'Invalid JSON from DB', raw };
        }
        setStructuredReport(parsed);
        // Clear the old HTML report since we're using structured data now
        setCareerAdviceReport('');
      }
      
      // Reconstruct chat history from answers
      const chatHistory: Message[] = [...starterMessages.map((text, index) => ({
        id: `bot_starter_${index}`,
        sender: "bot" as const,
        text,
      }))];
      
      // Add user answers and questions
      pathwayQuestions.forEach((question, index) => {
        if (answersMap[question.id]) {
          // Add user answer
          chatHistory.push({
            id: `user_${question.id}`,
            sender: 'user',
            text: answersMap[question.id]
          });
          
          // Add next question from bot if not the last question
          if (index < pathwayQuestions.length - 1) {
            const nextQ = pathwayQuestions[index + 1];
            chatHistory.push({
              id: `bot_q_${nextQ.id}`,
              sender: 'bot',
              // text: `${nextQ.label}. ${nextQ.placeholder}`
              text: `${nextQ.placeholder}`
            });
          }
        }
      });
      
      // Add final message if they completed all questions
      if (questionCount >= pathwayQuestions.length) {
        chatHistory.push({
          id: `bot_done_${Date.now()}`,
          sender: 'bot',
          text: "Your personalized career pathway report is ready! I've prepared it below based on your answers and resume."
        });
        
        // Check if resume was used
        const { data: resumeData } = await supabase
          .from('resumes')
          .select('text')
          .eq('user_id', user.id)
          .limit(1)
          .maybeSingle();
          
        if (resumeData?.text) {
          setResumePromptShown(true);
          setResumeUseConfirmed(true);
          chatHistory.push({
            id: `bot_resume_use_confirm_${Date.now()}`,
            sender: 'bot',
            text: "Using your existing resume on file for personalized career advice."
          });
        }
      } else {
        setShowQuickReplies(currentQuestionIndex === 0);
      }
      
      setMessages(chatHistory);
      setPreviousChatLoaded(true);
    } else {
      // No previous answers, just initialize a new conversation
      initializeConversation();
    }
  };

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

  // Update the handleReportError function
  const handleReportError = (msg: string) => {
    let displayMessage = msg;
    let isEdgeError = false;
    if (msg.includes("Rate limit reached")) {
      const timeMatch = msg.match(/Please try again in (\d+m\d+\.\d+s)/);
      if (timeMatch && timeMatch[1]) {
        const waitTime = timeMatch[1].replace(/\.\d+s/, ' seconds');
        displayMessage = `API rate limit reached. Please try again in ${waitTime}.`;
      }
    }
    // Detect edge function error (customize as needed)
    if (msg.toLowerCase().includes("career advice") || msg.toLowerCase().includes("edge function")) {
      isEdgeError = true;
    }
    setEdgeFunctionError(isEdgeError);

    setMessages(prev => [...prev, { 
      id: `bot_error_${Date.now()}`, 
      sender: 'bot', 
      text: `Error: ${displayMessage}`
    }]);
  };

  const handleRetryEdgeFunction = () => {
    setEdgeFunctionError(false);
    generateCareerAdviceReport(resume?.text);
  };

  const handleResetAnswers = async () => {
    if (!user?.id) return;
    console.log(`handleResetAnswers called for user ${user.id}`);
    
    try {
      console.log('Checking rows before update...');
      const { data: beforeRows } = await supabase
        .from('career_pathway_answers')
        .select('*')
        .eq('user_id', user.id)
        .is('is_reset', false);
      console.log('Rows to update:', beforeRows);

      const { data, error } = await supabase
        .from('career_pathway_answers')
        .update({ is_reset: true, updated_at: new Date().toISOString() })
        .eq('user_id', user.id)

      if (error) {
        console.log('Update error:', error);
        toast({
          title: 'Error',
          description: 'Failed to reset your answers. Please try again.',
          variant: 'destructive'
        });
        return;
      }
      console.log('Update successful:', data);
      console.log('Checking rows after update...');
      

      const { data: afterRows } = await supabase
        .from('career_pathway_answers')
        .select('*')
        .eq('user_id', user.id)
        .is('is_reset', false);
      console.log('Rows remaining after update:', afterRows);

      // Clear all local state
      setAnswers({});
      setMessages(starterMessages.map((text, index) => ({
        id: `bot_starter_${index}`,
        sender: "bot",
        text,
      })));
      setCurrentQuestionIndex(0);
      setShowQuickReplies(true);
      setCareerAdviceReport('');
      setStructuredReport(null);
      setResumePromptShown(false);
      setResumeUseConfirmed(null);
      setPreviousChatLoaded(false);
      console.log('State cleared after reset');

      toast({
        title: 'Success',
        description: 'Your answers have been reset.',
      });
    } catch (err) {
      console.log('Error in reset:', err);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred. Please try again.',
        variant: 'destructive'
      });
    }
  };

  // Update the generateCareerAdviceReport function
  const generateCareerAdviceReport = async (resumeText?: string) => {
    setMessages(prev => [...prev, { 
      id: `bot_${Date.now()}`, 
      sender: 'bot', 
      text: "Thank you for your answers! I'm working on your career pathway report now; it may take about 2 minutes to generate additional insights..."
    }]);
    
    if (!user) return;
    
    try {
      console.log('Calling evaluateCareerAdvice edge function');
      // Get the session properly using await
      const { data, error } = await supabase.functions.invoke('evaluateCareerAdvice', {
        body: {
          prompt: careerAdvicePrompt,
          pathwayQuestions,
          pathwayAnswers: answers,
          resumeText: resumeText || "",
        },
      });

      if (!data) {
        throw new Error("No result returned from career pathway form");
      }

      // If the response is a string, try to parse it
      let report: StructuredCareerReport;
      if (typeof data === 'string') {
        try {
          report = JSON.parse(data);
        } catch (e) {
          report = { summary: '', recommendedRoles: [], skillsAndCourses: [], nextStepRecommendations: '', potentialRoles: [], careerPathSteps: [], keyTakeaways: [], error: 'Invalid JSON from LLM', raw: data };
        }
      } else {
        report = data as StructuredCareerReport;
      }
      setStructuredReport(report);
      setCareerAdviceReport(''); // clear old markdown report if any

      // Save the report to career_pathway_results
      if (user?.id) {
        try {
          await supabase.from("career_pathway_results").insert({
            user_id: user.id,
            session_id: sessionId,
            report: JSON.stringify(report)
          });
        } catch (saveError) {
          console.error("Error saving career pathway report:", saveError);
        }
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

    saveAnswerToDatabase(pathwayQuestions[0].id, replyText);

    setTimeout(() => {
      const nextQuestion = pathwayQuestions[1];
      const botMessage: Message = {
        id: `bot_${Date.now()}`,
        sender: "bot",
        text: `${nextQuestion.placeholder}`,
        // text: `Next question: ${nextQ.label}. ${nextQ.placeholder}`,
      };
      setMessages((prev) => [...prev, botMessage]);
      setIsTyping(false);
      setCurrentQuestionIndex(1);
    }, 700);
  };

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
      const botMsg: Message = {
        id: `bot_resume_use_confirm_${Date.now()}`,
        sender: 'bot',
        text: "Using your existing resume on file for personalized career advice.",
      };
      setMessages((prev) => [...prev, botMsg]);
      
      generateCareerAdviceReport(resume.text);
    } else {
      const botMsg: Message = {
        id: `bot_resume_upload_prompt_${Date.now()}`,
        sender: 'bot',
        text: "Please upload your resume to receive personalized career advice.",
      };
      setMessages((prev) => [...prev, botMsg]);
    }
  };

  const handleAssessmentCompletion = () => {
    if (resume && !resumePromptShown) {
      const resumeFoundMsg: Message = {
        id: `bot_resume_found_${Date.now()}`,
        sender: "bot",
        text: "I found an existing resume on file. Would you like to use this resume or upload a new one?",
      };
      setMessages((prev) => [...prev, resumeFoundMsg]);
      setResumePromptShown(true);
      setShowQuickReplies(true);
    } else if (!resume) {
      const noResumeMsg: Message = {
        id: `bot_no_resume_${Date.now()}`,
        sender: "bot",
        text: "Please upload your resume to receive personalized career advice.",
      };
      setMessages((prev) => [...prev, noResumeMsg]);
    }
  };

  // Update the handleSubmit function
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
      const answer = inputValue.trim();
      
      setAnswers(prev => ({ ...prev, [currentQuestion.id]: answer }));
      
      // Save answer to database
      if (user?.id) {
        try {
          await supabase.from('career_pathway_answers').insert({
            user_id: user.id,
            session_id: sessionId,
            question: currentQuestion.id,
            answer: answer
          });
        } catch (err) {
          console.error('Error saving answer:', err);
        }
      }
      
      setInputValue("");

      setTimeout(() => {
        const nextIndex = currentQuestionIndex + 1;
        setIsTyping(false);
        setCurrentQuestionIndex(nextIndex);

        if (nextIndex < pathwayQuestions.length) {
          const nextQ = pathwayQuestions[nextIndex];
          const botMessage: Message = {
            id: `bot_${Date.now()}`,
            sender: "bot",
            
            text: `${nextQ.placeholder}`,
            // text: `Next question: ${nextQ.label}. ${nextQ.placeholder}`,
          };
          setMessages((prev) => [...prev, botMessage]);
        } else {
          handleAssessmentCompletion();
        }
      }, 1200);
    } else if (currentQuestionIndex === pathwayQuestions.length && resumeFile) {
      handleResumeUpload();
    }
  };

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
      const uploadSuccess = await uploadResume(resumeFile);
      
      if (uploadSuccess && resume?.text) {
        const botMessage: Message = {
          id: `bot_${Date.now()}`,
          sender: "bot",
          text: "Resume uploaded successfully! Based on your inputs, here are some career recommendations:",
        };

        setMessages((prev) => [...prev, botMessage]);
        
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

  const handleEmojiClick = (msgId: string, emoji: string) => {
    console.log(`User reacted to message ${msgId} with ${emoji}`);
    setReactingMessageId(null);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (inputValue.trim()) {
        void handleSubmit();
      }
    }
  };

  const getUserInitials = (name?: string) => {
    if (!name) return "U";
    const parts = name.trim().split(" ");
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
  };

  const showQuickRepliesAtCorrectPlace = () => {
    if (!showQuickReplies) return false;
    
    if (currentQuestionIndex === 0) {
      const botThirdMsg = messages.find((m) => m.text === starterMessages[2] && m.sender === "bot");
      return !!botThirdMsg;
    }
    
    return currentQuestionIndex === pathwayQuestions.length && resume && resumePromptShown && resumeUseConfirmed === null;
  };

  return (
    <AppLayout>
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex flex-col min-h-screen items-center justify-start pt-[8rem] pb-[5rem] px-4">
          <div className="sticky top-[-1.55rem] z-10 bg-gray-50 border-b border-gray-200 w-full">
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
              <div>
                <Button
                  variant="outline"
                  onClick={handleResetAnswers}
                  size="sm"
                  className="text-red-600 hover:text-red-700"
                >
                  Reset Answers
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-600 hover:text-red-700"
                  onClick={handleRetryEdgeFunction}
                >
                    Retry
                </Button>
              </div>
            </div>
          </div>
          <div 
            ref={scrollAreaRef}
            className="flex-1 overflow-y-auto pt-20 pb-20 px-2"
          >
            <div className="space-y-4 max-w-xl mx-auto">
              {messages.map((msg) => {
                const isBot = msg.sender === "bot";
                const isUser = msg.sender === "user";
                const isError = msg.id.startsWith("bot_error_");
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
                      {/* Show Retry button if this is the latest error and it's an edge function error */}
                      {isError && edgeFunctionError && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-2"
                          onClick={handleRetryEdgeFunction}
                        >
                          Retry
                        </Button>
                      )}
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

              {currentQuestionIndex === pathwayQuestions.length && 
               ((!resume) || (resumeUseConfirmed === false)) && (
                <div className="flex flex-col space-y-4 mt-4">
                  <label className="text-sm font-medium">Upload your resume (PDF or DOCX):</label>
                  <input
                    type="file"
                    accept=".pdf,.docx"
                    onChange={handleFileChange}
                    disabled={isTyping || resumeUploading}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                  {resumeFile && (
                    <Button
                      onClick={handleResumeUpload}
                      disabled={isTyping || resumeUploading}
                      className="mt-2"
                    >
                      {resumeUploading ? "Uploading..." : "Upload Resume"}
                    </Button>
                  )}
                </div>
              )}

              {/* View Your Career Pathway button should appear above the report and as soon as structuredReport is set and has no error */}
              {structuredReport && !structuredReport.error && (
                <Button 
                  onClick={() => navigate('/career-pathway')}
                  className="block mx-auto mt-6 mb-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                >
                  View Your Career Pathway
                </Button>
              )}
              {structuredReport && !structuredReport.error && (
                <div ref={reportRef} className="career-advice-report p-6 mt-6 rounded-lg bg-white border border-blue-300 max-w-3xl mx-auto text-gray-900 text-sm shadow-lg hover:shadow-xl transition-shadow duration-300">
                  <h1 className="text-xl font-bold text-blue-600 mb-4">Personalized Career Pathway Report</h1>
                  <section className="mb-6">
                    <h2 className="text-lg font-semibold text-blue-700 mb-2">Summary</h2>
                    <p>{structuredReport.summary}</p>
                  </section>
                  <section className="mb-6">
                    <h2 className="text-lg font-semibold text-blue-700 mb-2">Recommended Roles</h2>
                    {structuredReport.recommendedRoles && structuredReport.recommendedRoles.length > 0 ? (
                      <ul className="list-decimal ml-6">
                        {structuredReport.recommendedRoles.map((role, idx) => (
                          <li key={idx} className="mb-2">
                            <span className="font-medium">{role.title}</span>: {role.description} <span className="text-gray-500">({role.salaryRange})</span>
                          </li>
                        ))}
                      </ul>
                    ) : <p>No roles found.</p>}
                  </section>
                  <section className="mb-6">
                    <h2 className="text-lg font-semibold text-blue-700 mb-2">Skills and Matching Courses</h2>
                    {structuredReport.skillsAndCourses && structuredReport.skillsAndCourses.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="min-w-full bg-white border border-gray-200">
                          <thead className="bg-blue-50">
                            <tr>
                              <th className="py-2 px-4 border border-gray-200 font-medium text-left">Skill</th>
                              <th className="py-2 px-4 border border-gray-200 font-medium text-left">Course</th>
                              <th className="py-2 px-4 border border-gray-200 font-medium text-left">Provider</th>
                              <th className="py-2 px-4 border border-gray-200 font-medium text-left">Level</th>
                            </tr>
                          </thead>
                          <tbody>
                            {structuredReport.skillsAndCourses.map((row, idx) => (
                              <tr key={idx}>
                                <td className="py-2 px-4 border border-gray-200">{row.skill}</td>
                                <td className="py-2 px-4 border border-gray-200">{row.course}</td>
                                <td className="py-2 px-4 border border-gray-200">{row.provider}</td>
                                <td className="py-2 px-4 border border-gray-200">{row.level}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : <p>No skills/courses found.</p>}
                  </section>
                  <section className="mb-6">
                    <h2 className="text-lg font-semibold text-blue-700 mb-2">Next-Step Career Recommendations</h2>
                    <p>{structuredReport.nextStepRecommendations}</p>
                  </section>
                  <section className="mb-6">
                    <h2 className="text-lg font-semibold text-blue-700 mb-2">Roles that Might be Right for You</h2>
                    {structuredReport.potentialRoles && structuredReport.potentialRoles.length > 0 ? (
                      <ul className="list-disc ml-6">
                        {structuredReport.potentialRoles.map((role, idx) => (
                          <li key={idx}>
                            <span className="font-medium">{role.title}</span>: {role.description}
                          </li>
                        ))}
                      </ul>
                    ) : <p>No potential roles found.</p>}
                  </section>
                  <section className="mb-6">
                    <h2 className="text-lg font-semibold text-blue-700 mb-2">Path to Your Aspirational Role</h2>
                    {structuredReport.careerPathSteps && structuredReport.careerPathSteps.length > 0 ? (
                      <ol className="list-decimal ml-6">
                        {structuredReport.careerPathSteps.map((step, idx) => (
                          <li key={idx}>
                            <span className="font-medium">{step.step}</span>: {step.action} <span className="text-gray-500">({step.timeline})</span>
                          </li>
                        ))}
                      </ol>
                    ) : <p>No steps found.</p>}
                  </section>
                  <section className="mb-6">
                    <h2 className="text-lg font-semibold text-blue-700 mb-2">Key Takeaways</h2>
                    {structuredReport.keyTakeaways && structuredReport.keyTakeaways.length > 0 ? (
                      <ul className="list-disc ml-6">
                        {structuredReport.keyTakeaways.map((takeaway, idx) => (
                          <li key={idx}>{takeaway}</li>
                        ))}
                      </ul>
                    ) : <p>No key takeaways found.</p>}
                  </section>
                </div>
              )}
              {/* View Your Career Pathway button should appear above the report and as soon as structuredReport is set and has no error */}
              {structuredReport && !structuredReport.error && (
                <Button 
                  onClick={() => navigate('/career-pathway')}
                  className="block mx-auto mt-6 mb-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                >
                  View Your Career Pathway
                </Button>
              )}
              {structuredReport && structuredReport.error && (
                <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded">
                  <h2 className="font-bold mb-2">Error</h2>
                  <p>{structuredReport.error}</p>
                  {structuredReport.raw && <pre className="mt-2 text-xs whitespace-pre-wrap">{structuredReport.raw}</pre>}
                </div>
              )}
              <div ref={messagesEndRef}></div>
            </div>
          </div>

          {/* Input area */}
          <div className="sticky bottom-0 bg-gradient-to-t from-white to-transparent pb-4 pt-2 w-full">
            <div className="mx-auto max-w-2xl px-4">
              <div className="relative flex items-center">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleInputKeyDown}
                  disabled={isTyping}
                  className="flex-1 border border-gray-300 rounded-full py-3 px-4 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={isTyping ? "Please wait..." : "Type your message..."}
                />
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!inputValue.trim() || isTyping}
                  className="absolute right-2 bg-blue-500 hover:bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center"
                >
                  <span className="sr-only">Send message</span>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"></line>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                  </svg>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default CareerAgent;
