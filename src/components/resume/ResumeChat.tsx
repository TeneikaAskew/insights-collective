import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { sanitizeHTML } from '@/utils/sanitize';
import { useAuth } from '@/contexts/AuthContext';
import { formatMessage } from '@/components/assistants/utils/messageFormatting';
import { useToast } from '@/hooks/use-toast';
import { assertStorableResult, emptyResultToast, isEmptyResultError } from '@/lib/resultIntegrity';
import { ScrollArea } from "@/components/ui/scroll-area";
import { ResumeAnalysis } from '@/components/assistants/types';

import { createLogger } from '@/utils/logger';

const logger = createLogger('processNextWord');

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
  useTypingAnimation?: boolean; // Flag to control typing animation
};

// Create storage keys for persisting chat state
const STORAGE_KEYS = {
  MESSAGES: 'resume_chat_messages',
  WELCOME_SHOWN: 'resume_welcome_shown',
  CONVERSATION_ID: 'resume_conversation_id'
};

// `together-ai` forwards this id straight to the Lovable AI gateway, which only
// serves its own model ids. This was `meta-llama/Llama-3-8b-chat-hf` — a Together
// AI id the gateway rejected with `400 invalid model` on every send, with no
// fallback, so the chat errored instead of replying. One constant for both the
// request and the row we write about it, so the two cannot drift apart again.
const CHAT_MODEL = 'google/gemini-2.5-flash';
const CHAT_MAX_TOKENS = 1024;

