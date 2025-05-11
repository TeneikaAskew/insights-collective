
import React, { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ResumeAnalysis } from '@/components/assistants/types';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { formatMessage } from '@/components/assistants/utils/messageFormatting';
import { useToast } from '@/hooks/use-toast';

interface ResumeChatProps {
  resumeAnalysis: ResumeAnalysis | null;
}

type Message = {
  id: string;
  role: 'assistant' | 'user';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
};

const ResumeChat: React.FC<ResumeChatProps> = ({ resumeAnalysis }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamController, setStreamController] = useState<AbortController | null>(null);
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
      
      // Prepare prompt with context and conversation history
      let conversationHistory = messages.map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`).join('\n\n');
      
      const prompt = `You are a professional resume coach assisting a user with their resume. 
      
Resume Context: ${context}

Previous conversation:
${conversationHistory}

User's latest message: ${inputValue}

Respond with helpful, specific advice as a resume coach. Be constructive, honest, and professional.`;

      // Create a placeholder streaming message
      const streamingMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        isStreaming: true
      };
      
      setMessages(prev => [...prev, streamingMessage]);
      
      // Abort any existing streams
      if (streamController) {
        streamController.abort();
      }
      
      // Create a new controller for this stream
      const controller = new AbortController();
      setStreamController(controller);
      
      // Call the Together AI streaming endpoint
      // const response = await supabase.functions.invoke('together-ai', {
      //   body: { 
      //     prompt,
      //     model: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
      //     max_tokens: 1024,
      //     stream: true
      //   }
      // });
      
      // if (response.error) {
      //   console.error('Error from Together AI:', response.error);
      //   throw new Error(response.error.message);
      // }
      // Before the call
      console.log('Attempting to invoke together-ai function with prompt:', prompt.substring(0, 50) + '...');
      
      // Make the call with additional logging
      // try {
      //   console.log('Making Supabase function call...');
      //   const response = await supabase.functions.invoke('together-ai', {
      //     body: { 
      //       prompt,
      //       model: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
      //       max_tokens: 1024,
      //       stream: true
      //     }
      //   });
      //   console.log('Supabase function response received:', response);
        
      //   if (response.error) {
      //     console.error('Function invoke error:', response.error);
      //     throw new Error(`Function invoke error: ${response.error.message || 'Unknown error'}`);
      //   }
        
      //   if (!response.data) {
      //     console.error('No data in response:', response);
      //     throw new Error('No data returned from function');
      //   }
        
      //   console.log('Response data type:', typeof response.data);
      //   console.log('Is response.data a ReadableStream?', response.data instanceof ReadableStream);
        
      //   // Continue with your streaming logic...
      // } catch (error) {
      //   console.error('Caught error during function invoke:', error);
      //   throw error;
      // }
      
      // // Get the ReadableStream from the response
      // const readableStream = response.data;
      
      // if (!readableStream) {
      //   throw new Error('No stream in response');
      // }
      
      // const reader = readableStream.getReader();
      // let streamedContent = '';
      
      // // Process the SSE stream
      // while (true) {
      //   const { done, value } = await reader.read();
        
      //   if (done) {
      //     break;
      //   }
        
      //   // Decode the chunk
      //   const chunk = new TextDecoder().decode(value);
        
      //   // Parse SSE format - each line starts with "data: "
      //   const lines = chunk.split('\n').filter(line => line.trim() !== '');
        
      //   for (const line of lines) {
      //     if (line.startsWith('data: ')) {
      //       try {
      //         // Remove the "data: " prefix and parse the JSON
      //         const jsonStr = line.substring(6);
              
      //         // Check if it's the "[DONE]" marker
      //         if (jsonStr.trim() === '[DONE]') {
      //           continue;
      //         }
              
      //         const jsonData = JSON.parse(jsonStr);
              
      //         // Extract the text from the completion choices
      //         if (jsonData.choices && jsonData.choices[0]?.text) {
      //           const newText = jsonData.choices[0].text;
      //           streamedContent += newText;
                
      //           // Update the streaming message with current content
      //           setMessages(prev => prev.map(msg => 
      //             msg.id === streamingMessage.id 
      //               ? { ...msg, content: streamedContent }
      //               : msg
      //           ));
      //         }
      //       } catch (e) {
      //         console.warn('Error parsing SSE data:', e);
      //       }
      //     }
      //   }
      // }

      // After getting the response from Supabase
      // const response = await supabase.functions.invoke('together-ai', {
      //   body: { 
      //     prompt,
      //     model: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
      //     max_tokens: 1024,
      //     stream: true
      //   }
      // });
      
      // console.log('Supabase function response received:', response);
      
      // if (response.error) {
      //   console.error('Error from Together AI:', response.error);
      //   throw new Error(response.error.message || 'Unknown error');
      // }
      
      // // This is the key fix - response.data is a Response object, not a ReadableStream directly
      // // We need to access its body property to get the ReadableStream
      // if (!response.data || !response.data.body) {
      //   console.error('No body in response data:', response.data);
      //   throw new Error('No readable stream in response');
      // }
      
      // // Get the ReadableStream from the response.data.body
      // const readableStream = response.data.body;
      // const reader = readableStream.getReader();
      // let streamedContent = '';
      
      // // Process the SSE stream
      // while (true) {
      //   const { done, value } = await reader.read();
        
      //   if (done) {
      //     break;
      //   }
        
      //   // Decode the chunk
      //   const chunk = new TextDecoder().decode(value);
      //   console.log('Received chunk:', chunk); // Log raw chunk for debugging
        
      //   // Parse SSE format - each line starts with "data: "
      //   const lines = chunk.split('\n').filter(line => line.trim() !== '');
        
      //   for (const line of lines) {
      //     if (line.startsWith('data: ')) {
      //       try {
      //         // Remove the "data: " prefix and parse the JSON
      //         const jsonStr = line.substring(6);
              
      //         // Check if it's the "[DONE]" marker
      //         if (jsonStr.trim() === '[DONE]') {
      //           continue;
      //         }
              
      //         const jsonData = JSON.parse(jsonStr);
      //         console.log('Parsed JSON data:', jsonData); // Log parsed data
              
      //         // Extract the text from the completion choices
      //         if (jsonData.choices && jsonData.choices[0]?.text) {
      //           const newText = jsonData.choices[0].text;
      //           streamedContent += newText;
                
      //           // Update the streaming message with current content
      //           setMessages(prev => prev.map(msg => 
      //             msg.id === streamingMessage.id 
      //               ? { ...msg, content: streamedContent }
      //               : msg
      //           ));
      //         }
      //       } catch (e) {
      //         console.warn('Error parsing SSE data:', e, 'Line:', line);
      //       }
      //     }
      //   }
      // }
      
      // // Update the streaming message to mark streaming as complete
      // setMessages(prev => prev.map(msg => 
      //   msg.id === streamingMessage.id 
      //     ? { ...msg, isStreaming: false }
      //     : msg
      // ));
      
      // setStreamController(null);

      // After getting the response from Supabase
    const response = await supabase.functions.invoke('together-ai', {
      body: { 
        prompt,
        model: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
        max_tokens: 1024,
        stream: true
      }
    });
    
    console.log('Supabase function response received:', response);
    
    if (response.error) {
      console.error('Error from Together AI:', response.error);
      throw new Error(response.error.message || 'Unknown error');
    }
    
    // Access the response body
    if (!response.data || !response.data.body) {
      console.error('No body in response data:', response.data);
      throw new Error('No readable stream in response');
    }
    
    // Get the ReadableStream from the response.data.body
    const readableStream = response.data.body;
    const reader = readableStream.getReader();
    let streamedContent = '';
    
    // Add a timeout to handle premature stream termination
    let streamTimeout = null;
    const MAX_SILENCE_MS = 10000; // 10 seconds without data before we consider the stream dead
    
    try {
      // Process the SSE stream
      while (true) {
        // Clear any existing timeout and set a new one
        if (streamTimeout) clearTimeout(streamTimeout);
        
        streamTimeout = setTimeout(() => {
          console.log('Stream timed out - no data received in', MAX_SILENCE_MS, 'ms');
          reader.cancel('Stream timed out');
          // Update the streaming message to mark as complete
          setMessages(prev => prev.map(msg => 
            msg.id === streamingMessage.id 
              ? { ...msg, isStreaming: false }
              : msg
          ));
        }, MAX_SILENCE_MS);
        
        const { done, value } = await reader.read();
        
        if (done) {
          console.log('Stream marked as done');
          clearTimeout(streamTimeout);
          break;
        }
        
        // Decode the chunk
        const chunk = new TextDecoder().decode(value);
        console.log('Received chunk length:', chunk.length);
        
        // Parse SSE format - each line starts with "data: "
        const lines = chunk.split('\n').filter(line => line.trim() !== '');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              // Remove the "data: " prefix and parse the JSON
              const jsonStr = line.substring(6);
              
              // Check if it's the "[DONE]" marker
              if (jsonStr.trim() === '[DONE]') {
                continue;
              }
              
              const jsonData = JSON.parse(jsonStr);
              
              // Extract the text from the completion choices
              if (jsonData.choices && jsonData.choices[0]?.text) {
                const newText = jsonData.choices[0].text;
                streamedContent += newText;
                
                // Update the streaming message with current content
                setMessages(prev => prev.map(msg => 
                  msg.id === streamingMessage.id 
                    ? { ...msg, content: streamedContent }
                    : msg
                ));
              }
            } catch (e) {
              console.warn('Error parsing SSE data:', e, 'Line:', line);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error processing stream:', error);
      // Still update with whatever content we got
      if (streamedContent) {
        setMessages(prev => prev.map(msg => 
          msg.id === streamingMessage.id 
            ? { ...msg, content: streamedContent, isStreaming: false }
            : msg
        ));
      }
    } finally {
      // Make sure we clear any pending timeout
      if (streamTimeout) clearTimeout(streamTimeout);
      
      // Update the streaming message to mark streaming as complete
      setMessages(prev => prev.map(msg => 
        msg.id === streamingMessage.id 
          ? { ...msg, isStreaming: false }
          : msg
      ));
      
      setStreamController(null);
    }
      
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Log more details if available
      if (error.response) {
        console.error('Response data:', error.response.data);
        console.error('Response status:', error.response.status);
      }
      
      toast({
        title: "Error",
        description: "Failed to get a response from the AI. Please try again.",
        variant: "destructive"
      });
      
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
  
  return (
    <Card className="w-full mt-6 mb-6 flex flex-col">
      <CardHeader className="px-4 py-3 border-b bg-gradient-to-r from-blue-500 to-blue-600">
        <CardTitle className="text-lg text-white">AI Career Recommendations</CardTitle>
        <div className="text-xs text-blue-100">Get personalized career advice powered by Together.ai</div>
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
              
              {message.isStreaming && (
                <span className="inline-block w-1.5 h-4 bg-slate-400 ml-1 animate-pulse"></span>
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
        
        {isLoading && !messages.some(m => m.isStreaming) && (
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
            disabled={isLoading}
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
