
import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { MessageCircle, Send, X, PlusCircle, Upload, Home, BookOpen, Calendar, FileText, Cpu, User } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'react-router-dom';

type Message = {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
};

const MENU_DESCRIPTIONS = {
  dashboard: "View your learning progress and recommended content",
  courses: "Browse and enroll in our data science curriculum",
  events: "Upcoming workshops, webinars, and networking opportunities",
  resources: "Articles, guides, and learning materials",
  assistants: "AI-powered career and learning assistants",
  profile: "Manage your account and track achievements",
  resume: "Build and customize your data professional resume",
  messages: "Connect with instructors and fellow learners",
  calendar: "Schedule and track learning events and deadlines"
};

const MENU_ICONS = {
  dashboard: Home,
  courses: BookOpen,
  events: Calendar,
  resources: FileText,
  assistants: Cpu,
  profile: User,
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
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Add menu buttons on first load
  useEffect(() => {
    if (isOpen && showMenuButtons) {
      setShowMenuButtons(false);
    }
  }, [isOpen, showMenuButtons]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
    
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsProcessing(true);
    
    try {
      // In a real implementation, this would be an API call to a backend service
      // For this demo, we'll simulate a response
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Get a random response from fallbacks or generate a more specific one
      const botResponse = generateResponse(input, isAuthenticated);
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: botResponse,
        role: 'assistant',
        timestamp: new Date(),
      };
      
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error processing message:', error);
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: "I'm sorry, I couldn't process your request at the moment. Please try again later.",
        role: 'assistant',
        timestamp: new Date(),
      };
      
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
    }
  };

  const generateResponse = (query: string, isAuthenticated: boolean): string => {
    // Simple keyword matching for demo purposes
    const normalizedQuery = query.toLowerCase();
    
    if (normalizedQuery.includes('menu') || normalizedQuery.includes('navigation') || normalizedQuery.includes('find')) {
      const menuItems = Object.entries(MENU_DESCRIPTIONS)
        .map(([key, desc]) => `• ${key.charAt(0).toUpperCase() + key.slice(1)}: ${desc}`)
        .join('\n\n');
      
      return `Here's what you can find in our main menu:\n\n${menuItems}\n\nIs there a specific section you'd like to know more about?`;
    }
    
    if (normalizedQuery.includes('course') || normalizedQuery.includes('class')) {
      return "We offer courses in Data Science, Analytics, Data Engineering, and Machine Learning. Each course is designed with a practical, hands-on approach to help you build real-world skills.";
    }
    
    if (normalizedQuery.includes('blueprint') || normalizedQuery.includes('series')) {
      return "The Data Blueprint Series is our comprehensive 10-part guide that covers everything from starting a data career to advanced topics like responsible AI and career growth paths.";
    }
    
    if (normalizedQuery.includes('career') || normalizedQuery.includes('job')) {
      return "Based on our Data Blueprint Series, successful data careers usually start with strong foundations in statistics and programming, then specialize based on your interests. Building a portfolio of projects is crucial for landing your first role.";
    }
    
    if (normalizedQuery.includes('event') || normalizedQuery.includes('conference')) {
      return "We have several upcoming events, including the Machine Learning Conference 2025 on June 15th. Would you like me to provide more details about our events calendar?";
    }
    
    if (!isAuthenticated && (normalizedQuery.includes('advanced') || normalizedQuery.includes('personalized'))) {
      return "For more advanced or personalized assistance, please sign in to your account. This allows me to provide recommendations based on your learning history and interests.";
    }
    
    // Return a random fallback response for other queries
    return FALLBACK_RESPONSES[Math.floor(Math.random() * FALLBACK_RESPONSES.length)];
  };

  const handleUpload = () => {
    toast({
      title: "File uploaded successfully",
      description: "Your document has been added to the knowledge base.",
    });
    setUploadModalOpen(false);
  };

  const handleCloseChat = () => {
    setIsOpen(false);
    // Reset for next opening
    setShowMenuButtons(true);
  };

  // Renders menu navigation buttons
  const renderMenuButtons = () => {
    return (
      <div className="flex flex-col space-y-2 mt-4">
        {Object.entries(MENU_ICONS).map(([key, Icon]) => (
          <Link 
            to={`/${key === 'dashboard' ? '' : key}`} 
            key={key} 
            onClick={() => setIsOpen(false)}
          >
            <Button 
              variant="outline" 
              className="w-full justify-start text-left"
            >
              <Icon className="mr-2 h-4 w-4" />
              {key.charAt(0).toUpperCase() + key.slice(1)}: {MENU_DESCRIPTIONS[key as keyof typeof MENU_DESCRIPTIONS]}
            </Button>
          </Link>
        ))}
      </div>
    );
  };

  // Process message content for rendering
  const formatMessageContent = (content: string) => {
    // Split by newlines to handle them properly in JSX
    return content.split('\n').map((line, i) => (
      <React.Fragment key={i}>
        {line}
        {i < content.split('\n').length - 1 && <br />}
      </React.Fragment>
    ));
  };

  return (
    <>
      {/* Chat trigger button */}
      <div className="fixed bottom-6 right-6 z-50">
        <Button 
          className="h-14 w-14 rounded-full shadow-lg bg-primary hover:bg-primary/90 p-0"
          onClick={() => setIsOpen(true)}
        >
          <MessageCircle className="h-6 w-6" />
        </Button>
      </div>
      
      {/* Chat interface */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent 
          className="w-full sm:max-w-md p-0 border-l"
          side="right"
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
                  >
                    <Upload className="h-5 w-5" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={handleCloseChat}
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            </SheetHeader>
            
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${
                      message.role === 'assistant' ? 'justify-start' : 'justify-end'
                    }`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg p-3 ${
                        message.role === 'assistant'
                          ? 'bg-secondary text-secondary-foreground'
                          : 'bg-primary text-primary-foreground'
                      }`}
                    >
                      {message.role === 'assistant' && (
                        <div className="flex items-center mb-1">
                          <Avatar className="h-6 w-6 mr-2">
                            <div className="bg-primary text-primary-foreground rounded-full h-full w-full flex items-center justify-center text-xs font-medium">
                              IC
                            </div>
                          </Avatar>
                          <span className="text-xs font-medium">IC Assistant</span>
                        </div>
                      )}
                      <p className="text-sm">
                        {formatMessageContent(message.content)}
                      </p>
                      <div className="text-xs opacity-70 mt-1 text-right">
                        {message.timestamp.toLocaleTimeString([], { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </div>
                    </div>
                  </div>
                ))}
                {/* Show menu buttons after initial message */}
                {showMenuButtons && (
                  <div className="flex justify-start w-full">
                    <div className="max-w-[95%] w-full">
                      {renderMenuButtons()}
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
            
            <form 
              onSubmit={handleSubmit}
              className="border-t p-4"
            >
              <div className="flex items-center gap-2">
                <Input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask me anything..."
                  className="flex-1"
                  disabled={isProcessing}
                />
                <Button 
                  type="submit" 
                  size="icon"
                  disabled={isProcessing || !input.trim()}
                >
                  <Send className="h-5 w-5" />
                </Button>
              </div>
              <div className="mt-2 text-xs text-muted-foreground text-center">
                <p>
                  Did you know? You can ask about our courses, resources, events, or data careers.
                  {!isAuthenticated && (
                    <span> <a href="/login" className="text-primary hover:underline">Sign in</a> for personalized assistance.</span>
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
              <Button onClick={handleUpload}>
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
