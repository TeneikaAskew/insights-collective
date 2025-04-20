
import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { v4 as uuidv4 } from "uuid";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

/**
 * Type definitions
 */

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

// Static three starter AI messages as requested
const starterMessages = [
  "I will recommend the best route to your aspirational role, step-by-step. I'll also show you the most promising alternative career paths.",
  "You'll find specific recommendations on how to fill gaps in your key skills. I will even create a dynamite first draft of your professional pitch! Sound good? Okay, let's do this. It should take less than 8 minutes to answer my questions.",
  "Choose the statement that best describes your interest in taking a career assessment",
];

// Assessment questions list as given (to maintain question flow)
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

// Dummy career recommendations
const dummyCareers: string[] = [
  "Data Scientist",
  "Frontend Engineer",
  "AI Researcher",
  "Product Manager",
  "UX Designer",
  "Business Analyst",
];

const avatarUrl = "/placeholder.svg"; // Put actual coach avatar url here

const CareerAgent: React.FC = () => {
  const { user, isAuthenticated } = useAuth();

  // All hooks at top level, unconditionally
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [questionIndex, setQuestionIndex] = useState<number>(-1); // start before questions to show initial 3 AI messages + quick replies
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(true);
  const [inputValue, setInputValue] = useState("");
  const [reactingMessageId, setReactingMessageId] = useState<string | null>(null);

  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on messages or typing changes
  useEffect(() => {
    scrollAreaRef.current?.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isTyping]);

  // On login, initiate session and initial messages
  useEffect(() => {
    if (isAuthenticated && !sessionId) {
      const newSessionId = uuidv4();
      setSessionId(newSessionId);

      // Add the 3 starter AI messages with delay and typing effect
      (async () => {
        setIsTyping(true);
        for (let i = 0; i < starterMessages.length; i++) {
          await new Promise((resolve) => setTimeout(resolve, 600)); // typing delay 600ms
          setMessages((prev) => [
            ...prev,
            {
              id: `bot_starter_${i}`,
              sender: "bot",
              text: starterMessages[i],
            },
          ]);
        }
        setIsTyping(false);
      })();
    }
  }, [isAuthenticated, sessionId]);

  // After starter messages shown, show quick replies
  useEffect(() => {
    if (
      messages.length === starterMessages.length && // all 3 starter messages displayed
      !isTyping &&
      showQuickReplies
    ) {
      setShowQuickReplies(true);
      setQuestionIndex(0); // start questions from the first question
    }
  }, [messages, isTyping, showQuickReplies]);

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto max-w-3xl p-6 flex flex-col min-h-screen justify-center items-center">
        <p className="text-lg text-center text-muted-foreground">
          Please log in to access the Career Pathway Agent.
        </p>
      </div>
    );
  }

  // Handles user selecting a quick reply for first question
  const handleQuickReply = (replyText: string) => {
    if (isTyping) return;

    // Append user quick reply as message bubble on right
    const userMessage: Message = {
      id: `user_${Date.now()}`,
      sender: "user",
      text: replyText,
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsTyping(true);
    setShowQuickReplies(false);

    // Save answer for q1
    setAnswers((prev) => ({
      ...prev,
      [assessmentQuestions[0].id]: replyText,
    }));

    // Store answer in database
    (async () => {
      if (sessionId && user) {
        try {
          await supabase.from("career_assessments").insert({
            user_id: user.id,
            session_id: sessionId,
            question: assessmentQuestions[0].id,
            answer: replyText,
          });
        } catch (error) {
          console.error("Error saving assessment answer:", error);
        }
      }
    })();

    // After short delay, show next question AI bubble with typing delay
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

  // Handle input enter for subsequent questions (text inputs from q2 onwards)
  const handleSubmit = async () => {
    if (isTyping) return;

    // Handling the normal question-answer flow for questions 2 to 13 and resume upload
    if (questionIndex >= 1 && questionIndex < assessmentQuestions.length) {
      if (!inputValue.trim()) return;

      // Append user message
      const userMessage: Message = {
        id: `user_${Date.now()}`,
        sender: "user",
        text: inputValue.trim(),
      };
      setMessages((prev) => [...prev, userMessage]);
      setIsTyping(true);

      const currentQuestion = assessmentQuestions[questionIndex];
      setAnswers((prev) => ({ ...prev, [currentQuestion.id]: inputValue.trim() }));

      // Save answer to DB
      if (sessionId && user) {
        try {
          await supabase.from("career_assessments").insert({
            user_id: user.id,
            session_id: sessionId,
            question: currentQuestion.id,
            answer: inputValue.trim(),
          });
        } catch (error) {
          console.error("Error saving assessment answer:", error);
        }
      }

      setInputValue("");

      setTimeout(() => {
        // Proceed to next question or next step
        const nextIndex = questionIndex + 1;
        setIsTyping(false);
        setQuestionIndex(nextIndex);

        if (nextIndex < assessmentQuestions.length) {
          const nextQ = assessmentQuestions[nextIndex];
          const botMessage: Message = {
            id: `bot_${Date.now()}`,
            sender: "bot",
            text: `Next question: ${nextQ.label}. ${nextQ.placeholder}`,
          };
          setMessages((prev) => [...prev, botMessage]);
        } else {
          // End of questions, prompt resume upload
          const botMessage: Message = {
            id: `bot_${Date.now()}`,
            sender: "bot",
            text: "Thank you for your answers! Please upload your resume to help us provide career recommendations.",
          };
          setMessages((prev) => [...prev, botMessage]);
        }
      }, 1200);
    } else if (questionIndex === assessmentQuestions.length) {
      // Resume upload step
      if (!resumeFile) return;
      setIsTyping(true);

      // Show user resume upload message
      const userMessage: Message = {
        id: `user_${Date.now()}`,
        sender: "user",
        text: `Uploaded resume file: ${resumeFile.name}`,
      };
      setMessages((prev) => [...prev, userMessage]);

      try {
        const uploadSuccess = await userResumeUpload(resumeFile);
        if (uploadSuccess) {
          const botMessage: Message = {
            id: `bot_${Date.now()}`,
            sender: "bot",
            text: "Resume uploaded successfully! Based on your inputs, here are some career recommendations:",
          };

          const careerMessages: Message[] = dummyCareers.map((career) => ({
            id: `career_${career}_${Date.now()}`,
            sender: "bot",
            text: `• ${career} - This is a recommended career based on your skills and interests.`,
          }));

          setMessages((prev) => [...prev, botMessage, ...careerMessages]);
          setQuestionIndex(questionIndex + 1);
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
    } else if (questionIndex === assessmentQuestions.length + 1) {
      // Final dashboard welcome
      const botMessage: Message = {
        id: `bot_${Date.now()}`,
        sender: "bot",
        text: "Welcome to your personalized dashboard overview! Here's your next action list:\n- Complete your profile\n- Review recommended career paths\n- Start applying for internships\n- Schedule a mentorship session",
      };
      setMessages((prev) => [...prev, botMessage]);
      setQuestionIndex(questionIndex + 1);
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (questionIndex >= 1 && questionIndex < assessmentQuestions.length) {
        if (inputValue.trim()) {
          void handleSubmit();
        }
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setResumeFile(e.target.files[0]);
    }
  };

  // Stub for resume upload wrapper
  const userResumeUpload = async (file: File): Promise<boolean> => {
    // Implement with your resume upload logic or reuse useResume() hook's uploadResume
    // For now, simulate upload delay and success
    await new Promise((r) => setTimeout(r, 1200));
    return true;
  };

  // Emoji reaction feature - just display a simple emoji picker on AI messages on hover (basic)
  const emojis = ["👍", "❤️", "💡"];

  const handleEmojiClick = (msgId: string, emoji: string) => {
    alert(`You reacted to message ${msgId} with ${emoji}`);
    setReactingMessageId(null);
  };

  return (
    <div className="container mx-auto max-w-3xl p-6 flex flex-col min-h-screen bg-white rounded-lg shadow-md">
      <h1 className="text-4xl font-bold text-amber-600 mb-6">Career Pathway Agent</h1>

      <div
        ref={scrollAreaRef}
        role="log"
        aria-live="polite"
        className="flex-1 overflow-y-auto space-y-4 max-h-[60vh] mb-6 pr-2"
      >
        {messages.map((msg, idx) => {
          const isBot = msg.sender === "bot";
          const isUser = msg.sender === "user";
          const isFirstBot = isBot && idx === 0;
          return (
            <div
              key={msg.id}
              className={`flex items-end ${
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
              {isBot && isFirstBot && (
                <img
                  src={avatarUrl}
                  alt="Career Coach Avatar"
                  className="w-9 h-9 rounded-full mr-3 select-none"
                  draggable={false}
                />
              )}
              <div
                className={`relative max-w-[75%] px-4 py-3 rounded-2xl break-words ${
                  isBot ? "bg-amber-50 text-gray-900 shadow-md" : "bg-gray-100 text-gray-900 shadow"
                }`}
                onMouseEnter={() => {
                  if (isBot) setReactingMessageId(msg.id);
                }}
                onTouchStart={() => {
                  if (isBot) setReactingMessageId(msg.id);
                }}
              >
                <p className="whitespace-pre-wrap">{msg.text}</p>
                {/* Emoji reaction popup */}
                {reactingMessageId === msg.id && (
                  <div className="absolute -top-8 left-0 flex space-x-1 bg-white rounded-md shadow-lg p-1 text-lg select-none z-50">
                    {emojis.map((emoji) => (
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
            </div>
          );
        })}

        {isTyping && (
          <div className="flex items-center space-x-3">
            <img
              src={avatarUrl}
              alt="Career Coach Avatar"
              className="w-9 h-9 rounded-full select-none"
              draggable={false}
            />
            <div className="italic text-gray-500 select-none">Coach is typing...</div>
          </div>
        )}
      </div>

      {/* Quick reply buttons - only show after starter 3 bulleted AI messages and before first question answered */}
      {showQuickReplies && messages.length === starterMessages.length && !isTyping && (
        <div className="flex flex-col space-y-3">
          {quickReplies.map((reply, idx) => (
            <Button
              key={idx}
              variant="outline"
              size="lg"
              className="text-left rounded-full px-6 py-3 hover:bg-amber-100"
              onClick={() => handleQuickReply(reply)}
            >
              {reply}
            </Button>
          ))}
        </div>
      )}

      {/* Input for questions starting from second question */}
      {!showQuickReplies && questionIndex >= 1 && questionIndex < assessmentQuestions.length && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSubmit();
          }}
          className="flex items-center space-x-3"
        >
          <input
            className="flex-grow rounded-full border border-gray-300 px-4 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
            type="text"
            placeholder={assessmentQuestions[questionIndex]?.placeholder || "Type your answer..."}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleInputKeyDown}
            autoFocus
            disabled={isTyping}
          />
          <Button
            type="submit"
            disabled={isTyping || inputValue.trim() === ""}
            variant="default"
            size="default"
          >
            Send
          </Button>
        </form>
      )}

      {/* Resume upload step */}
      {!showQuickReplies && questionIndex === assessmentQuestions.length && (
        <div className="flex flex-col space-y-4">
          <label className="text-sm font-medium">Upload your resume (PDF or DOCX):</label>
          <input
            type="file"
            accept=".pdf,.docx"
            onChange={handleFileChange}
            disabled={isTyping}
            className="block w-full text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-amber-100 file:text-amber-900 hover:file:bg-amber-200 cursor-pointer"
          />
          <Button
            onClick={() => void handleSubmit()}
            disabled={isTyping || !resumeFile}
            variant="default"
          >
            Send
          </Button>
        </div>
      )}

      {/* After final submit (career recommendations) show Next button to proceed */}
      {!showQuickReplies && questionIndex > assessmentQuestions.length && (
        <div className="flex justify-end">
          <Button onClick={() => void handleSubmit()} disabled={isTyping}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
};

export default CareerAgent;

