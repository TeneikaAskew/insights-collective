
import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { v4 as uuidv4 } from "uuid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useResume } from "@/hooks/resume/useResume";
import { supabase } from "@/integrations/supabase/client";

// The questions to ask user
const assessmentQuestions = [
  {
    id: "skills",
    label: "Skills",
    placeholder: "E.g., JavaScript, Data Analysis, UX Design",
  },
  {
    id: "interests",
    label: "Interests",
    placeholder: "E.g., Machine Learning, Frontend Development",
  },
  {
    id: "goals",
    label: "Career Goals",
    placeholder: "E.g., Become a Team Lead, Work in AI",
  },
];

// Dummy career recommendations for example
const dummyCareers: string[] = [
  "Data Scientist",
  "Frontend Engineer",
  "AI Researcher",
  "Product Manager",
  "UX Designer",
  "Business Analyst",
];

type Message = {
  id: string;
  sender: "system" | "user" | "bot";
  text: string;
};

const CareerAgent: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const { resume, uploadResume, loading: resumeLoading, uploading } = useResume();

  // A unique session id per assessment session for storing answers
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Chat messages state
  const [messages, setMessages] = useState<Message[]>([]);

  // Current question index
  const [questionIndex, setQuestionIndex] = useState<number>(0);

  // Current input value for user typing
  const [inputValue, setInputValue] = useState("");

  // User answers stored locally for rendering recommendations later
  const [answers, setAnswers] = useState<Record<string, string>>({});

  // Upload resume file state for upload step
  const [resumeFile, setResumeFile] = React.useState<File | null>(null);

  // Typing indicator state
  const [isTyping, setIsTyping] = useState(false);

  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on message update
  useEffect(() => {
    scrollAreaRef.current?.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isTyping]);

  // Initialize session on mount when authenticated
  useEffect(() => {
    if (isAuthenticated && !sessionId) {
      setSessionId(uuidv4());
      // Start conversation with welcome message and first question
      setMessages([
        {
          id: "m1",
          sender: "system",
          text: "Welcome to your Career Pathway Agent! Let's start by assessing your skills and interests.",
        },
        {
          id: "m2",
          sender: "bot",
          text: `First question: ${assessmentQuestions[0].label}. ${assessmentQuestions[0].placeholder}`,
        },
      ]);
    }
  }, [isAuthenticated, sessionId]);

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto max-w-3xl p-6 flex flex-col min-h-screen justify-center items-center">
        <p className="text-lg text-center text-muted-foreground">Please log in to access the Career Pathway Agent.</p>
      </div>
    );
  }

  // Handle user submit for each question or resume upload
  const handleSubmit = async () => {
    const currentQuestion = assessmentQuestions[questionIndex];
    if (questionIndex < assessmentQuestions.length) {
      // User submitting a textual answer
      if (!inputValue.trim()) return;

      // Add user message
      const userMessage: Message = {
        id: `user_${Date.now()}`,
        sender: "user",
        text: inputValue.trim(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsTyping(true);

      // Persist answer in local answers state
      setAnswers((prev) => ({ ...prev, [currentQuestion.id]: inputValue.trim() }));

      // Persist answer to Supabase career_assessments table
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

      // Simulate bot typing delay
      setTimeout(() => {
        setIsTyping(false);
        setQuestionIndex(questionIndex + 1);

        if (questionIndex + 1 < assessmentQuestions.length) {
          const nextQ = assessmentQuestions[questionIndex + 1];

          const botMessage: Message = {
            id: `bot_${Date.now()}`,
            sender: "bot",
            text: `Next question: ${nextQ.label}. ${nextQ.placeholder}`,
          };
          setMessages((prev) => [...prev, botMessage]);
        } else {
          // After last question, offer to upload resume or get recommendations
          const botMessage: Message = {
            id: `bot_${Date.now()}`,
            sender: "bot",
            text: "Thank you for your answers! Please upload your resume to help us provide career recommendations.",
          };
          setMessages((prev) => [...prev, botMessage]);
        }
      }, 1200);
    } else if (questionIndex === assessmentQuestions.length) {
      // User submit for resume upload step: trigger upload if file selected
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

          const careerMessages = dummyCareers.map((career) => ({
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
      // Final step showing personalized dashboard insights message
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
      // Only allow submit if input is not empty or for upload step ignore input
      if (questionIndex < assessmentQuestions.length) {
        if (inputValue.trim()) {
          void handleSubmit();
        }
      }
    }
  };

  // Handle file selection for resume upload
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
