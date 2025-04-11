
import React, { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ResumeAnalysis } from '@/components/assistants/types';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface ResumeChatProps {
  resumeAnalysis: ResumeAnalysis | null;
}

type Message = {
  id: string;
  role: 'assistant' | 'user';
  content: string;
  timestamp: Date;
};

const ResumeChat: React.FC<ResumeChatProps> = ({ resumeAnalysis }) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Scroll to bottom whenever messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  // Fetch initial resume assessment and create welcome message on component mount
  useEffect(() => {
    if (resumeAnalysis && user) {
      setIsLoading(true);
      
      // Create basic welcome message with basic info
      const welcomeMessage: Message = {
        id: `welcome-${Date.now()}`,
        role: 'assistant',
        content: `I've analyzed your resume and can help you improve it! Your resume currently has a grade of **${resumeAnalysis.letter_grade} (${resumeAnalysis.resume_percent}%)**.`,
        timestamp: new Date(),
      };
      
      setMessages([welcomeMessage]);
      
      // Try to fetch stored assessment from the database
      (async () => {
        try {
          const { data, error } = await supabase
            .from('resumes')
            .select('initial_assessment')
            .eq('user_id', user.id)
            .single();
          
          if (error) {
            console.error('Error fetching stored assessment:', error);
            throw error;
          }
          
          let initialAssessment = data?.initial_assessment;
          
          // If no stored assessment, try to fetch it
          if (!initialAssessment && resumeAnalysis.resume_id) {
            const resumeText = localStorage.getItem(`resume_text_${resumeAnalysis.resume_id}`) || '';
            
            if (resumeText) {
              const { data: roastData, error: roastError } = await supabase.functions.invoke('resume-analyzer', {
                body: { 
                  action: 'get-roast',
                  resumeText
                }
              });
              
              if (roastError) throw roastError;
              
              if (roastData?.roast) {
                initialAssessment = roastData.roast;
                
                // Store it in the database for future use
                await supabase
                  .from('resumes')
                  .update({ initial_assessment: initialAssessment })
                  .eq('user_id', user.id);
              }
            }
          }
          
          // Update welcome message with assessment
          const updatedWelcomeMessage: Message = {
            ...welcomeMessage,
            content: `I've analyzed your resume and can help you improve it! Your resume currently has a grade of **${resumeAnalysis.letter_grade} (${resumeAnalysis.resume_percent}%)**.

${initialAssessment ? `**Here's my honest assessment:**
${initialAssessment}

` : ''}Let's start by discussing your experience: **What specific challenges did you tackle in your first listed role, what actions did you take, and what measurable results did you achieve?**`
          };
          
          setMessages([updatedWelcomeMessage]);
        } catch (error) {
          console.error('Error with assessment:', error);
          
          // Fallback message
          const updatedWelcomeMessage: Message = {
            ...welcomeMessage,
            content: `${welcomeMessage.content}

Let's start by discussing your experience: **What specific challenges did you tackle in your first listed role, what actions did you take, and what measurable results did you achieve?**`
          };
          
          setMessages([updatedWelcomeMessage]);
        } finally {
          setIsLoading(false);
        }
      })();
    }
  }, [resumeAnalysis, user]);
  
  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;
    
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: inputValue,
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    
    try {
      // Create context from resume analysis
      const context = resumeAnalysis ? 
        `Resume analysis: Grade ${resumeAnalysis.letter_grade} (${resumeAnalysis.resume_percent}%). 
         Key themes for improvement: ${resumeAnalysis.themes.join(', ')}.
         Elevator pitch: ${resumeAnalysis.elevator_pitch}` : 
        'No resume analysis available.';
      
      // Call the Edge Function
      const { data, error } = await supabase.functions.invoke('assistant-ai', {
        body: {
          query: userMessage.content,
          careerFocus: 'Data',
          careerPath: 'Data Analyst',
          salaryCap: 120000,
          assistantType: 'Resume Coach',
          context
        }
      });
      
      if (error) throw error;
      
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data?.response || "I'm sorry, I couldn't process your request at this time.",
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Fallback response
      const fallbackMessage: Message = {
        id: `assistant-fallback-${Date.now()}`,
        role: 'assistant',
        content: "Thanks for sharing those details. Based on what you've told me, I'd recommend focusing on quantifying your achievements more clearly in your resume. Add specific metrics and outcomes to demonstrate your impact. Could you share a specific project where you made a significant contribution?",
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, fallbackMessage]);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };
  
  // Function to format message content with markdown-like syntax
  const formatMessage = (content: string) => {
    if (!content) return '';
    
    // Replace **text** with <strong>text</strong>
    let formatted = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Replace _text_ with <em>text</em>
    formatted = formatted.replace(/_(.*?)_/g, '<em>$1</em>');
    
    // Replace `text` with <code>text</code>
    formatted = formatted.replace(/`(.*?)`/g, '<code>$1</code>');
    
    // Replace ## Headers with <h2>
    formatted = formatted.replace(/^## (.*?)$/gm, '<h2 class="text-lg font-bold mt-3 mb-2">$1</h2>');
    
    // Replace ### Headers with <h3>
    formatted = formatted.replace(/^### (.*?)$/gm, '<h3 class="text-md font-bold mt-2 mb-1">$1</h3>');
    
    // Replace - list items with <li>
    formatted = formatted.replace(/^- (.*?)$/gm, '<li class="ml-4">• $1</li>');
    
    // Replace numbered lists
    formatted = formatted.replace(/^\d+\. (.*?)$/gm, '<li class="ml-4 list-decimal">$1</li>');
    
    // Replace * list items with <li> (asterisk list items)
    formatted = formatted.replace(/^\* (.*?)$/gm, '<li class="ml-4">• $1</li>');
    
    // Replace newlines with <br>
    formatted = formatted.replace(/\n/g, '<br>');
    
    return formatted;
  };
  
  return (
    <Card className="w-full mt-6 mb-6 flex flex-col">
      <CardHeader className="px-4 py-3 border-b">
        <CardTitle className="text-lg">Resume Career Coach</CardTitle>
      </CardHeader>
      
      <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[500px]">
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
              {message.role === 'assistant' ? (
                <div 
                  className="prose prose-slate max-w-none"
                  dangerouslySetInnerHTML={{ __html: formatMessage(message.content) }}
                />
              ) : (
                <div>{message.content}</div>
              )}
            </div>
          </div>
        ))}
        
        {messages.length === 0 && resumeAnalysis && !isLoading && (
          <div className="text-center p-6">
            <p className="text-muted-foreground mb-4">
              Your resume is ready for review. I can provide personalized advice to help you improve it.
            </p>
          </div>
        )}
        
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
        <div ref={messagesEndRef} />
      </CardContent>
      
      <CardFooter className="p-4 border-t">
        <div className="flex space-x-2 w-full">
          <Textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe the challenges, actions, and results from your first role..."
            className="flex-1 resize-none"
            rows={2}
          />
          <Button 
            onClick={handleSendMessage} 
            disabled={isLoading || !inputValue.trim()}
            className="self-end"
          >
            <Send className="h-4 w-4" />
            <span className="sr-only">Send</span>
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
};

export default ResumeChat;
