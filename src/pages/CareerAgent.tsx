
import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { v4 as uuidv4 } from "uuid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useResume } from "@/hooks/resume/useResume";
import { supabase } from "@/integrations/supabase/client";

// Updated full 13 assessment questions as requested
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

type SenderType = "system" | "user" | "bot";

type Message = {
  id: string;
  sender: SenderType;
  text: string;
};

const CareerAgent: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const { resume, uploadResume, loading: resumeLoading, uploading } = useResume();

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [questionIndex, setQuestionIndex] = useState<number>(0);
  const [inputValue, setInputValue] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [resumeFile, setResumeFile] = React.useState<File | null>(null);
  const [isTyping, setIsTyping] = useState(false);

  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollAreaRef.current?.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isTyping]);

  useEffect(() => {
    if (isAuthenticated && !sessionId) {
      const newSessionId = uuidv4();
      setSessionId(newSessionId);
      setMessages([
        {
          id: "m1",
          sender: "system",
          text: "Welcome to your Career Pathway Agent! Let's start by assessing your skills and interests.",
        },
        {
          id: "bot_0",
          sender: "bot",
          text: `First question: ${assessmentQuestions[0].label}. ${assessmentQuestions[0].placeholder}`,
        },
      ]);
    }
  }, [isAuthenticated, sessionId]);

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto max-w-3xl p-6 flex flex-col min-h-screen justify-center items-center">
        <p className="text-lg text-center text-muted-foreground">
          Please log in to access the Career Pathway Agent.
        </p>
      </div>
    );
  }

  const handleSubmit = async () => {
    if (questionIndex < assessmentQuestions.length) {
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

      try {
        if (sessionId && user) {
          await supabase.from("career_assessments").insert({
            user_id: user.id,
            session_id: sessionId,
            question: currentQuestion.id,
            answer: inputValue.trim(),
          });
        }
      } catch (error) {
        console.error("Error saving assessment answer:", error);
      }

      setInputValue("");

      setTimeout(() => {
        setIsTyping(false);
        const nextIndex = questionIndex + 1;
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
        const uploadSuccess = await uploadResume(resumeFile);
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
      if (questionIndex < assessmentQuestions.length) {
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

  return (
    <div className="container mx-auto max-w-3xl p-6 flex flex-col min-h-screen bg-white rounded-lg shadow-md">
      <h1 className="text-4xl font-bold text-amber-600 mb-6">Career Pathway Agent</h1>

      <div
        ref={scrollAreaRef}
        className="flex-1 overflow-y-auto space-y-4 max-h-[60vh] mb-6 p-4 border rounded-md bg-amber-50"
        role="log"
        aria-live="polite"
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`max-w-[80%] p-4 rounded-lg shadow-sm break-words whitespace-pre-wrap ${
              msg.sender === "user"
                ? "bg-primary text-primary-foreground self-end"
                : "bg-amber-100 text-amber-900 self-start"
            }`}
          >
            {msg.text}
          </div>
        ))}
        {isTyping && (
          <div className="max-w-[80%] p-4 rounded-lg shadow-inner bg-amber-200 text-amber-900 self-start">
            Typing...
          </div>
        )}
      </div>

      <div className="flex items-center space-x-4">
        {(questionIndex < assessmentQuestions.length || questionIndex === assessmentQuestions.length) && (
          <>
            {questionIndex < assessmentQuestions.length && (
              <Input
                type="text"
                placeholder={assessmentQuestions[questionIndex].placeholder}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleInputKeyDown}
                autoFocus
                disabled={isTyping}
                className="flex-grow"
              />
            )}
            {questionIndex === assessmentQuestions.length && (
              <div className="flex flex-col flex-grow space-y-2">
                <label className="text-sm font-medium">Upload your resume (PDF or DOCX):</label>
                <input
                  type="file"
                  accept=".pdf,.docx"
                  onChange={handleFileChange}
                  disabled={isTyping || uploading}
                  className="block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white file:hover:bg-primary/90 cursor-pointer"
                />
              </div>
            )}
            <Button
              onClick={() => {
                void handleSubmit();
              }}
              disabled={
                isTyping ||
                (questionIndex < assessmentQuestions.length && inputValue.trim() === "") ||
                (questionIndex === assessmentQuestions.length && !resumeFile)
              }
            >
              Send
            </Button>
          </>
        )}
        {questionIndex > assessmentQuestions.length && (
          <Button onClick={() => void handleSubmit()} disabled={isTyping}>
            Next
          </Button>
        )}
      </div>
    </div>
  );
};

export default CareerAgent;

