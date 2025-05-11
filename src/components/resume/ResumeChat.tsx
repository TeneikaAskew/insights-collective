import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { formatMessage } from '@/components/assistants/utils/messageFormatting';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from "@/components/ui/scroll-area";
import { ResumeAnalysis } from '@/components/assistants/types';

interface ResumeChatProps {
  resumeAnalysis: ResumeAnalysis | null;
}

type Message = {
  id: string;
  role: 'assistant' | 'user' | 'system';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  displayContent?: string; // This is what will be shown to the user
};

// Create storage keys for persisting chat state
const STORAGE_KEYS = {
  MESSAGES: 'resume_chat_messages',
  WELCOME_SHOWN: 'resume_welcome_shown'
};

const ResumeChat: React.FC<ResumeChatProps> = ({ resumeAnalysis }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamController, setStreamController] = useState<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [welcomeMessageShown, setWelcomeMessageShown] = useState(false);
  
  // Enhanced typing animation state
  const contentBufferRef = useRef<string[]>([]);
  const typingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef(false);
  const currentStreamingIdRef = useRef<string | null>(null);
  
  // Load persisted messages from localStorage
  useEffect(() => {
    if (user) {
      try {
        const savedMessages = localStorage.getItem(`${STORAGE_KEYS.MESSAGES}_${user.id}`);
        const welcomeShown = localStorage.getItem(`${STORAGE_KEYS.WELCOME_SHOWN}_${user.id}`);
        
        if (savedMessages) {
          const parsedMessages = JSON.parse(savedMessages);
          // Ensure displayContent matches content for loaded messages
          const messagesWithDisplay = parsedMessages.map((msg: Message) => ({
            ...msg,
            displayContent: msg.content
          }));
          setMessages(messagesWithDisplay);
        }
        
        if (welcomeShown) {
          setWelcomeMessageShown(true);
        }
      } catch (error) {
        console.error('Error loading saved chat:', error);
      }
    }
  }, [user]);
  
  // Clean up typing interval on unmount
  useEffect(() => {
    return () => {
      if (typingIntervalRef.current) {
        clearInterval(typingIntervalRef.current);
      }
    };
  }, []);
  
  // Save messages to localStorage whenever they change
  useEffect(() => {
    if (user && messages.length > 0) {
      // Filter out system messages before saving
      const messagesToSave = messages.filter(msg => msg.role !== 'system');
      localStorage.setItem(`${STORAGE_KEYS.MESSAGES}_${user.id}`, JSON.stringify(messagesToSave));
    }
  }, [messages, user]);
  
  // Scroll to bottom whenever messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  // Word-by-word typing animation processor
  const startWordTypingAnimation = useCallback(() => {
    if (isTypingRef.current || !currentStreamingIdRef.current) return;
    isTypingRef.current = true;
    
    // Process the next word from the buffer
    const processNextWord = () => {
      // If no streaming message or empty buffer, stop typing
      if (!currentStreamingIdRef.current || contentBufferRef.current.length === 0) {
        isTypingRef.current = false;
        return;
      }
      
      // Get the next word (or chunk) from the buffer
      const nextWord = contentBufferRef.current.shift();
      
      // Update the message with the next word
      setMessages(msgs => 
        msgs.map(msg => {
          if (msg.id === currentStreamingIdRef.current) {
            const newDisplayContent = (msg.displayContent || '') + nextWord;
            return { ...msg, displayContent: newDisplayContent };
          }
          return msg;
        })
      );
      
      // If there are more words in the buffer, schedule the next word
      if (contentBufferRef.current.length > 0) {
        // Random delay between 50-200ms for more natural typing feel
        const delay = Math.floor(Math.random() * 150) + 50;
        typingIntervalRef.current = setTimeout(processNextWord, delay);
      } else {
        isTypingRef.current = false;
      }
    };
    
    // Start processing words
    processNextWord();
  }, []);
  
  // Split content into words and add to buffer
  const addContentToBuffer = useCallback((content: string) => {
    if (!content) return;
    
    // Split new content into words/chunks
    // This regex splits by spaces but keeps the space with the preceding word
    const words = content.match(/\S+\s*/g) || [];
    
    // Add words to buffer
    contentBufferRef.current.push(...words);
    
    // Start typing animation if not already running
    if (!isTypingRef.current) {
      startWordTypingAnimation();
    }
  }, [startWordTypingAnimation]);
  
  // Create system message with resume context
  const createSystemMessage = useCallback(() => {
    if (!resumeAnalysis) return null;
    
    const systemContent = `You are a professional resume coach assisting a user with their resume.
    
Resume Context: Grade ${resumeAnalysis.letter_grade} (${resumeAnalysis.resume_percent}%). 
Key themes for improvement: ${resumeAnalysis.themes.join(', ')}.
Elevator pitch: ${resumeAnalysis.elevator_pitch}

Provide helpful, specific advice as a resume coach. Be constructive, honest, and professional.`;
    
    return {
      id: `system-${Date.now()}`,
      role: 'system',
      content: systemContent,
      timestamp: new Date()
    };
  }, [resumeAnalysis]);
  
  // Fetch initial resume assessment and create welcome message on component mount
  useEffect(() => {
    if (resumeAnalysis && user && !welcomeMessageShown) {
      setIsLoading(true);
      
      // Create basic welcome message with basic info
      const welcomeMessage: Message = {
        id: `welcome-${Date.now()}`,
        role: 'assistant',
        content: `I've analyzed your resume and can help you improve it! Your resume currently has a grade of **${resumeAnalysis.letter_grade} (${resumeAnalysis.resume_percent}%)**.`,
        displayContent: '', // Start empty for typing effect
        timestamp: new Date(),
      };
      
      // Create system message with resume context
      const systemMessage = createSystemMessage();
      
      // Set initial messages with system message if available
      setMessages(systemMessage ? [systemMessage, welcomeMessage] : [welcomeMessage]);
      
      // Setup for welcome message typing
      currentStreamingIdRef.current = welcomeMessage.id;
      contentBufferRef.current = [];
      
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
          const fullWelcomeContent = `I've analyzed your resume and can help you improve it! Your resume currently has a grade of **${resumeAnalysis.letter_grade} (${resumeAnalysis.resume_percent}%)**.

${initialAssessment ? `**Here's my honest assessment:**
${initialAssessment}

` : ''}Let's start by discussing your experience: **What specific challenges did you tackle in your first listed role, what actions did you take, and what measurable results did you achieve?**`;
          
          // Update message with full content but keep empty display for typing effect
          setMessages(prev => {
            return prev.map(msg => {
              if (msg.id === welcomeMessage.id) {
                return { ...msg, content: fullWelcomeContent, displayContent: '' };
              }
              return msg;
            });
          });
          
          // Add content to buffer for typing effect
          addContentToBuffer(fullWelcomeContent);
          
          setWelcomeMessageShown(true);
          localStorage.setItem(`${STORAGE_KEYS.WELCOME_SHOWN}_${user.id}`, 'true');
        } catch (error) {
          console.error('Error with assessment:', error);
          
          // Fallback message
          const fallbackContent = `${welcomeMessage.content}

Let's start by discussing your experience: **What specific challenges did you tackle in your first listed role, what actions did you take, and what measurable results did you achieve?**`;
          
          // Update message with fallback content but keep empty display for typing effect
          setMessages(prev => {
            return prev.map(msg => {
              if (msg.id === welcomeMessage.id) {
                return { ...msg, content: fallbackContent, displayContent: '' };
              }
              return msg;
            });
          });
          
          // Add content to buffer for typing effect
          addContentToBuffer(fallbackContent);
          
          setWelcomeMessageShown(true);
          localStorage.setItem(`${STORAGE_KEYS.WELCOME_SHOWN}_${user.id}`, 'true');
        } finally {
          setIsLoading(false);
        }
      })();
    }
  }, [resumeAnalysis, user, welcomeMessageShown, addContentToBuffer, createSystemMessage]);
  
  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: inputValue,
      displayContent: inputValue,
      timestamp: new Date(),
    };
    
    // Create a placeholder streaming message
    const streamingMessage: Message = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: '',
      displayContent: '',
      timestamp: new Date(),
      isStreaming: true
    };
    
    // Reset the buffer and set current streaming ID
    contentBufferRef.current = [];
    currentStreamingIdRef.current = streamingMessage.id;
    
    setMessages(prev => [...prev, userMessage, streamingMessage]);
    setInputValue('');
    setIsLoading(true);
    
    try {
      // Prepare the chat history for the API - we need to convert our Message objects to the
      // format expected by the Together API
      const chatHistory = messages
        .filter(msg => !msg.isStreaming) // Remove any current streaming messages
        .map(msg => ({
          role: msg.role,
          content: msg.content
        }));
      
      // Add the new user message
      chatHistory.push({
        role: userMessage.role,
        content: userMessage.content
      });
      
      // Abort any existing streams
      if (streamController) {
        streamController.abort();
      }
      
      // Create a new controller for this stream
      const controller = new AbortController();
      setStreamController(controller);
      
      console.log('Invoking together-ai function with chat history');
      
      const response = await supabase.functions.invoke('together-ai', {
        body: { 
          chatHistory,
          model: 'meta-llama/Llama-3-8b-chat-hf',
          max_tokens: 1024,
          stream: true
        }
      });
      
      console.log('Supabase function response received:', response);
      
      if (response.error) {
        console.error('Error from Together AI:', response.error);
        throw new Error(response.error.message || 'Unknown error');
      }
      
      if (!response.data || !response.data.body) {
        console.error('No body in response data:', response.data);
        throw new Error('No readable stream in response');
      }
      
      // Get the ReadableStream from the response.data.body
      const readableStream = response.data.body;
      const reader = readableStream.getReader();
      
      // Add a timeout to handle premature stream termination
      let streamTimeout: NodeJS.Timeout | null = null;
      const MAX_SILENCE_MS = 10000; // 10 seconds without data before we consider the stream dead
      
      try {
        // Process the SSE stream
        while (true) {
          // Clear any existing timeout and set a new one
          if (streamTimeout) clearTimeout(streamTimeout);
          
          streamTimeout = setTimeout(() => {
            console.log('Stream timed out - no data received in', MAX_SILENCE_MS, 'ms');
            reader.cancel('Stream timed out');
            // Mark streaming as complete
            setMessages(prev => prev.map(msg => 
              msg.id === streamingMessage.id 
                ? { ...msg, isStreaming: false }
                : msg
            ));
            // Clear current streaming ID
            currentStreamingIdRef.current = null;
          }, MAX_SILENCE_MS);
          
          const { done, value } = await reader.read();
          
          if (done) {
            console.log('Stream marked as done');
            if (streamTimeout) clearTimeout(streamTimeout);
            break;
          }
          
          // Decode the chunk
          const chunk = new TextDecoder().decode(value);
          console.log('Received chunk:', chunk.substring(0, 100));
          
          // Parse SSE format - each line starts with "data: "
          const lines = chunk.split('\n').filter(line => line.trim() !== '');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                // Remove the "data: " prefix and parse the JSON
                const jsonStr = line.substring(6);
                
                // Check if it's the "[DONE]" marker
                if (jsonStr.trim() === '[DONE]') {
                  console.log('Received [DONE] marker');
                  continue;
                }
                
                const jsonData = JSON.parse(jsonStr);
                console.log('Parsed JSON data:', jsonData);
                
                // Extract the text from the completion choices
                // Check for the delta.content format (chat completions API)
                if (jsonData.choices && jsonData.choices[0]?.delta?.content) {
                  const newText = jsonData.choices[0].delta.content;
                  console.log('Received new text:', newText);
                  
                  // Update the full message content in state (not visible to user yet)
                  setMessages(prev => {
                    const updatedMessages = prev.map(msg => {
                      if (msg.id === streamingMessage.id) {
                        return { ...msg, content: msg.content + newText };
                      }
                      return msg;
                    });
                    return updatedMessages;
                  });
                  
                  // Add new text to buffer for word-by-word typing
                  addContentToBuffer(newText);
                }
                // Fallback for the older completions API format
                else if (jsonData.choices && jsonData.choices[0]?.text) {
                  const newText = jsonData.choices[0].text;
                  console.log('Received new text (legacy format):', newText);
                  
                  setMessages(prev => {
                    const updatedMessages = prev.map(msg => {
                      if (msg.id === streamingMessage.id) {
                        return { ...msg, content: msg.content + newText };
                      }
                      return msg;
                    });
                    return updatedMessages;
                  });
                  
                  addContentToBuffer(newText);
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
        setMessages(prev => prev.map(msg => 
          msg.id === streamingMessage.id 
            ? { ...msg, isStreaming: false }
            : msg
        ));
        // Clear current streaming ID
        currentStreamingIdRef.current = null;
      } finally {
        // Make sure we clear any pending timeout
        if (streamTimeout) clearTimeout(streamTimeout);
        
        // Update the streaming message to mark streaming as complete
        // But keep typing animation going until buffer is empty
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
      const fallbackContent = "Thanks for sharing those details. Based on what you've told me, I'd recommend focusing on quantifying your achievements more clearly in your resume. Add specific metrics and outcomes to demonstrate your impact. Could you share a specific project where you made a significant contribution?";
      
      const fallbackMessage: Message = {
        id: `assistant-fallback-${Date.now()}`,
        role: 'assistant',
        content: fallbackContent,
        displayContent: '',
        timestamp: new Date(),
      };
      
      // Remove any streaming messages and add fallback
      setMessages(prev => [...prev.filter(msg => !msg.isStreaming), fallbackMessage]);
      
      // Setup typing animation for fallback message
      currentStreamingIdRef.current = fallbackMessage.id;
      contentBufferRef.current = [];
      addContentToBuffer(fallbackContent);
      
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
    <div className="w-full">
      <ScrollArea className="h-[900px] px-1">
        <div className="space-y-4 p-4">
          {messages
            .filter(message => message.role !== 'system') // Hide system messages from the UI
            .map((message) => (
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
                      dangerouslySetInnerHTML={{ 
                        __html: formatMessage(
                          message.displayContent || ''
                        )
                      }}
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
          
          {messages.filter(msg => msg.role !== 'system').length === 0 && resumeAnalysis && !isLoading && (
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
        </div>
      </ScrollArea>
      
      <div className="p-4 border-t mt-2">
        <div className="flex space-x-2 w-full">
          <Textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your resume or career path..."
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
      </div>
    </div>
  );
};

export default ResumeChat;

// import React, { useState, useRef, useEffect, useCallback } from 'react';
// import { Send } from 'lucide-react';
// import { Button } from '@/components/ui/button';
// import { Textarea } from '@/components/ui/textarea';
// import { supabase } from '@/integrations/supabase/client';
// import { useAuth } from '@/contexts/AuthContext';
// import { formatMessage } from '@/components/assistants/utils/messageFormatting';
// import { useToast } from '@/hooks/use-toast';
// import { ScrollArea } from "@/components/ui/scroll-area";
// import { ResumeAnalysis } from '@/components/assistants/types';

// interface ResumeChatProps {
//   resumeAnalysis: ResumeAnalysis | null;
// }

// type Message = {
//   id: string;
//   role: 'assistant' | 'user' | 'system';
//   content: string;
//   timestamp: Date;
//   isStreaming?: boolean;
//   displayContent?: string; // This is what will be shown to the user
//   useTypingAnimation?: boolean; // NEW: Flag to control typing animation
// };

// // Create storage keys for persisting chat state
// const STORAGE_KEYS = {
//   MESSAGES: 'resume_chat_messages',
//   WELCOME_SHOWN: 'resume_welcome_shown'
// };

// const ResumeChat: React.FC<ResumeChatProps> = ({ resumeAnalysis }) => {
//   const { user } = useAuth();
//   const { toast } = useToast();
//   const [messages, setMessages] = useState<Message[]>([]);
//   const [inputValue, setInputValue] = useState('');
//   const [isLoading, setIsLoading] = useState(false);
//   const [streamController, setStreamController] = useState<AbortController | null>(null);
//   const messagesEndRef = useRef<HTMLDivElement>(null);
//   const [welcomeMessageShown, setWelcomeMessageShown] = useState(false);
  
//   // Enhanced typing animation state
//   const contentBufferRef = useRef<string[]>([]);
//   const typingIntervalRef = useRef<NodeJS.Timeout | null>(null);
//   const isTypingRef = useRef(false);
//   const currentStreamingIdRef = useRef<string | null>(null);
  
//   // Load persisted messages from localStorage
//   useEffect(() => {
//     if (user) {
//       try {
//         const savedMessages = localStorage.getItem(`${STORAGE_KEYS.MESSAGES}_${user.id}`);
//         const welcomeShown = localStorage.getItem(`${STORAGE_KEYS.WELCOME_SHOWN}_${user.id}`);
        
//         if (savedMessages) {
//           const parsedMessages = JSON.parse(savedMessages);
//           // Ensure displayContent matches content for loaded messages
//           const messagesWithDisplay = parsedMessages.map((msg: Message) => ({
//             ...msg,
//             displayContent: msg.content,
//             useTypingAnimation: false // No typing animation for loaded messages
//           }));
//           setMessages(messagesWithDisplay);
//         }
        
//         if (welcomeShown) {
//           setWelcomeMessageShown(true);
//         }
//       } catch (error) {
//         console.error('Error loading saved chat:', error);
//       }
//     }
//   }, [user]);
  
//   // Clean up typing interval on unmount
//   useEffect(() => {
//     return () => {
//       if (typingIntervalRef.current) {
//         clearInterval(typingIntervalRef.current);
//       }
//     };
//   }, []);
  
//   // Save messages to localStorage whenever they change
//   useEffect(() => {
//     if (user && messages.length > 0) {
//       // Filter out system messages before saving
//       const messagesToSave = messages
//         .filter(msg => msg.role !== 'system')
//         .map(({ useTypingAnimation, displayContent, ...msg }) => msg); // Remove typing-related properties
      
//       localStorage.setItem(`${STORAGE_KEYS.MESSAGES}_${user.id}`, JSON.stringify(messagesToSave));
//     }
//   }, [messages, user]);
  
//   // Scroll to bottom whenever messages change
//   useEffect(() => {
//     messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
//   }, [messages]);
  
//   // Word-by-word typing animation processor
//   const startWordTypingAnimation = useCallback(() => {
//     if (isTypingRef.current || !currentStreamingIdRef.current) return;
//     isTypingRef.current = true;
    
//     // Process the next word from the buffer
//     const processNextWord = () => {
//       // If no streaming message or empty buffer, stop typing
//       if (!currentStreamingIdRef.current || contentBufferRef.current.length === 0) {
//         isTypingRef.current = false;
//         return;
//       }
      
//       // Get the next word (or chunk) from the buffer
//       const nextWord = contentBufferRef.current.shift();
      
//       // Update the message with the next word
//       setMessages(msgs => 
//         msgs.map(msg => {
//           if (msg.id === currentStreamingIdRef.current) {
//             const newDisplayContent = (msg.displayContent || '') + nextWord;
//             return { ...msg, displayContent: newDisplayContent };
//           }
//           return msg;
//         })
//       );
      
//       // If there are more words in the buffer, schedule the next word
//       if (contentBufferRef.current.length > 0) {
//         // Random delay between 50-200ms for more natural typing feel
//         const delay = Math.floor(Math.random() * 150) + 50;
//         typingIntervalRef.current = setTimeout(processNextWord, delay);
//       } else {
//         isTypingRef.current = false;
//       }
//     };
    
//     // Start processing words
//     processNextWord();
//   }, []);
  
//   // Split content into words and add to buffer
//   const addContentToBuffer = useCallback((content: string) => {
//     if (!content) return;
    
//     // Split new content into words/chunks
//     // This regex splits by spaces but keeps the space with the preceding word
//     const words = content.match(/\S+\s*/g) || [];
    
//     // Add words to buffer
//     contentBufferRef.current.push(...words);
    
//     // Start typing animation if not already running
//     if (!isTypingRef.current) {
//       startWordTypingAnimation();
//     }
//   }, [startWordTypingAnimation]);
  
//   // Create system message with resume context
//   const createSystemMessage = useCallback(() => {
//     if (!resumeAnalysis) return null;
    
//     const systemContent = `You are a professional resume coach assisting a user with their resume.
    
// Resume Context: Grade ${resumeAnalysis.letter_grade} (${resumeAnalysis.resume_percent}%). 
// Key themes for improvement: ${resumeAnalysis.themes.join(', ')}.
// Elevator pitch: ${resumeAnalysis.elevator_pitch}

// Provide helpful, specific advice as a resume coach. Be constructive, honest, and professional.`;
    
//     return {
//       id: `system-${Date.now()}`,
//       role: 'system',
//       content: systemContent,
//       displayContent: systemContent,
//       timestamp: new Date(),
//       useTypingAnimation: false
//     };
//   }, [resumeAnalysis]);
  
//   // Fetch initial resume assessment and create welcome message on component mount
//   useEffect(() => {
//     if (resumeAnalysis && user && !welcomeMessageShown) {
//       setIsLoading(true);
      
//       // Initial operation to fetch assessment
//       (async () => {
//         try {
//           const { data, error } = await supabase
//             .from('resumes')
//             .select('initial_assessment')
//             .eq('user_id', user.id)
//             .single();
          
//           if (error) {
//             console.error('Error fetching stored assessment:', error);
//             throw error;
//           }
          
//           let initialAssessment = data?.initial_assessment;
          
//           // If no stored assessment, try to fetch it
//           if (!initialAssessment && resumeAnalysis.resume_id) {
//             const resumeText = localStorage.getItem(`resume_text_${resumeAnalysis.resume_id}`) || '';
            
//             if (resumeText) {
//               const { data: roastData, error: roastError } = await supabase.functions.invoke('resume-analyzer', {
//                 body: { 
//                   action: 'get-roast',
//                   resumeText
//                 }
//               });
              
//               if (roastError) throw roastError;
              
//               if (roastData?.roast) {
//                 initialAssessment = roastData.roast;
                
//                 // Store it in the database for future use
//                 await supabase
//                   .from('resumes')
//                   .update({ initial_assessment: initialAssessment })
//                   .eq('user_id', user.id);
//               }
//             }
//           }
          
//           // Create welcome message with assessment - NO TYPING ANIMATION
//           const fullWelcomeContent = `I've analyzed your resume and can help you improve it! Your resume currently has a grade of **${resumeAnalysis.letter_grade} (${resumeAnalysis.resume_percent}%)**.

// ${initialAssessment ? `**Here's my honest assessment:**
// ${initialAssessment}

// ` : ''}Let's start by discussing your experience: **What specific challenges did you tackle in your first listed role, what actions did you take, and what measurable results did you achieve?**`;
          
//           // Create welcome message with full content visible immediately - no typing animation
//           const welcomeMessage: Message = {
//             id: `welcome-${Date.now()}`,
//             role: 'assistant',
//             content: fullWelcomeContent,
//             displayContent: fullWelcomeContent, // Same as content - no need for typing animation
//             timestamp: new Date(),
//             useTypingAnimation: false // Explicitly set to false
//           };
          
//           // Create system message with resume context
//           const systemMessage = createSystemMessage();
          
//           // Set messages with system message (if available) and welcome message
//           setMessages(systemMessage ? [systemMessage, welcomeMessage] : [welcomeMessage]);
//           setWelcomeMessageShown(true);
//           localStorage.setItem(`${STORAGE_KEYS.WELCOME_SHOWN}_${user.id}`, 'true');
          
//         } catch (error) {
//           console.error('Error with assessment:', error);
          
//           // Fallback welcome message - NO TYPING ANIMATION
//           const fallbackContent = `I've analyzed your resume and can help you improve it! Your resume currently has a grade of **${resumeAnalysis.letter_grade} (${resumeAnalysis.resume_percent}%)**.

// Let's start by discussing your experience: **What specific challenges did you tackle in your first listed role, what actions did you take, and what measurable results did you achieve?**`;
          
//           // Create welcome message with full content visible immediately
//           const welcomeMessage: Message = {
//             id: `welcome-${Date.now()}`,
//             role: 'assistant',
//             content: fallbackContent,
//             displayContent: fallbackContent, // Same as content - no typing animation
//             timestamp: new Date(),
//             useTypingAnimation: false
//           };
          
//           // Create system message with resume context
//           const systemMessage = createSystemMessage();
          
//           // Set messages with system message (if available) and welcome message
//           setMessages(systemMessage ? [systemMessage, welcomeMessage] : [welcomeMessage]);
//           setWelcomeMessageShown(true);
//           localStorage.setItem(`${STORAGE_KEYS.WELCOME_SHOWN}_${user.id}`, 'true');
          
//         } finally {
//           setIsLoading(false);
//         }
//       })();
//     }
//   }, [resumeAnalysis, user, welcomeMessageShown, createSystemMessage]);
  
//   const handleSendMessage = async () => {
//     if (!inputValue.trim() || isLoading) return;

//     const userMessage: Message = {
//       id: `user-${Date.now()}`,
//       role: 'user',
//       content: inputValue,
//       displayContent: inputValue,
//       timestamp: new Date(),
//       useTypingAnimation: false // User messages don't need typing animation
//     };
    
//     // Create a placeholder streaming message
//     const streamingMessage: Message = {
//       id: `assistant-${Date.now()}`,
//       role: 'assistant',
//       content: '',
//       displayContent: '',
//       timestamp: new Date(),
//       isStreaming: true,
//       useTypingAnimation: true // THIS message WILL use typing animation
//     };
    
//     // Reset the buffer and set current streaming ID
//     contentBufferRef.current = [];
//     currentStreamingIdRef.current = streamingMessage.id;
    
//     setMessages(prev => [...prev, userMessage, streamingMessage]);
//     setInputValue('');
//     setIsLoading(true);
    
//     try {
//       // Prepare the chat history for the API - we need to convert our Message objects to the
//       // format expected by the Together API
//       const chatHistory = messages
//         .filter(msg => !msg.isStreaming) // Remove any current streaming messages
//         .map(msg => ({
//           role: msg.role,
//           content: msg.content
//         }));
      
//       // Add the new user message
//       chatHistory.push({
//         role: userMessage.role,
//         content: userMessage.content
//       });
      
//       // Abort any existing streams
//       if (streamController) {
//         streamController.abort();
//       }
      
//       // Create a new controller for this stream
//       const controller = new AbortController();
//       setStreamController(controller);
      
//       console.log('Invoking together-ai function with chat history');
      
//       const response = await supabase.functions.invoke('together-ai', {
//         body: { 
//           chatHistory,
//           model: 'meta-llama/Llama-3-8b-chat-hf',
//           max_tokens: 1024,
//           stream: true
//         }
//       });
      
//       console.log('Supabase function response received:', response);
      
//       if (response.error) {
//         console.error('Error from Together AI:', response.error);
//         throw new Error(response.error.message || 'Unknown error');
//       }
      
//       if (!response.data || !response.data.body) {
//         console.error('No body in response data:', response.data);
//         throw new Error('No readable stream in response');
//       }
      
//       // Get the ReadableStream from the response.data.body
//       const readableStream = response.data.body;
//       const reader = readableStream.getReader();
      
//       // Add a timeout to handle premature stream termination
//       let streamTimeout: NodeJS.Timeout | null = null;
//       const MAX_SILENCE_MS = 10000; // 10 seconds without data before we consider the stream dead
      
//       try {
//         // Process the SSE stream
//         while (true) {
//           // Clear any existing timeout and set a new one
//           if (streamTimeout) clearTimeout(streamTimeout);
          
//           streamTimeout = setTimeout(() => {
//             console.log('Stream timed out - no data received in', MAX_SILENCE_MS, 'ms');
//             reader.cancel('Stream timed out');
//             // Mark streaming as complete
//             setMessages(prev => prev.map(msg => 
//               msg.id === streamingMessage.id 
//                 ? { ...msg, isStreaming: false }
//                 : msg
//             ));
//             // Clear current streaming ID
//             currentStreamingIdRef.current = null;
//           }, MAX_SILENCE_MS);
          
//           const { done, value } = await reader.read();
          
//           if (done) {
//             console.log('Stream marked as done');
//             if (streamTimeout) clearTimeout(streamTimeout);
//             break;
//           }
          
//           // Decode the chunk
//           const chunk = new TextDecoder().decode(value);
//           console.log('Received chunk:', chunk.substring(0, 100));
          
//           // Parse SSE format - each line starts with "data: "
//           const lines = chunk.split('\n').filter(line => line.trim() !== '');
          
//           for (const line of lines) {
//             if (line.startsWith('data: ')) {
//               try {
//                 // Remove the "data: " prefix and parse the JSON
//                 const jsonStr = line.substring(6);
                
//                 // Check if it's the "[DONE]" marker
//                 if (jsonStr.trim() === '[DONE]') {
//                   console.log('Received [DONE] marker');
//                   continue;
//                 }
                
//                 const jsonData = JSON.parse(jsonStr);
//                 console.log('Parsed JSON data:', jsonData);
                
//                 // Extract the text from the completion choices
//                 // Check for the delta.content format (chat completions API)
//                 if (jsonData.choices && jsonData.choices[0]?.delta?.content) {
//                   const newText = jsonData.choices[0].delta.content;
//                   console.log('Received new text:', newText);
                  
//                   // Update the full message content in state (not visible to user yet)
//                   setMessages(prev => {
//                     const updatedMessages = prev.map(msg => {
//                       if (msg.id === streamingMessage.id) {
//                         return { ...msg, content: msg.content + newText };
//                       }
//                       return msg;
//                     });
//                     return updatedMessages;
//                   });
                  
//                   // Only add to buffer if this message uses typing animation
//                   if (streamingMessage.useTypingAnimation) {
//                     addContentToBuffer(newText);
//                   }
//                 }
//                 // Fallback for the older completions API format
//                 else if (jsonData.choices && jsonData.choices[0]?.text) {
//                   const newText = jsonData.choices[0].text;
//                   console.log('Received new text (legacy format):', newText);
                  
//                   setMessages(prev => {
//                     const updatedMessages = prev.map(msg => {
//                       if (msg.id === streamingMessage.id) {
//                         return { ...msg, content: msg.content + newText };
//                       }
//                       return msg;
//                     });
//                     return updatedMessages;
//                   });
                  
//                   // Only add to buffer if this message uses typing animation
//                   if (streamingMessage.useTypingAnimation) {
//                     addContentToBuffer(newText);
//                   }
//                 }
//               } catch (e) {
//                 console.warn('Error parsing SSE data:', e, 'Line:', line);
//               }
//             }
//           }
//         }
//       } catch (error) {
//         console.error('Error processing stream:', error);
//         // Still update with whatever content we got
//         setMessages(prev => prev.map(msg => 
//           msg.id === streamingMessage.id 
//             ? { ...msg, isStreaming: false }
//             : msg
//         ));
//         // Clear current streaming ID
//         currentStreamingIdRef.current = null;
//       } finally {
//         // Make sure we clear any pending timeout
//         if (streamTimeout) clearTimeout(streamTimeout);
        
//         // Update the streaming message to mark streaming as complete
//         // But keep typing animation going until buffer is empty
//         setMessages(prev => prev.map(msg => 
//           msg.id === streamingMessage.id 
//             ? { ...msg, isStreaming: false }
//             : msg
//         ));
        
//         setStreamController(null);
//       }
      
//     } catch (error) {
//       console.error('Error sending message:', error);
      
//       // Log more details if available
//       if (error.response) {
//         console.error('Response data:', error.response.data);
//         console.error('Response status:', error.response.status);
//       }
      
//       toast({
//         title: "Error",
//         description: "Failed to get a response from the AI. Please try again.",
//         variant: "destructive"
//       });
      
//       // Fallback response
//       const fallbackContent = "Thanks for sharing those details. Based on what you've told me, I'd recommend focusing on quantifying your achievements more clearly in your resume. Add specific metrics and outcomes to demonstrate your impact. Could you share a specific project where you made a significant contribution?";
      
//       const fallbackMessage: Message = {
//         id: `assistant-fallback-${Date.now()}`,
//         role: 'assistant',
//         content: fallbackContent,
//         displayContent: fallbackContent, // No typing animation for fallback
//         timestamp: new Date(),
//         useTypingAnimation: false
//       };
      
//       // Remove any streaming messages and add fallback
//       setMessages(prev => [...prev.filter(msg => !msg.isStreaming), fallbackMessage]);
      
//     } finally {
//       setIsLoading(false);
//     }
//   };
  
//   const handleKeyDown = (e: React.KeyboardEvent) => {
//     if (e.key === 'Enter' && !e.shiftKey) {
//       e.preventDefault();
//       handleSendMessage();
//     }
//   };
  
//   return (
//     <div className="w-full">
//       <ScrollArea className="h-[900px] px-1">
//         <div className="space-y-4 p-4">
//           {messages
//             .filter(message => message.role !== 'system') // Hide system messages from the UI
//             .map((message) => (
//               <div key={message.id} className={`flex ${
//                 message.role === 'assistant' 
//                   ? 'justify-start' 
//                   : 'justify-end'
//               }`}>
//                 <div className={`max-w-3xl p-3 rounded-lg ${
//                   message.role === 'assistant' 
//                     ? 'bg-slate-100 text-slate-800' 
//                     : 'bg-blue-600 text-white'
//                 }`}>
//                   {message.role === 'assistant' ? (
//                     <div 
//                       className="prose prose-slate max-w-none"
//                       dangerouslySetInnerHTML={{ 
//                         __html: formatMessage(
//                           // For assistant messages, use displayContent if using typing animation,
//                           // otherwise just use the full content
//                           message.useTypingAnimation ? (message.displayContent || '') : message.content
//                         )
//                       }}
//                     />
//                   ) : (
//                     <div>{message.content}</div>
//                   )}
                  
//                   {message.isStreaming && (
//                     <span className="inline-block w-1.5 h-4 bg-slate-400 ml-1 animate-pulse"></span>
//                   )}
//                 </div>
//               </div>
//           ))}
          
//           {messages.filter(msg => msg.role !== 'system').length === 0 && resumeAnalysis && !isLoading && (
//             <div className="text-center p-6">
//               <p className="text-muted-foreground mb-4">
//                 Your resume is ready for review. I can provide personalized advice to help you improve it.
//               </p>
//             </div>
//           )}
          
//           {isLoading && !messages.some(m => m.isStreaming) && (
//             <div className="flex justify-start">
//               <div className="max-w-3xl p-3 rounded-lg bg-slate-100 text-slate-800">
//                 <div className="flex space-x-2">
//                   <div className="w-2 h-2 rounded-full bg-slate-400 animate-pulse"></div>
//                   <div className="w-2 h-2 rounded-full bg-slate-400 animate-pulse delay-75"></div>
//                   <div className="w-2 h-2 rounded-full bg-slate-400 animate-pulse delay-150"></div>
//                 </div>
//               </div>
//             </div>
//           )}
//           <div ref={messagesEndRef} />
//         </div>
//       </ScrollArea>
      
//       <div className="p-4 border-t mt-2">
//         <div className="flex space-x-2 w-full">
//           <Textarea
//             value={inputValue}
//             onChange={(e) => setInputValue(e.target.value)}
//             onKeyDown={handleKeyDown}
//             placeholder="Ask about your resume or career path..."
//             className="flex-1 resize-none"
//             rows={2}
//             disabled={isLoading}
//           />
//           <Button 
//             onClick={handleSendMessage} 
//             disabled={isLoading || !inputValue.trim()}
//             className="self-end"
//           >
//             <Send className="h-4 w-4" />
//             <span className="sr-only">Send</span>
//           </Button>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default ResumeChat;
// // import React, { useState, useRef, useEffect, useCallback } from 'react';
// // import { Send } from 'lucide-react';
// // import { Button } from '@/components/ui/button';
// // import { Textarea } from '@/components/ui/textarea';
// // import { supabase } from '@/integrations/supabase/client';
// // import { useAuth } from '@/contexts/AuthContext';
// // import { formatMessage } from '@/components/assistants/utils/messageFormatting';
// // import { useToast } from '@/hooks/use-toast';
// // import { ScrollArea } from "@/components/ui/scroll-area";
// // import { ResumeAnalysis } from '@/components/assistants/types';

// // interface ResumeChatProps {
// //   resumeAnalysis: ResumeAnalysis | null;
// // }

// // type Message = {
// //   id: string;
// //   role: 'assistant' | 'user' | 'system';
// //   content: string;
// //   timestamp: Date;
// //   isStreaming?: boolean;
// //   displayContent?: string; // This is what will be shown to the user
// // };

// // // Create storage keys for persisting chat state
// // const STORAGE_KEYS = {
// //   MESSAGES: 'resume_chat_messages',
// //   WELCOME_SHOWN: 'resume_welcome_shown'
// // };

// // const ResumeChat: React.FC<ResumeChatProps> = ({ resumeAnalysis }) => {
// //   const { user } = useAuth();
// //   const { toast } = useToast();
// //   const [messages, setMessages] = useState<Message[]>([]);
// //   const [inputValue, setInputValue] = useState('');
// //   const [isLoading, setIsLoading] = useState(false);
// //   const [streamController, setStreamController] = useState<AbortController | null>(null);
// //   const messagesEndRef = useRef<HTMLDivElement>(null);
// //   const [welcomeMessageShown, setWelcomeMessageShown] = useState(false);
  
// //   // Enhanced typing animation state
// //   const contentBufferRef = useRef<string[]>([]);
// //   const typingIntervalRef = useRef<NodeJS.Timeout | null>(null);
// //   const isTypingRef = useRef(false);
// //   const currentStreamingIdRef = useRef<string | null>(null);
  
// //   // Load persisted messages from localStorage
// //   useEffect(() => {
// //     if (user) {
// //       try {
// //         const savedMessages = localStorage.getItem(`${STORAGE_KEYS.MESSAGES}_${user.id}`);
// //         const welcomeShown = localStorage.getItem(`${STORAGE_KEYS.WELCOME_SHOWN}_${user.id}`);
        
// //         if (savedMessages) {
// //           const parsedMessages = JSON.parse(savedMessages);
// //           // Ensure displayContent matches content for loaded messages
// //           const messagesWithDisplay = parsedMessages.map((msg: Message) => ({
// //             ...msg,
// //             displayContent: msg.content
// //           }));
// //           setMessages(messagesWithDisplay);
// //         }
        
// //         if (welcomeShown) {
// //           setWelcomeMessageShown(true);
// //         }
// //       } catch (error) {
// //         console.error('Error loading saved chat:', error);
// //       }
// //     }
// //   }, [user]);
  
// //   // Clean up typing interval on unmount
// //   useEffect(() => {
// //     return () => {
// //       if (typingIntervalRef.current) {
// //         clearInterval(typingIntervalRef.current);
// //       }
// //     };
// //   }, []);
  
// //   // Save messages to localStorage whenever they change
// //   useEffect(() => {
// //     if (user && messages.length > 0) {
// //       // Filter out system messages before saving
// //       const messagesToSave = messages.filter(msg => msg.role !== 'system');
// //       localStorage.setItem(`${STORAGE_KEYS.MESSAGES}_${user.id}`, JSON.stringify(messagesToSave));
// //     }
// //   }, [messages, user]);
  
// //   // Scroll to bottom whenever messages change
// //   useEffect(() => {
// //     messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
// //   }, [messages]);
  
// //   // Word-by-word typing animation processor
// //   const startWordTypingAnimation = useCallback(() => {
// //     if (isTypingRef.current || !currentStreamingIdRef.current) return;
// //     isTypingRef.current = true;
    
// //     // Process the next word from the buffer
// //     const processNextWord = () => {
// //       // If no streaming message or empty buffer, stop typing
// //       if (!currentStreamingIdRef.current || contentBufferRef.current.length === 0) {
// //         isTypingRef.current = false;
// //         return;
// //       }
      
// //       // Get the next word (or chunk) from the buffer
// //       const nextWord = contentBufferRef.current.shift();
      
// //       // Update the message with the next word
// //       setMessages(msgs => 
// //         msgs.map(msg => {
// //           if (msg.id === currentStreamingIdRef.current) {
// //             const newDisplayContent = (msg.displayContent || '') + nextWord;
// //             return { ...msg, displayContent: newDisplayContent };
// //           }
// //           return msg;
// //         })
// //       );
      
// //       // If there are more words in the buffer, schedule the next word
// //       if (contentBufferRef.current.length > 0) {
// //         // Random delay between 50-200ms for more natural typing feel
// //         const delay = Math.floor(Math.random() * 150) + 50;
// //         typingIntervalRef.current = setTimeout(processNextWord, delay);
// //       } else {
// //         isTypingRef.current = false;
// //       }
// //     };
    
// //     // Start processing words
// //     processNextWord();
// //   }, []);
  
// //   // Split content into words and add to buffer
// //   const addContentToBuffer = useCallback((content: string) => {
// //     if (!content) return;
    
// //     // Split new content into words/chunks
// //     // This regex splits by spaces but keeps the space with the preceding word
// //     const words = content.match(/\S+\s*/g) || [];
    
// //     // Add words to buffer
// //     contentBufferRef.current.push(...words);
    
// //     // Start typing animation if not already running
// //     if (!isTypingRef.current) {
// //       startWordTypingAnimation();
// //     }
// //   }, [startWordTypingAnimation]);
  
// //   // Create system message with resume context
// //   const createSystemMessage = useCallback(() => {
// //     if (!resumeAnalysis) return null;
    
// //     const systemContent = `You are a professional resume coach assisting a user with their resume.
    
// // Resume Context: Grade ${resumeAnalysis.letter_grade} (${resumeAnalysis.resume_percent}%). 
// // Key themes for improvement: ${resumeAnalysis.themes.join(', ')}.
// // Elevator pitch: ${resumeAnalysis.elevator_pitch}

// // Provide helpful, specific advice as a resume coach. Be constructive, honest, and professional.`;
    
// //     return {
// //       id: `system-${Date.now()}`,
// //       role: 'system',
// //       content: systemContent,
// //       timestamp: new Date()
// //     };
// //   }, [resumeAnalysis]);
  
// //   // Fetch initial resume assessment and create welcome message on component mount
// //   useEffect(() => {
// //     if (resumeAnalysis && user && !welcomeMessageShown) {
// //       setIsLoading(true);
      
// //       // Create basic welcome message with basic info
// //       const welcomeMessage: Message = {
// //         id: `welcome-${Date.now()}`,
// //         role: 'assistant',
// //         content: `I've analyzed your resume and can help you improve it! Your resume currently has a grade of **${resumeAnalysis.letter_grade} (${resumeAnalysis.resume_percent}%)**.`,
// //         displayContent: '', // Start empty for typing effect
// //         timestamp: new Date(),
// //       };
      
// //       // Create system message with resume context
// //       const systemMessage = createSystemMessage();
      
// //       // Set initial messages with system message if available
// //       setMessages(systemMessage ? [systemMessage, welcomeMessage] : [welcomeMessage]);
      
// //       // Setup for welcome message typing
// //       currentStreamingIdRef.current = welcomeMessage.id;
// //       contentBufferRef.current = [];
      
// //       // Try to fetch stored assessment from the database
// //       (async () => {
// //         try {
// //           const { data, error } = await supabase
// //             .from('resumes')
// //             .select('initial_assessment')
// //             .eq('user_id', user.id)
// //             .single();
          
// //           if (error) {
// //             console.error('Error fetching stored assessment:', error);
// //             throw error;
// //           }
          
// //           let initialAssessment = data?.initial_assessment;
          
// //           // If no stored assessment, try to fetch it
// //           if (!initialAssessment && resumeAnalysis.resume_id) {
// //             const resumeText = localStorage.getItem(`resume_text_${resumeAnalysis.resume_id}`) || '';
            
// //             if (resumeText) {
// //               const { data: roastData, error: roastError } = await supabase.functions.invoke('resume-analyzer', {
// //                 body: { 
// //                   action: 'get-roast',
// //                   resumeText
// //                 }
// //               });
              
// //               if (roastError) throw roastError;
              
// //               if (roastData?.roast) {
// //                 initialAssessment = roastData.roast;
                
// //                 // Store it in the database for future use
// //                 await supabase
// //                   .from('resumes')
// //                   .update({ initial_assessment: initialAssessment })
// //                   .eq('user_id', user.id);
// //               }
// //             }
// //           }
          
// //           // Update welcome message with assessment
// //           const fullWelcomeContent = `I've analyzed your resume and can help you improve it! Your resume currently has a grade of **${resumeAnalysis.letter_grade} (${resumeAnalysis.resume_percent}%)**.

// // ${initialAssessment ? `**Here's my honest assessment:**
// // ${initialAssessment}

// // ` : ''}Let's start by discussing your experience: **What specific challenges did you tackle in your first listed role, what actions did you take, and what measurable results did you achieve?**`;
          
// //           // Update message with full content but keep empty display for typing effect
// //           setMessages(prev => {
// //             return prev.map(msg => {
// //               if (msg.id === welcomeMessage.id) {
// //                 return { ...msg, content: fullWelcomeContent, displayContent: '' };
// //               }
// //               return msg;
// //             });
// //           });
          
// //           // Add content to buffer for typing effect
// //           addContentToBuffer(fullWelcomeContent);
          
// //           setWelcomeMessageShown(true);
// //           localStorage.setItem(`${STORAGE_KEYS.WELCOME_SHOWN}_${user.id}`, 'true');
// //         } catch (error) {
// //           console.error('Error with assessment:', error);
          
// //           // Fallback message
// //           const fallbackContent = `${welcomeMessage.content}

// // Let's start by discussing your experience: **What specific challenges did you tackle in your first listed role, what actions did you take, and what measurable results did you achieve?**`;
          
// //           // Update message with fallback content but keep empty display for typing effect
// //           setMessages(prev => {
// //             return prev.map(msg => {
// //               if (msg.id === welcomeMessage.id) {
// //                 return { ...msg, content: fallbackContent, displayContent: '' };
// //               }
// //               return msg;
// //             });
// //           });
          
// //           // Add content to buffer for typing effect
// //           addContentToBuffer(fallbackContent);
          
// //           setWelcomeMessageShown(true);
// //           localStorage.setItem(`${STORAGE_KEYS.WELCOME_SHOWN}_${user.id}`, 'true');
// //         } finally {
// //           setIsLoading(false);
// //         }
// //       })();
// //     }
// //   }, [resumeAnalysis, user, welcomeMessageShown, addContentToBuffer, createSystemMessage]);
  
// //   const handleSendMessage = async () => {
// //     if (!inputValue.trim() || isLoading) return;

// //     const userMessage: Message = {
// //       id: `user-${Date.now()}`,
// //       role: 'user',
// //       content: inputValue,
// //       displayContent: inputValue,
// //       timestamp: new Date(),
// //     };
    
// //     // Create a placeholder streaming message
// //     const streamingMessage: Message = {
// //       id: `assistant-${Date.now()}`,
// //       role: 'assistant',
// //       content: '',
// //       displayContent: '',
// //       timestamp: new Date(),
// //       isStreaming: true
// //     };
    
// //     // Reset the buffer and set current streaming ID
// //     contentBufferRef.current = [];
// //     currentStreamingIdRef.current = streamingMessage.id;
    
// //     setMessages(prev => [...prev, userMessage, streamingMessage]);
// //     setInputValue('');
// //     setIsLoading(true);
    
// //     try {
// //       // Prepare the chat history for the API - we need to convert our Message objects to the
// //       // format expected by the Together API
// //       const chatHistory = messages
// //         .filter(msg => !msg.isStreaming) // Remove any current streaming messages
// //         .map(msg => ({
// //           role: msg.role,
// //           content: msg.content
// //         }));
      
// //       // Add the new user message
// //       chatHistory.push({
// //         role: userMessage.role,
// //         content: userMessage.content
// //       });
      
// //       // Abort any existing streams
// //       if (streamController) {
// //         streamController.abort();
// //       }
      
// //       // Create a new controller for this stream
// //       const controller = new AbortController();
// //       setStreamController(controller);
      
// //       console.log('Invoking together-ai function with chat history');
      
// //       const response = await supabase.functions.invoke('together-ai', {
// //         body: { 
// //           chatHistory,
// //           model: 'meta-llama/Llama-3-8b-chat-hf',
// //           max_tokens: 1024,
// //           stream: true
// //         }
// //       });
      
// //       console.log('Supabase function response received:', response);
      
// //       if (response.error) {
// //         console.error('Error from Together AI:', response.error);
// //         throw new Error(response.error.message || 'Unknown error');
// //       }
      
// //       if (!response.data || !response.data.body) {
// //         console.error('No body in response data:', response.data);
// //         throw new Error('No readable stream in response');
// //       }
      
// //       // Get the ReadableStream from the response.data.body
// //       const readableStream = response.data.body;
// //       const reader = readableStream.getReader();
      
// //       // Add a timeout to handle premature stream termination
// //       let streamTimeout: NodeJS.Timeout | null = null;
// //       const MAX_SILENCE_MS = 10000; // 10 seconds without data before we consider the stream dead
      
// //       try {
// //         // Process the SSE stream
// //         while (true) {
// //           // Clear any existing timeout and set a new one
// //           if (streamTimeout) clearTimeout(streamTimeout);
          
// //           streamTimeout = setTimeout(() => {
// //             console.log('Stream timed out - no data received in', MAX_SILENCE_MS, 'ms');
// //             reader.cancel('Stream timed out');
// //             // Mark streaming as complete
// //             setMessages(prev => prev.map(msg => 
// //               msg.id === streamingMessage.id 
// //                 ? { ...msg, isStreaming: false }
// //                 : msg
// //             ));
// //             // Clear current streaming ID
// //             currentStreamingIdRef.current = null;
// //           }, MAX_SILENCE_MS);
          
// //           const { done, value } = await reader.read();
          
// //           if (done) {
// //             console.log('Stream marked as done');
// //             if (streamTimeout) clearTimeout(streamTimeout);
// //             break;
// //           }
          
// //           // Decode the chunk
// //           const chunk = new TextDecoder().decode(value);
// //           console.log('Received chunk:', chunk.substring(0, 100));
          
// //           // Parse SSE format - each line starts with "data: "
// //           const lines = chunk.split('\n').filter(line => line.trim() !== '');
          
// //           for (const line of lines) {
// //             if (line.startsWith('data: ')) {
// //               try {
// //                 // Remove the "data: " prefix and parse the JSON
// //                 const jsonStr = line.substring(6);
                
// //                 // Check if it's the "[DONE]" marker
// //                 if (jsonStr.trim() === '[DONE]') {
// //                   console.log('Received [DONE] marker');
// //                   continue;
// //                 }
                
// //                 const jsonData = JSON.parse(jsonStr);
// //                 console.log('Parsed JSON data:', jsonData);
                
// //                 // Extract the text from the completion choices
// //                 // Check for the delta.content format (chat completions API)
// //                 if (jsonData.choices && jsonData.choices[0]?.delta?.content) {
// //                   const newText = jsonData.choices[0].delta.content;
// //                   console.log('Received new text:', newText);
                  
// //                   // Update the full message content in state (not visible to user yet)
// //                   setMessages(prev => {
// //                     const updatedMessages = prev.map(msg => {
// //                       if (msg.id === streamingMessage.id) {
// //                         return { ...msg, content: msg.content + newText };
// //                       }
// //                       return msg;
// //                     });
// //                     return updatedMessages;
// //                   });
                  
// //                   // Add new text to buffer for word-by-word typing
// //                   addContentToBuffer(newText);
// //                 }
// //                 // Fallback for the older completions API format
// //                 else if (jsonData.choices && jsonData.choices[0]?.text) {
// //                   const newText = jsonData.choices[0].text;
// //                   console.log('Received new text (legacy format):', newText);
                  
// //                   setMessages(prev => {
// //                     const updatedMessages = prev.map(msg => {
// //                       if (msg.id === streamingMessage.id) {
// //                         return { ...msg, content: msg.content + newText };
// //                       }
// //                       return msg;
// //                     });
// //                     return updatedMessages;
// //                   });
                  
// //                   addContentToBuffer(newText);
// //                 }
// //               } catch (e) {
// //                 console.warn('Error parsing SSE data:', e, 'Line:', line);
// //               }
// //             }
// //           }
// //         }
// //       } catch (error) {
// //         console.error('Error processing stream:', error);
// //         // Still update with whatever content we got
// //         setMessages(prev => prev.map(msg => 
// //           msg.id === streamingMessage.id 
// //             ? { ...msg, isStreaming: false }
// //             : msg
// //         ));
// //         // Clear current streaming ID
// //         currentStreamingIdRef.current = null;
// //       } finally {
// //         // Make sure we clear any pending timeout
// //         if (streamTimeout) clearTimeout(streamTimeout);
        
// //         // Update the streaming message to mark streaming as complete
// //         // But keep typing animation going until buffer is empty
// //         setMessages(prev => prev.map(msg => 
// //           msg.id === streamingMessage.id 
// //             ? { ...msg, isStreaming: false }
// //             : msg
// //         ));
        
// //         setStreamController(null);
// //       }
      
// //     } catch (error) {
// //       console.error('Error sending message:', error);
      
// //       // Log more details if available
// //       if (error.response) {
// //         console.error('Response data:', error.response.data);
// //         console.error('Response status:', error.response.status);
// //       }
      
// //       toast({
// //         title: "Error",
// //         description: "Failed to get a response from the AI. Please try again.",
// //         variant: "destructive"
// //       });
      
// //       // Fallback response
// //       const fallbackContent = "Thanks for sharing those details. Based on what you've told me, I'd recommend focusing on quantifying your achievements more clearly in your resume. Add specific metrics and outcomes to demonstrate your impact. Could you share a specific project where you made a significant contribution?";
      
// //       const fallbackMessage: Message = {
// //         id: `assistant-fallback-${Date.now()}`,
// //         role: 'assistant',
// //         content: fallbackContent,
// //         displayContent: '',
// //         timestamp: new Date(),
// //       };
      
// //       // Remove any streaming messages and add fallback
// //       setMessages(prev => [...prev.filter(msg => !msg.isStreaming), fallbackMessage]);
      
// //       // Setup typing animation for fallback message
// //       currentStreamingIdRef.current = fallbackMessage.id;
// //       contentBufferRef.current = [];
// //       addContentToBuffer(fallbackContent);
      
// //     } finally {
// //       setIsLoading(false);
// //     }
// //   };
  
// //   const handleKeyDown = (e: React.KeyboardEvent) => {
// //     if (e.key === 'Enter' && !e.shiftKey) {
// //       e.preventDefault();
// //       handleSendMessage();
// //     }
// //   };
  
// //   return (
// //     <div className="w-full">
// //       <ScrollArea className="h-[900px] px-1">
// //         <div className="space-y-4 p-4">
// //           {messages
// //             .filter(message => message.role !== 'system') // Hide system messages from the UI
// //             .map((message) => (
// //               <div key={message.id} className={`flex ${
// //                 message.role === 'assistant' 
// //                   ? 'justify-start' 
// //                   : 'justify-end'
// //               }`}>
// //                 <div className={`max-w-3xl p-3 rounded-lg ${
// //                   message.role === 'assistant' 
// //                     ? 'bg-slate-100 text-slate-800' 
// //                     : 'bg-blue-600 text-white'
// //                 }`}>
// //                   {message.role === 'assistant' ? (
// //                     <div 
// //                       className="prose prose-slate max-w-none"
// //                       dangerouslySetInnerHTML={{ 
// //                         __html: formatMessage(
// //                           message.displayContent || ''
// //                         )
// //                       }}
// //                     />
// //                   ) : (
// //                     <div>{message.content}</div>
// //                   )}
                  
// //                   {message.isStreaming && (
// //                     <span className="inline-block w-1.5 h-4 bg-slate-400 ml-1 animate-pulse"></span>
// //                   )}
// //                 </div>
// //               </div>
// //           ))}
          
// //           {messages.filter(msg => msg.role !== 'system').length === 0 && resumeAnalysis && !isLoading && (
// //             <div className="text-center p-6">
// //               <p className="text-muted-foreground mb-4">
// //                 Your resume is ready for review. I can provide personalized advice to help you improve it.
// //               </p>
// //             </div>
// //           )}
          
// //           {isLoading && !messages.some(m => m.isStreaming) && (
// //             <div className="flex justify-start">
// //               <div className="max-w-3xl p-3 rounded-lg bg-slate-100 text-slate-800">
// //                 <div className="flex space-x-2">
// //                   <div className="w-2 h-2 rounded-full bg-slate-400 animate-pulse"></div>
// //                   <div className="w-2 h-2 rounded-full bg-slate-400 animate-pulse delay-75"></div>
// //                   <div className="w-2 h-2 rounded-full bg-slate-400 animate-pulse delay-150"></div>
// //                 </div>
// //               </div>
// //             </div>
// //           )}
// //           <div ref={messagesEndRef} />
// //         </div>
// //       </ScrollArea>
      
// //       <div className="p-4 border-t mt-2">
// //         <div className="flex space-x-2 w-full">
// //           <Textarea
// //             value={inputValue}
// //             onChange={(e) => setInputValue(e.target.value)}
// //             onKeyDown={handleKeyDown}
// //             placeholder="Ask about your resume or career path..."
// //             className="flex-1 resize-none"
// //             rows={2}
// //             disabled={isLoading}
// //           />
// //           <Button 
// //             onClick={handleSendMessage} 
// //             disabled={isLoading || !inputValue.trim()}
// //             className="self-end"
// //           >
// //             <Send className="h-4 w-4" />
// //             <span className="sr-only">Send</span>
// //           </Button>
// //         </div>
// //       </div>
// //     </div>
// //   );
// // };

// // export default ResumeChat;
// // // import React, { useState, useRef, useEffect, useCallback } from 'react';
// // // import { Send } from 'lucide-react';
// // // import { Button } from '@/components/ui/button';
// // // import { Textarea } from '@/components/ui/textarea';
// // // import { supabase } from '@/integrations/supabase/client';
// // // import { useAuth } from '@/contexts/AuthContext';
// // // import { formatMessage } from '@/components/assistants/utils/messageFormatting';
// // // import { useToast } from '@/hooks/use-toast';
// // // import { ScrollArea } from "@/components/ui/scroll-area";
// // // import { ResumeAnalysis } from '@/components/assistants/types';

// // // interface ResumeChatProps {
// // //   resumeAnalysis: ResumeAnalysis | null;
// // // }

// // // type Message = {
// // //   id: string;
// // //   role: 'assistant' | 'user';
// // //   content: string;
// // //   timestamp: Date;
// // //   isStreaming?: boolean;
// // //   displayContent?: string; // This is what will be shown to the user
// // // };

// // // // Create storage keys for persisting chat state
// // // const STORAGE_KEYS = {
// // //   MESSAGES: 'resume_chat_messages',
// // //   WELCOME_SHOWN: 'resume_welcome_shown'
// // // };

// // // const ResumeChat: React.FC<ResumeChatProps> = ({ resumeAnalysis }) => {
// // //   const { user } = useAuth();
// // //   const { toast } = useToast();
// // //   const [messages, setMessages] = useState<Message[]>([]);
// // //   const [inputValue, setInputValue] = useState('');
// // //   const [isLoading, setIsLoading] = useState(false);
// // //   const [streamController, setStreamController] = useState<AbortController | null>(null);
// // //   const messagesEndRef = useRef<HTMLDivElement>(null);
// // //   const [welcomeMessageShown, setWelcomeMessageShown] = useState(false);
  
// // //   // Enhanced typing animation state
// // //   const contentBufferRef = useRef<string[]>([]);
// // //   const typingIntervalRef = useRef<NodeJS.Timeout | null>(null);
// // //   const isTypingRef = useRef(false);
// // //   const currentStreamingIdRef = useRef<string | null>(null);
  
// // //   // Load persisted messages from localStorage
// // //   useEffect(() => {
// // //     if (user) {
// // //       try {
// // //         const savedMessages = localStorage.getItem(`${STORAGE_KEYS.MESSAGES}_${user.id}`);
// // //         const welcomeShown = localStorage.getItem(`${STORAGE_KEYS.WELCOME_SHOWN}_${user.id}`);
        
// // //         if (savedMessages) {
// // //           const parsedMessages = JSON.parse(savedMessages);
// // //           // Ensure displayContent matches content for loaded messages
// // //           const messagesWithDisplay = parsedMessages.map((msg: Message) => ({
// // //             ...msg,
// // //             displayContent: msg.content
// // //           }));
// // //           setMessages(messagesWithDisplay);
// // //         }
        
// // //         if (welcomeShown) {
// // //           setWelcomeMessageShown(true);
// // //         }
// // //       } catch (error) {
// // //         console.error('Error loading saved chat:', error);
// // //       }
// // //     }
// // //   }, [user]);
  
// // //   // Clean up typing interval on unmount
// // //   useEffect(() => {
// // //     return () => {
// // //       if (typingIntervalRef.current) {
// // //         clearInterval(typingIntervalRef.current);
// // //       }
// // //     };
// // //   }, []);
  
// // //   // Save messages to localStorage whenever they change
// // //   useEffect(() => {
// // //     if (user && messages.length > 0) {
// // //       localStorage.setItem(`${STORAGE_KEYS.MESSAGES}_${user.id}`, JSON.stringify(messages));
// // //     }
// // //   }, [messages, user]);
  
// // //   // Scroll to bottom whenever messages change
// // //   useEffect(() => {
// // //     messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
// // //   }, [messages]);
  
// // //   // Word-by-word typing animation processor
// // //   const startWordTypingAnimation = useCallback(() => {
// // //     if (isTypingRef.current || !currentStreamingIdRef.current) return;
// // //     isTypingRef.current = true;
    
// // //     // Process the next word from the buffer
// // //     const processNextWord = () => {
// // //       // If no streaming message or empty buffer, stop typing
// // //       if (!currentStreamingIdRef.current || contentBufferRef.current.length === 0) {
// // //         isTypingRef.current = false;
// // //         return;
// // //       }
      
// // //       // Get the next word (or chunk) from the buffer
// // //       const nextWord = contentBufferRef.current.shift();
      
// // //       // Update the message with the next word
// // //       setMessages(msgs => 
// // //         msgs.map(msg => {
// // //           if (msg.id === currentStreamingIdRef.current) {
// // //             const newDisplayContent = (msg.displayContent || '') + nextWord;
// // //             return { ...msg, displayContent: newDisplayContent };
// // //           }
// // //           return msg;
// // //         })
// // //       );
      
// // //       // If there are more words in the buffer, schedule the next word
// // //       if (contentBufferRef.current.length > 0) {
// // //         // Random delay between 50-200ms for more natural typing feel
// // //         const delay = Math.floor(Math.random() * 150) + 50;
// // //         typingIntervalRef.current = setTimeout(processNextWord, delay);
// // //       } else {
// // //         isTypingRef.current = false;
// // //       }
// // //     };
    
// // //     // Start processing words
// // //     processNextWord();
// // //   }, []);
  
// // //   // Split content into words and add to buffer
// // //   const addContentToBuffer = useCallback((content: string) => {
// // //     if (!content) return;
    
// // //     // Split new content into words/chunks
// // //     // This regex splits by spaces but keeps the space with the preceding word
// // //     const words = content.match(/\S+\s*/g) || [];
    
// // //     // Add words to buffer
// // //     contentBufferRef.current.push(...words);
    
// // //     // Start typing animation if not already running
// // //     if (!isTypingRef.current) {
// // //       startWordTypingAnimation();
// // //     }
// // //   }, [startWordTypingAnimation]);
  
// // //   // Fetch initial resume assessment and create welcome message on component mount
// // //   useEffect(() => {
// // //     if (resumeAnalysis && user && !welcomeMessageShown) {
// // //       setIsLoading(true);
      
// // //       // Create basic welcome message with basic info
// // //       const welcomeMessage: Message = {
// // //         id: `welcome-${Date.now()}`,
// // //         role: 'assistant',
// // //         content: `I've analyzed your resume and can help you improve it! Your resume currently has a grade of **${resumeAnalysis.letter_grade} (${resumeAnalysis.resume_percent}%)**.`,
// // //         displayContent: '', // Start empty for typing effect
// // //         timestamp: new Date(),
// // //       };
      
// // //       setMessages([welcomeMessage]);
      
// // //       // Setup for welcome message typing
// // //       currentStreamingIdRef.current = welcomeMessage.id;
// // //       contentBufferRef.current = [];
      
// // //       // Try to fetch stored assessment from the database
// // //       (async () => {
// // //         try {
// // //           const { data, error } = await supabase
// // //             .from('resumes')
// // //             .select('initial_assessment')
// // //             .eq('user_id', user.id)
// // //             .single();
          
// // //           if (error) {
// // //             console.error('Error fetching stored assessment:', error);
// // //             throw error;
// // //           }
          
// // //           let initialAssessment = data?.initial_assessment;
          
// // //           // If no stored assessment, try to fetch it
// // //           if (!initialAssessment && resumeAnalysis.resume_id) {
// // //             const resumeText = localStorage.getItem(`resume_text_${resumeAnalysis.resume_id}`) || '';
            
// // //             if (resumeText) {
// // //               const { data: roastData, error: roastError } = await supabase.functions.invoke('resume-analyzer', {
// // //                 body: { 
// // //                   action: 'get-roast',
// // //                   resumeText
// // //                 }
// // //               });
              
// // //               if (roastError) throw roastError;
              
// // //               if (roastData?.roast) {
// // //                 initialAssessment = roastData.roast;
                
// // //                 // Store it in the database for future use
// // //                 await supabase
// // //                   .from('resumes')
// // //                   .update({ initial_assessment: initialAssessment })
// // //                   .eq('user_id', user.id);
// // //               }
// // //             }
// // //           }
          
// // //           // Update welcome message with assessment
// // //           const fullWelcomeContent = `I've analyzed your resume and can help you improve it! Your resume currently has a grade of **${resumeAnalysis.letter_grade} (${resumeAnalysis.resume_percent}%)**.

// // // ${initialAssessment ? `**Here's my honest assessment:**
// // // ${initialAssessment}

// // // ` : ''}Let's start by discussing your experience: **What specific challenges did you tackle in your first listed role, what actions did you take, and what measurable results did you achieve?**`;
          
// // //           // Update message with full content but keep empty display for typing effect
// // //           setMessages([{
// // //             ...welcomeMessage,
// // //             content: fullWelcomeContent,
// // //             displayContent: ''
// // //           }]);
          
// // //           // Add content to buffer for typing effect
// // //           addContentToBuffer(fullWelcomeContent);
          
// // //           setWelcomeMessageShown(true);
// // //           localStorage.setItem(`${STORAGE_KEYS.WELCOME_SHOWN}_${user.id}`, 'true');
// // //         } catch (error) {
// // //           console.error('Error with assessment:', error);
          
// // //           // Fallback message
// // //           const fallbackContent = `${welcomeMessage.content}

// // // Let's start by discussing your experience: **What specific challenges did you tackle in your first listed role, what actions did you take, and what measurable results did you achieve?**`;
          
// // //           // Update message with fallback content but keep empty display for typing effect
// // //           setMessages([{
// // //             ...welcomeMessage,
// // //             content: fallbackContent,
// // //             displayContent: ''
// // //           }]);
          
// // //           // Add content to buffer for typing effect
// // //           addContentToBuffer(fallbackContent);
          
// // //           setWelcomeMessageShown(true);
// // //           localStorage.setItem(`${STORAGE_KEYS.WELCOME_SHOWN}_${user.id}`, 'true');
// // //         } finally {
// // //           setIsLoading(false);
// // //         }
// // //       })();
// // //     }
// // //   }, [resumeAnalysis, user, welcomeMessageShown, addContentToBuffer]);
  
// // //   const handleSendMessage = async () => {
// // //     if (!inputValue.trim() || isLoading) return;

// // //     const userMessage: Message = {
// // //       id: `user-${Date.now()}`,
// // //       role: 'user',
// // //       content: inputValue,
// // //       displayContent: inputValue,
// // //       timestamp: new Date(),
// // //     };
    
// // //     // Create a placeholder streaming message
// // //     const streamingMessage: Message = {
// // //       id: `assistant-${Date.now()}`,
// // //       role: 'assistant',
// // //       content: '',
// // //       displayContent: '',
// // //       timestamp: new Date(),
// // //       isStreaming: true
// // //     };
    
// // //     // Reset the buffer and set current streaming ID
// // //     contentBufferRef.current = [];
// // //     currentStreamingIdRef.current = streamingMessage.id;
    
// // //     setMessages(prev => [...prev, userMessage, streamingMessage]);
// // //     setInputValue('');
// // //     setIsLoading(true);
    
// // //     try {
// // //       // Create context from resume analysis
// // //       const context = resumeAnalysis ? 
// // //         `Resume analysis: Grade ${resumeAnalysis.letter_grade} (${resumeAnalysis.resume_percent}%). 
// // //          Key themes for improvement: ${resumeAnalysis.themes.join(', ')}.
// // //          Elevator pitch: ${resumeAnalysis.elevator_pitch}` : 
// // //         'No resume analysis available.';
      
// // //       // Prepare prompt with context and conversation history
// // //       let conversationHistory = messages.map(msg => `${msg.content}`).join('\n\n');
      
// // //       const prompt = `You are a professional resume coach assisting a user with their resume. 
      
// // // Resume Context: ${context}

// // // Previous conversation:
// // // ${conversationHistory}

// // // User's latest message: ${inputValue}

// // // Respond with helpful, specific advice as a resume coach. Be constructive, honest, and professional. Do not prefix your response with "Assistant:" or any other label. Do not repeat the user's prompt.`;
      
// // //       // Abort any existing streams
// // //       if (streamController) {
// // //         streamController.abort();
// // //       }
      
// // //       // Create a new controller for this stream
// // //       const controller = new AbortController();
// // //       setStreamController(controller);
      
// // //       console.log('Invoking together-ai function with prompt:', prompt.substring(0, 50) + '...');
      
// // //       const response = await supabase.functions.invoke('together-ai', {
// // //         body: { 
// // //           prompt,
// // //           model: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
// // //           max_tokens: 1024,
// // //           stream: true
// // //         }
// // //       });
      
// // //       console.log('Supabase function response received:', response);
      
// // //       if (response.error) {
// // //         console.error('Error from Together AI:', response.error);
// // //         throw new Error(response.error.message || 'Unknown error');
// // //       }
      
// // //       if (!response.data || !response.data.body) {
// // //         console.error('No body in response data:', response.data);
// // //         throw new Error('No readable stream in response');
// // //       }
      
// // //       // Get the ReadableStream from the response.data.body
// // //       const readableStream = response.data.body;
// // //       const reader = readableStream.getReader();
      
// // //       // Add a timeout to handle premature stream termination
// // //       let streamTimeout: NodeJS.Timeout | null = null;
// // //       const MAX_SILENCE_MS = 10000; // 10 seconds without data before we consider the stream dead
      
// // //       try {
// // //         // Process the SSE stream
// // //         while (true) {
// // //           // Clear any existing timeout and set a new one
// // //           if (streamTimeout) clearTimeout(streamTimeout);
          
// // //           streamTimeout = setTimeout(() => {
// // //             console.log('Stream timed out - no data received in', MAX_SILENCE_MS, 'ms');
// // //             reader.cancel('Stream timed out');
// // //             // Mark streaming as complete
// // //             setMessages(prev => prev.map(msg => 
// // //               msg.id === streamingMessage.id 
// // //                 ? { ...msg, isStreaming: false }
// // //                 : msg
// // //             ));
// // //             // Clear current streaming ID
// // //             currentStreamingIdRef.current = null;
// // //           }, MAX_SILENCE_MS);
          
// // //           const { done, value } = await reader.read();
          
// // //           if (done) {
// // //             console.log('Stream marked as done');
// // //             if (streamTimeout) clearTimeout(streamTimeout);
// // //             break;
// // //           }
          
// // //           // Decode the chunk
// // //           const chunk = new TextDecoder().decode(value);
// // //           console.log('Received chunk length:', chunk.length);
          
// // //           // Parse SSE format - each line starts with "data: "
// // //           const lines = chunk.split('\n').filter(line => line.trim() !== '');
          
// // //           for (const line of lines) {
// // //             if (line.startsWith('data: ')) {
// // //               try {
// // //                 // Remove the "data: " prefix and parse the JSON
// // //                 const jsonStr = line.substring(6);
                
// // //                 // Check if it's the "[DONE]" marker
// // //                 if (jsonStr.trim() === '[DONE]') {
// // //                   continue;
// // //                 }
                
// // //                 const jsonData = JSON.parse(jsonStr);
// // //                 console.log('Parsed JSON data:', jsonData);
                
// // //                 // Extract the text from the completion choices
// // //                 if (jsonData.choices && jsonData.choices[0]?.text) {
// // //                   const newText = jsonData.choices[0].text;
                  
// // //                   // Update the full message content in state (not visible to user yet)
// // //                   setMessages(prev => {
// // //                     const updatedMessages = prev.map(msg => {
// // //                       if (msg.id === streamingMessage.id) {
// // //                         return { ...msg, content: msg.content + newText };
// // //                       }
// // //                       return msg;
// // //                     });
// // //                     return updatedMessages;
// // //                   });
                  
// // //                   // Add new text to buffer for word-by-word typing
// // //                   addContentToBuffer(newText);
// // //                 }
// // //               } catch (e) {
// // //                 console.warn('Error parsing SSE data:', e, 'Line:', line);
// // //               }
// // //             }
// // //           }
// // //         }
// // //       } catch (error) {
// // //         console.error('Error processing stream:', error);
// // //         // Still update with whatever content we got
// // //         setMessages(prev => prev.map(msg => 
// // //           msg.id === streamingMessage.id 
// // //             ? { ...msg, isStreaming: false }
// // //             : msg
// // //         ));
// // //         // Clear current streaming ID
// // //         currentStreamingIdRef.current = null;
// // //       } finally {
// // //         // Make sure we clear any pending timeout
// // //         if (streamTimeout) clearTimeout(streamTimeout);
        
// // //         // Update the streaming message to mark streaming as complete
// // //         // But keep typing animation going until buffer is empty
// // //         setMessages(prev => prev.map(msg => 
// // //           msg.id === streamingMessage.id 
// // //             ? { ...msg, isStreaming: false }
// // //             : msg
// // //         ));
        
// // //         setStreamController(null);
// // //       }
      
// // //     } catch (error) {
// // //       console.error('Error sending message:', error);
      
// // //       // Log more details if available
// // //       if (error.response) {
// // //         console.error('Response data:', error.response.data);
// // //         console.error('Response status:', error.response.status);
// // //       }
      
// // //       toast({
// // //         title: "Error",
// // //         description: "Failed to get a response from the AI. Please try again.",
// // //         variant: "destructive"
// // //       });
      
// // //       // Fallback response
// // //       const fallbackContent = "Thanks for sharing those details. Based on what you've told me, I'd recommend focusing on quantifying your achievements more clearly in your resume. Add specific metrics and outcomes to demonstrate your impact. Could you share a specific project where you made a significant contribution?";
      
// // //       const fallbackMessage: Message = {
// // //         id: `assistant-fallback-${Date.now()}`,
// // //         role: 'assistant',
// // //         content: fallbackContent,
// // //         displayContent: '',
// // //         timestamp: new Date(),
// // //       };
      
// // //       // Remove any streaming messages and add fallback
// // //       setMessages(prev => [...prev.filter(msg => !msg.isStreaming), fallbackMessage]);
      
// // //       // Setup typing animation for fallback message
// // //       currentStreamingIdRef.current = fallbackMessage.id;
// // //       contentBufferRef.current = [];
// // //       addContentToBuffer(fallbackContent);
      
// // //     } finally {
// // //       setIsLoading(false);
// // //     }
// // //   };
  
// // //   const handleKeyDown = (e: React.KeyboardEvent) => {
// // //     if (e.key === 'Enter' && !e.shiftKey) {
// // //       e.preventDefault();
// // //       handleSendMessage();
// // //     }
// // //   };
  
// // //   return (
// // //     <div className="w-full">
// // //       <ScrollArea className="h-[900px] px-1">
// // //         <div className="space-y-4 p-4">
// // //           {messages.map((message) => (
// // //             <div key={message.id} className={`flex ${
// // //               message.role === 'assistant' 
// // //                 ? 'justify-start' 
// // //                 : 'justify-end'
// // //             }`}>
// // //               <div className={`max-w-3xl p-3 rounded-lg ${
// // //                 message.role === 'assistant' 
// // //                   ? 'bg-slate-100 text-slate-800' 
// // //                   : 'bg-blue-600 text-white'
// // //               }`}>
// // //                 {message.role === 'assistant' ? (
// // //                   <div 
// // //                     className="prose prose-slate max-w-none"
// // //                     dangerouslySetInnerHTML={{ 
// // //                       __html: formatMessage(
// // //                         message.displayContent || ''
// // //                       )
// // //                     }}
// // //                   />
// // //                 ) : (
// // //                   <div>{message.content}</div>
// // //                 )}
                
// // //                 {message.isStreaming && (
// // //                   <span className="inline-block w-1.5 h-4 bg-slate-400 ml-1 animate-pulse"></span>
// // //                 )}
// // //               </div>
// // //             </div>
// // //           ))}
          
// // //           {messages.length === 0 && resumeAnalysis && !isLoading && (
// // //             <div className="text-center p-6">
// // //               <p className="text-muted-foreground mb-4">
// // //                 Your resume is ready for review. I can provide personalized advice to help you improve it.
// // //               </p>
// // //             </div>
// // //           )}
          
// // //           {isLoading && !messages.some(m => m.isStreaming) && (
// // //             <div className="flex justify-start">
// // //               <div className="max-w-3xl p-3 rounded-lg bg-slate-100 text-slate-800">
// // //                 <div className="flex space-x-2">
// // //                   <div className="w-2 h-2 rounded-full bg-slate-400 animate-pulse"></div>
// // //                   <div className="w-2 h-2 rounded-full bg-slate-400 animate-pulse delay-75"></div>
// // //                   <div className="w-2 h-2 rounded-full bg-slate-400 animate-pulse delay-150"></div>
// // //                 </div>
// // //               </div>
// // //             </div>
// // //           )}
// // //           <div ref={messagesEndRef} />
// // //         </div>
// // //       </ScrollArea>
      
// // //       <div className="p-4 border-t mt-2">
// // //         <div className="flex space-x-2 w-full">
// // //           <Textarea
// // //             value={inputValue}
// // //             onChange={(e) => setInputValue(e.target.value)}
// // //             onKeyDown={handleKeyDown}
// // //             placeholder="Ask about your resume or career path..."
// // //             className="flex-1 resize-none"
// // //             rows={2}
// // //             disabled={isLoading}
// // //           />
// // //           <Button 
// // //             onClick={handleSendMessage} 
// // //             disabled={isLoading || !inputValue.trim()}
// // //             className="self-end"
// // //           >
// // //             <Send className="h-4 w-4" />
// // //             <span className="sr-only">Send</span>
// // //           </Button>
// // //         </div>
// // //       </div>
// // //     </div>
// // //   );
// // // };

// // // export default ResumeChat;
// // // // import React, { useState, useRef, useEffect } from 'react';
// // // // import { Send } from 'lucide-react';
// // // // import { Button } from '@/components/ui/button';
// // // // import { Textarea } from '@/components/ui/textarea';
// // // // import { supabase } from '@/integrations/supabase/client';
// // // // import { useAuth } from '@/contexts/AuthContext';
// // // // import { formatMessage } from '@/components/assistants/utils/messageFormatting';
// // // // import { useToast } from '@/hooks/use-toast';
// // // // import { ScrollArea } from "@/components/ui/scroll-area";
// // // // import { ResumeAnalysis } from '@/components/assistants/types';

// // // // interface ResumeChatProps {
// // // //   resumeAnalysis: ResumeAnalysis | null;
// // // // }

// // // // type Message = {
// // // //   id: string;
// // // //   role: 'assistant' | 'user';
// // // //   content: string;
// // // //   timestamp: Date;
// // // //   isStreaming?: boolean;
// // // //   displayContent?: string; // NEW: This is what will be shown while typing
// // // // };

// // // // // Create storage keys for persisting chat state
// // // // const STORAGE_KEYS = {
// // // //   MESSAGES: 'resume_chat_messages',
// // // //   WELCOME_SHOWN: 'resume_welcome_shown'
// // // // };

// // // // const ResumeChat: React.FC<ResumeChatProps> = ({ resumeAnalysis }) => {
// // // //   const { user } = useAuth();
// // // //   const { toast } = useToast();
// // // //   const [messages, setMessages] = useState<Message[]>([]);
// // // //   const [inputValue, setInputValue] = useState('');
// // // //   const [isLoading, setIsLoading] = useState(false);
// // // //   const [streamController, setStreamController] = useState<AbortController | null>(null);
// // // //   const messagesEndRef = useRef<HTMLDivElement>(null);
// // // //   const [welcomeMessageShown, setWelcomeMessageShown] = useState(false);
// // // //   const typingIntervalRef = useRef<NodeJS.Timeout | null>(null);

// // // //   // Load persisted messages from localStorage
// // // //   useEffect(() => {
// // // //     if (user) {
// // // //       try {
// // // //         const savedMessages = localStorage.getItem(`${STORAGE_KEYS.MESSAGES}_${user.id}`);
// // // //         const welcomeShown = localStorage.getItem(`${STORAGE_KEYS.WELCOME_SHOWN}_${user.id}`);
        
// // // //         if (savedMessages) {
// // // //           setMessages(JSON.parse(savedMessages));
// // // //         }
        
// // // //         if (welcomeShown) {
// // // //           setWelcomeMessageShown(true);
// // // //         }
// // // //       } catch (error) {
// // // //         console.error('Error loading saved chat:', error);
// // // //       }
// // // //     }
// // // //   }, [user]);
  
// // // //   // Clean up typing interval on unmount
// // // //   useEffect(() => {
// // // //     return () => {
// // // //       if (typingIntervalRef.current) {
// // // //         clearInterval(typingIntervalRef.current);
// // // //       }
// // // //     };
// // // //   }, []);
  
// // // //   // Save messages to localStorage whenever they change
// // // //   useEffect(() => {
// // // //     if (user && messages.length > 0) {
// // // //       // Save without displayContent to avoid storing duplicate data
// // // //       const messagesToSave = messages.map(({ displayContent, ...msg }) => msg);
// // // //       localStorage.setItem(`${STORAGE_KEYS.MESSAGES}_${user.id}`, JSON.stringify(messagesToSave));
// // // //     }
// // // //   }, [messages, user]);
  
// // // //   // Scroll to bottom whenever messages change
// // // //   useEffect(() => {
// // // //     messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
// // // //   }, [messages]);
  
// // // //   // Simple typing animation function
// // // //   const animateTyping = (messageId: string, fullText: string) => {
// // // //     // Clear any existing animation
// // // //     if (typingIntervalRef.current) {
// // // //       clearInterval(typingIntervalRef.current);
// // // //     }
    
// // // //     let charIndex = 0;
    
// // // //     // Start typing animation
// // // //     typingIntervalRef.current = setInterval(() => {
// // // //       if (charIndex <= fullText.length) {
// // // //         // Update the message with the current number of characters
// // // //         setMessages(msgs => 
// // // //           msgs.map(msg => 
// // // //             msg.id === messageId 
// // // //               ? { ...msg, displayContent: fullText.substring(0, charIndex) } 
// // // //               : msg
// // // //           )
// // // //         );
        
// // // //         charIndex++;
// // // //       } else {
// // // //         // Animation complete
// // // //         if (typingIntervalRef.current) {
// // // //           clearInterval(typingIntervalRef.current);
// // // //           typingIntervalRef.current = null;
// // // //         }
// // // //       }
// // // //     }, 15); // Adjust speed here (15ms per character)
// // // //   };
  
// // // //   // Fetch initial resume assessment and create welcome message on component mount
// // // //   useEffect(() => {
// // // //     if (resumeAnalysis && user && !welcomeMessageShown) {
// // // //       setIsLoading(true);
      
// // // //       // Create basic welcome message with basic info
// // // //       const welcomeMessage: Message = {
// // // //         id: `welcome-${Date.now()}`,
// // // //         role: 'assistant',
// // // //         content: `I've analyzed your resume and can help you improve it! Your resume currently has a grade of **${resumeAnalysis.letter_grade} (${resumeAnalysis.resume_percent}%)**.`,
// // // //         timestamp: new Date(),
// // // //       };
      
// // // //       setMessages([welcomeMessage]);
      
// // // //       // Try to fetch stored assessment from the database
// // // //       (async () => {
// // // //         try {
// // // //           const { data, error } = await supabase
// // // //             .from('resumes')
// // // //             .select('initial_assessment')
// // // //             .eq('user_id', user.id)
// // // //             .single();
          
// // // //           if (error) {
// // // //             console.error('Error fetching stored assessment:', error);
// // // //             throw error;
// // // //           }
          
// // // //           let initialAssessment = data?.initial_assessment;
          
// // // //           // If no stored assessment, try to fetch it
// // // //           if (!initialAssessment && resumeAnalysis.resume_id) {
// // // //             const resumeText = localStorage.getItem(`resume_text_${resumeAnalysis.resume_id}`) || '';
            
// // // //             if (resumeText) {
// // // //               const { data: roastData, error: roastError } = await supabase.functions.invoke('resume-analyzer', {
// // // //                 body: { 
// // // //                   action: 'get-roast',
// // // //                   resumeText
// // // //                 }
// // // //               });
              
// // // //               if (roastError) throw roastError;
              
// // // //               if (roastData?.roast) {
// // // //                 initialAssessment = roastData.roast;
                
// // // //                 // Store it in the database for future use
// // // //                 await supabase
// // // //                   .from('resumes')
// // // //                   .update({ initial_assessment: initialAssessment })
// // // //                   .eq('user_id', user.id);
// // // //               }
// // // //             }
// // // //           }
          
// // // //           // Update welcome message with assessment
// // // //           const updatedWelcomeMessage: Message = {
// // // //             ...welcomeMessage,
// // // //             content: `I've analyzed your resume and can help you improve it! Your resume currently has a grade of **${resumeAnalysis.letter_grade} (${resumeAnalysis.resume_percent}%)**.

// // // // ${initialAssessment ? `**Here's my honest assessment:**
// // // // ${initialAssessment}

// // // // ` : ''}Let's start by discussing your experience: **What specific challenges did you tackle in your first listed role, what actions did you take, and what measurable results did you achieve?**`
// // // //           };
          
// // // //           setMessages([updatedWelcomeMessage]);
// // // //           setWelcomeMessageShown(true);
// // // //           localStorage.setItem(`${STORAGE_KEYS.WELCOME_SHOWN}_${user.id}`, 'true');
// // // //         } catch (error) {
// // // //           console.error('Error with assessment:', error);
          
// // // //           // Fallback message
// // // //           const updatedWelcomeMessage: Message = {
// // // //             ...welcomeMessage,
// // // //             content: `${welcomeMessage.content}

// // // // Let's start by discussing your experience: **What specific challenges did you tackle in your first listed role, what actions did you take, and what measurable results did you achieve?**`
// // // //           };
          
// // // //           setMessages([updatedWelcomeMessage]);
// // // //           setWelcomeMessageShown(true);
// // // //           localStorage.setItem(`${STORAGE_KEYS.WELCOME_SHOWN}_${user.id}`, 'true');
// // // //         } finally {
// // // //           setIsLoading(false);
// // // //         }
// // // //       })();
// // // //     }
// // // //   }, [resumeAnalysis, user, welcomeMessageShown]);
  
// // // //   const handleSendMessage = async () => {
// // // //     if (!inputValue.trim() || isLoading) return;

// // // //     const userMessage: Message = {
// // // //       id: `user-${Date.now()}`,
// // // //       role: 'user',
// // // //       content: inputValue,
// // // //       timestamp: new Date(),
// // // //     };
    
// // // //     // Create a placeholder streaming message
// // // //     const streamingMessage: Message = {
// // // //       id: `assistant-${Date.now()}`,
// // // //       role: 'assistant',
// // // //       content: '',
// // // //       displayContent: '', // Initialize empty display content
// // // //       timestamp: new Date(),
// // // //       isStreaming: true
// // // //     };
    
// // // //     setMessages(prev => [...prev, userMessage, streamingMessage]);
// // // //     setInputValue('');
// // // //     setIsLoading(true);
    
// // // //     try {
// // // //       // Create context from resume analysis
// // // //       const context = resumeAnalysis ? 
// // // //         `Resume analysis: Grade ${resumeAnalysis.letter_grade} (${resumeAnalysis.resume_percent}%). 
// // // //          Key themes for improvement: ${resumeAnalysis.themes.join(', ')}.
// // // //          Elevator pitch: ${resumeAnalysis.elevator_pitch}` : 
// // // //         'No resume analysis available.';
      
// // // //       // Prepare prompt with context and conversation history - removing "User:" and "Assistant:" prefixes
// // // //       let conversationHistory = messages.map(msg => `${msg.content}`).join('\n\n');
      
// // // //       // The prompt is modified to instruct the model not to include 'Assistant:' in its response
// // // //       const prompt = `You are a professional resume coach assisting a user with their resume. 
      
// // // // Resume Context: ${context}

// // // // Previous conversation:
// // // // ${conversationHistory}

// // // // User's latest message: ${inputValue}

// // // // Respond with helpful, specific advice as a resume coach. Be constructive, honest, and professional. Do not prefix your response with "Assistant:" or any other label. Do not repeat the user's prompt.`;
      
// // // //       // Abort any existing streams
// // // //       if (streamController) {
// // // //         streamController.abort();
// // // //       }
      
// // // //       // Create a new controller for this stream
// // // //       const controller = new AbortController();
// // // //       setStreamController(controller);
      
// // // //       // Call the Together AI streaming endpoint
// // // //       console.log('Attempting to invoke together-ai function with prompt:', prompt.substring(0, 50) + '...');
      
// // // //       // After getting the response from Supabase
// // // //       const response = await supabase.functions.invoke('together-ai', {
// // // //         body: { 
// // // //           prompt,
// // // //           model: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
// // // //           max_tokens: 1024,
// // // //           stream: true
// // // //         }
// // // //       });
      
// // // //       console.log('Supabase function response received:', response);
      
// // // //       if (response.error) {
// // // //         console.error('Error from Together AI:', response.error);
// // // //         throw new Error(response.error.message || 'Unknown error');
// // // //       }
      
// // // //       // Access the response body
// // // //       if (!response.data || !response.data.body) {
// // // //         console.error('No body in response data:', response.data);
// // // //         throw new Error('No readable stream in response');
// // // //       }
      
// // // //       // Get the ReadableStream from the response.data.body
// // // //       const readableStream = response.data.body;
// // // //       const reader = readableStream.getReader();
      
// // // //       // Add a timeout to handle premature stream termination
// // // //       let streamTimeout = null;
// // // //       const MAX_SILENCE_MS = 10000; // 10 seconds without data before we consider the stream dead
      
// // // //       try {
// // // //         // Process the SSE stream
// // // //         while (true) {
// // // //           // Clear any existing timeout and set a new one
// // // //           if (streamTimeout) clearTimeout(streamTimeout);
          
// // // //           streamTimeout = setTimeout(() => {
// // // //             console.log('Stream timed out - no data received in', MAX_SILENCE_MS, 'ms');
// // // //             reader.cancel('Stream timed out');
// // // //             // Update the streaming message to mark as complete
// // // //             setMessages(prev => prev.map(msg => 
// // // //               msg.id === streamingMessage.id 
// // // //                 ? { ...msg, isStreaming: false }
// // // //                 : msg
// // // //             ));
// // // //           }, MAX_SILENCE_MS);
          
// // // //           const { done, value } = await reader.read();
          
// // // //           if (done) {
// // // //             console.log('Stream marked as done');
// // // //             clearTimeout(streamTimeout);
// // // //             break;
// // // //           }
          
// // // //           // Decode the chunk
// // // //           const chunk = new TextDecoder().decode(value);
// // // //           console.log('Received chunk length:', chunk.length);
          
// // // //           // Parse SSE format - each line starts with "data: "
// // // //           const lines = chunk.split('\n').filter(line => line.trim() !== '');
          
// // // //           for (const line of lines) {
// // // //             if (line.startsWith('data: ')) {
// // // //               try {
// // // //                 // Remove the "data: " prefix and parse the JSON
// // // //                 const jsonStr = line.substring(6);
                
// // // //                 // Check if it's the "[DONE]" marker
// // // //                 if (jsonStr.trim() === '[DONE]') {
// // // //                   continue;
// // // //                 }
                
// // // //                 const jsonData = JSON.parse(jsonStr);
// // // //                 console.log('Parsed JSON data:', jsonData);
                
// // // //                 // Extract the text from the completion choices
// // // //                 if (jsonData.choices && jsonData.choices[0]?.text) {
// // // //                   const newText = jsonData.choices[0].text;
                  
// // // //                   // Update the message content without triggering typing animation
// // // //                   setMessages(prev => {
// // // //                     // Find the current message
// // // //                     const updatedMessages = prev.map(msg => {
// // // //                       if (msg.id === streamingMessage.id) {
// // // //                         const updatedContent = msg.content + newText;
// // // //                         // Animate only the NEW content
// // // //                         animateTyping(msg.id, updatedContent);
// // // //                         return { ...msg, content: updatedContent };
// // // //                       }
// // // //                       return msg;
// // // //                     });
                    
// // // //                     return updatedMessages;
// // // //                   });
// // // //                 }
// // // //               } catch (e) {
// // // //                 console.warn('Error parsing SSE data:', e, 'Line:', line);
// // // //               }
// // // //             }
// // // //           }
// // // //         }
// // // //       } catch (error) {
// // // //         console.error('Error processing stream:', error);
// // // //         // Still update with whatever content we got
// // // //         setMessages(prev => prev.map(msg => 
// // // //           msg.id === streamingMessage.id 
// // // //             ? { ...msg, isStreaming: false }
// // // //             : msg
// // // //         ));
// // // //       } finally {
// // // //         // Make sure we clear any pending timeout
// // // //         if (streamTimeout) clearTimeout(streamTimeout);
        
// // // //         // Update the streaming message to mark streaming as complete
// // // //         setMessages(prev => prev.map(msg => 
// // // //           msg.id === streamingMessage.id 
// // // //             ? { ...msg, isStreaming: false, displayContent: msg.content }
// // // //             : msg
// // // //         ));
        
// // // //         setStreamController(null);
// // // //       }
      
// // // //     } catch (error) {
// // // //       console.error('Error sending message:', error);
      
// // // //       // Log more details if available
// // // //       if (error.response) {
// // // //         console.error('Response data:', error.response.data);
// // // //         console.error('Response status:', error.response.status);
// // // //       }
      
// // // //       toast({
// // // //         title: "Error",
// // // //         description: "Failed to get a response from the AI. Please try again.",
// // // //         variant: "destructive"
// // // //       });
      
// // // //       // Fallback response
// // // //       const fallbackMessage: Message = {
// // // //         id: `assistant-fallback-${Date.now()}`,
// // // //         role: 'assistant',
// // // //         content: "Thanks for sharing those details. Based on what you've told me, I'd recommend focusing on quantifying your achievements more clearly in your resume. Add specific metrics and outcomes to demonstrate your impact. Could you share a specific project where you made a significant contribution?",
// // // //         timestamp: new Date(),
// // // //       };
      
// // // //       setMessages(prev => [...prev.filter(msg => !msg.isStreaming), fallbackMessage]);
// // // //     } finally {
// // // //       setIsLoading(false);
// // // //     }
// // // //   };
  
// // // //   const handleKeyDown = (e: React.KeyboardEvent) => {
// // // //     if (e.key === 'Enter' && !e.shiftKey) {
// // // //       e.preventDefault();
// // // //       handleSendMessage();
// // // //     }
// // // //   };
  
// // // //   return (
// // // //     <div className="w-full">
// // // //       <ScrollArea className="h-[900px] px-1">
// // // //         <div className="space-y-4 p-4">
// // // //           {messages.map((message) => (
// // // //             <div key={message.id} className={`flex ${
// // // //               message.role === 'assistant' 
// // // //                 ? 'justify-start' 
// // // //                 : 'justify-end'
// // // //             }`}>
// // // //               <div className={`max-w-3xl p-3 rounded-lg ${
// // // //                 message.role === 'assistant' 
// // // //                   ? 'bg-slate-100 text-slate-800' 
// // // //                   : 'bg-blue-600 text-white'
// // // //               }`}>
// // // //                 {message.role === 'assistant' ? (
// // // //                   <div 
// // // //                     className="prose prose-slate max-w-none"
// // // //                     dangerouslySetInnerHTML={{ 
// // // //                       __html: formatMessage(
// // // //                         message.isStreaming 
// // // //                           ? (message.displayContent || '') 
// // // //                           : message.content
// // // //                       )
// // // //                     }}
// // // //                   />
// // // //                 ) : (
// // // //                   <div>{message.content}</div>
// // // //                 )}
                
// // // //                 {message.isStreaming && (
// // // //                   <span className="inline-block w-1.5 h-4 bg-slate-400 ml-1 animate-pulse"></span>
// // // //                 )}
// // // //               </div>
// // // //             </div>
// // // //           ))}
          
// // // //           {messages.length === 0 && resumeAnalysis && !isLoading && (
// // // //             <div className="text-center p-6">
// // // //               <p className="text-muted-foreground mb-4">
// // // //                 Your resume is ready for review. I can provide personalized advice to help you improve it.
// // // //               </p>
// // // //             </div>
// // // //           )}
          
// // // //           {isLoading && !messages.some(m => m.isStreaming) && (
// // // //             <div className="flex justify-start">
// // // //               <div className="max-w-3xl p-3 rounded-lg bg-slate-100 text-slate-800">
// // // //                 <div className="flex space-x-2">
// // // //                   <div className="w-2 h-2 rounded-full bg-slate-400 animate-pulse"></div>
// // // //                   <div className="w-2 h-2 rounded-full bg-slate-400 animate-pulse delay-75"></div>
// // // //                   <div className="w-2 h-2 rounded-full bg-slate-400 animate-pulse delay-150"></div>
// // // //                 </div>
// // // //               </div>
// // // //             </div>
// // // //           )}
// // // //           <div ref={messagesEndRef} />
// // // //         </div>
// // // //       </ScrollArea>
      
// // // //       <div className="p-4 border-t mt-2">
// // // //         <div className="flex space-x-2 w-full">
// // // //           <Textarea
// // // //             value={inputValue}
// // // //             onChange={(e) => setInputValue(e.target.value)}
// // // //             onKeyDown={handleKeyDown}
// // // //             placeholder="Ask about your resume or career path..."
// // // //             className="flex-1 resize-none"
// // // //             rows={2}
// // // //             disabled={isLoading}
// // // //           />
// // // //           <Button 
// // // //             onClick={handleSendMessage} 
// // // //             disabled={isLoading || !inputValue.trim()}
// // // //             className="self-end"
// // // //           >
// // // //             <Send className="h-4 w-4" />
// // // //             <span className="sr-only">Send</span>
// // // //           </Button>
// // // //         </div>
// // // //       </div>
// // // //     </div>
// // // //   );
// // // // };

// // // // export default ResumeChat;
// // // // // import React, { useState, useRef, useEffect, useCallback } from 'react';
// // // // // import { Send } from 'lucide-react';
// // // // // import { Button } from '@/components/ui/button';
// // // // // import { Textarea } from '@/components/ui/textarea';
// // // // // import { supabase } from '@/integrations/supabase/client';
// // // // // import { useAuth } from '@/contexts/AuthContext';
// // // // // import { formatMessage } from '@/components/assistants/utils/messageFormatting';
// // // // // import { useToast } from '@/hooks/use-toast';
// // // // // import { ScrollArea } from "@/components/ui/scroll-area";
// // // // // import { ResumeAnalysis } from '@/components/assistants/types';

// // // // // interface ResumeChatProps {
// // // // //   resumeAnalysis: ResumeAnalysis | null;
// // // // // }

// // // // // type Message = {
// // // // //   id: string;
// // // // //   role: 'assistant' | 'user';
// // // // //   content: string;
// // // // //   timestamp: Date;
// // // // //   isStreaming?: boolean;
// // // // // };

// // // // // // Create storage keys for persisting chat state
// // // // // const STORAGE_KEYS = {
// // // // //   MESSAGES: 'resume_chat_messages',
// // // // //   WELCOME_SHOWN: 'resume_welcome_shown'
// // // // // };

// // // // // const ResumeChat: React.FC<ResumeChatProps> = ({ resumeAnalysis }) => {
// // // // //   const { user } = useAuth();
// // // // //   const { toast } = useToast();
// // // // //   const [messages, setMessages] = useState<Message[]>([]);
// // // // //   const [inputValue, setInputValue] = useState('');
// // // // //   const [isLoading, setIsLoading] = useState(false);
// // // // //   const [streamController, setStreamController] = useState<AbortController | null>(null);
// // // // //   const messagesEndRef = useRef<HTMLDivElement>(null);
// // // // //   const [welcomeMessageShown, setWelcomeMessageShown] = useState(false);

// // // // //   // Replace typing effect state with this:
// // // // //   const [activeStreamingId, setActiveStreamingId] = useState<string | null>(null);
// // // // //   const [typingContent, setTypingContent] = useState('');
// // // // //   const fullContentRef = useRef('');
// // // // //   const typingSpeedRef = useRef(15); // ms per character (adjust for faster/slower typing)
// // // // //   const isTypingRef = useRef(false);
// // // // //   const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
// // // // //   // Load persisted messages from localStorage
// // // // //   useEffect(() => {
// // // // //     if (user) {
// // // // //       try {
// // // // //         const savedMessages = localStorage.getItem(`${STORAGE_KEYS.MESSAGES}_${user.id}`);
// // // // //         const welcomeShown = localStorage.getItem(`${STORAGE_KEYS.WELCOME_SHOWN}_${user.id}`);
        
// // // // //         if (savedMessages) {
// // // // //           setMessages(JSON.parse(savedMessages));
// // // // //         }
        
// // // // //         if (welcomeShown) {
// // // // //           setWelcomeMessageShown(true);
// // // // //         }
// // // // //       } catch (error) {
// // // // //         console.error('Error loading saved chat:', error);
// // // // //       }
// // // // //     }
// // // // //   }, [user]);

// // // // //   // Add this effect to manage typing animation
// // // // //   useEffect(() => {
// // // // //     const streamingMessage = messages.find(msg => msg.isStreaming);
    
// // // // //     if (streamingMessage) {
// // // // //       if (activeStreamingId !== streamingMessage.id) {
// // // // //         // New streaming message
// // // // //         setActiveStreamingId(streamingMessage.id);
// // // // //         fullContentRef.current = streamingMessage.content;
// // // // //         setTypingContent('');
// // // // //         isTypingRef.current = false;
        
// // // // //         // Start typing the new message
// // // // //         if (streamingMessage.content) {
// // // // //           simulateTyping();
// // // // //         }
// // // // //       } else if (fullContentRef.current !== streamingMessage.content) {
// // // // //         // Content updated for current message
// // // // //         fullContentRef.current = streamingMessage.content;
        
// // // // //         // If not already typing, start typing
// // // // //         if (!isTypingRef.current) {
// // // // //           simulateTyping();
// // // // //         }
// // // // //       }
// // // // //     } else {
// // // // //       // No streaming message
// // // // //       setActiveStreamingId(null);
// // // // //       if (typingTimeoutRef.current) {
// // // // //         clearTimeout(typingTimeoutRef.current);
// // // // //         typingTimeoutRef.current = null;
// // // // //       }
// // // // //       isTypingRef.current = false;
// // // // //     }
// // // // //   }, [messages]);
  
// // // // //   // Add the memoized typing function
// // // // //   const simulateTyping = useCallback(() => {
// // // // //     if (isTypingRef.current) return;
    
// // // // //     isTypingRef.current = true;
    
// // // // //     const typeNextChar = () => {
// // // // //       if (typingContent.length < fullContentRef.current.length) {
// // // // //         setTypingContent(prev => fullContentRef.current.substring(0, prev.length + 1));
        
// // // // //         typingTimeoutRef.current = setTimeout(typeNextChar, typingSpeedRef.current);
// // // // //       } else {
// // // // //         isTypingRef.current = false;
// // // // //         typingTimeoutRef.current = null;
// // // // //       }
// // // // //     };
    
// // // // //     typeNextChar();
// // // // //   }, [typingContent]);

// // // // //   // Save messages to localStorage whenever they change
// // // // //   useEffect(() => {
// // // // //     if (user && messages.length > 0) {
// // // // //       localStorage.setItem(`${STORAGE_KEYS.MESSAGES}_${user.id}`, JSON.stringify(messages));
// // // // //     }
// // // // //   }, [messages, user]);
  
// // // // //   // Scroll to bottom whenever messages change or typing content updates
// // // // //   useEffect(() => {
// // // // //     messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
// // // // //   }, [messages, typingContent]);
  
// // // // //   // Fetch initial resume assessment and create welcome message on component mount
// // // // //   useEffect(() => {
// // // // //     if (resumeAnalysis && user && !welcomeMessageShown) {
// // // // //       setIsLoading(true);
      
// // // // //       // Create basic welcome message with basic info
// // // // //       const welcomeMessage: Message = {
// // // // //         id: `welcome-${Date.now()}`,
// // // // //         role: 'assistant',
// // // // //         content: `I've analyzed your resume and can help you improve it! Your resume currently has a grade of **${resumeAnalysis.letter_grade} (${resumeAnalysis.resume_percent}%)**.`,
// // // // //         timestamp: new Date(),
// // // // //       };
      
// // // // //       setMessages([welcomeMessage]);
      
// // // // //       // Try to fetch stored assessment from the database
// // // // //       (async () => {
// // // // //         try {
// // // // //           const { data, error } = await supabase
// // // // //             .from('resumes')
// // // // //             .select('initial_assessment')
// // // // //             .eq('user_id', user.id)
// // // // //             .single();
          
// // // // //           if (error) {
// // // // //             console.error('Error fetching stored assessment:', error);
// // // // //             throw error;
// // // // //           }
          
// // // // //           let initialAssessment = data?.initial_assessment;
          
// // // // //           // If no stored assessment, try to fetch it
// // // // //           if (!initialAssessment && resumeAnalysis.resume_id) {
// // // // //             const resumeText = localStorage.getItem(`resume_text_${resumeAnalysis.resume_id}`) || '';
            
// // // // //             if (resumeText) {
// // // // //               const { data: roastData, error: roastError } = await supabase.functions.invoke('resume-analyzer', {
// // // // //                 body: { 
// // // // //                   action: 'get-roast',
// // // // //                   resumeText
// // // // //                 }
// // // // //               });
              
// // // // //               if (roastError) throw roastError;
              
// // // // //               if (roastData?.roast) {
// // // // //                 initialAssessment = roastData.roast;
                
// // // // //                 // Store it in the database for future use
// // // // //                 await supabase
// // // // //                   .from('resumes')
// // // // //                   .update({ initial_assessment: initialAssessment })
// // // // //                   .eq('user_id', user.id);
// // // // //               }
// // // // //             }
// // // // //           }
          
// // // // //           // Update welcome message with assessment
// // // // //           const updatedWelcomeMessage: Message = {
// // // // //             ...welcomeMessage,
// // // // //             content: `I've analyzed your resume and can help you improve it! Your resume currently has a grade of **${resumeAnalysis.letter_grade} (${resumeAnalysis.resume_percent}%)**.

// // // // // ${initialAssessment ? `**Here's my honest assessment:**
// // // // // ${initialAssessment}

// // // // // ` : ''}Let's start by discussing your experience: **What specific challenges did you tackle in your first listed role, what actions did you take, and what measurable results did you achieve?**`
// // // // //           };
          
// // // // //           setMessages([updatedWelcomeMessage]);
// // // // //           setWelcomeMessageShown(true);
// // // // //           localStorage.setItem(`${STORAGE_KEYS.WELCOME_SHOWN}_${user.id}`, 'true');
// // // // //         } catch (error) {
// // // // //           console.error('Error with assessment:', error);
          
// // // // //           // Fallback message
// // // // //           const updatedWelcomeMessage: Message = {
// // // // //             ...welcomeMessage,
// // // // //             content: `${welcomeMessage.content}

// // // // // Let's start by discussing your experience: **What specific challenges did you tackle in your first listed role, what actions did you take, and what measurable results did you achieve?**`
// // // // //           };
          
// // // // //           setMessages([updatedWelcomeMessage]);
// // // // //           setWelcomeMessageShown(true);
// // // // //           localStorage.setItem(`${STORAGE_KEYS.WELCOME_SHOWN}_${user.id}`, 'true');
// // // // //         } finally {
// // // // //           setIsLoading(false);
// // // // //         }
// // // // //       })();
// // // // //     }
// // // // //   }, [resumeAnalysis, user, welcomeMessageShown]);
  
// // // // //   const handleSendMessage = async () => {
// // // // //     if (!inputValue.trim() || isLoading) return;

// // // // //     const userMessage: Message = {
// // // // //       id: `user-${Date.now()}`,
// // // // //       role: 'user',
// // // // //       content: inputValue,
// // // // //       timestamp: new Date(),
// // // // //     };
    
// // // // //     // Create a placeholder streaming message
// // // // //     const streamingMessage: Message = {
// // // // //       id: `assistant-${Date.now()}`,
// // // // //       role: 'assistant',
// // // // //       content: '',
// // // // //       timestamp: new Date(),
// // // // //       isStreaming: true
// // // // //     };
    
// // // // //     // Reset typing state
// // // // //     setActiveStreamingId(streamingMessage.id);
// // // // //     fullContentRef.current = '';
// // // // //     setTypingContent('');
    
// // // // //     setMessages(prev => [...prev, userMessage, streamingMessage]);
// // // // //     setInputValue('');
// // // // //     setIsLoading(true);
    
// // // // //     try {
// // // // //       // Create context from resume analysis
// // // // //       const context = resumeAnalysis ? 
// // // // //         `Resume analysis: Grade ${resumeAnalysis.letter_grade} (${resumeAnalysis.resume_percent}%). 
// // // // //          Key themes for improvement: ${resumeAnalysis.themes.join(', ')}.
// // // // //          Elevator pitch: ${resumeAnalysis.elevator_pitch}` : 
// // // // //         'No resume analysis available.';
      
// // // // //       // Prepare prompt with context and conversation history - removing "User:" and "Assistant:" prefixes
// // // // //       let conversationHistory = messages.map(msg => `${msg.content}`).join('\n\n');
      
// // // // //       // The prompt is modified to instruct the model not to include 'Assistant:' in its response
// // // // //       const prompt = `You are a professional resume coach assisting a user with their resume. 
      
// // // // // Resume Context: ${context}

// // // // // Previous conversation:
// // // // // ${conversationHistory}

// // // // // User's latest message: ${inputValue}

// // // // // Respond with helpful, specific advice as a resume coach. Be constructive, honest, and professional. Do not prefix your response with "Assistant:" or any other label. Do not repeat the user's prompt.`;
      
// // // // //       // Abort any existing streams
// // // // //       if (streamController) {
// // // // //         streamController.abort();
// // // // //       }
      
// // // // //       // Create a new controller for this stream
// // // // //       const controller = new AbortController();
// // // // //       setStreamController(controller);
      
// // // // //       // Call the Together AI streaming endpoint
// // // // //       console.log('Attempting to invoke together-ai function with prompt:', prompt.substring(0, 50) + '...');
      
// // // // //       // After getting the response from Supabase
// // // // //       const response = await supabase.functions.invoke('together-ai', {
// // // // //         body: { 
// // // // //           prompt,
// // // // //           model: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
// // // // //           max_tokens: 1024,
// // // // //           stream: true
// // // // //         }
// // // // //       });
      
// // // // //       console.log('Supabase function response received:', response);
      
// // // // //       if (response.error) {
// // // // //         console.error('Error from Together AI:', response.error);
// // // // //         throw new Error(response.error.message || 'Unknown error');
// // // // //       }
      
// // // // //       // Access the response body
// // // // //       if (!response.data || !response.data.body) {
// // // // //         console.error('No body in response data:', response.data);
// // // // //         throw new Error('No readable stream in response');
// // // // //       }
      
// // // // //       // Get the ReadableStream from the response.data.body
// // // // //       const readableStream = response.data.body;
// // // // //       const reader = readableStream.getReader();
      
// // // // //       // Add a timeout to handle premature stream termination
// // // // //       let streamTimeout = null;
// // // // //       const MAX_SILENCE_MS = 10000; // 10 seconds without data before we consider the stream dead
      
// // // // //       try {
// // // // //         // Process the SSE stream
// // // // //         while (true) {
// // // // //           // Clear any existing timeout and set a new one
// // // // //           if (streamTimeout) clearTimeout(streamTimeout);
          
// // // // //           streamTimeout = setTimeout(() => {
// // // // //             console.log('Stream timed out - no data received in', MAX_SILENCE_MS, 'ms');
// // // // //             reader.cancel('Stream timed out');
// // // // //             // Update the streaming message to mark as complete
// // // // //             setMessages(prev => prev.map(msg => 
// // // // //               msg.id === streamingMessage.id 
// // // // //                 ? { ...msg, isStreaming: false }
// // // // //                 : msg
// // // // //             ));
// // // // //           }, MAX_SILENCE_MS);
          
// // // // //           const { done, value } = await reader.read();
          
// // // // //           if (done) {
// // // // //             console.log('Stream marked as done');
// // // // //             clearTimeout(streamTimeout);
// // // // //             break;
// // // // //           }
          
// // // // //           // Decode the chunk
// // // // //           const chunk = new TextDecoder().decode(value);
// // // // //           console.log('Received chunk length:', chunk.length);
          
// // // // //           // Parse SSE format - each line starts with "data: "
// // // // //           const lines = chunk.split('\n').filter(line => line.trim() !== '');
          
// // // // //           for (const line of lines) {
// // // // //             if (line.startsWith('data: ')) {
// // // // //               try {
// // // // //                 // Remove the "data: " prefix and parse the JSON
// // // // //                 const jsonStr = line.substring(6);
                
// // // // //                 // Check if it's the "[DONE]" marker
// // // // //                 if (jsonStr.trim() === '[DONE]') {
// // // // //                   continue;
// // // // //                 }
                
// // // // //                 const jsonData = JSON.parse(jsonStr);
// // // // //                 console.log('Parsed JSON data:', jsonData);
                
// // // // //                 // Extract the text from the completion choices
// // // // //                 if (jsonData.choices && jsonData.choices[0]?.text) {
// // // // //                   const newText = jsonData.choices[0].text;
                  
// // // // //                   // Update the message content
// // // // //                   setMessages(prev => {
// // // // //                     const updatedMessages = prev.map(msg => 
// // // // //                       msg.id === streamingMessage.id 
// // // // //                         ? { ...msg, content: msg.content + newText }
// // // // //                         : msg
// // // // //                     );
// // // // //                     return updatedMessages;
// // // // //                   });
// // // // //                 }
// // // // //               } catch (e) {
// // // // //                 console.warn('Error parsing SSE data:', e, 'Line:', line);
// // // // //               }
// // // // //             }
// // // // //           }
// // // // //         }
// // // // //       } catch (error) {
// // // // //         console.error('Error processing stream:', error);
// // // // //         // Still update with whatever content we got
// // // // //         setMessages(prev => prev.map(msg => 
// // // // //           msg.id === streamingMessage.id 
// // // // //             ? { ...msg, isStreaming: false }
// // // // //             : msg
// // // // //         ));
// // // // //       } finally {
// // // // //         // Make sure we clear any pending timeout
// // // // //         if (streamTimeout) clearTimeout(streamTimeout);
        
// // // // //         // Update the streaming message to mark streaming as complete
// // // // //         setMessages(prev => prev.map(msg => 
// // // // //           msg.id === streamingMessage.id 
// // // // //             ? { ...msg, isStreaming: false }
// // // // //             : msg
// // // // //         ));
        
// // // // //         setStreamController(null);
// // // // //       }
      
// // // // //     } catch (error) {
// // // // //       console.error('Error sending message:', error);
      
// // // // //       // Log more details if available
// // // // //       if (error.response) {
// // // // //         console.error('Response data:', error.response.data);
// // // // //         console.error('Response status:', error.response.status);
// // // // //       }
      
// // // // //       toast({
// // // // //         title: "Error",
// // // // //         description: "Failed to get a response from the AI. Please try again.",
// // // // //         variant: "destructive"
// // // // //       });
      
// // // // //       // Fallback response
// // // // //       const fallbackMessage: Message = {
// // // // //         id: `assistant-fallback-${Date.now()}`,
// // // // //         role: 'assistant',
// // // // //         content: "Thanks for sharing those details. Based on what you've told me, I'd recommend focusing on quantifying your achievements more clearly in your resume. Add specific metrics and outcomes to demonstrate your impact. Could you share a specific project where you made a significant contribution?",
// // // // //         timestamp: new Date(),
// // // // //       };
      
// // // // //       setMessages(prev => [...prev.filter(msg => !msg.isStreaming), fallbackMessage]);
// // // // //     } finally {
// // // // //       setIsLoading(false);
// // // // //     }
// // // // //   };
  
// // // // //   const handleKeyDown = (e: React.KeyboardEvent) => {
// // // // //     if (e.key === 'Enter' && !e.shiftKey) {
// // // // //       e.preventDefault();
// // // // //       handleSendMessage();
// // // // //     }
// // // // //   };
  
// // // // //   return (
// // // // //     <div className="w-full">
// // // // //       <ScrollArea className="h-[900px] px-1">
// // // // //         <div className="space-y-4 p-4">
// // // // //           {messages.map((message) => (
// // // // //             <div key={message.id} className={`flex ${
// // // // //               message.role === 'assistant' 
// // // // //                 ? 'justify-start' 
// // // // //                 : 'justify-end'
// // // // //             }`}>
// // // // //               <div className={`max-w-3xl p-3 rounded-lg ${
// // // // //                 message.role === 'assistant' 
// // // // //                   ? 'bg-slate-100 text-slate-800' 
// // // // //                   : 'bg-blue-600 text-white'
// // // // //               }`}>
// // // // //                 {message.role === 'assistant' ? (
// // // // //                   <div 
// // // // //                     className="prose prose-slate max-w-none"
// // // // //                     dangerouslySetInnerHTML={{ 
// // // // //                       __html: formatMessage(
// // // // //                         message.id === activeStreamingId ? typingContent : message.content
// // // // //                       )
// // // // //                     }}
// // // // //                   />
// // // // //                 ) : (
// // // // //                   <div>{message.content}</div>
// // // // //                 )}
                
// // // // //                 {message.isStreaming && (
// // // // //                   <span className="inline-block w-1.5 h-4 bg-slate-400 ml-1 animate-pulse"></span>
// // // // //                 )}
// // // // //               </div>
// // // // //             </div>
// // // // //           ))}
          
// // // // //           {messages.length === 0 && resumeAnalysis && !isLoading && (
// // // // //             <div className="text-center p-6">
// // // // //               <p className="text-muted-foreground mb-4">
// // // // //                 Your resume is ready for review. I can provide personalized advice to help you improve it.
// // // // //               </p>
// // // // //             </div>
// // // // //           )}
          
// // // // //           {isLoading && !messages.some(m => m.isStreaming) && (
// // // // //             <div className="flex justify-start">
// // // // //               <div className="max-w-3xl p-3 rounded-lg bg-slate-100 text-slate-800">
// // // // //                 <div className="flex space-x-2">
// // // // //                   <div className="w-2 h-2 rounded-full bg-slate-400 animate-pulse"></div>
// // // // //                   <div className="w-2 h-2 rounded-full bg-slate-400 animate-pulse delay-75"></div>
// // // // //                   <div className="w-2 h-2 rounded-full bg-slate-400 animate-pulse delay-150"></div>
// // // // //                 </div>
// // // // //               </div>
// // // // //             </div>
// // // // //           )}
// // // // //           <div ref={messagesEndRef} />
// // // // //         </div>
// // // // //       </ScrollArea>
      
// // // // //       <div className="p-4 border-t mt-2">
// // // // //         <div className="flex space-x-2 w-full">
// // // // //           <Textarea
// // // // //             value={inputValue}
// // // // //             onChange={(e) => setInputValue(e.target.value)}
// // // // //             onKeyDown={handleKeyDown}
// // // // //             placeholder="Ask about your resume or career path..."
// // // // //             className="flex-1 resize-none"
// // // // //             rows={2}
// // // // //             disabled={isLoading}
// // // // //           />
// // // // //           <Button 
// // // // //             onClick={handleSendMessage} 
// // // // //             disabled={isLoading || !inputValue.trim()}
// // // // //             className="self-end"
// // // // //           >
// // // // //             <Send className="h-4 w-4" />
// // // // //             <span className="sr-only">Send</span>
// // // // //           </Button>
// // // // //         </div>
// // // // //       </div>
// // // // //     </div>
// // // // //   );
// // // // // };

// // // // // export default ResumeChat;
// // // // // // import React, { useState, useRef, useEffect } from 'react';
// // // // // // import { Send } from 'lucide-react';
// // // // // // import { Button } from '@/components/ui/button';
// // // // // // import { Textarea } from '@/components/ui/textarea';
// // // // // // import { supabase } from '@/integrations/supabase/client';
// // // // // // import { useAuth } from '@/contexts/AuthContext';
// // // // // // import { formatMessage } from '@/components/assistants/utils/messageFormatting';
// // // // // // import { useToast } from '@/hooks/use-toast';
// // // // // // import { ScrollArea } from "@/components/ui/scroll-area";
// // // // // // import { ResumeAnalysis } from '@/components/assistants/types';

// // // // // // // Add to your imports
// // // // // // import React, { useState, useRef, useEffect, useCallback } from 'react';


  

// // // // // // interface ResumeChatProps {
// // // // // //   resumeAnalysis: ResumeAnalysis | null;
// // // // // // }

// // // // // // type Message = {
// // // // // //   id: string;
// // // // // //   role: 'assistant' | 'user';
// // // // // //   content: string;
// // // // // //   timestamp: Date;
// // // // // //   isStreaming?: boolean;
// // // // // // };

// // // // // // // Create storage keys for persisting chat state
// // // // // // const STORAGE_KEYS = {
// // // // // //   MESSAGES: 'resume_chat_messages',
// // // // // //   WELCOME_SHOWN: 'resume_welcome_shown'
// // // // // // };

// // // // // // const ResumeChat: React.FC<ResumeChatProps> = ({ resumeAnalysis }) => {
// // // // // //   const { user } = useAuth();
// // // // // //   const { toast } = useToast();
// // // // // //   const [messages, setMessages] = useState<Message[]>([]);
// // // // // //   const [inputValue, setInputValue] = useState('');
// // // // // //   const [isLoading, setIsLoading] = useState(false);
// // // // // //   const [streamController, setStreamController] = useState<AbortController | null>(null);
// // // // // //   const messagesEndRef = useRef<HTMLDivElement>(null);
// // // // // //   const [welcomeMessageShown, setWelcomeMessageShown] = useState(false);


// // // // // //   // Replace typing effect state with this:
// // // // // //   const [activeStreamingId, setActiveStreamingId] = useState<string | null>(null);
// // // // // //   const [typingContent, setTypingContent] = useState('');
// // // // // //   const fullContentRef = useRef('');
// // // // // //   const typingSpeedRef = useRef(15); // ms per character (adjust for faster/slower typing)
// // // // // //   const isTypingRef = useRef(false);
// // // // // //   const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
// // // // // //   // Other existing code...
  
// // // // // //   // Load persisted messages from localStorage
// // // // // //   useEffect(() => {
// // // // // //     if (user) {
// // // // // //       try {
// // // // // //         const savedMessages = localStorage.getItem(`${STORAGE_KEYS.MESSAGES}_${user.id}`);
// // // // // //         const welcomeShown = localStorage.getItem(`${STORAGE_KEYS.WELCOME_SHOWN}_${user.id}`);
        
// // // // // //         if (savedMessages) {
// // // // // //           setMessages(JSON.parse(savedMessages));
// // // // // //         }
        
// // // // // //         if (welcomeShown) {
// // // // // //           setWelcomeMessageShown(true);
// // // // // //         }
// // // // // //       } catch (error) {
// // // // // //         console.error('Error loading saved chat:', error);
// // // // // //       }
// // // // // //     }
// // // // // //   }, [user]);

// // // // // //     // Add this effect to manage typing animation
// // // // // //   useEffect(() => {
// // // // // //     const streamingMessage = messages.find(msg => msg.isStreaming);
    
// // // // // //     if (streamingMessage) {
// // // // // //       if (activeStreamingId !== streamingMessage.id) {
// // // // // //         // New streaming message
// // // // // //         setActiveStreamingId(streamingMessage.id);
// // // // // //         fullContentRef.current = streamingMessage.content;
// // // // // //         setTypingContent('');
// // // // // //         isTypingRef.current = false;
        
// // // // // //         // Start typing the new message
// // // // // //         if (streamingMessage.content) {
// // // // // //           simulateTyping();
// // // // // //         }
// // // // // //       } else if (fullContentRef.current !== streamingMessage.content) {
// // // // // //         // Content updated for current message
// // // // // //         fullContentRef.current = streamingMessage.content;
        
// // // // // //         // If not already typing, start typing
// // // // // //         if (!isTypingRef.current) {
// // // // // //           simulateTyping();
// // // // // //         }
// // // // // //       }
// // // // // //     } else {
// // // // // //       // No streaming message
// // // // // //       setActiveStreamingId(null);
// // // // // //       if (typingTimeoutRef.current) {
// // // // // //         clearTimeout(typingTimeoutRef.current);
// // // // // //         typingTimeoutRef.current = null;
// // // // // //       }
// // // // // //       isTypingRef.current = false;
// // // // // //     }
// // // // // //   }, [messages]);
  
// // // // // //   // Add the memoized typing function
// // // // // //   const simulateTyping = useCallback(() => {
// // // // // //     if (isTypingRef.current) return;
    
// // // // // //     isTypingRef.current = true;
    
// // // // // //     const typeNextChar = () => {
// // // // // //       if (typingContent.length < fullContentRef.current.length) {
// // // // // //         setTypingContent(prev => fullContentRef.current.substring(0, prev.length + 1));
        
// // // // // //         typingTimeoutRef.current = setTimeout(typeNextChar, typingSpeedRef.current);
// // // // // //       } else {
// // // // // //         isTypingRef.current = false;
// // // // // //         typingTimeoutRef.current = null;
// // // // // //       }
// // // // // //     };
    
// // // // // //     typeNextChar();
// // // // // //   }, [typingContent]);

  
// // // // // //   // Save messages to localStorage whenever they change
// // // // // //   useEffect(() => {
// // // // // //     if (user && messages.length > 0) {
// // // // // //       localStorage.setItem(`${STORAGE_KEYS.MESSAGES}_${user.id}`, JSON.stringify(messages));
// // // // // //     }
// // // // // //   }, [messages, user]);
  
// // // // // //   // Scroll to bottom whenever messages change
// // // // // //   useEffect(() => {
// // // // // //     messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
// // // // // //   }, [messages]);
  
// // // // // //   // Fetch initial resume assessment and create welcome message on component mount
// // // // // //   useEffect(() => {
// // // // // //     if (resumeAnalysis && user && !welcomeMessageShown) {
// // // // // //       setIsLoading(true);
      
// // // // // //       // Create basic welcome message with basic info
// // // // // //       const welcomeMessage: Message = {
// // // // // //         id: `welcome-${Date.now()}`,
// // // // // //         role: 'assistant',
// // // // // //         content: `I've analyzed your resume and can help you improve it! Your resume currently has a grade of **${resumeAnalysis.letter_grade} (${resumeAnalysis.resume_percent}%)**.`,
// // // // // //         timestamp: new Date(),
// // // // // //       };
      
// // // // // //       setMessages([welcomeMessage]);
      
// // // // // //       // Try to fetch stored assessment from the database
// // // // // //       (async () => {
// // // // // //         try {
// // // // // //           const { data, error } = await supabase
// // // // // //             .from('resumes')
// // // // // //             .select('initial_assessment')
// // // // // //             .eq('user_id', user.id)
// // // // // //             .single();
          
// // // // // //           if (error) {
// // // // // //             console.error('Error fetching stored assessment:', error);
// // // // // //             throw error;
// // // // // //           }
          
// // // // // //           let initialAssessment = data?.initial_assessment;
          
// // // // // //           // If no stored assessment, try to fetch it
// // // // // //           if (!initialAssessment && resumeAnalysis.resume_id) {
// // // // // //             const resumeText = localStorage.getItem(`resume_text_${resumeAnalysis.resume_id}`) || '';
            
// // // // // //             if (resumeText) {
// // // // // //               const { data: roastData, error: roastError } = await supabase.functions.invoke('resume-analyzer', {
// // // // // //                 body: { 
// // // // // //                   action: 'get-roast',
// // // // // //                   resumeText
// // // // // //                 }
// // // // // //               });
              
// // // // // //               if (roastError) throw roastError;
              
// // // // // //               if (roastData?.roast) {
// // // // // //                 initialAssessment = roastData.roast;
                
// // // // // //                 // Store it in the database for future use
// // // // // //                 await supabase
// // // // // //                   .from('resumes')
// // // // // //                   .update({ initial_assessment: initialAssessment })
// // // // // //                   .eq('user_id', user.id);
// // // // // //               }
// // // // // //             }
// // // // // //           }
          
// // // // // //           // Update welcome message with assessment
// // // // // //           const updatedWelcomeMessage: Message = {
// // // // // //             ...welcomeMessage,
// // // // // //             content: `I've analyzed your resume and can help you improve it! Your resume currently has a grade of **${resumeAnalysis.letter_grade} (${resumeAnalysis.resume_percent}%)**.

// // // // // // ${initialAssessment ? `**Here's my honest assessment:**
// // // // // // ${initialAssessment}

// // // // // // ` : ''}Let's start by discussing your experience: **What specific challenges did you tackle in your first listed role, what actions did you take, and what measurable results did you achieve?**`
// // // // // //           };
          
// // // // // //           setMessages([updatedWelcomeMessage]);
// // // // // //           setWelcomeMessageShown(true);
// // // // // //           localStorage.setItem(`${STORAGE_KEYS.WELCOME_SHOWN}_${user.id}`, 'true');
// // // // // //         } catch (error) {
// // // // // //           console.error('Error with assessment:', error);
          
// // // // // //           // Fallback message
// // // // // //           const updatedWelcomeMessage: Message = {
// // // // // //             ...welcomeMessage,
// // // // // //             content: `${welcomeMessage.content}

// // // // // // Let's start by discussing your experience: **What specific challenges did you tackle in your first listed role, what actions did you take, and what measurable results did you achieve?**`
// // // // // //           };
          
// // // // // //           setMessages([updatedWelcomeMessage]);
// // // // // //           setWelcomeMessageShown(true);
// // // // // //           localStorage.setItem(`${STORAGE_KEYS.WELCOME_SHOWN}_${user.id}`, 'true');
// // // // // //         } finally {
// // // // // //           setIsLoading(false);
// // // // // //         }
// // // // // //       })();
// // // // // //     }
// // // // // //   }, [resumeAnalysis, user, welcomeMessageShown]);
  
// // // // // //   const handleSendMessage = async () => {
// // // // // //     if (!inputValue.trim() || isLoading) return;

// // // // // //      // Create a placeholder streaming message
// // // // // //     const streamingMessage: Message = {
// // // // // //       id: `assistant-${Date.now()}`,
// // // // // //       role: 'assistant',
// // // // // //       content: '',
// // // // // //       timestamp: new Date(),
// // // // // //       isStreaming: true
// // // // // //     };
    
// // // // // //     // Reset typing state
// // // // // //     setActiveStreamingId(streamingMessage.id);
// // // // // //     fullContentRef.current = '';
// // // // // //     setTypingContent('');
    
// // // // // //     setMessages(prev => [...prev, streamingMessage]);
    
// // // // // //     const userMessage: Message = {
// // // // // //       id: `user-${Date.now()}`,
// // // // // //       role: 'user',
// // // // // //       content: inputValue,
// // // // // //       timestamp: new Date(),
// // // // // //     };
    
// // // // // //     setMessages(prev => [...prev, userMessage]);
// // // // // //     setInputValue('');
// // // // // //     setIsLoading(true);
    
// // // // // //     try {
// // // // // //       // Create context from resume analysis
// // // // // //       const context = resumeAnalysis ? 
// // // // // //         `Resume analysis: Grade ${resumeAnalysis.letter_grade} (${resumeAnalysis.resume_percent}%). 
// // // // // //          Key themes for improvement: ${resumeAnalysis.themes.join(', ')}.
// // // // // //          Elevator pitch: ${resumeAnalysis.elevator_pitch}` : 
// // // // // //         'No resume analysis available.';
      
// // // // // //       // Prepare prompt with context and conversation history - removing "User:" and "Assistant:" prefixes
// // // // // //       let conversationHistory = messages.map(msg => `${msg.content}`).join('\n\n');
      
// // // // // //       // The prompt is modified to instruct the model not to include 'Assistant:' in its response
// // // // // //       const prompt = `You are a professional resume coach assisting a user with their resume. 
      
// // // // // // Resume Context: ${context}

// // // // // // Previous conversation:
// // // // // // ${conversationHistory}

// // // // // // User's latest message: ${inputValue}

// // // // // // Respond with helpful, specific advice as a resume coach. Be constructive, honest, and professional. Do not prefix your response with "Assistant:" or any other label. Do not repeat the user's prompt.`;

// // // // // //       // Create a placeholder streaming message
// // // // // //       const streamingMessage: Message = {
// // // // // //         id: `assistant-${Date.now()}`,
// // // // // //         role: 'assistant',
// // // // // //         content: '',
// // // // // //         timestamp: new Date(),
// // // // // //         isStreaming: true
// // // // // //       };
      
// // // // // //       setMessages(prev => [...prev, streamingMessage]);
      
// // // // // //       // Abort any existing streams
// // // // // //       if (streamController) {
// // // // // //         streamController.abort();
// // // // // //       }
      
// // // // // //       // Create a new controller for this stream
// // // // // //       const controller = new AbortController();
// // // // // //       setStreamController(controller);
      
// // // // // //       // Call the Together AI streaming endpoint
// // // // // //       console.log('Attempting to invoke together-ai function with prompt:', prompt.substring(0, 50) + '...');
      
// // // // // //       // After getting the response from Supabase
// // // // // //       const response = await supabase.functions.invoke('together-ai', {
// // // // // //         body: { 
// // // // // //           prompt,
// // // // // //           model: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
// // // // // //           max_tokens: 1024,
// // // // // //           stream: true
// // // // // //         }
// // // // // //       });
      
// // // // // //       console.log('Supabase function response received:', response);
      
// // // // // //       if (response.error) {
// // // // // //         console.error('Error from Together AI:', response.error);
// // // // // //         throw new Error(response.error.message || 'Unknown error');
// // // // // //       }
      
// // // // // //       // Access the response body
// // // // // //       if (!response.data || !response.data.body) {
// // // // // //         console.error('No body in response data:', response.data);
// // // // // //         throw new Error('No readable stream in response');
// // // // // //       }
      
// // // // // //       // Get the ReadableStream from the response.data.body
// // // // // //       const readableStream = response.data.body;
// // // // // //       const reader = readableStream.getReader();
// // // // // //       let streamedContent = '';
      
// // // // // //       // Add a timeout to handle premature stream termination
// // // // // //       let streamTimeout = null;
// // // // // //       const MAX_SILENCE_MS = 10000; // 10 seconds without data before we consider the stream dead
      
// // // // // //       try {
// // // // // //         // Process the SSE stream
// // // // // //         while (true) {
// // // // // //           // Clear any existing timeout and set a new one
// // // // // //           if (streamTimeout) clearTimeout(streamTimeout);
          
// // // // // //           streamTimeout = setTimeout(() => {
// // // // // //             console.log('Stream timed out - no data received in', MAX_SILENCE_MS, 'ms');
// // // // // //             reader.cancel('Stream timed out');
// // // // // //             // Update the streaming message to mark as complete
// // // // // //             setMessages(prev => prev.map(msg => 
// // // // // //               msg.id === streamingMessage.id 
// // // // // //                 ? { ...msg, isStreaming: false }
// // // // // //                 : msg
// // // // // //             ));
// // // // // //           }, MAX_SILENCE_MS);
          
// // // // // //           const { done, value } = await reader.read();
          
// // // // // //           if (done) {
// // // // // //             console.log('Stream marked as done');
// // // // // //             clearTimeout(streamTimeout);
// // // // // //             break;
// // // // // //           }
          
// // // // // //           // Decode the chunk
// // // // // //           const chunk = new TextDecoder().decode(value);
// // // // // //           console.log('Received chunk length:', chunk.length);
          
// // // // // //           // Parse SSE format - each line starts with "data: "
// // // // // //           const lines = chunk.split('\n').filter(line => line.trim() !== '');
          
// // // // // //           for (const line of lines) {
// // // // // //             if (line.startsWith('data: ')) {
// // // // // //               try {
// // // // // //                 // Remove the "data: " prefix and parse the JSON
// // // // // //                 const jsonStr = line.substring(6);
                
// // // // // //                 // Check if it's the "[DONE]" marker
// // // // // //                 if (jsonStr.trim() === '[DONE]') {
// // // // // //                   continue;
// // // // // //                 }
                
// // // // // //                 const jsonData = JSON.parse(jsonStr);
// // // // // //                 console.log('Parsed JSON data:', jsonData);
                
// // // // // //                 // Extract the text from the completion choices
// // // // // //                 // if (jsonData.choices && jsonData.choices[0]?.text) {
// // // // // //                 //   const newText = jsonData.choices[0].text;
// // // // // //                 //   streamedContent += newText;
// // // // // //                       // In the streaming loop, modify the part where you process each chunk:
// // // // // //                 if (jsonData.choices && jsonData.choices[0]?.text) {
// // // // // //                   const newText = jsonData.choices[0].text;
                  
// // // // // //                   // Update the message content
// // // // // //                   setMessages(prev => {
// // // // // //                     const updatedMessages = prev.map(msg => 
// // // // // //                       msg.id === streamingMessage.id 
// // // // // //                         ? { ...msg, content: msg.content + newText }
// // // // // //                         : msg
// // // // // //                     );
// // // // // //                     return updatedMessages;
// // // // // //                   });
// // // // // //                 }
// // // // // //                   // Update the streaming message with current content
// // // // // //                 //   setMessages(prev => prev.map(msg => 
// // // // // //                 //     msg.id === streamingMessage.id 
// // // // // //                 //       ? { ...msg, content: streamedContent }
// // // // // //                 //       : msg
// // // // // //                 //   ));
// // // // // //                 // }
// // // // // //               } catch (e) {
// // // // // //                 console.warn('Error parsing SSE data:', e, 'Line:', line);
// // // // // //               }
// // // // // //             }
// // // // // //           }
// // // // // //         }
// // // // // //       } catch (error) {
// // // // // //         console.error('Error processing stream:', error);
// // // // // //         // Still update with whatever content we got
// // // // // //         if (streamedContent) {
// // // // // //           setMessages(prev => prev.map(msg => 
// // // // // //             msg.id === streamingMessage.id 
// // // // // //               ? { ...msg, content: streamedContent, isStreaming: false }
// // // // // //               : msg
// // // // // //           ));
// // // // // //         }
// // // // // //       } finally {
// // // // // //         // Make sure we clear any pending timeout
// // // // // //         if (streamTimeout) clearTimeout(streamTimeout);
        
// // // // // //         // Update the streaming message to mark streaming as complete
// // // // // //         setMessages(prev => prev.map(msg => 
// // // // // //           msg.id === streamingMessage.id 
// // // // // //             ? { ...msg, isStreaming: false }
// // // // // //             : msg
// // // // // //         ));
        
// // // // // //         setStreamController(null);
// // // // // //       }
      
// // // // // //     } catch (error) {
// // // // // //       console.error('Error sending message:', error);
      
// // // // // //       // Log more details if available
// // // // // //       if (error.response) {
// // // // // //         console.error('Response data:', error.response.data);
// // // // // //         console.error('Response status:', error.response.status);
// // // // // //       }
      
// // // // // //       toast({
// // // // // //         title: "Error",
// // // // // //         description: "Failed to get a response from the AI. Please try again.",
// // // // // //         variant: "destructive"
// // // // // //       });
      
// // // // // //       // Fallback response
// // // // // //       const fallbackMessage: Message = {
// // // // // //         id: `assistant-fallback-${Date.now()}`,
// // // // // //         role: 'assistant',
// // // // // //         content: "Thanks for sharing those details. Based on what you've told me, I'd recommend focusing on quantifying your achievements more clearly in your resume. Add specific metrics and outcomes to demonstrate your impact. Could you share a specific project where you made a significant contribution?",
// // // // // //         timestamp: new Date(),
// // // // // //       };
      
// // // // // //       setMessages(prev => [...prev.filter(msg => !msg.isStreaming), fallbackMessage]);
// // // // // //     } finally {
// // // // // //       setIsLoading(false);
// // // // // //     }
// // // // // //   };
  
// // // // // //   const handleKeyDown = (e: React.KeyboardEvent) => {
// // // // // //     if (e.key === 'Enter' && !e.shiftKey) {
// // // // // //       e.preventDefault();
// // // // // //       handleSendMessage();
// // // // // //     }
// // // // // //   };
  
// // // // // //   return (
// // // // // //     <div className="w-full">
// // // // // //       <ScrollArea className="h-[900px] px-1"> {/* Increased height from previous ~400px */}
// // // // // //         <div className="space-y-4 p-4">
// // // // // //           {messages.map((message) => (
// // // // // //             <div key={message.id} className={`flex ${
// // // // // //               message.role === 'assistant' 
// // // // // //                 ? 'justify-start' 
// // // // // //                 : 'justify-end'
// // // // // //             }`}>
// // // // // //               <div className={`max-w-3xl p-3 rounded-lg ${
// // // // // //                 message.role === 'assistant' 
// // // // // //                   ? 'bg-slate-100 text-slate-800' 
// // // // // //                   : 'bg-blue-600 text-white'
// // // // // //               }`}>
// // // // // //                 {message.role === 'assistant' ? (
// // // // // //                 <div 
// // // // // //                   className="prose prose-slate max-w-none"
// // // // // //                   dangerouslySetInnerHTML={{ 
// // // // // //                     __html: formatMessage(
// // // // // //                       message.id === activeStreamingId ? typingContent : message.content
// // // // // //                     )
// // // // // //                   }}
// // // // // //                 />
// // // // // //               ) : (
// // // // // //                 <div>{message.content}</div>
// // // // // //               )}
// // // // // //                 {/* /* {message.role === 'assistant' ? (
// // // // // //                   <div 
// // // // // //                     className="prose prose-slate max-w-none"
// // // // // //                     dangerouslySetInnerHTML={{ __html: formatMessage(message.content) }}
// // // // // //                   />
// // // // // //                 ) : (
// // // // // //                   <div>{message.content}</div>
// // // // // //                 )} */ */}
                
// // // // // //                 {message.isStreaming && (
// // // // // //                   <span className="inline-block w-1.5 h-4 bg-slate-400 ml-1 animate-pulse"></span>
// // // // // //                 )}
// // // // // //               </div>
// // // // // //             </div>
// // // // // //           ))}
          
// // // // // //           {messages.length === 0 && resumeAnalysis && !isLoading && (
// // // // // //             <div className="text-center p-6">
// // // // // //               <p className="text-muted-foreground mb-4">
// // // // // //                 Your resume is ready for review. I can provide personalized advice to help you improve it.
// // // // // //               </p>
// // // // // //             </div>
// // // // // //           )}
          
// // // // // //           {isLoading && !messages.some(m => m.isStreaming) && (
// // // // // //             <div className="flex justify-start">
// // // // // //               <div className="max-w-3xl p-3 rounded-lg bg-slate-100 text-slate-800">
// // // // // //                 <div className="flex space-x-2">
// // // // // //                   <div className="w-2 h-2 rounded-full bg-slate-400 animate-pulse"></div>
// // // // // //                   <div className="w-2 h-2 rounded-full bg-slate-400 animate-pulse delay-75"></div>
// // // // // //                   <div className="w-2 h-2 rounded-full bg-slate-400 animate-pulse delay-150"></div>
// // // // // //                 </div>
// // // // // //               </div>
// // // // // //             </div>
// // // // // //           )}
// // // // // //           <div ref={messagesEndRef} />
// // // // // //         </div>
// // // // // //       </ScrollArea>
      
// // // // // //       <div className="p-4 border-t mt-2">
// // // // // //         <div className="flex space-x-2 w-full">
// // // // // //           <Textarea
// // // // // //             value={inputValue}
// // // // // //             onChange={(e) => setInputValue(e.target.value)}
// // // // // //             onKeyDown={handleKeyDown}
// // // // // //             placeholder="Ask about your resume or career path..."
// // // // // //             className="flex-1 resize-none"
// // // // // //             rows={2}
// // // // // //             disabled={isLoading}
// // // // // //           />
// // // // // //           <Button 
// // // // // //             onClick={handleSendMessage} 
// // // // // //             disabled={isLoading || !inputValue.trim()}
// // // // // //             className="self-end"
// // // // // //           >
// // // // // //             <Send className="h-4 w-4" />
// // // // // //             <span className="sr-only">Send</span>
// // // // // //           </Button>
// // // // // //         </div>
// // // // // //       </div>
// // // // // //     </div>
// // // // // //   );
// // // // // // };

// // // // // // export default ResumeChat;
