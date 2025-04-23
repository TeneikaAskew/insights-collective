import React, { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { pathwayQuestions, quickReplies, LOCAL_STORAGE_KEY, MAX_CHAT_MESSAGES, MAX_MESSAGE_SIZE } from '@/data/careerPathwayData';
import { supabase } from '@/integrations/supabase/client';
import { LocalStorageUtils } from '@/utils/localStorageUtils';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const CareerAgent = () => {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(true);

  // Load messages from localStorage on component mount
  useEffect(() => {
    try {
      const savedMessages = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (savedMessages) {
        const parsedMessages = JSON.parse(savedMessages);
        if (Array.isArray(parsedMessages)) {
          // Convert string dates back to Date objects
          const messagesWithDates = parsedMessages.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          }));
          setMessages(messagesWithDates);
        }
      } else {
        // Initialize with welcome message
        const welcomeMessage: Message = {
          id: 'welcome',
          role: 'assistant',
          content: "Welcome to your Career Pathway Assistant! I'll help you explore career options that match your skills and interests. Let's start by understanding your current situation and goals.",
          timestamp: new Date()
        };
        setMessages([welcomeMessage]);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
      toast({
        title: "Error",
        description: "Failed to load previous conversation.",
        variant: "destructive",
      });
    }
  }, [toast]);

  // Save messages to localStorage when they change
  useEffect(() => {
    if (messages.length > 0) {
      try {
        // Limit the number of messages to prevent storage issues
        const messagesToStore = messages.slice(-MAX_CHAT_MESSAGES);
        
        // Trim message content to prevent exceeding storage limits
        const trimmedMessages = messagesToStore.map(msg => ({
          ...msg,
          content: msg.content.length > MAX_MESSAGE_SIZE 
            ? msg.content.substring(0, MAX_MESSAGE_SIZE) + "... (content truncated)" 
            : msg.content
        }));
        
        // Use the utility to safely store messages
        const success = LocalStorageUtils.safelyStoreItem(
          LOCAL_STORAGE_KEY, 
          JSON.stringify(trimmedMessages)
        );
        
        if (!success) {
          toast({
            title: "Storage Warning",
            description: "Some conversation history couldn't be saved due to browser limitations.",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error('Error saving messages:', error);
      }
    }
  }, [messages, toast]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;
    
    // Create user message
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: inputValue,
      timestamp: new Date()
    };
    
    // Update UI immediately
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    setShowQuickReplies(false);
    
    try {
      // Call the Supabase Edge Function
      const { data, error } = await supabase.functions.invoke('evaluateCareerAdvice', {
        body: {
          prompt: "You are a helpful career coach. Provide personalized career advice based on the user's message.",
          PathwayQuestions: pathwayQuestions,
          pathwayAnswers: { [Date.now()]: userMessage.content },
          resumeText: ''
        }
      });
      
      if (error) throw error;
      
      // Create assistant response
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data?.generatedText || "I'm sorry, I couldn't process your request at this time.",
        timestamp: new Date()
      };
      
      // Update messages
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Add error message
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: "I'm sorry, I encountered an error processing your request. Please try again later.",
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, errorMessage]);
      
      toast({
        title: "Error",
        description: "Failed to get a response from the career assistant.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickReply = (reply: string) => {
    setInputValue(reply);
    setShowQuickReplies(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <AppLayout>
      <div className="flex flex-col h-full max-w-4xl mx-auto">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <div key={message.id} className={`flex ${
              message.role === 'assistant' 
                ? 'justify-start' 
                : 'justify-end'
            }`}>
              <div className={`max-w-3xl p-3 rounded-lg ${
                message.role === 'assistant' 
                  ? 'bg-slate-100 text-slate-800' 
                  : 'bg-blue-600 text-white'
              }`}>
                <div className="whitespace-pre-wrap">{message.content}</div>
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="max-w-3xl p-3 rounded-lg bg-slate-100 text-slate-800">
                <div className="flex space-x-2">
                  <div className="w-2 h-2 rounded-full bg-slate-400 animate-pulse"></div>
                  <div className="w-2 h-2 rounded-full bg-slate-400 animate-pulse delay-75"></div>
                  <div className="w-2 h-2 rounded-full bg-slate-400 animate-pulse delay-150"></div>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {showQuickReplies && messages.length <= 2 && (
          <div className="p-4 border-t">
            <p className="text-sm text-muted-foreground mb-2">Quick replies:</p>
            <div className="flex flex-wrap gap-2">
              {quickReplies.map((reply, index) => (
                <button
                  key={index}
                  onClick={() => handleQuickReply(reply)}
                  className="px-3 py-1 bg-slate-100 hover:bg-slate-200 rounded-full text-sm"
                >
                  {reply}
                </button>
              ))}
            </div>
          </div>
        )}
        
        <div className="p-4 border-t">
          <div className="flex space-x-2">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your career question..."
              className="flex-1 p-2 border rounded-md resize-none"
              rows={2}
            />
            <button
              onClick={handleSendMessage}
              disabled={isLoading || !inputValue.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-md disabled:opacity-50"
            >
              Send
            </button>
          </div>
          
          {!isAuthenticated && (
            <p className="text-sm text-muted-foreground mt-2">
              Note: Your conversation will be stored locally. Sign in to save your progress.
            </p>
          )}
        </div>
      </div>
      
      <style>
        {`
        .career-agent-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 2rem;
        }

        .career-agent-header {
          text-align: center;
          margin-bottom: 2rem;
        }

        .career-agent-content {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        @media (min-width: 768px) {
          .career-agent-content {
            flex-direction: row;
          }
        }
        `}
      </style>
    </AppLayout>
  );
};

export default CareerAgent;
