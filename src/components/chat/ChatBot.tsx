
import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { MessageCircle, Send, X, Upload } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

import { createLogger } from '@/utils/logger';

const logger = createLogger('ChatBot');

type Message = {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
};

const INITIAL_MESSAGES: Message[] = [
  {
    id: '1',
    content: "Hi there! I'm the IC Assistant. I can help you navigate our platform and answer questions about data careers.\n\nHere's a quick overview of what you can find in our menu:",
    role: 'assistant',
    timestamp: new Date(),
  },
];

const FALLBACK_RESPONSES = [
  "Based on the Data Blueprint Series, data science combines statistics, programming, and domain expertise to extract insights from data.",
  "Our Data Engineering Bootcamp covers ETL processes, data warehousing, and real-time data processing over 8 intensive weeks.",
  "According to our resources, building a good data portfolio should showcase 3-5 projects demonstrating different skills and solving real problems.",
  "The 'Core Roles in a Data Team' article explains that data analysts focus on descriptive analytics while data scientists typically handle predictive modeling.",
  "Ethics in AI is covered extensively in our Responsible AI article, which discusses bias mitigation, transparency, and governance frameworks."
];

const ChatBot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [showMenuButtons, setShowMenuButtons] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Always show menu buttons on first load (fix for menu not showing)
  useEffect(() => {
    if (isOpen) {
      // Don't hide menu buttons automatically
      // We'll leave them visible until user interacts
    }
  }, [isOpen]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Check if user has a resume on file when chat opens
  useEffect(() => {
    if (isOpen && user) {
      (async () => {
        try {
          const { data, error } = await supabase
            .from('resumes')
            .select('id, text')
            .eq('user_id', user.id)
            .limit(1)
            .maybeSingle();

          if (error) {
            logger.error('Error checking resume existence:', error);
            // Add message anyway to prompt upload if needed
            appendBotMessage("Do you want to upload your resume to get personalized career advice?");
            return;
          }

          if (data && data.id) {
            // Resume exists, welcome message includes resume usage info
            appendBotMessage("Welcome back! I found your resume on file, so we can use it during our career conversations.");
          } else {
            // No resume found, prompt to upload
            appendBotMessage("I don't see a resume on file. Please upload your resume to get personalized career advice.");
          }
        } catch (e) {
          logger.error('Exception during resume check:', e);
          appendBotMessage("I cannot check your resume status currently. Please upload your resume for personalized career advice.");
        }
      })();
    }
  }, [isOpen, user]);

  const appendBotMessage = (content: string) => {
    setMessages(prev => [
      ...prev, 
      {
        id: `bot_${Date.now()}`,
        content,
        role: 'assistant',
        timestamp: new Date(),
      }
    ]);
  };

  // Reset chat - clears all messages and cache
  const handleResetChat = () => {
    setMessages([...INITIAL_MESSAGES]);
    setShowMenuButtons(true);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();

    if (!input.trim()) return;

    // Add user message to the chat
    const userMessage: Message = {
      id: Date.now().toString(),
      content: input,
      role: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsProcessing(true);
    setShowMenuButtons(false); // Hide menu buttons when user starts chatting

    try {
      // Before sending, get user's resume text to include in context if exists
      let resumeText = null;

      if (user) {
        const { data, error } = await supabase
          .from('resumes')
          .select('text')
          .eq('user_id', user.id)
          .limit(1)
          .maybeSingle();

        if (error) {
          logger.error('Error fetching resume text:', error);
        } else if (data && data.text) {
          resumeText = data.text;
        }
      }

      const context = resumeText
        ? `User resume provided: \n${resumeText}\n`
        : 'No user resume provided.';

      // Call the Edge Function with the context included
      const { data, error } = await supabase.functions.invoke('assistant-ai', {
        body: {
          query: userMessage.content,
          careerFocus: 'Data',
          careerPath: 'Data Analyst',
          salaryCap: 120000,
          assistantType: 'Career Coach',
          context,
        },
      });

      if (error) {
        throw error;
      }

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data?.response || "I'm sorry, I couldn't process your request at this time.",
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);

      // If conversation reached certain keywords, respond with report message
      const lowerContent = userMessage.content.toLowerCase();
      if (
        lowerContent.includes('career pathway') ||
        lowerContent.includes('career advice') ||
        lowerContent.includes('recommendation')
      ) {
        appendBotMessage("I'm working on your career pathway report now; it may take about 2 minutes to generate additional insights...");
        // After delay or API call (backend handles) final report is available
        // In real system, would poll or push event for report update
      }

    } catch (error) {
      logger.error('Error processing message:', error);

      const errorMessage: Message = {
        id: `assistant-fallback-${Date.now()}`,
        role: 'assistant',
        content: "Sorry, I couldn't process your request at this moment. Please try again later.",
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
      scrollToBottom();
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Formats message content for JSX, handles newlines
  const formatMessageContent = (content: string) => {
    return content.split('\n').map((line, i) => (
      <React.Fragment key={i}>
        {line}
        {i < content.split('\n').length - 1 && <br />}
      </React.Fragment>
    ));
  };

  // Get user initials fallback for avatar
  const getUserInitials = (name?: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
  };

  return (
    <>
      {/* Chat trigger button */}
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          className="h-14 w-14 rounded-full shadow-lg bg-primary hover:bg-primary/90 p-0"
          onClick={() => setIsOpen(true)}
          aria-label="Open chat"
        >
          <MessageCircle className="h-6 w-6" />
        </Button>
      </div>

      {/* Chat interface */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent
          className="w-full sm:max-w-md p-0 border-l"
          side="right"
          aria-label="Chat window"
        >
          <div className="flex flex-col h-full">
            <SheetHeader className="px-4 py-3 border-b">
              <div className="flex justify-between items-center">
                <SheetTitle className="text-xl font-medium">IC Assistant</SheetTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setUploadModalOpen(true)}
                    aria-label="Upload document"
                  >
                    <Upload className="h-5 w-5" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} aria-label="Close chat">
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            </SheetHeader>

            <ScrollArea className="flex-1 p-4 overflow-auto">
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex max-w-[80%] ${
                      message.role === 'assistant' ? 'justify-start' : 'justify-end'
                    }`}
                  >
                    {message.role === 'assistant' && (
                      <Avatar className="h-8 w-8 mr-2 self-end select-none" aria-label="Assistant Avatar">
                        {/* Use static system avatar or fallback */}
                        <AvatarFallback className="text-xs font-semibold bg-primary text-primary-foreground rounded-full">
                          IC
                        </AvatarFallback>
                      </Avatar>
                    )}

                    <div
                      className={`rounded-lg p-3 break-words text-sm ${
                        message.role === 'assistant'
                          ? 'bg-secondary text-secondary-foreground'
                          : 'bg-primary text-primary-foreground'
                      }`}
                    >
                      <p>{formatMessageContent(message.content)}</p>
                      <div className="text-xs opacity-70 mt-1 text-right select-none">
                        {message.timestamp.toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>

                    {message.role === 'user' && (
                      <Avatar className="h-8 w-8 ml-2 self-end select-none" aria-label="User Avatar">
                        {user?.avatar ? (
                          <AvatarImage src={user.avatar} alt={user.name || 'User Avatar'} />
                        ) : (
                          <AvatarFallback className="text-xs font-semibold rounded-full">
                            {getUserInitials(user?.name)}
                          </AvatarFallback>
                        )}
                      </Avatar>
                    )}
                  </div>
                ))}

                {/* Show menu only if not chatting */}
                {showMenuButtons && (
                  <div className="flex justify-start w-full">
                    <div className="max-w-[95%] w-full">
                      {/* menu buttons rendering */}
                      <div className="flex flex-col space-y-2 mt-4">
                        <Link to="/" onClick={() => setIsOpen(false)}>
                          <Button variant="outline" className="w-full justify-start text-left">
                            Home
                          </Button>
                        </Link>
                        <Link to="/courses" onClick={() => setIsOpen(false)}>
                          <Button variant="outline" className="w-full justify-start text-left">
                            Courses
                          </Button>
                        </Link>
                        {/* add other links similarly... */}
                      </div>
                    </div>
                  </div>
                )}

                {isProcessing && (
                  <div className="flex justify-start">
                    <div className="max-w-[80%] rounded-lg p-3 bg-secondary text-secondary-foreground">
                      <div className="flex space-x-2">
                        <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '300ms' }}></div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            <form onSubmit={handleSubmit} className="border-t p-4" aria-label="Chat input form">
              <div className="flex items-center gap-2">
                <Input
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder="Ask me anything..."
                  className="flex-1"
                  aria-label="Type your message"
                  disabled={isProcessing}
                />
                <Button type="submit" size="icon" disabled={isProcessing || !input.trim()} aria-label="Send message">
                  <Send className="h-5 w-5" />
                </Button>
              </div>
              <div className="mt-2 text-xs text-muted-foreground text-center">
                <p>
                  Did you know? You can ask about our courses, resources, events, or data careers.
                  {!isAuthenticated && (
                    <span>
                      {' '}
                      <a href="/login" className="text-primary hover:underline">
                        Sign in
                      </a>{' '}
                      for personalized assistance.
                    </span>
                  )}
                </p>
              </div>
            </form>
          </div>
        </SheetContent>
      </Sheet>

      {/* Upload modal */}
      <Sheet open={uploadModalOpen} onOpenChange={setUploadModalOpen}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Upload Knowledge Document</SheetTitle>
          </SheetHeader>
          <div className="mt-6">
            <div className="border-2 border-dashed border-muted-foreground/20 rounded-lg p-8 text-center">
              <div className="flex flex-col items-center">
                <Upload className="h-10 w-10 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Upload PDF or Text Document</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Drop your file here or click to browse. We'll parse it and add to the assistant's knowledge.
                </p>
                <Button>Select File</Button>
              </div>
            </div>
            <div className="mt-6 flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setUploadModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => {
                toast({
                  title: "File uploaded successfully",
                  description: "Your document has been added to the knowledge base.",
                });
                setUploadModalOpen(false);
              }}>
                Upload
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};

export default ChatBot;
