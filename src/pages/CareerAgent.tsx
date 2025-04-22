import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { v4 as uuidv4 } from "uuid";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useResume } from "@/hooks/resume/useResume";

type SenderType = "system" | "user" | "bot";

type Message = {
  id: string;
  sender: SenderType;
  text: string;
};

const quickReplies = [
  "I am not happy in my current job (or I am currently in transition) and would like to find another one",
  "I am interested in exploring other career paths aligned with my skills and experience",
  "I would like to explore logical next steps and overcome obstacles in my current career path",
  "I am a recent or soon-to-be college grad looking for potential career paths",
];

const starterMessages = [
  "I will recommend the best route to your aspirational role, step-by-step. I'll also show you the most promising alternative career paths.",
  "You'll find specific recommendations on how to fill gaps in your key skills. I will even create a dynamite first draft of your professional pitch! Sound good? Okay, let's do this. It should take less than 8 minutes to answer my questions.",
  "Choose the statement that best describes your interest in taking a career assessment",
];

const assessmentQuestions = [
  {
    id: "q1",
    label: "Interest in Career Assessment",
    placeholder: "Choose the statement that best describes your interest in taking a career assessment?",
  },
  {
    id: "q2",
    label: "Ideal Next Job",
    placeholder: "So if you woke up tomorrow in your ideal next job, what would that look like?",
  },
  {
    id: "q3",
    label: "Future Vision",
    placeholder: "Fast forward 5 years, where do you see yourself?",
  },
  {
    id: "q4",
    label: "Desired Role",
    placeholder: "What role would you really want to be in?",
  },
  {
    id: "q5",
    label: "Seniority Level",
    placeholder: "How senior would this role be?",
  },
  {
    id: "q6",
    label: "Career Pivot",
    placeholder: "Are you thinking about a career pivot? What role would make better use of your talents?",
  },
  {
    id: "q7",
    label: "Strengths",
    placeholder: "What would you say are the strengths that set you apart?",
  },
  {
    id: "q8",
    label: "Weaknesses",
    placeholder: "What are some skills or abilities that should not feature prominently in your next role?",
  },
  {
    id: "q9",
    label: "Career Obstacles",
    placeholder: "What do you see as the biggest obstacle to moving ahead in your career?",
  },
  {
    id: "q10",
    label: "Past Role Insights",
    placeholder: "What makes work exciting and satisfying? What makes it boring or frustrating?",
  },
  {
    id: "q11",
    label: "Self-Reflection",
    placeholder: "What aspect of your personality is your biggest positive? What has hindered your success?",
  },
  {
    id: "q12",
    label: "Top Career Priorities",
    placeholder: "What are your top priorities in your career at this time?",
  },
  {
    id: "q13",
    label: "Work Engagement",
    placeholder: "When you get lost in your work, what are you working on? Activities you'd like to do more?",
  },
];

// Use proper coach avatar URL instead of placeholder
const coachAvatarUrl = "https://wp-aberdeen.s3.amazonaws.com/wp-content/uploads/2019/12/10043240/GettyImages-1017199998-e1654696271733.jpg";

const LOCAL_STORAGE_KEY = "careerPathwayChat";

