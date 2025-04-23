import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
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

  // State variables
  const [sessionId, setSessionId] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [careerAdviceReport, setCareerAdviceReport] = useState<string>('');
  const [resumeText, setResumeText] = useState<string>('');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [reactingMessageId, setReactingMessageId] = useState<string | null>(null);
  const [showQuickReplies, setShowQuickReplies] = useState<boolean>(false);
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [inputValue, setInputValue] = useState<string>('');
  const reportRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

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

  // Initialize or retrieve session ID
  useEffect(() => {
    let sid = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!sid) {
      sid = Date.now().toString();
      localStorage.setItem(LOCAL_STORAGE_KEY, sid);
    }
    setSessionId(sid);

    // Load existing conversation or start new
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
          setCurrentQuestionIndex(Math.min(userAnswersCount, pathwayQuestions.length));
          setShowQuickReplies(userAnswersCount === 0);
        } else {
          initializeConversation();
        }
      } catch {
        initializeConversation();
      }
    } else {
      initializeConversation();
    }
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollAreaRef.current?.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: "smooth" });
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
      <div className="container mx-auto max-w-3xl p-6 flex flex-col min-h-screen justify-center items-center bg-white">
        <p className="text-lg text-center text-muted-foreground">
          Please log in to access the Career Pathway Agent.
        </p>
      </div>
    );
  }

  // Save answer to database
  const saveAnswerToDatabase = async (questionId: string, answer: string) => {
    if (user && sessionId) {
      try {
        await supabase.from('career_assessments').insert({
          user_id: user.id,
          session_id: sessionId,
          question: questionId,
          answer,
        });
      } catch (err) {
        console.error('Error saving answer:', err);
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
          <span class="inline-block bg-amber-200 text-amber-800 rounded-full w-6 h-6 text-center mr-2">${i + 1}</span>
          ${cleanText(item)}
        </div>`
      ).join('');
    } else {
      return `<p>${cleanText(content)}</p>`;
    }
  };

  const formatSkillsTable = (tableText: string): string => {
    if (!tableText) return '<tr><td colspan="2" class="border border-amber-300 px-4 py-2">No skills data available</td></tr>';
    
    const rows = tableText.split('\n')
      .filter(r => r.startsWith('|') && !r.includes('---'));
      
    return rows.map(row => {
      const cells = row.split('|').filter(c => c.trim());
      return cells.length >= 2
        ? `<tr>
          <td class="border border-amber-300 px-4 py-2">${cells[0].trim()}</td>
          <td class="border border-amber-300 px-4 py-2">${cells[1].trim()}</td>
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
  const generateCareerAdviceReport = async (txt?: string) => {
    setMessages(prev => [...prev, { 
      id: `bot_${Date.now()}`, 
      sender: 'bot', 
      text: "Thank you for your answers! I'm working on your career pathway report now; it may take about 2 minutes to generate additional insights..."
    }]);
    
    if (!user) return;
    
    const payload = { 
      prompt: careerAdvicePrompt, 
      PathwayQuestions: pathwayQuestions, 
      pathwayAnswers: answers, 
      resumeText: txt || null 
    };
    
    try {
      const { data, error } = await supabase.functions.invoke('evaluateCareerAdvice', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      
      if (error) throw error;
      
      const raw = typeof data === 'string' ? data : data.generatedText;
      console.log("Career Pathway Insights: ", raw)
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
      handleReportError(e instanceof Error ? e.message : 'Failed to get career advice'); 
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
      saveAnswerToDatabase(currentQuestion.id, inputValue.trim());
      
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
          generateCareerAdviceReport(resumeText);
        }
      }, 1200);
    }
  };

  const handleFileUpload = (file: File) => {
    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = e => { 
      setResumeText(e.target?.result as string); 
      setIsUploading(false);
    };
    reader.readAsText(file);
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
    
    // Only show the initial quick replies when we're at question 0
    if (currentQuestionIndex === 0) {
      const botThirdMsg = messages.find((m) => m.text === starterMessages[2] && m.sender === "bot");
      return !!botThirdMsg;
    }
    
    return false;
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
    setResumeText("");
    setCareerAdviceReport('');
    window.localStorage.removeItem(LOCAL_STORAGE_KEY);
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
        {messages.map((msg) => {
          const isBot = msg.sender === "bot";
          const isUser = msg.sender === "user";

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
                      const target = e.currentTarget;
                      target.style.display = "none";
                      // Show fallback text when image fails to load
                      if (target.parentElement) {
                        target.parentElement.textContent = "CC";
                      }
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
                        const target = e.currentTarget;
                        target.style.display = "none";
                        // Show initials when avatar fails to load
                        if (target.parentElement) {
                          target.parentElement.textContent = getUserInitials(user?.user_metadata?.name);
                        }
                      }}
                    />
                  ) : (
                    <span>{getUserInitials(user?.user_metadata?.name)}</span>
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
                  const target = e.currentTarget;
                  target.style.display = "none";
                  if (target.parentElement) {
                    target.parentElement.textContent = "CC";
                  }
                }}
              />
            </div>
            <div className="italic text-gray-500 select-none">Coach is typing...</div>
          </div>
        )}
      </div>

      {/* First question quick replies */}
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

      {/* Resume upload section at the start */}
      {currentQuestionIndex === 0 && (
        <div className="flex flex-col space-y-4 mt-4">
          <label className="text-sm font-medium">Upload your resume (PDF or DOCX) - Optional:</label>
          <input
            type="file"
            accept=".pdf,.docx,.txt"
            onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
            disabled={isTyping || isUploading}
            className="block w-full text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-amber-100 file:text-amber-900 hover:file:bg-amber-200 cursor-pointer"
          />
          {isUploading && <p>Uploading...</p>}
          {resumeText && (
            <p className="text-sm text-gray-500">
              Resume uploaded. Analyzing...
            </p>
          )}
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
          disabled={isTyping || (currentQuestionIndex === pathwayQuestions.length)}
          autoComplete="off"
          aria-label="Chat input"
        />
        <Button
          type="submit"
          disabled={
            isTyping ||
            !inputValue.trim() ||
            (currentQuestionIndex === pathwayQuestions.length)
          }
          variant="default"
          size="default"
        >
          Send
        </Button>
      </form>

      {careerAdviceReport && (
        <>
          <style>
            {`
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
          `}
          </style>
          <div 
            ref={reportRef}
            className="career-advice-report p-6 mt-6 rounded-lg bg-white border border-amber-300 max-w-3xl mx-auto text-gray-900 text-sm shadow-lg hover:shadow-xl transition-shadow duration-300"
            dangerouslySetInnerHTML={{ __html: careerAdviceReport }}
          />
        </>
      )}
    </div>
  );
};

export default CareerAgent;
