
import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { v4 as uuidv4 } from "uuid";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

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

const dummyCareers: string[] = [
  "Data Scientist",
  "Frontend Engineer",
  "AI Researcher",
  "Product Manager",
  "UX Designer",
  "Business Analyst",
];

const coachAvatarUrl = "/placeholder.svg";

const LOCAL_STORAGE_KEY = "careerPathwayChat";

const CareerAgent: React.FC = () => {
  const { user, isAuthenticated } = useAuth();

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [questionIndex, setQuestionIndex] = useState<number>(-1);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [reactingMessageId, setReactingMessageId] = useState<string | null>(null);
  const [userHasResume, setUserHasResume] = useState<boolean | null>(null);

  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Scroll on messages or typing
  useEffect(() => {
    scrollAreaRef.current?.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isTyping]);

  // Hydrate messages and check resume on mount
  useEffect(() => {
    const hydrateMessagesAndCheck = async () => {
      const stored = window.localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        try {
          const parsedMessages: Message[] = JSON.parse(stored);
          // Check if starter messages are already there (for dedupe)
          const existingStarters = starterMessages.every((starter) =>
            parsedMessages.some((msg) => msg.text === starter && msg.sender === "bot")
          );
          if (existingStarters) {
            setMessages(parsedMessages);
            const userAnswersCount = parsedMessages.filter((m) => m.sender === "user" && m.text).length;
            setQuestionIndex(Math.min(userAnswersCount, assessmentQuestions.length));
            setShowQuickReplies(userAnswersCount === 0);
          } else {
            // Starters missing - initialize with starters only once
            setMessages(starterMessages.map((text, index) => ({
              id: `bot_starter_${index}`,
              sender: "bot",
              text,
            })));
            setShowQuickReplies(true);
            setQuestionIndex(0);
          }
        } catch {
          // Parsing error, initialize with starters
          setMessages(starterMessages.map((text, index) => ({
            id: `bot_starter_${index}`,
            sender: "bot",
            text,
          })));
          setShowQuickReplies(true);
          setQuestionIndex(0);
        }
      } else {
        // No stored messages: initialize starters
        setMessages(starterMessages.map((text, index) => ({
          id: `bot_starter_${index}`,
          sender: "bot",
          text,
        })));
        setShowQuickReplies(true);
        setQuestionIndex(0);
      }

      // Check if user has resume file
      if (user) {
        try {
          const { data, error } = await supabase
            .from("resumes")
            .select("id")
            .eq("user_id", user.id)
            .limit(1)
            .maybeSingle();

          if (error) {
            console.error("Error checking resume existence:", error);
            setUserHasResume(null);
          } else {
            const hasResume = !!data;
            setUserHasResume(hasResume);
            if (!hasResume) {
              setMessages((prev) => {
                const messageExists = prev.some((msg) =>
                  msg.text === "We'll use your resume on file to continue." && msg.sender === "bot"
                );
                if (messageExists) return prev;
                const newMsg: Message = {
                  id: `bot_resume_notice_${Date.now()}`,
                  sender: "bot",
                  text: "We'll use your resume on file to continue.",
                };
                return [...prev, newMsg];
              });
            }
          }
        } catch (e) {
          console.error("Exception during resume check:", e);
          setUserHasResume(null);
        }
      }
    };

    hydrateMessagesAndCheck();
  }, [user]);

  // Create session on login
  useEffect(() => {
    if (isAuthenticated && !sessionId) {
      setSessionId(uuidv4());
    }
  }, [isAuthenticated, sessionId]);

  // Save messages to localStorage on every update
  useEffect(() => {
    if (messages.length === 0) return;
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto max-w-3xl p-6 flex flex-col min-h-screen justify-center items-center bg-white">
        <p className="text-lg text-center text-muted-foreground">
          Please log in to access the Career Pathway Agent.
        </p>
      </div>
    );
  }

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
    window.localStorage.removeItem(LOCAL_STORAGE_KEY);
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
      [assessmentQuestions[0].id]: replyText,
    }));

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

  const handleSubmit = async () => {
    if (isTyping) return;

    if (questionIndex >= 0 && questionIndex < assessmentQuestions.length) {
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
          const botMessage: Message = {
            id: `bot_${Date.now()}`,
            sender: "bot",
            text: "Thank you for your answers! Please upload your resume to help us provide career recommendations.",
          };
          setMessages((prev) => [...prev, botMessage]);
        }
      }, 1200);
    } else if (questionIndex === assessmentQuestions.length) {
      if (!resumeFile) return;
      setIsTyping(true);

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
      if (questionIndex >= 0 && questionIndex <= assessmentQuestions.length) {
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

  const userResumeUpload = async (file: File): Promise<boolean> => {
    await new Promise((r) => setTimeout(r, 1200));
    return true;
  };

  const emojis = ["👍", "❤️", "💡"];

  const handleEmojiClick = (msgId: string, emoji: string) => {
    alert(`You reacted to message ${msgId} with ${emoji}`);
    setReactingMessageId(null);
  };

  // Determine if quick replies are to be shown only below third starter message
  const showQuickRepliesAtCorrectPlace = () => {
    if (!showQuickReplies) return false;
    const botThirdMsg = messages.find((m) => m.text === starterMessages[2] && m.sender === "bot");
    return !!botThirdMsg;
  };

  const getUserInitials = (name: string | undefined) => {
    if (!name) return "U";
    const parts = name.trim().split(" ");
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
  };

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
              {/* Coach avatar on left for first bot message */}
              {isBot && idx === firstBotIndex && (
                <div
                  className="w-9 h-9 rounded-full mr-3 flex items-center justify-center bg-amber-100 select-none text-amber-600 font-semibold text-sm"
                  aria-label="Coach Avatar"
                >
                  <img
                    src={coachAvatarUrl}
                    alt="Career Coach Avatar"
                    className="w-full h-full rounded-full object-cover"
                    draggable={false}
                    onError={(e) => {
                      // fallback to initials if image fails
                      const target = e.currentTarget as HTMLImageElement;
                      target.style.display = "none";
                    }}
                  />
                  {/* If image fails, fallback to initials IC */}
                  <span className="sr-only">IC</span>
                </div>
              )}

              {/* User avatar on right for user messages */}
              {isUser && (
                <div
                  className="w-9 h-9 rounded-full ml-3 flex items-center justify-center bg-gray-300 select-none text-gray-700 font-semibold text-sm"
                  aria-label="User Avatar"
                >
                  {user?.user_metadata?.avatar_url ? (
                    <img
                      src={user.user_metadata.avatar_url}
                      alt="User Avatar"
                      className="w-full h-full rounded-full object-cover"
                      draggable={false}
                    />
                  ) : (
                    <span>{getUserInitials(user?.name)}</span>
                  )}
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
            </div>
          );
        })}
        {isTyping && (
          <div className="flex items-center space-x-3">
            <div
              className="w-9 h-9 rounded-full select-none flex items-center justify-center bg-amber-100 text-amber-600 font-semibold"
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
                }}
              />
              <span className="sr-only">IC</span>
            </div>
            <div className="italic text-gray-500 select-none">Coach is typing...</div>
          </div>
        )}
      </div>

      {showQuickRepliesAtCorrectPlace() && (
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

      {/* Persistent chat input bar always visible at the bottom */}
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
          disabled={isTyping}
          autoComplete="off"
          aria-label="Chat input"
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

      {/* Resume upload step */}
      {!showQuickReplies && questionIndex === assessmentQuestions.length && (
        <div className="flex flex-col space-y-4 mt-4">
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

      {/* After final submit (career recommendations) show Next button */}
      {!showQuickReplies && questionIndex > assessmentQuestions.length && (
        <div className="flex justify-end mt-4">
          <Button onClick={() => void handleSubmit()} disabled={isTyping}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
};

export default CareerAgent;

