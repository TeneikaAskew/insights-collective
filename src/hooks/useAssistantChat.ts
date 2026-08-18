
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Chat, Message, PersonalizationSettings } from '@/components/assistants/types';
import { Assistant } from '@/types/assistants';
import { allAssistants, careerExplorerAssistant } from '@/data/assistantData';

import { createLogger } from '@/utils/logger';
import { invokeWithBackoff, describeWait } from '@/lib/rateLimitRetry';

const logger = createLogger('useAssistantChat');

export const useAssistantChat = (initialAssistant: Assistant) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [assistant, setAssistant] = useState<Assistant>(initialAssistant);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentChat, setCurrentChat] = useState<Chat | null>(null);
  const [quizAttemptId, setQuizAttemptId] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  
  // Check for quiz data context on initialization
  useEffect(() => {
    const storedQuizAttemptId = localStorage.getItem('activeQuizAttemptId');
    const storedConversationId = localStorage.getItem('activeConversationId');
    
    if (storedQuizAttemptId) {
      setQuizAttemptId(storedQuizAttemptId);
    }
    
    if (storedConversationId) {
      setConversationId(storedConversationId);
      
      // Fetch conversation history if we have a conversation ID
      if (storedConversationId) {
        fetchConversationHistory(storedConversationId);
      }
    }
  }, []);
  
  // Function to fetch conversation history from Supabase
  const fetchConversationHistory = async (convId: string) => {
    try {
      const { data, error } = await supabase
        .from('assistant_messages')
        .select('*')
        .eq('conversation_id', convId)
        .order('created_at', { ascending: true });
        
      if (error) {
        logger.error('Error fetching conversation history:', error);
        toast({
          title: "Error",
          description: "Could not load your previous conversation history.",
          variant: "destructive",
        });
        return;
      }

      if (data && data.length > 0) {
        const chatMessages: Message[] = data.map((msg) => ({
          id: msg.id,
          role: msg.sender_type as 'user' | 'assistant' | 'system',
          content: msg.content,
          timestamp: new Date(msg.created_at)
        }));
        
        setMessages(chatMessages);
      }
    } catch (error) {
      logger.error('Error in fetchConversationHistory:', error);
    }
  };
  
  const initializeChat = (settings: PersonalizationSettings) => {
    // Skip initialization if we have conversation history
    if (conversationId && messages.length > 0) {
      return;
    }
    
    const { careerFocus, careerPath, salaryCap } = settings;
    
    const welcomeMessage: Message = {
      id: `welcome-${Date.now()}`,
      role: 'assistant',
      content: `Hello! I'm your ${assistant.name} assistant. ${assistant.description} How can I help you today?`,
      timestamp: new Date(),
    };
    
    // Add personalization settings reminder
    const personalizationReminder: Message = {
      id: `reminder-${Date.now()}`,
      role: 'system',
      content: `**Personalization Settings Reminder**\n\nYour current settings:\n- Career Focus: **${careerFocus}**\n- Career Path: **${careerPath}**\n- Target Salary: **$${salaryCap.toLocaleString()}**\n\nAdjust these settings in the sidebar to get more tailored responses.`,
      timestamp: new Date(),
    };
    
    setMessages([welcomeMessage, personalizationReminder]);
    
    // Create new chat
    const newChat: Chat = {
      id: `chat-${Date.now()}`,
      title: `New ${assistant.name} Chat`,
      messages: [welcomeMessage, personalizationReminder],
      assistantId: assistant.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    setCurrentChat(newChat);
    
    // Save to localStorage
    const savedChats = JSON.parse(localStorage.getItem('assistantChats') || '[]');
    savedChats.push(newChat);
    localStorage.setItem('assistantChats', JSON.stringify(savedChats));
  };

  const handleAssistantChange = (assistantId: string) => {
    const newAssistant = [...allAssistants, careerExplorerAssistant].find(
      a => a.id === assistantId
    ) || careerExplorerAssistant;
    
    setAssistant(newAssistant);
    
    // Reset quiz context if changing away from career coach
    if (assistantId !== 'career-coach') {
      setQuizAttemptId(null);
      setConversationId(null);
      localStorage.removeItem('activeQuizAttemptId');
      localStorage.removeItem('activeConversationId');
    }
    
    // Update URL without reloading
    navigate(`/assistant/${assistantId}`, { replace: true });
  };

  const handleSendMessage = async (settings: PersonalizationSettings) => {
    if (!inputValue.trim() || isLoading) return;
    
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: inputValue,
      timestamp: new Date(),
    };
    
    setMessages(prevMessages => [...prevMessages, userMessage]);
    setInputValue('');
    setIsLoading(true);
    
    try {
      // Update the current chat
      if (currentChat) {
        const updatedChat = {
          ...currentChat,
          messages: [...currentChat.messages, userMessage],
          updatedAt: new Date()
        };
        setCurrentChat(updatedChat);
        
        // Update in localStorage
        const savedChats = JSON.parse(localStorage.getItem('assistantChats') || '[]');
        const updatedChats = savedChats.map((chat: Chat) => 
          chat.id === updatedChat.id ? updatedChat : chat
        );
        localStorage.setItem('assistantChats', JSON.stringify(updatedChats));
      }
      
      // Call the OpenAI edge function with the user's message and context
      const { careerFocus, careerPath, salaryCap } = settings;
      const data = await invokeWithBackoff<{ response?: string } & Record<string, unknown>>(
        'assistant-ai',
        {
          body: {
            query: userMessage.content,
            careerFocus,
            careerPath,
            salaryCap,
            assistantType: assistant.name,
            conversationId: conversationId || undefined,
            quizAttemptId: quizAttemptId || undefined
          },
          onWait: ({ waitMs, remaining }) => {
            toast({
              title: 'Rate limit reached',
              description:
                `The AI model's per-minute budget is full. Retrying in ${describeWait(waitMs)}` +
                (remaining > 0 ? ` — ${remaining + 1} attempts left.` : ' — last attempt.'),
              duration: waitMs,
            });
          },
        },
      );

      // An empty payload is a failure, not a response — do not fabricate one.
      if (!data?.response) {
        throw new Error('No response received from assistant');
      }

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
      };
      
      setMessages(prevMessages => [...prevMessages, assistantMessage]);
      
      // Update chat with AI response
      if (currentChat) {
        const updatedChat = {
          ...currentChat,
          messages: [...currentChat.messages, userMessage, assistantMessage],
          updatedAt: new Date()
        };
        setCurrentChat(updatedChat);
        
        // Update localStorage
        const savedChats = JSON.parse(localStorage.getItem('assistantChats') || '[]');
        const updatedChats = savedChats.map((chat: Chat) => 
          chat.id === updatedChat.id ? updatedChat : chat
        );
        localStorage.setItem('assistantChats', JSON.stringify(updatedChats));
      }
    } catch (error) {
      logger.error('Error sending message:', error);
      // Surface the failure honestly — never inject a fabricated assistant
      // reply that makes an API failure look like a successful response.
      toast({
        title: "Error",
        description: "Failed to get a response. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewChat = (settings: PersonalizationSettings) => {
    // Reset the current assistant conversation
    const welcomeMessage: Message = {
      id: `welcome-${Date.now()}`,
      role: 'assistant',
      content: `Hello! I'm your ${assistant.name} assistant. ${assistant.description} How can I help you today?`,
      timestamp: new Date(),
    };
    
    setMessages([welcomeMessage]);
    
    // Create new chat object
    const newChat: Chat = {
      id: `chat-${Date.now()}`,
      title: `New ${assistant.name} Chat`,
      messages: [welcomeMessage],
      assistantId: assistant.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    setCurrentChat(newChat);
    
    // Reset quiz context when starting a new chat
    if (assistant.id !== 'career-coach') {
      setQuizAttemptId(null);
      setConversationId(null);
      localStorage.removeItem('activeQuizAttemptId');
      localStorage.removeItem('activeConversationId');
    }
    
    // Save to localStorage
    const savedChats = JSON.parse(localStorage.getItem('assistantChats') || '[]');
    savedChats.push(newChat);
    localStorage.setItem('assistantChats', JSON.stringify(savedChats));
    
    toast({
      title: "New Chat Created",
      description: "Started a new conversation with the assistant.",
    });
  };

  const loadChat = (chatId: string) => {
    const savedChats = JSON.parse(localStorage.getItem('assistantChats') || '[]');
    const chat = savedChats.find((c: Chat) => c.id === chatId);
    
    if (chat) {
      setCurrentChat(chat);
      setMessages(chat.messages);
      
      // Find and set the assistant
      const chatAssistant = [...allAssistants, careerExplorerAssistant].find(
        a => a.id === chat.assistantId
      ) || careerExplorerAssistant;
      
      setAssistant(chatAssistant);
    }
  };

  return {
    assistant,
    messages,
    inputValue,
    isLoading,
    currentChat,
    quizAttemptId,
    conversationId,
    setInputValue,
    handleAssistantChange,
    handleSendMessage,
    handleNewChat,
    loadChat,
    initializeChat
  };
};