const ResumeChat: React.FC<ResumeChatProps> = ({ resumeAnalysis }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamController, setStreamController] = useState<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [welcomeMessageShown, setWelcomeMessageShown] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  
  // Enhanced typing animation state
  const contentBufferRef = useRef<string[]>([]);
  const typingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef(false);
  const currentStreamingIdRef = useRef<string | null>(null);
  
  // Add refs for full content
  const fullContentRef = useRef('');
  const typingSpeedRef = useRef(5); // ms per character
  
  // Load persisted conversation ID and messages from localStorage
  useEffect(() => {
    if (user) {
      try {
        const savedMessages = localStorage.getItem(`${STORAGE_KEYS.MESSAGES}_${user.id}`);
        const welcomeShown = localStorage.getItem(`${STORAGE_KEYS.WELCOME_SHOWN}_${user.id}`);
        const savedConversationId = localStorage.getItem(`${STORAGE_KEYS.CONVERSATION_ID}_${user.id}`);
        
        if (savedConversationId) {
          setConversationId(savedConversationId);
        }
        
        if (savedMessages) {
          const parsedMessages = JSON.parse(savedMessages);
          // Ensure displayContent matches content for loaded messages
          const messagesWithDisplay = parsedMessages.map((msg: Message) => ({
            ...msg,
            displayContent: msg.content,
            useTypingAnimation: false // No typing animation for loaded messages
          }));
          setMessages(messagesWithDisplay);
        }
        
        if (welcomeShown) {
          setWelcomeMessageShown(true);
        }
      } catch (error) {
        logger.error('Error loading saved chat:', error);
      }
    }
  }, [user]);
  
  // Helper function to store a message in the database
  const storeMessageInDB = async (message: Message, model?: string, maxTokens?: number, stream?: boolean) => {
    if (!user || !conversationId) return;
    
    try {
      // Determine sender type based on message role
      const senderType = message.role;

      // A message with no content is not a message. Storing one leaves a blank
      // turn in the transcript that the person reads back later as something
      // they or the assistant said and cannot recover.
      assertStorableResult('chat message', message.content);

      // Store message in database
      await supabase.from('assistant_messages').insert({
        conversation_id: conversationId,
        content: message.content,
        sender_type: senderType,
        model: model || CHAT_MODEL,
        max_tokens: maxTokens || CHAT_MAX_TOKENS,
        stream: stream || false
      });
      
      logger.log(`Stored ${senderType} message in database`);
    } catch (error) {
      logger.error('Error storing message in database:', error);
      // This runs alongside the visible chat, so a silent failure means the
      // conversation on screen and the one in the database quietly diverge.
      toast(
        isEmptyResultError(error)
          ? emptyResultToast(error)
          : {
              title: 'Message not saved',
              description:
                'Your conversation is on screen but could not be saved, so it may not be here next time.',
              variant: 'destructive',
            },
      );
    }
  };

  // Helper function to create a new conversation in the database
  const createConversation = async (): Promise<string | null> => {
    if (!user) return null;
    
    try {
      const { data, error } = await supabase.from('assistant_conversations').insert({
        user_id: user.id,
        is_active: true,
        session_id: `resume-chat-${crypto.randomUUID()}`
      }).select('id').single();
      
      if (error) throw error;
      if (!data) throw new Error('No conversation ID returned');
      
      // Store the conversation ID in localStorage
      localStorage.setItem(`${STORAGE_KEYS.CONVERSATION_ID}_${user.id}`, data.id);
      logger.log('Created new conversation:', data.id);
      return data.id;
    } catch (error) {
      logger.error('Error creating conversation:', error);
      return null;
    }
  };
  
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
      const messagesToSave = messages
        .filter(msg => msg.role !== 'system')
        .map(({ useTypingAnimation, displayContent, ...msg }) => msg); // Remove typing-related properties
      
      localStorage.setItem(`${STORAGE_KEYS.MESSAGES}_${user.id}`, JSON.stringify(messagesToSave));
    }
  }, [messages, user]);
  
  // Scroll to bottom whenever messages change. Scroll ONLY the chat's own
  // viewport — scrollIntoView would also scroll every ancestor, yanking the
  // whole page down when the Chat tab mounts with existing messages.
  useEffect(() => {
    const viewport = messagesEndRef.current?.closest('[data-radix-scroll-area-viewport]');
    if (viewport) {
      viewport.scrollTo({ top: viewport.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);
  
  // Word-by-word typing animation processor with improved handling
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
        // Random delay between 20-150ms for more natural typing feel
        // Lower minimum delay prevents it from feeling too slow
        const delay = Math.floor(Math.random() * 130) + 20;
        typingIntervalRef.current = setTimeout(processNextWord, delay);
      } else {
        isTypingRef.current = false;
      }
    };
    
    // Start processing words
    processNextWord();
  }, []);
  
  // Improved word splitting to better handle spacing and punctuation
  const addContentToBuffer = useCallback((content: string) => {
    if (!content) return;
    
    // Improved regex to properly handle punctuation and whitespace
    // This matches words, spaces, or punctuation symbols
    const words = content.match(/\S+\s*|\s+|[.,!?;:'"()-]/g) || [];
    
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
Key themes for improvement: ${resumeAnalysis.themes && resumeAnalysis.themes.join 
      ? resumeAnalysis.themes.join(', ') 
      : 'Need to improve overall'}.
Elevator pitch: ${resumeAnalysis.elevator_pitch || 'Not provided'}

Provide helpful, specific advice as a resume coach. Be constructive, honest, and professional.`;
    
    return {
      id: `system-${Date.now()}`,
      role: 'system' as const,
      content: systemContent,
      displayContent: systemContent,
      timestamp: new Date(),
      useTypingAnimation: false
    };
  }, [resumeAnalysis]);
  
  // Fetch initial resume assessment and create welcome message on component mount
  useEffect(() => {
    if (resumeAnalysis && user && !welcomeMessageShown) {
      setIsLoading(true);
      
      // Initial operation to fetch assessment and create conversation if needed
      (async () => {
        try {
          // Create a new conversation if one doesn't exist
          let newConversationId = conversationId;
          if (!conversationId) {
            newConversationId = await createConversation();
            if (newConversationId) {
              setConversationId(newConversationId);
            }
          }
          
          // Users can have multiple resume rows (one per upload) — .single()
          // errored with PGRST116 for anyone with more than one, losing the
          // stored roast. Take the most recent row instead.
          const { data, error } = await supabase
            .from('resumes')
            .select('resume_roast')
            .eq('user_id', user.id)
            .order('uploaded_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (error) {
            logger.error('Error fetching stored assessment:', error);
            throw error;
          }
          
          let resumeRoast = data?.resume_roast;
          
          // If no stored assessment, try to fetch it
          if (!resumeRoast && resumeAnalysis.resume_id) {
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
                resumeRoast = roastData.roast;
                
                // Store it in the database for future use.
                //
                // The result was discarded entirely, so a failed write was
                // indistinguishable from a successful one — and since this value
                // is a cache for a PAID generation, every future chat open
                // silently regenerated and re-billed it. The chat still works
                // without the cache, so this warns rather than throws.
                const { error: roastPersistError } = await supabase
                  .from('resumes')
                  .update({ resume_roast: resumeRoast })
                  .eq('user_id', user.id);

                if (roastPersistError) {
                  logger.warn(
                    'Resume roast could not be cached; it will be regenerated on the next open',
                    roastPersistError,
                  );
                }
              }
            }
          }
          
          // Create welcome message with assessment - NO TYPING ANIMATION
          const fullWelcomeContent = `I've analyzed your resume and can help you improve it! Your resume currently has a grade of **${resumeAnalysis.letter_grade} (${Number(resumeAnalysis.resume_percent).toFixed(2)}%)**.

${resumeRoast ? `**Here's my honest assessment:**
${resumeRoast}

` : ''}Let's start by discussing your experience: **What specific challenges did you tackle in your first listed role, what actions did you take, and what measurable results did you achieve?**`;
          
          // Create welcome message with full content visible immediately - no typing animation
          const welcomeMessage: Message = {
            id: `welcome-${Date.now()}`,
            role: 'assistant',
            content: fullWelcomeContent,
            displayContent: fullWelcomeContent, // Same as content - no need for typing animation
            timestamp: new Date(),
            useTypingAnimation: false // Explicitly set to false
          };
          
          // Create system message with resume context
          const systemMessage = createSystemMessage();
          
          // Set messages with system message (if available) and welcome message
          const initialMessages = systemMessage ? [systemMessage, welcomeMessage] : [welcomeMessage];
          setMessages(initialMessages);
          setWelcomeMessageShown(true);
          localStorage.setItem(`${STORAGE_KEYS.WELCOME_SHOWN}_${user.id}`, 'true');
          
          // Store welcome message in DB
          if (newConversationId) {
            await storeMessageInDB(welcomeMessage);
          }
          
        } catch (error) {
          logger.error('Error with assessment:', error);
          
          // Fallback welcome message - NO TYPING ANIMATION
          const fallbackContent = `I've analyzed your resume and can help you improve it! Your resume currently has a grade of **${resumeAnalysis.letter_grade} (${Number(resumeAnalysis.resume_percent).toFixed(2)}%)**.

Let's start by discussing your experience: **What specific challenges did you tackle in your first listed role, what actions did you take, and what measurable results did you achieve?**`;
          
          // Create welcome message with full content visible immediately
          const welcomeMessage: Message = {
            id: `welcome-${Date.now()}`,
            role: 'assistant',
            content: fallbackContent,
            displayContent: fallbackContent, // Same as content - no typing animation
            timestamp: new Date(),
            useTypingAnimation: false
          };
          
          // Create system message with resume context
          const systemMessage = createSystemMessage();
          
          // Set messages with system message (if available) and welcome message
          const initialMessages = systemMessage ? [systemMessage, welcomeMessage] : [welcomeMessage];
          setMessages(initialMessages);
          setWelcomeMessageShown(true);
          localStorage.setItem(`${STORAGE_KEYS.WELCOME_SHOWN}_${user.id}`, 'true');
          
          // Store welcome message in DB even in error case
          if (conversationId) {
            await storeMessageInDB(welcomeMessage);
          }
          
        } finally {
          setIsLoading(false);
        }
      })();
    }
  }, [resumeAnalysis, user, welcomeMessageShown, createSystemMessage, conversationId]);
  
  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    // Create a new conversation if one doesn't exist yet
    if (!conversationId && user) {
      const newConversationId = await createConversation();
      if (newConversationId) {
        setConversationId(newConversationId);
      } else {
        toast({
          title: "Error",
          description: "Failed to create conversation. Please try again.",
          variant: "destructive"
        });
        return;
      }
    }

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: inputValue,
      displayContent: inputValue,
      timestamp: new Date(),
      useTypingAnimation: false // User messages don't need typing animation
    };
    
    // Store user message in database
    await storeMessageInDB(userMessage);
    
    // Create a placeholder streaming message
    const streamingMessage: Message = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: '',
      displayContent: '',
      timestamp: new Date(),
      isStreaming: true,
      useTypingAnimation: true // THIS message WILL use typing animation
    };
    
    // Reset the buffer and set current streaming ID
    contentBufferRef.current = [];
    currentStreamingIdRef.current = streamingMessage.id;
    fullContentRef.current = ''; // Reset full content
    
    setMessages(prev => [...prev, userMessage, streamingMessage]);
    setInputValue('');
    setIsLoading(true);
    
    try {
      // Prepare the chat history for the API
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
      
      logger.log('Invoking together-ai function with chat history');
      
      const selectedModel = CHAT_MODEL;
      const maxTokens = CHAT_MAX_TOKENS;
      
      const response = await supabase.functions.invoke('together-ai', {
        body: { 
          chatHistory,
          model: selectedModel,
          max_tokens: maxTokens,
          stream: true
        }
      });
      
      logger.log('Supabase function response received:', response);
      
      if (response.error) {
        logger.error('Error from Together AI:', response.error);
        throw new Error(response.error.message || 'Unknown error');
      }
      
      if (!response.data || !response.data.body) {
        logger.error('No body in response data:', response.data);
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
            logger.log('Stream timed out - no data received in', MAX_SILENCE_MS, 'ms');
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
            logger.log('Stream marked as done');
            if (streamTimeout) clearTimeout(streamTimeout);
            break;
          }
          
          // Decode the chunk
          const chunk = new TextDecoder().decode(value);
          logger.log('Received chunk:', chunk.substring(0, 100));
          
          // Parse SSE format - each line starts with "data: "
          const lines = chunk.split('\n').filter(line => line.trim() !== '');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                // Remove the "data: " prefix and parse the JSON
                const jsonStr = line.substring(6);
                
                // Check if it's the "[DONE]" marker
                if (jsonStr.trim() === '[DONE]') {
                  logger.log('Received [DONE] marker');
                  continue;
                }
                
                const jsonData = JSON.parse(jsonStr);
                logger.log('Parsed JSON data:', jsonData);
                
                // Process delta.content format (newer API)
                if (jsonData.choices && jsonData.choices[0]?.delta?.content) {
                  const newText = jsonData.choices[0].delta.content;
                  logger.log('Received new text:', newText);
                  
                  // Add to full content reference
                  fullContentRef.current += newText;
                  
                  // Update the full message content in state
                  setMessages(prev => {
                    const updatedMessages = prev.map(msg => {
                      if (msg.id === streamingMessage.id) {
                        return { ...msg, content: fullContentRef.current };
                      }
                      return msg;
                    });
                    return updatedMessages;
                  });
                  
                  // Only add to buffer if using typing animation
                  if (streamingMessage.useTypingAnimation) {
                    addContentToBuffer(newText);
                  }
                }
                // Handle text format (older API)
                else if (jsonData.choices && jsonData.choices[0]?.text) {
                  const newText = jsonData.choices[0].text;
                  logger.log('Received new text (legacy format):', newText);
                  
                  // Add to full content reference
                  fullContentRef.current += newText;
                  
                  setMessages(prev => {
                    const updatedMessages = prev.map(msg => {
                      if (msg.id === streamingMessage.id) {
                        return { ...msg, content: fullContentRef.current };
                      }
                      return msg;
                    });
                    return updatedMessages;
                  });
                  
                  // Only add to buffer if using typing animation
                  if (streamingMessage.useTypingAnimation) {
                    addContentToBuffer(newText);
                  }
                }
              } catch (e) {
                logger.warn('Error parsing SSE data:', e, 'Line:', line);
              }
            }
          }
        }
      } catch (error) {
        logger.error('Error processing stream:', error);
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
        
        // Store the completed AI message in database
        const completedMessage = {
          ...streamingMessage,
          content: fullContentRef.current,
          isStreaming: false
        };
        
        await storeMessageInDB(completedMessage, selectedModel, maxTokens, true);
      }
      
    } catch (error) {
      logger.error('Error sending message:', error);
      
      // Log more details if available
      if (error.response) {
        logger.error('Response data:', error.response.data);
        logger.error('Response status:', error.response.status);
      }
      
      toast({
        title: "Error",
        description: "Failed to get a response from the AI. Please try again.",
        variant: "destructive"
      });
      
      // Surface the failure honestly. The old code injected fabricated
      // "AI advice" as an assistant message and persisted it to the DB,
      // making an API failure look like a real coaching response.
      const failureNotice = "I wasn't able to generate a response just now. Please try sending your message again.";

      const failureMessage: Message = {
        id: `assistant-error-${Date.now()}`,
        role: 'assistant',
        content: failureNotice,
        displayContent: failureNotice,
        timestamp: new Date(),
        useTypingAnimation: false
      };

      // Remove any streaming messages and show the error notice (not stored
      // in the DB — it is not real conversation content).
      setMessages(prev => [...prev.filter(msg => !msg.isStreaming), failureMessage]);

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
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 overflow-y-auto" style={{ height: '70vh', maxHeight: '600px' }}>
        <div className="space-y-4 p-4">
          {messages
            .filter(message => message.role !== 'system') // Hide system messages from the UI
            .map((message) => (
              <div key={message.id} className={`flex ${
                message.role === 'assistant' 
                  ? 'justify-start' 
                  : 'justify-end'
              }`}>
                <div className={`max-w-3xl p-4 ${
                  message.role === 'assistant' 
                    ? 'bg-ss-lav-chip text-foreground rounded-2xl rounded-bl-md'
                    : 'bg-ss-lav-deep text-white rounded-2xl rounded-br-md'
                }`}>
                  {message.role === 'assistant' ? (
                    <div 
                      className="prose prose-slate max-w-none whitespace-pre-wrap"
                      dangerouslySetInnerHTML={{ 
                        __html: sanitizeHTML(formatMessage(
                          // For assistant messages, use displayContent if using typing animation,
                          // otherwise just use the full content
                          message.useTypingAnimation ? (message.displayContent || '') : message.content
                        ))
                      }}
                    />
                  ) : (
                    <div className="whitespace-pre-wrap">{message.content}</div>
                  )}
                  
                  {message.isStreaming && (
                    <span className="inline-block w-1.5 h-4 bg-ss-lav ml-1 animate-pulse"></span>
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
              <div className="max-w-3xl p-4 rounded-2xl rounded-bl-md bg-ss-lav-chip text-foreground">
                <div className="flex space-x-2">
                  <div className="w-1.5 h-2 rounded-full bg-ss-lav animate-pulse"></div>
                  <div className="w-1.5 h-2 rounded-full bg-ss-lav animate-pulse delay-75"></div>
                  <div className="w-1.5 h-2 rounded-full bg-ss-lav animate-pulse delay-150"></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>
      
      <div className="p-4 border-t mt-auto">
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
            className="self-end h-11 w-11 rounded-full p-0"
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
