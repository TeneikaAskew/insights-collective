import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, RotateCcw, FileText } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { pathwayQuestions, quickReplies, starterMessages, LOCAL_STORAGE_KEY } from '@/data/careerPathwayData';
import CareerPathwayForm from '@/components/CareerPathwayForm';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
}

interface PathwayAnswers {
  [key: string]: string;
}

const CareerPathwayChat = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [pathwayAnswers, setPathwayAnswers] = useState<PathwayAnswers>({});
  const [isComplete, setIsComplete] = useState(false);
  const [generatedReport, setGeneratedReport] = useState<string | null>(null);
  const [showReportButton, setShowReportButton] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Load saved conversation from localStorage
    const savedData = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (savedData) {
      try {
        const parsedData = JSON.parse(savedData);
        setMessages(parsedData.messages || []);
        setPathwayAnswers(parsedData.pathwayAnswers || {});
        setCurrentQuestionIndex(parsedData.currentQuestionIndex || 0);
        setIsComplete(parsedData.isComplete || false);
        setGeneratedReport(parsedData.generatedReport || null);
        setShowReportButton(parsedData.showReportButton || false);
      } catch (error) {
        console.error('Error loading saved data:', error);
        initializeChat();
      }
    } else {
      initializeChat();
    }
  }, []);

  useEffect(() => {
    // Save conversation to localStorage
    const dataToSave = {
      messages,
      pathwayAnswers,
      currentQuestionIndex,
      isComplete,
      generatedReport,
      showReportButton
    };
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(dataToSave));
  }, [messages, pathwayAnswers, currentQuestionIndex, isComplete, generatedReport, showReportButton]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const initializeChat = () => {
    const welcomeMessage: Message = {
      id: Date.now().toString(),
      content: starterMessages[0],
      role: 'assistant',
      timestamp: new Date(),
    };
    setMessages([welcomeMessage]);
  };

  const handleReset = () => {
    // Clear all state
    setPathwayAnswers({});
    setCurrentQuestionIndex(0);
    setIsComplete(false);
    setGeneratedReport(null);
    setShowReportButton(false);
    setInput('');
    setIsProcessing(false);
    
    // Clear localStorage
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    
    // Reinitialize chat with welcome message
    const welcomeMessage: Message = {
      id: Date.now().toString(),
      content: starterMessages[0],
      role: 'assistant',
      timestamp: new Date(),
    };
    setMessages([welcomeMessage]);
  };

  const handleSendMessage = async (messageContent?: string) => {
    const content = messageContent || input.trim();
    if (!content || isProcessing) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content,
      role: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsProcessing(true);

    try {
      // Handle pathway answers
      if (currentQuestionIndex < pathwayQuestions.length) {
        const currentQuestion = pathwayQuestions[currentQuestionIndex];
        const newAnswers = { ...pathwayAnswers, [currentQuestion.id]: content };
        setPathwayAnswers(newAnswers);

        if (currentQuestionIndex < pathwayQuestions.length - 1) {
          // Move to next question
          const nextIndex = currentQuestionIndex + 1;
          setCurrentQuestionIndex(nextIndex);
          
          const nextQuestion = pathwayQuestions[nextIndex];
          const assistantMessage: Message = {
            id: (Date.now() + 1).toString(),
            content: nextQuestion.placeholder,
            role: 'assistant',
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, assistantMessage]);
        } else {
          // All questions completed
          setIsComplete(true);
          const completionMessage: Message = {
            id: (Date.now() + 1).toString(),
            content: "Thank you for completing the career pathway questionnaire! I'm now generating your personalized career advice report...",
            role: 'assistant',
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, completionMessage]);

          // Generate career advice
          await generateCareerAdvice(newAnswers);
        }
      } else {
        // Continue conversation after completion
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: "I'm here to help with any additional questions about your career path. Feel free to ask!",
          role: 'assistant',
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, assistantMessage]);
      }
    } catch (error) {
      console.error('Error processing message:', error);
      toast({
        title: "Error",
        description: "Failed to process your message. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const generateCareerAdvice = async (answers: PathwayAnswers) => {
    try {
      // Get user's resume text if available
      let resumeText = '';
      if (user) {
        const { data: resumeData } = await supabase
          .from('resumes')
          .select('text')
          .eq('user_id', user.id)
          .limit(1)
          .maybeSingle();
        
        if (resumeData?.text) {
          resumeText = resumeData.text;
        }
      }

      const careerForm = new CareerPathwayForm({
        prompt: "Generate a comprehensive career pathway report",
        pathwayQuestions,
        pathwayAnswers: answers,
        resumeText
      });

      const result = await careerForm.processRequest();
      
      if (result?.generatedText) {
        setGeneratedReport(result.generatedText);
        setShowReportButton(true); // Show the report button after successful generation
        
        const reportMessage: Message = {
          id: (Date.now() + 2).toString(),
          content: "Your personalized career pathway report has been generated! Click the 'View Your Pathway Report' button to see your detailed recommendations.",
          role: 'assistant',
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, reportMessage]);
      } else {
        throw new Error('No report generated');
      }
    } catch (error) {
      console.error('Error generating career advice:', error);
      const errorMessage: Message = {
        id: (Date.now() + 2).toString(),
        content: "I encountered an issue generating your career report. Please try again or contact support if the problem persists.",
        role: 'assistant',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
      
      toast({
        title: "Error",
        description: "Failed to generate career advice. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleQuickReply = (reply: string) => {
    handleSendMessage(reply);
  };

  const handleViewReport = () => {
    if (generatedReport) {
      // Open report in a new window or navigate to report page
      const reportWindow = window.open('', '_blank');
      if (reportWindow) {
        reportWindow.document.write(`
          <html>
            <head>
              <title>Career Pathway Report</title>
              <style>
                body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
                h1, h2, h3 { color: #333; }
                table { border-collapse: collapse; width: 100%; margin: 20px 0; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #f2f2f2; }
              </style>
            </head>
            <body>
              ${generatedReport.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}
            </body>
          </html>
        `);
      }
    }
  };

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">Career Pathway Coach</h2>
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset Chat
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'assistant' ? 'justify-start' : 'justify-end'}`}
            >
              {message.role === 'assistant' && (
                <Avatar className="h-8 w-8 mr-2">
                  <AvatarFallback>AI</AvatarFallback>
                </Avatar>
              )}
              <div
                className={`max-w-[80%] p-3 rounded-lg ${
                  message.role === 'assistant'
                    ? 'bg-secondary text-secondary-foreground'
                    : 'bg-primary text-primary-foreground'
                }`}
              >
                <p className="whitespace-pre-wrap">{message.content}</p>
              </div>
            </div>
          ))}

          {/* Quick replies for first interaction */}
          {messages.length <= 1 && (
            <div className="space-y-2">
              {quickReplies.map((reply, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickReply(reply)}
                  className="w-full text-left justify-start"
                >
                  {reply}
                </Button>
              ))}
            </div>
          )}

          {/* View Report Button - Only show when report is generated */}
          {showReportButton && generatedReport && (
            <div className="flex justify-center">
              <Button
                onClick={handleViewReport}
                className="bg-green-600 hover:bg-green-700"
              >
                <FileText className="h-4 w-4 mr-2" />
                View Your Pathway Report
              </Button>
            </div>
          )}

          {isProcessing && (
            <div className="flex justify-start">
              <Avatar className="h-8 w-8 mr-2">
                <AvatarFallback>AI</AvatarFallback>
              </Avatar>
              <div className="bg-secondary text-secondary-foreground p-3 rounded-lg">
                <div className="flex space-x-2">
                  <div className="w-2 h-2 rounded-full bg-primary animate-bounce"></div>
                  <div className="w-2 h-2 rounded-full bg-primary animate-bounce delay-75"></div>
                  <div className="w-2 h-2 rounded-full bg-primary animate-bounce delay-150"></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t">
        <div className="flex space-x-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              currentQuestionIndex < pathwayQuestions.length
                ? "Type your answer..."
                : "Ask me anything about your career path..."
            }
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            disabled={isProcessing}
          />
          <Button
            onClick={() => handleSendMessage()}
            disabled={isProcessing || !input.trim()}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CareerPathwayChat;