const CareerAgent: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const { 
    resume, 
    loading: resumeLoading, 
    uploading: resumeUploading,
    uploadResume,
    deleteResume
  } = useResume();

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [questionIndex, setQuestionIndex] = useState<number>(-1);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [reactingMessageId, setReactingMessageId] = useState<string | null>(null);
  const [resumeUseConfirmed, setResumeUseConfirmed] = useState<boolean | null>(null);
  const [careerAdviceReport, setCareerAdviceReport] = useState<string>('');
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [inputValue, setInputValue] = useState("");
  const [resumePromptShown, setResumePromptShown] = useState(false);

  // Check if we previously showed the resume prompt
  const checkResumePromptShown = () => {
    const stored = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored) {
      const parsedMessages: Message[] = JSON.parse(stored);
      const resumePromptExists = parsedMessages.some(msg => 
        msg.sender === "bot" && msg.text.includes("found an existing resume on file")
      );
      setResumePromptShown(resumePromptExists);
    }
  };

  // Handle scrolling when messages update
  useEffect(() => {
    scrollAreaRef.current?.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isTyping]);

  // Initialize conversation
  const initializeConversation = () => {
    setMessages(starterMessages.map((text, index) => ({
      id: `bot_starter_${index}`,
      sender: "bot",
      text,
    })));
    setShowQuickReplies(true);
    setQuestionIndex(0);
  };

  // Initialize messages and check resume
  useEffect(() => {
    const hydrateMessagesAndCheck = async () => {
      const stored = window.localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        try {
          const parsedMessages: Message[] = JSON.parse(stored);
          const existingStarters = starterMessages.every((starter) =>
            parsedMessages.some((msg) => msg.text === starter && msg.sender === "bot")
          );
          if (existingStarters) {
            setMessages(parsedMessages);
            const userAnswersCount = parsedMessages.filter((m) => m.sender === "user" && m.text).length;
            setQuestionIndex(Math.min(userAnswersCount, assessmentQuestions.length));
            setShowQuickReplies(userAnswersCount === 0);
            // Check resume prompt status from stored messages
            checkResumePromptShown();
          } else {
            initializeConversation();
          }
        } catch {
          initializeConversation();
        }
      } else {
        initializeConversation();
      }
    };

    hydrateMessagesAndCheck();
  }, [user]);

  // Set session ID when authenticated
  useEffect(() => {
    if (isAuthenticated && !sessionId) {
      setSessionId(uuidv4());
    }
  }, [isAuthenticated, sessionId]);

  // Save messages to local storage
  useEffect(() => {
    if (messages.length === 0) return;
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  // Reset chat to initial state
  const handleResetChat = () => {
    setMessages(starterMessages.map((text, index) => ({
      id: `bot_starter_${index}`,
      sender: "bot",
      text,
    })));
    setShowQuickReplies(true);
    setQuestionIndex(0);
    setAnswers({});
    setInputValue("");
    setResumeFile(null);
    setResumeUseConfirmed(null);
    setCareerAdviceReport('');
    setResumePromptShown(false);
    window.localStorage.removeItem(LOCAL_STORAGE_KEY);
  };

  // Save answer to database
  const saveAnswerToDatabase = async (questionId: string, answer: string) => {
    if (sessionId && user) {
      try {
        await supabase.from("career_assessments").insert({
          user_id: user.id,
          session_id: sessionId,
          question: questionId,
          answer: answer,
        });
      } catch (error) {
        console.error("Error saving assessment answer:", error);
      }
    }
  };

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
      [assessmentQuestions[0].id]: replyText,
    }));

    // Save answer to database
    saveAnswerToDatabase(assessmentQuestions[0].id, replyText);

    // Send next question after delay
    setTimeout(() => {
      const nextQuestion = assessmentQuestions[1];
      const botMessage: Message = {
        id: `bot_${Date.now()}`,
        sender: "bot",
        text: `Next question: ${nextQuestion.label}. ${nextQuestion.placeholder}`,
      };
      setMessages((prev) => [...prev, botMessage]);
      setIsTyping(false);
      setQuestionIndex(1);
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

  // Handle report generation error
  const handleReportError = (errorMessage: string) => {
    setCareerAdviceReport(errorMessage);
    setMessages((prev) => [
      ...prev,
      { id: `bot_error_${Date.now()}`, sender: "bot", text: errorMessage },
    ]);
  };

  // Generate career advice report
//   const generateCareerAdviceReport = async (resumeText?: string) => {
//     // Start report generation
//     const botMessageLoading: Message = {
//       id: `bot_${Date.now()}`,
//       sender: "bot",
//       text: "Thank you for your answers! I'm working on your career pathway report now; it may take about 2 minutes to generate additional insights...",
//     };
//     setMessages((prev) => [...prev, botMessageLoading]);
    
//     if (!user) return;
    
//     // Format quiz answers for API
//     const quizAnswersPayload: Record<number, string> = {};
//     assessmentQuestions.forEach((q) => {
//       if (answers[q.id]) {
//         quizAnswersPayload[q.id] = answers[q.id];
//       }
//     });

//     const prompt = `Here are outputs from a career chat:
// - A set of recommended roles with descriptions & salary bands
// - A table of skills and matching courses
// - A narrative of next-step career recommendations
// - A 'Roles that might be right for you' list
// - A 'Path to your aspirational role' carousel
// Please combine these data points with the user's quiz answers to generate a personalized career-advice report.`;

//     const payload = {
//       prompt,
//       Quizquestions: assessmentQuestions,
//       quizAnswers: quizAnswersPayload,
//       resumeText: resumeText || null,
//     };

//     try {
//       const { data, error } = await supabase.functions.invoke('evaluateCareerAdvice', {
//         method: 'POST',
//         body: JSON.stringify(payload),
//       });

//       if (error) {
//         console.error("Error invoking evaluateCareerAdvice:", error);
//         handleReportError("Failed to get career advice. Please try again later.");
//         return;
//       }

//       const resultText = typeof data === "string" ? data : data.generatedText || JSON.stringify(data);
//       setCareerAdviceReport(resultText);

//       const botMessageReport: Message = {
//         id: `bot_report_${Date.now()}`,
//         sender: "bot",
//         text: resultText,
//       };

//       setMessages((prev) => [...prev, botMessageReport]);
//     } catch (e) {
//       console.error("Error during career advice evaluation:", e);
//       handleReportError("Failed to get career advice. Please try again later.");
//     }
//   };

  // This is the updated generateCareerAdviceReport function for CareerAgent.tsx

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
  assessmentQuestions.forEach((q) => {
    if (answers[q.id]) {
      pathwayAnswersPayload[q.id] = answers[q.id];
    }
  });

  const prompt = `Here are outputs from a career chat:
- A set of recommended roles with descriptions & salary bands
- A table of skills and matching courses
- A narrative of next-step career recommendations
- A 'Roles that might be right for you' list
- A 'Path to your aspirational role' carousel
Please combine these data points with the user's quiz answers to generate a personalized career-advice report.`;

  const payload = {
    prompt,
    PathwayQuestions: assessmentQuestions,
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
  // Use the actual resume upload function from useResume hook
  const handleResumeUpload = async (file: File): Promise<boolean> => {
    if (!user) return false;
    
    try {
      setIsTyping(true);
      const success = await uploadResume(file);
      return success;
    } catch (error) {
      console.error("Error uploading resume:", error);
      return false;
    } finally {
      setIsTyping(false);
    }
  };

  // Process resume upload from user
  const processResumeUpload = async () => {
    if (!resumeFile) {
      alert("Please upload your resume file to continue.");
      return;
    }

    setIsTyping(true);

    const userMessage: Message = {
      id: `user_${Date.now()}`,
      sender: "user",
      text: `Uploaded resume file: ${resumeFile.name}`,
    };
    setMessages((prev) => [...prev, userMessage]);

    try {
      const uploadSuccess = await handleResumeUpload(resumeFile);
      if (uploadSuccess && resume?.text) {
        const botMessage: Message = {
          id: `bot_${Date.now()}`,
          sender: "bot",
          text: "Resume uploaded successfully! Based on your inputs, here are some career recommendations:",
        };

        setMessages((prev) => [...prev, botMessage]);
        
        // Generate report with new resume
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

  // Handle form submission
  const handleSubmit = async () => {
    if (isTyping) return;

    // Check if we need to show resume options
    if (questionIndex === assessmentQuestions.length && resume && !resumePromptShown) {
      // Show resume options if we've completed questions and user has a resume
      const resumeFoundMsg: Message = {
        id: `bot_resume_found_${Date.now()}`,
        sender: "bot",
        text: "I found an existing resume on file. Would you like to use this resume or upload a new one?",
      };
      setMessages((prev) => [...prev, resumeFoundMsg]);
      setResumePromptShown(true);
      setShowQuickReplies(true);
      return;
    }

    if (questionIndex >= 0 && questionIndex < assessmentQuestions.length) {
      // Handle regular assessment questions
      if (!inputValue.trim()) return;

      const userMessage: Message = {
        id: `user_${Date.now()}`,
        sender: "user",
        text: inputValue.trim(),
      };
      setMessages((prev) => [...prev, userMessage]);
      setIsTyping(true);

      const currentQuestion = assessmentQuestions[questionIndex];
      setAnswers((prev) => ({ ...prev, [currentQuestion.id]: inputValue.trim() }));
      
      // Save answer to database
      saveAnswerToDatabase(currentQuestion.id, inputValue.trim());
      
      setInputValue("");

      setTimeout(() => {
        const nextIndex = questionIndex + 1;
        setIsTyping(false);
        setQuestionIndex(nextIndex);

        if (nextIndex < assessmentQuestions.length) {
          // Show next question
          const nextQ = assessmentQuestions[nextIndex];
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
    } else if (questionIndex === assessmentQuestions.length && resumeFile) {
      // Handle resume upload
      processResumeUpload();
    }
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

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setResumeFile(e.target.files[0]);
    }
  };

  // Handle emoji reaction
  const handleEmojiClick = (msgId: string, emoji: string) => {
    alert(`You reacted to message ${msgId} with ${emoji}`);
    setReactingMessageId(null);
  };

  // Determine if quick replies should be shown
  const showQuickRepliesAtCorrectPlace = () => {
    if (!showQuickReplies) return false;
    
    // Only show the initial quick replies when we're at question 0
    if (questionIndex === 0) {
      const botThirdMsg = messages.find((m) => m.text === starterMessages[2] && m.sender === "bot");
      return !!botThirdMsg;
    }
    
    // Show resume options when appropriate
    return questionIndex === assessmentQuestions.length && resume && resumePromptShown && resumeUseConfirmed === null;
  };

  // Get user initials for avatar
  const getUserInitials = (name: string | undefined) => {
    if (!name) return "U";
    const parts = name.trim().split(" ");
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
  };

  // Show login prompt if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="container mx-auto max-w-3xl p-6 flex flex-col min-h-screen justify-center items-center bg-white">
        <p className="text-lg text-center text-muted-foreground">
          Please log in to access the Career Pathway Agent.
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-3xl p-6 flex flex-col min-h-screen bg-white rounded-lg shadow-md">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-4xl font-bold text-amber-600">Career Pathway Agent</h1>
        <Button variant="outline" onClick={handleResetChat} size="sm" className="ml-4">
          Reset Chat
        </Button>
      </div>

      <div
        ref={scrollAreaRef}
        role="log"
        aria-live="polite"
        className="flex-1 overflow-y-auto space-y-4 max-h-[60vh] mb-6 pr-2"
      >
        {messages.map((msg, idx) => {
          const isBot = msg.sender === "bot";
          const isUser = msg.sender === "user";
          const firstBotIndex = messages.findIndex((m) => m.sender === "bot");

          return (
<div
              key={msg.id}
              className={`flex items-end max-w-full ${
                isBot ? "justify-start" : "justify-end"
              } group`}
              onMouseLeave={() => {
                if (reactingMessageId === msg.id) {
                  setReactingMessageId(null);
                }
              }}
              onTouchEnd={() => {
                if (reactingMessageId === msg.id) {
                  setReactingMessageId(null);
                }
              }}
            >
              {isBot && (
                <div
                  className="w-9 h-9 rounded-full mr-3 flex items-center justify-center bg-amber-100 select-none text-amber-600 font-semibold text-sm overflow-hidden"
                  aria-label="Coach Avatar"
                >
                  <img
                    src={coachAvatarUrl}
                    alt="Career Coach Avatar"
                    className="w-full h-full rounded-full object-cover"
                    draggable={false}
                    onError={(e) => {
                      const target = e.currentTarget as HTMLImageElement;
                      target.style.display = "none";
                      // Show fallback text when image fails to load
                      target.parentElement!.textContent = "CC";
                    }}
                  />
                </div>
              )}

              <div
                className={`relative max-w-[75%] px-5 py-3 rounded-3xl break-words text-sm
                  ${
                    isBot
                      ? "bg-amber-50 text-gray-900 shadow-md/[0_2px_8px_rgba(0,0,0,0.06)]"
                      : "bg-gray-100 text-gray-900 shadow/[0_2px_6px_rgba(0,0,0,0.10)]"
                  }
                `}
                onMouseEnter={() => {
                  if (isBot) setReactingMessageId(msg.id);
                }}
                onTouchStart={() => {
                  if (isBot) setReactingMessageId(msg.id);
                }}
              >
                <p className="whitespace-pre-wrap">{msg.text}</p>
                {reactingMessageId === msg.id && (
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
                <div
                  className="w-9 h-9 rounded-full ml-3 flex items-center justify-center bg-gray-300 select-none text-gray-700 font-semibold text-sm overflow-hidden"
                  aria-label="User Avatar"
                >
                  {user?.user_metadata?.avatar_url ? (
                    <img
                      src={user.user_metadata.avatar_url}
                      alt="User Avatar"
                      className="w-full h-full rounded-full object-cover"
                      draggable={false}
                      onError={(e) => {
                        const target = e.currentTarget as HTMLImageElement;
                        target.style.display = "none";
                        // Show initials when avatar fails to load
                        target.parentElement!.textContent = getUserInitials(user?.name);
                      }}
                    />
                  ) : (
                    <span>{getUserInitials(user?.name)}</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
        
        {isTyping && (
          <div className="flex items-center space-x-3">
            <div
              className="w-9 h-9 rounded-full select-none flex items-center justify-center bg-amber-100 text-amber-600 font-semibold overflow-hidden"
              aria-label="Coach Avatar Typing"
            >
              <img
                src={coachAvatarUrl}
                alt="Career Coach Avatar"
                className="w-full h-full rounded-full object-cover"
                draggable={false}
                onError={(e) => {
                  const target = e.currentTarget as HTMLImageElement;
                  target.style.display = "none";
                  target.parentElement!.textContent = "CC";
                }}
              />
            </div>
            <div className="italic text-gray-500 select-none">Coach is typing...</div>
          </div>
        )}
      </div>

      {/* First question quick replies */}
      {showQuickRepliesAtCorrectPlace() && questionIndex === 0 && (
        <div className="flex flex-col space-y-3 mb-4">
          {quickReplies.map((reply, idx) => (
            <button
              key={idx}
              onClick={() => handleQuickReply(reply)}
              className="rounded-full px-6 py-3 border border-gray-300 text-gray-900 text-left hover:bg-amber-100 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-300 max-w-full sm:max-w-md mx-auto"
              type="button"
            >
              {reply}
            </button>
          ))}
        </div>
      )}

      {/* Resume options at the end of assessment */}
      {showQuickRepliesAtCorrectPlace() && questionIndex === assessmentQuestions.length && (
        <div className="flex flex-col space-y-2 mt-4">
          <Button
            variant="outline"
            className="w-full justify-start text-left"
            type="button"
            onClick={() => handleResumeUseConfirm(true)}
          >
            Use existing resume
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start text-left"
            type="button"
            onClick={() => handleResumeUseConfirm(false)}
          >
            Upload new resume
          </Button>
        </div>
      )}

      {/* Resume upload form when a new resume is needed */}
      {questionIndex === assessmentQuestions.length && 
       ((!resume) || (resumeUseConfirmed === false)) && (
        <div className="flex flex-col space-y-4 mt-4">
          <label className="text-sm font-medium">Upload your resume (PDF or DOCX):</label>
          <input
            type="file"
            accept=".pdf,.docx"
            onChange={handleFileChange}
            disabled={isTyping || resumeUploading}
            className="block w-full text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-amber-100 file:text-amber-900 hover:file:bg-amber-200 cursor-pointer"
          />
          <Button
            onClick={() => void handleSubmit()}
            disabled={isTyping || resumeUploading || !resumeFile}
            variant="default"
          >
            {resumeUploading ? "Uploading..." : "Upload Resume"}
          </Button>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleSubmit();
        }}
        className="flex items-center space-x-3 border-t border-gray-200 pt-3"
      >
        <input
          className="flex-grow rounded-full border border-gray-300 px-4 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-300 text-sm"
          type="text"
          placeholder="Type your response…"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleInputKeyDown}
          disabled={isTyping || resumeUploading || (questionIndex === assessmentQuestions.length && showQuickReplies)}
          autoComplete="off"
          aria-label="Chat input"
        />
        <Button
          type="submit"
          disabled={
            isTyping ||
            resumeUploading ||
            !inputValue.trim() ||
            (questionIndex === assessmentQuestions.length && showQuickReplies)
          }
          variant="default"
          size="default"
        >
          Send
        </Button>
      </form>

      {careerAdviceReport && (
        <div className="career-advice-report p-4 mt-4 rounded-md bg-amber-50 border border-amber-200 max-w-full whitespace-pre-wrap text-gray-900 text-sm">
          {careerAdviceReport}
        </div>
      )}
    </div>
  );
};

export default CareerAgent;
            
            
// import React, { useState, useEffect, useRef } from "react";
// import { useAuth } from "@/contexts/AuthContext";
// import { v4 as uuidv4 } from "uuid";
// import { Button } from "@/components/ui/button";
// import { supabase } from "@/integrations/supabase/client";

// type SenderType = "system" | "user" | "bot";

// type Message = {
//   id: string;
//   sender: SenderType;
//   text: string;
// };

// const quickReplies = [
//   "I am not happy in my current job (or I am currently in transition) and would like to find another one",
//   "I am interested in exploring other career paths aligned with my skills and experience",
//   "I would like to explore logical next steps and overcome obstacles in my current career path",
//   "I am a recent or soon-to-be college grad looking for potential career paths",
// ];

// const starterMessages = [
//   "I will recommend the best route to your aspirational role, step-by-step. I'll also show you the most promising alternative career paths.",
//   "You'll find specific recommendations on how to fill gaps in your key skills. I will even create a dynamite first draft of your professional pitch! Sound good? Okay, let's do this. It should take less than 8 minutes to answer my questions.",
//   "Choose the statement that best describes your interest in taking a career assessment",
// ];

// const assessmentQuestions = [
//   {
//     id: "q1",
//     label: "Interest in Career Assessment",
//     placeholder: "Choose the statement that best describes your interest in taking a career assessment?",
//   },
//   {
//     id: "q2",
//     label: "Ideal Next Job",
//     placeholder: "So if you woke up tomorrow in your ideal next job, what would that look like?",
//   },
//   {
//     id: "q3",
//     label: "Future Vision",
//     placeholder: "Fast forward 5 years, where do you see yourself?",
//   },
//   {
//     id: "q4",
//     label: "Desired Role",
//     placeholder: "What role would you really want to be in?",
//   },
//   {
//     id: "q5",
//     label: "Seniority Level",
//     placeholder: "How senior would this role be?",
//   },
//   {
//     id: "q6",
//     label: "Career Pivot",
//     placeholder: "Are you thinking about a career pivot? What role would make better use of your talents?",
//   },
//   {
//     id: "q7",
//     label: "Strengths",
//     placeholder: "What would you say are the strengths that set you apart?",
//   },
//   {
//     id: "q8",
//     label: "Weaknesses",
//     placeholder: "What are some skills or abilities that should not feature prominently in your next role?",
//   },
//   {
//     id: "q9",
//     label: "Career Obstacles",
//     placeholder: "What do you see as the biggest obstacle to moving ahead in your career?",
//   },
//   {
//     id: "q10",
//     label: "Past Role Insights",
//     placeholder: "What makes work exciting and satisfying? What makes it boring or frustrating?",
//   },
//   {
//     id: "q11",
//     label: "Self-Reflection",
//     placeholder: "What aspect of your personality is your biggest positive? What has hindered your success?",
//   },
//   {
//     id: "q12",
//     label: "Top Career Priorities",
//     placeholder: "What are your top priorities in your career at this time?",
//   },
//   {
//     id: "q13",
//     label: "Work Engagement",
//     placeholder: "When you get lost in your work, what are you working on? Activities you'd like to do more?",
//   },
// ];

// const dummyCareers: string[] = [
//   "Data Scientist",
//   "Frontend Engineer",
//   "AI Researcher",
//   "Product Manager",
//   "UX Designer",
//   "Business Analyst",
// ];

// const coachAvatarUrl = "/placeholder.svg";

// const LOCAL_STORAGE_KEY = "careerPathwayChat";

// const CareerAgent: React.FC = () => {
//   const { user, isAuthenticated } = useAuth();

//   const [sessionId, setSessionId] = useState<string | null>(null);
//   const [messages, setMessages] = useState<Message[]>([]);
//   const [questionIndex, setQuestionIndex] = useState<number>(-1);
//   const [answers, setAnswers] = useState<Record<string, string>>({});
//   const [resumeFile, setResumeFile] = useState<File | null>(null);
//   const [isTyping, setIsTyping] = useState(false);
//   const [showQuickReplies, setShowQuickReplies] = useState(false);
//   const [reactingMessageId, setReactingMessageId] = useState<string | null>(null);
//   const [userHasResume, setUserHasResume] = useState<boolean | null>(null);
//   const [resumeUseConfirmed, setResumeUseConfirmed] = useState<boolean | null>(null);
//   const [careerAdviceReport, setCareerAdviceReport] = useState<string>('');
//   const scrollAreaRef = useRef<HTMLDivElement>(null);
//   const [inputValue, setInputValue] = useState("");
//   const [resumeNotificationShown, setResumeNotificationShown] = useState(false);

//   useEffect(() => {
//     scrollAreaRef.current?.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: "smooth" });
//   }, [messages, isTyping]);

//   useEffect(() => {
//     const hydrateMessagesAndCheck = async () => {
//       const stored = window.localStorage.getItem(LOCAL_STORAGE_KEY);
//       if (stored) {
//         try {
//           const parsedMessages: Message[] = JSON.parse(stored);
//           const existingStarters = starterMessages.every((starter) =>
//             parsedMessages.some((msg) => msg.text === starter && msg.sender === "bot")
//           );
//           if (existingStarters) {
//             setMessages(parsedMessages);
//             const userAnswersCount = parsedMessages.filter((m) => m.sender === "user" && m.text).length;
//             setQuestionIndex(Math.min(userAnswersCount, assessmentQuestions.length));
//             setShowQuickReplies(userAnswersCount === 0);
//           } else {
//             setMessages(starterMessages.map((text, index) => ({
//               id: `bot_starter_${index}`,
//               sender: "bot",
//               text,
//             })));
//             setShowQuickReplies(true);
//             setQuestionIndex(0);
//           }
//         } catch {
//           setMessages(starterMessages.map((text, index) => ({
//             id: `bot_starter_${index}`,
//             sender: "bot",
//             text,
//           })));
//           setShowQuickReplies(true);
//           setQuestionIndex(0);
//         }
//       } else {
//         setMessages(starterMessages.map((text, index) => ({
//           id: `bot_starter_${index}`,
//           sender: "bot",
//           text,
//         })));
//         setShowQuickReplies(true);
//         setQuestionIndex(0);
//       }

//       if (user) {
//         try {
//           const { data, error } = await supabase
//             .from("resumes")
//             .select("id")
//             .eq("user_id", user.id)
//             .limit(1)
//             .maybeSingle();

//           if (error) {
//             console.error("Error checking resume existence:", error);
//             setUserHasResume(null);
//           } else {
//             const hasResume = !!data;
//             setUserHasResume(hasResume);
            
//             // If there's a stored conversation, check for resume notification
//             if (stored) {
//               const parsedMessages: Message[] = JSON.parse(stored);
//               const resumeNotificationExists = parsedMessages.some(msg => 
//                 msg.sender === "bot" && msg.text.includes("found an existing resume on file")
//               );
//               setResumeNotificationShown(resumeNotificationExists);
//             }
//           }
//         } catch (e) {
//           console.error("Exception during resume check:", e);
//           setUserHasResume(null);
//         }
//       }
//     };

//     hydrateMessagesAndCheck();
//   }, [user]);

//   useEffect(() => {
//     if (isAuthenticated && !sessionId) {
//       setSessionId(uuidv4());
//     }
//   }, [isAuthenticated, sessionId]);

//   useEffect(() => {
//     if (messages.length === 0) return;
//     window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(messages));
//   }, [messages]);

//   if (!isAuthenticated) {
//     return (
//       <div className="container mx-auto max-w-3xl p-6 flex flex-col min-h-screen justify-center items-center bg-white">
//         <p className="text-lg text-center text-muted-foreground">
//           Please log in to access the Career Pathway Agent.
//         </p>
//       </div>
//     );
//   }

//   const handleResetChat = () => {
//     setMessages(starterMessages.map((text, index) => ({
//       id: `bot_starter_${index}`,
//       sender: "bot",
//       text,
//     })));
//     setShowQuickReplies(true);
//     setQuestionIndex(0);
//     setAnswers({});
//     setInputValue("");
//     setResumeFile(null);
//     setUserHasResume(null);
//     setResumeUseConfirmed(null);
//     setCareerAdviceReport('');
//     setResumeNotificationShown(false);
//     window.localStorage.removeItem(LOCAL_STORAGE_KEY);
//   };

//   const handleQuickReply = (replyText: string) => {
//     if (isTyping) return;

//     const userMessage: Message = {
//       id: `user_${Date.now()}`,
//       sender: "user",
//       text: replyText,
//     };

//     setMessages((prev) => [...prev, userMessage]);
//     setIsTyping(true);
//     setShowQuickReplies(false);

//     setAnswers((prev) => ({
//       ...prev,
//       [assessmentQuestions[0].id]: replyText,
//     }));

//     (async () => {
//       if (sessionId && user) {
//         try {
//           await supabase.from("career_assessments").insert({
//             user_id: user.id,
//             session_id: sessionId,
//             question: assessmentQuestions[0].id,
//             answer: replyText,
//           });
//         } catch (error) {
//           console.error("Error saving assessment answer:", error);
//         }
//       }
//     })();

//     setTimeout(() => {
//       const nextQuestion = assessmentQuestions[1];
//       const botMessage: Message = {
//         id: `bot_${Date.now()}`,
//         sender: "bot",
//         text: `Next question: ${nextQuestion.label}. ${nextQuestion.placeholder}`,
//       };
//       setMessages((prev) => [...prev, botMessage]);
//       setIsTyping(false);
//       setQuestionIndex(1);
//     }, 700);
//   };

//   const handleResumeUseConfirm = (useExisting: boolean) => {
//     setResumeUseConfirmed(useExisting);
//     const userText = useExisting ? "Use existing resume" : "Upload new resume";
//     const userMessage: Message = {
//       id: `user_resume_confirm_${Date.now()}`,
//       sender: "user",
//       text: userText,
//     };
//     setMessages((prev) => [...prev, userMessage]);

//     setShowQuickReplies(false);

//     if (useExisting) {
//       // Use existing resume: advance to career advice generation step
//       const botMsg: Message = {
//         id: `bot_resume_use_confirm_${Date.now()}`,
//         sender: "bot",
//         text: "Using your existing resume on file for personalized career advice.",
//       };
//       setMessages((prev) => [...prev, botMsg]);
      
//       // Start report generation
//       const botMessageLoading: Message = {
//         id: `bot_${Date.now()}`,
//         sender: "bot",
//         text: "Thank you for your answers! I'm working on your career pathway report now; it may take about 2 minutes to generate additional insights...",
//       };
//       setMessages((prev) => [...prev, botMessageLoading]);
      
//       // Generate career advice report
//       (async () => {
//         if (!user) return;
//         const quizAnswersPayload: Record<number, string> = {};
//         assessmentQuestions.forEach((q) => {
//           if (answers[q.id]) {
//             quizAnswersPayload[q.id] = answers[q.id];
//           }
//         });

//         let resumeText = null;
//         try {
//           const { data, error } = await supabase
//             .from('resumes')
//             .select('text')
//             .eq('user_id', user.id)
//             .limit(1)
//             .maybeSingle();

//           if (!error && data && data.text) {
//             resumeText = data.text;
//           }
//         } catch (err) {
//           console.error("Error fetching resume text", err);
//         }

//         const prompt = `Here are outputs from a career chat:
// - A set of recommended roles with descriptions & salary bands
// - A table of skills and matching courses
// - A narrative of next-step career recommendations
// - A 'Roles that might be right for you' list
// - A 'Path to your aspirational role' carousel
// Please combine these data points with the user's quiz answers to generate a personalized career-advice report.`;

//         const payload = {
//           prompt,
//           Quizquestions: assessmentQuestions,
//           quizAnswers: quizAnswersPayload,
//           resumeText: resumeText || null,
//         };

//         try {
//           const { data, error } = await supabase.functions.invoke('evaluateCareerAdvice', {
//             method: 'POST',
//             body: JSON.stringify(payload),
//           });

//           if (error) {
//             console.error("Error invoking evaluateCareerAdvice:", error);
//             const errMsg = "Failed to get career advice. Please try again later.";
//             setCareerAdviceReport(errMsg);
//             setMessages((prev) => [
//               ...prev,
//               { id: `bot_error_${Date.now()}`, sender: "bot", text: errMsg },
//             ]);
//             return;
//           }

//           const resultText = typeof data === "string" ? data : data.generatedText || JSON.stringify(data);
//           setCareerAdviceReport(resultText);

//           const botMessageReport: Message = {
//             id: `bot_report_${Date.now()}`,
//             sender: "bot",
//             text: resultText,
//           };

//           setMessages((prev) => [...prev, botMessageReport]);
//         } catch (e) {
//           console.error("Error during career advice evaluation:", e);
//           const errMsg = "Failed to get career advice. Please try again later.";
//           setCareerAdviceReport(errMsg);
//           setMessages((prev) => [
//             ...prev,
//             { id: `bot_error_${Date.now()}`, sender: "bot", text: errMsg },
//           ]);
//         }
//       })();
//     } else {
//       // User wants to upload a new resume - no need to immediately start report generation
//       const botMsg: Message = {
//         id: `bot_resume_upload_prompt_${Date.now()}`,
//         sender: "bot",
//         text: "Please upload your resume to receive personalized career advice.",
//       };
//       setMessages((prev) => [...prev, botMsg]);
//     }
//   };

//   const handleSubmit = async () => {
//     if (isTyping) return;

//     // Check if we need to show resume options
//     if (questionIndex === assessmentQuestions.length && userHasResume && resumeUseConfirmed === null) {
//       if (!resumeNotificationShown) {
//         // First, show the message that a resume was found
//         const resumeFoundMsg: Message = {
//           id: `bot_resume_found_${Date.now()}`,
//           sender: "bot",
//           text: "I found an existing resume on file. Would you like to use this resume or upload a new one?",
//         };
//         setMessages((prev) => [...prev, resumeFoundMsg]);
//         setResumeNotificationShown(true);
//       }
      
//       setShowQuickReplies(true);
//       return;
//     }

//     if (questionIndex >= 0 && questionIndex < assessmentQuestions.length) {
//       if (!inputValue.trim()) return;

//       const userMessage: Message = {
//         id: `user_${Date.now()}`,
//         sender: "user",
//         text: inputValue.trim(),
//       };
//       setMessages((prev) => [...prev, userMessage]);
//       setIsTyping(true);

//       const currentQuestion = assessmentQuestions[questionIndex];
//       setAnswers((prev) => ({ ...prev, [currentQuestion.id]: inputValue.trim() }));

//       if (sessionId && user) {
//         try {
//           await supabase.from("career_assessments").insert({
//             user_id: user.id,
//             session_id: sessionId,
//             question: currentQuestion.id,
//             answer: inputValue.trim(),
//           });
//         } catch (error) {
//           console.error("Error saving assessment answer:", error);
//         }
//       }

//       setInputValue("");

//       setTimeout(() => {
//         const nextIndex = questionIndex + 1;
//         setIsTyping(false);
//         setQuestionIndex(nextIndex);

//         if (nextIndex < assessmentQuestions.length) {
//           const nextQ = assessmentQuestions[nextIndex];
//           const botMessage: Message = {
//             id: `bot_${Date.now()}`,
//             sender: "bot",
//             text: `Next question: ${nextQ.label}. ${nextQ.placeholder}`,
//           };
//           setMessages((prev) => [...prev, botMessage]);
//         } else {
//           // If we've reached the end of questions
//           if (userHasResume) {
//             // If user has a resume, show the resume found message
//             const resumeFoundMsg: Message = {
//               id: `bot_resume_found_${Date.now()}`,
//               sender: "bot",
//               text: "I found an existing resume on file. Would you like to use this resume or upload a new one?",
//             };
//             setMessages((prev) => [...prev, resumeFoundMsg]);
//             setResumeNotificationShown(true);
//             setShowQuickReplies(true);
//           } else {
//             // If no existing resume, show upload prompt
//             const noResumeMsg: Message = {
//               id: `bot_no_resume_${Date.now()}`,
//               sender: "bot",
//               text: "Please upload your resume to receive personalized career advice.",
//             };
//             setMessages((prev) => [...prev, noResumeMsg]);
//           }
//         }
//       }, 1200);
//     } else if (questionIndex === assessmentQuestions.length && resumeUseConfirmed === false) {
//       // Handle new resume upload when user chose to upload a new one
//       if (!resumeFile) {
//         alert("Please upload your resume file to continue.");
//         return;
//       }

//       setIsTyping(true);

//       const userMessage: Message = {
//         id: `user_${Date.now()}`,
//         sender: "user",
//         text: `Uploaded resume file: ${resumeFile.name}`,
//       };
//       setMessages((prev) => [...prev, userMessage]);

//       try {
//         const uploadSuccess = await userResumeUpload(resumeFile);
//         if (uploadSuccess) {
//           const botMessage: Message = {
//             id: `bot_${Date.now()}`,
//             sender: "bot",
//             text: "Resume uploaded successfully! Based on your inputs, here are some career recommendations:",
//           };

//           setMessages((prev) => [...prev, botMessage]);

//           // Start report generation with new resume
//           const botMessageLoading: Message = {
//             id: `bot_${Date.now()}`,
//             sender: "bot",
//             text: "I'm working on your career pathway report now; it may take about 2 minutes to generate additional insights...",
//           };
//           setMessages((prev) => [...prev, botMessageLoading]);
          
//           // Generate report with new resume
//           (async () => {
//             if (!user) return;
//             const quizAnswersPayload: Record<number, string> = {};
//             assessmentQuestions.forEach((q) => {
//               if (answers[q.id]) {
//                 quizAnswersPayload[q.id] = answers[q.id];
//               }
//             });

//             const prompt = `Here are outputs from a career chat:
// - A set of recommended roles with descriptions & salary bands
// - A table of skills and matching courses
// - A narrative of next-step career recommendations
// - A 'Roles that might be right for you' list
// - A 'Path to your aspirational role' carousel
// Please combine these data points with the user's quiz answers to generate a personalized career-advice report.`;

//             const payload = {
//               prompt,
//               Quizquestions: assessmentQuestions,
//               quizAnswers: quizAnswersPayload,
//               resumeText: "New resume uploaded", // This would normally be text extracted from the resume
//             };

//             try {
//               const { data, error } = await supabase.functions.invoke('evaluateCareerAdvice', {
//                 method: 'POST',
//                 body: JSON.stringify(payload),
//               });

//               if (error) {
//                 console.error("Error invoking evaluateCareerAdvice:", error);
//                 const errMsg = "Failed to get career advice. Please try again later.";
//                 setCareerAdviceReport(errMsg);
//                 setMessages((prev) => [
//                   ...prev,
//                   { id: `bot_error_${Date.now()}`, sender: "bot", text: errMsg },
//                 ]);
//                 return;
//               }

//               const resultText = typeof data === "string" ? data : data.generatedText || JSON.stringify(data);
//               setCareerAdviceReport(resultText);

//               const botMessageReport: Message = {
//                 id: `bot_report_${Date.now()}`,
//                 sender: "bot",
//                 text: resultText,
//               };

//               setMessages((prev) => [...prev, botMessageReport]);
//             } catch (e) {
//               console.error("Error during career advice evaluation:", e);
//               const errMsg = "Failed to get career advice. Please try again later.";
//               setCareerAdviceReport(errMsg);
//               setMessages((prev) => [
//                 ...prev,
//                 { id: `bot_error_${Date.now()}`, sender: "bot", text: errMsg },
//               ]);
//             }
//           })();
//         } else {
//           const botMessage: Message = {
//             id: `bot_${Date.now()}`,
//             sender: "bot",
//             text: "Failed to upload resume. Please try again.",
//           };
//           setMessages((prev) => [...prev, botMessage]);
//         }
//       } catch (error) {
//         console.error("Error uploading resume:", error);
//         const botMessage: Message = {
//           id: `bot_${Date.now()}`,
//           sender: "bot",
//           text: "An error occurred uploading your resume. Please try again later.",
//         };
//         setMessages((prev) => [...prev, botMessage]);
//       } finally {
//         setIsTyping(false);
//         setResumeFile(null);
//       }
//     } else if (questionIndex === assessmentQuestions.length && userHasResume === false) {
//       // Handle case when user doesn't have a resume and needs to upload one
//       if (!resumeFile) {
//         alert("Please upload your resume file to continue.");
//         return;
//       }

//       setIsTyping(true);

//       const userMessage: Message = {
//         id: `user_${Date.now()}`,
//         sender: "user",
//         text: `Uploaded resume file: ${resumeFile.name}`,
//       };
//       setMessages((prev) => [...prev, userMessage]);

//       try {
//         const uploadSuccess = await userResumeUpload(resumeFile);
//         if (uploadSuccess) {
//           const botMessage: Message = {
//             id: `bot_${Date.now()}`,
//             sender: "bot",
//             text: "Resume uploaded successfully! Based on your inputs, here are some career recommendations:",
//           };

//           setMessages((prev) => [...prev, botMessage]);

//           // Start report generation with new resume
//           const botMessageLoading: Message = {
//             id: `bot_${Date.now()}`,
//             sender: "bot",
//             text: "I'm working on your career pathway report now; it may take about 2 minutes to generate additional insights...",
//           };
//           setMessages((prev) => [...prev, botMessageLoading]);
          
//           // Generate report with new resume
//           (async () => {
//             if (!user) return;
//             const quizAnswersPayload: Record<number, string> = {};
//             assessmentQuestions.forEach((q) => {
//               if (answers[q.id]) {
//                 quizAnswersPayload[q.id] = answers[q.id];
//               }
//             });

//             const prompt = `Here are outputs from a career chat:
// - A set of recommended roles with descriptions & salary bands
// - A table of skills and matching courses
// - A narrative of next-step career recommendations
// - A 'Roles that might be right for you' list
// - A 'Path to your aspirational role' carousel
// Please combine these data points with the user's quiz answers to generate a personalized career-advice report.`;

//             const payload = {
//               prompt,
//               Quizquestions: assessmentQuestions,
//               quizAnswers: quizAnswersPayload,
//               resumeText: "New resume uploaded", // This would normally be text extracted from the resume
//             };

//             try {
//               const { data, error } = await supabase.functions.invoke('evaluateCareerAdvice', {
//                 method: 'POST',
//                 body: JSON.stringify(payload),
//               });

//               if (error) {
//                 console.error("Error invoking evaluateCareerAdvice:", error);
//                 const errMsg = "Failed to get career advice. Please try again later.";
//                 setCareerAdviceReport(errMsg);
//                 setMessages((prev) => [
//                   ...prev,
//                   { id: `bot_error_${Date.now()}`, sender: "bot", text: errMsg },
//                 ]);
//                 return;
//               }

//               const resultText = typeof data === "string" ? data : data.generatedText || JSON.stringify(data);
//               setCareerAdviceReport(resultText);

//               const botMessageReport: Message = {
//                 id: `bot_report_${Date.now()}`,
//                 sender: "bot",
//                 text: resultText,
//               };

//               setMessages((prev) => [...prev, botMessageReport]);
//             } catch (e) {
//               console.error("Error during career advice evaluation:", e);
//               const errMsg = "Failed to get career advice. Please try again later.";
//               setCareerAdviceReport(errMsg);
//               setMessages((prev) => [
//                 ...prev,
//                 { id: `bot_error_${Date.now()}`, sender: "bot", text: errMsg },
//               ]);
//             }
//           })();
//         } else {
//           const botMessage: Message = {
//             id: `bot_${Date.now()}`,
//             sender: "bot",
//             text: "Failed to upload resume. Please try again.",
//           };
//           setMessages((prev) => [...prev, botMessage]);
//         }
//       } catch (error) {
//         console.error("Error uploading resume:", error);
//         const botMessage: Message = {
//           id: `bot_${Date.now()}`,
//           sender: "bot",
//           text: "An error occurred uploading your resume. Please try again later.",
//         };
//         setMessages((prev) => [...prev, botMessage]);
//       } finally {
//         setIsTyping(false);
//         setResumeFile(null);
//       }
//     }
//   };

//   const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
//     if (e.key === "Enter") {
//       e.preventDefault();
//       if (questionIndex >= 0 && questionIndex <= assessmentQuestions.length) {
//         if (inputValue.trim()) {
//           void handleSubmit();
//         }
//       }
//     }
//   };

//   const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
//     if (e.target.files && e.target.files.length > 0) {
//       setResumeFile(e.target.files[0]);
//     }
//   };

//   const userResumeUpload = async (file: File): Promise<boolean> => {
//     await new Promise((r) => setTimeout(r, 1200));
//     return true;
//   };

//   const handleEmojiClick = (msgId: string, emoji: string) => {
//     alert(`You reacted to message ${msgId} with ${emoji}`);
//     setReactingMessageId(null);
//   };

//   const showQuickRepliesAtCorrectPlace = () => {
//     if (!showQuickReplies) return false;
//     // Only show the initial quick replies when we're at question 0
//     if (questionIndex === 0) {
//       const botThirdMsg = messages.find((m) => m.text === starterMessages[2] && m.sender === "bot");
//       return !!botThirdMsg;
//     }
//     return false;
//   };

//   const getUserInitials = (name: string | undefined) => {
//     if (!name) return "U";
//     const parts = name.trim().split(" ");
//     if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
//     return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
//   };

//   return (
//     <div className="container mx-auto max-w-3xl p-6 flex flex-col min-h-screen bg-white rounded-lg shadow-md">
//       <div className="flex justify-between items-center mb-4">
//         <h1 className="text-4xl font-bold text-amber-600">Career Pathway Agent</h1>
//         <Button variant="outline" onClick={handleResetChat} size="sm" className="ml-4">
//           Reset Chat
//         </Button>
//       </div>

//       <div
//         ref={scrollAreaRef}
//         role="log"
//         aria-live="polite"
//         className="flex-1 overflow-y-auto space-y-4 max-h-[60vh] mb-6 pr-2"
//       >
//         {messages.map((msg, idx) => {
//           const isBot = msg.sender === "bot";
//           const isUser = msg.sender === "user";
//           const firstBotIndex = messages.findIndex((m) => m.sender === "bot");

//           return (
//             <div
//               key={msg.id}
//               className={`flex items-end max-w-full ${
//                 isBot ? "justify-start" : "justify-end"
//               } group`}
//               onMouseLeave={() => {
//                 if (reactingMessageId === msg.id) {
//                   setReactingMessageId(null);
//                 }
//               }}
//               onTouchEnd={() => {
//                 if (reactingMessageId === msg.id) {
//                   setReactingMessageId(null);
//                 }
//               }}
//             >
//               {isBot && idx === firstBotIndex && (
//                 <div
//                   className="w-9 h-9 rounded-full mr-3 flex items-center justify-center bg-amber-100 select-none text-amber-600 font-semibold text-sm"
//                   aria-label="Coach Avatar"
//                 >
//                   <img
//                     src={coachAvatarUrl}
//                     alt="Career Coach Avatar"
//                     className="w-full h-full rounded-full object-cover"
//                     draggable={false}
//                     onError={(e) => {
//                       const target = e.currentTarget as HTMLImageElement;
//                       target.style.display = "none";
//                     }}
//                   />
//                   <span className="sr-only">IC</span>
//                 </div>
//               )}

//               {isUser && (
//                 <div
//                   className="w-9 h-9 rounded-full ml-3 flex items-center justify-center bg-gray-300 select-none text-gray-700 font-semibold text-sm"
//                   aria-label="User Avatar"
//                 >
//                   {user?.user_metadata?.avatar_url ? (
//                     <img
//                       src={user.user_metadata.avatar_url}
//                       alt="User Avatar"
//                       className="w-full h-full rounded-full object-cover"
//                       draggable={false}
//                     />
//                   ) : (
//                     <span>{getUserInitials(user?.name)}</span>
//                   )}
//                 </div>
//               )}

//               <div
//                 className={`relative max-w-[75%] px-5 py-3 rounded-3xl break-words text-sm
//                   ${
//                     isBot
//                       ? "bg-amber-50 text-gray-900 shadow-md/[0_2px_8px_rgba(0,0,0,0.06)]"
//                       : "bg-gray-100 text-gray-900 shadow/[0_2px_6px_rgba(0,0,0,0.10)]"
//                   }
//                 `}
//                 onMouseEnter={() => {
//                   if (isBot) setReactingMessageId(msg.id);
//                 }}
//                 onTouchStart={() => {
//                   if (isBot) setReactingMessageId(msg.id);
//                 }}
//               >
//                 <p className="whitespace-pre-wrap">{msg.text}</p>
//                 {reactingMessageId === msg.id && (
//                   <div className="absolute -top-8 left-0 flex space-x-1 bg-white rounded-md shadow-lg p-1 text-lg select-none z-50">
//                     {["👍", "❤️", "💡"].map((emoji) => (
//                       <button
//                         key={emoji}
//                         onClick={() => handleEmojiClick(msg.id, emoji)}
//                         className="hover:bg-gray-200 rounded-md p-1"
//                         type="button"
//                       >
//                         {emoji}
//                       </button>
//                     ))}
//                   </div>
//                 )}
//               </div>
//             </div>
//           );
//         })}
//         {isTyping && (
//           <div className="flex items-center space-x-3">
//             <div
//               className="w-9 h-9 rounded-full select-none flex items-center justify-center bg-amber-100 text-amber-600 font-semibold"
//               aria-label="Coach Avatar Typing"
//             >
//               <img
//                 src={coachAvatarUrl}
//                 alt="Career Coach Avatar"
//                 className="w-full h-full rounded-full object-cover"
//                 draggable={false}
//                 onError={(e) => {
//                   const target = e.currentTarget as HTMLImageElement;
//                   target.style.display = "none";
//                 }}
//               />
//               <span className="sr-only">IC</span>
//             </div>
//             <div className="italic text-gray-500 select-none">Coach is typing...</div>
//           </div>
//         )}
//       </div>

//       {/* First question quick replies */}
//       {showQuickRepliesAtCorrectPlace() && (
//         <div className="flex flex-col space-y-3 mb-4">
//           {quickReplies.map((reply, idx) => (
//             <button
//               key={idx}
//               onClick={() => handleQuickReply(reply)}
//               className="rounded-full px-6 py-3 border border-gray-300 text-gray-900 text-left hover:bg-amber-100 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-300 max-w-full sm:max-w-md mx-auto"
//               type="button"
//             >
//               {reply}
//             </button>
//           ))}
//         </div>
//       )}

//       {/* Resume options at the end of assessment */}
//       {showQuickReplies && questionIndex === assessmentQuestions.length && userHasResume && resumeUseConfirmed === null && (
//         <div className="flex flex-col space-y-2 mt-4">
//           <Button
//             variant="outline"
//             className="w-full justify-start text-left"
//             type="button"
//             onClick={() => handleResumeUseConfirm(true)}
//           >
//             Use existing resume
//           </Button>
//           <Button
//             variant="outline"
//             className="w-full justify-start text-left"
//             type="button"
//             onClick={() => handleResumeUseConfirm(false)}
//           >
//             Upload new resume
//           </Button>
//         </div>
//       )}

//       {/* Resume upload form when a new resume is needed */}
//       {questionIndex === assessmentQuestions.length && 
//        ((userHasResume === false) || (resumeUseConfirmed === false)) && (
//         <div className="flex flex-col space-y-4 mt-4">
//           <label className="text-sm font-medium">Upload your resume (PDF or DOCX):</label>
//           <input
//             type="file"
//             accept=".pdf,.docx"
//             onChange={handleFileChange}
//             disabled={isTyping}
//             className="block w-full text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-amber-100 file:text-amber-900 hover:file:bg-amber-200 cursor-pointer"
//           />
//           <Button
//             onClick={() => void handleSubmit()}
//             disabled={isTyping || !resumeFile}
//             variant="default"
//           >
//             Send
//           </Button>
//         </div>
//       )}

//       <form
//         onSubmit={(e) => {
//           e.preventDefault();
//           void handleSubmit();
//         }}
//         className="flex items-center space-x-3 border-t border-gray-200 pt-3"
//       >
//         <input
//           className="flex-grow rounded-full border border-gray-300 px-4 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-300 text-sm"
//           type="text"
//           placeholder="Type your response…"
//           value={inputValue}
//           onChange={(e) => setInputValue(e.target.value)}
//           onKeyDown={handleInputKeyDown}
//           disabled={isTyping || (questionIndex === assessmentQuestions.length && userHasResume && resumeUseConfirmed === null)}
//           autoComplete="off"
//           aria-label="Chat input"
//         />
//         <Button
//           type="submit"
//           disabled={
//             isTyping ||
//             !inputValue.trim() ||
//             (questionIndex === assessmentQuestions.length && userHasResume && resumeUseConfirmed === null)
//           }
//           variant="default"
//           size="default"
//         >
//           Send
//         </Button>
//       </form>

//       {careerAdviceReport && (
//         <div className="career-advice-report p-4 mt-4 rounded-md bg-amber-50 border border-amber-200 max-w-full whitespace-pre-wrap text-gray-900 text-sm">
//           {careerAdviceReport}
//         </div>
//       )}
//     </div>
//   );
// };

// export default CareerAgent;