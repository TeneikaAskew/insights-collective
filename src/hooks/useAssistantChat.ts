import { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Assistant } from '@/types/assistants';
import { Message, Chat, PersonalizationSettings } from '@/components/assistants/types';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './use-toast';
import { ChatStorageUtils } from '@/utils/chatStorageUtils'; 
import { careerAdvicePrompt, starterMessages } from '@/data/careerPathwayData';

// Maximum number of messages to keep in history
const MAX_MESSAGES = 30;

// Default assistant welcome messages
const ASSISTANT_WELCOME_MESSAGES: Record<string, string[]> = {
  'career-coach': [
    "Hello! I'm your Career Coach AI assistant. I'm here to help you navigate your career path and provide personalized advice.",
    "I'll analyze your skills, experience, and goals to recommend the best next steps in your career journey.",
    "What specific aspect of your career would you like to discuss today?"
  ],
  'data-guru': [
    "Welcome to Data Guru! I'm your AI assistant specialized in all things data.",
    "Whether you need help with data analysis, visualization, or understanding complex data concepts, I'm here to assist.",
    "What data-related question can I help you with today?"
  ],
  'resume-builder': [
    "Welcome to Resume Builder! I'm your AI assistant for crafting impressive resumes and cover letters.",
    "I can help you highlight your skills, format your resume professionally, and tailor it to specific job applications.",
    "How can I help improve your resume today?"
  ]
};

export function useAssistantChat(initialAssistant: Assistant) {
  const [assistant, setAssistant] = useState<Assistant>(initialAssistant);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentChat, setCurrentChat] = useState<Chat | null>(null);
  const { toast } = useToast();

  const getStorageKey = useCallback(() => {
    return `${assistant.id}-chat-${currentChat?.id || 'current'}`;
  }, [assistant.id, currentChat?.id]);

  // Load chats from localStorage
  useEffect(() => {
    const loadChats = () => {
      try {
        const savedChats = localStorage.getItem(`${assistant.id}-chats`);
        if (savedChats) {
          const parsedChats = JSON.parse(savedChats);
          return Array.isArray(parsedChats) ? parsedChats : [];
        }
      } catch (error) {
        console.error('Error loading chats:', error);
      }
      return [];
    };
    
    // Get the most recent chat or create a new one
    const chats = loadChats();
    if (chats.length > 0) {
      // Sort by updated time
      const sortedChats = chats.sort((a: Chat, b: Chat) => 
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
      setCurrentChat(sortedChats[0]);
    } else {
      handleNewChat();
    }
  }, [assistant.id]);

  // Load messages when current chat changes
  useEffect(() => {
    if (currentChat) {
      const savedMessages = ChatStorageUtils.loadMessages(getStorageKey());
      if (savedMessages) {
        setMessages(savedMessages);
      }
    }
  }, [currentChat, getStorageKey]);

  // Save messages when they change
  useEffect(() => {
    if (messages.length > 0 && currentChat) {
      const success = ChatStorageUtils.storeMessages(getStorageKey(), messages);
      
      if (!success) {
        toast({
          title: "Storage Warning",
          description: "Some message history couldn't be saved due to browser limitations.",
          variant: "destructive",
        });
      }
      
      // Also update the chat in the list of chats
      updateChat({
        ...currentChat,
        updatedAt: new Date(),
        messages: messages.slice(0, 3) // Just save a preview of messages
      });
    }
  }, [messages, currentChat, getStorageKey, toast]);

  const updateChat = (updatedChat: Chat) => {
    try {
      // Get existing chats
      const savedChats = localStorage.getItem(`${assistant.id}-chats`) || '[]';
      const chats = JSON.parse(savedChats);
      
      // Find and update the chat
      const updatedChats = Array.isArray(chats) ? 
        chats.map((chat: Chat) => chat.id === updatedChat.id ? updatedChat : chat) : 
        [updatedChat];
      
      // Save back to localStorage, but handle potential quota errors
      try {
        localStorage.setItem(`${assistant.id}-chats`, JSON.stringify(updatedChats));
      } catch (error) {
        console.error('Error saving chats:', error);
        // If error, try to save with just IDs and titles
        const minimalChats = updatedChats.map((chat: Chat) => ({
          id: chat.id,
          title: chat.title,
          createdAt: chat.createdAt,
          updatedAt: chat.updatedAt
        }));
        try {
          localStorage.setItem(`${assistant.id}-chats`, JSON.stringify(minimalChats));
        } catch (innerError) {
          console.error('Error saving minimal chats:', innerError);
          // Last resort - remove oldest chats to make room
          const newestChats = minimalChats.slice(-5);
          try {
            localStorage.setItem(`${assistant.id}-chats`, JSON.stringify(newestChats));
          } catch (finalError) {
            console.error('Failed to save even minimal chats:', finalError);
          }
        }
      }
    } catch (error) {
      console.error('Error in updateChat:', error);
    }
  };

  const handleNewChat = (personalizationSettings?: PersonalizationSettings) => {
    const newChat: Chat = {
      id: uuidv4(),
      title: `Chat with ${assistant.name}`,
      createdAt: new Date(),
      updatedAt: new Date(),
      messages: []
    };
    
    try {
      // Get existing chats
      const savedChats = localStorage.getItem(`${assistant.id}-chats`) || '[]';
      const chats = JSON.parse(savedChats);
      
      // Add new chat to the list
      const updatedChats = Array.isArray(chats) ? [...chats, newChat] : [newChat];
      
      // Save to localStorage
      localStorage.setItem(`${assistant.id}-chats`, JSON.stringify(updatedChats));
      
      // Set as current chat
      setCurrentChat(newChat);
      setMessages([]);
      
      // Initialize with welcome messages if provided
      if (personalizationSettings) {
        initializeChat(personalizationSettings);
      }
    } catch (error) {
      console.error('Error creating new chat:', error);
      toast({
        title: "Error",
        description: "Failed to create a new chat. Please try clearing your browser cache.",
        variant: "destructive",
      });
    }
  };

  const loadChat = (chatId: string) => {
    try {
      // Get existing chats
      const savedChats = localStorage.getItem(`${assistant.id}-chats`) || '[]';
      const chats = JSON.parse(savedChats);
      
      // Find the chat
      if (Array.isArray(chats)) {
        const chat = chats.find((c: Chat) => c.id === chatId);
        if (chat) {
          setCurrentChat(chat);
          
          // Load messages for this chat
          const savedMessages = ChatStorageUtils.loadMessages(`${assistant.id}-chat-${chatId}`);
          if (savedMessages) {
            setMessages(savedMessages);
          } else {
            setMessages([]);
          }
        }
      }
    } catch (error) {
      console.error('Error loading chat:', error);
      toast({
        title: "Error",
        description: "Failed to load the chat. The data may be corrupted.",
        variant: "destructive",
      });
    }
  };

  const handleAssistantChange = (newAssistant: Assistant) => {
    // Save current chat state if needed
    if (messages.length > 0 && currentChat) {
      updateChat({
        ...currentChat,
        updatedAt: new Date(),
        messages: messages.slice(0, 3) // Just save a preview
      });
    }
    
    // Update the assistant
    setAssistant(newAssistant);
    
    // Reset state for new assistant
    setMessages([]);
    setInputValue('');
    setCurrentChat(null);
    
    // Create a new chat for this assistant
    handleNewChat();
  };

  const initializeChat = async (personalizationSettings?: PersonalizationSettings) => {
    // Get welcome messages for this assistant
    const welcomeMessages = ASSISTANT_WELCOME_MESSAGES[assistant.id] || [
      `Welcome! I'm ${assistant.name}, your AI assistant.`,
      "How can I help you today?"
    ];
    
    // For career coach, use starter messages from data
    const assistantMessages = assistant.id === 'career-coach' 
      ? starterMessages 
      : welcomeMessages;
    
    // Create message objects
    const initialMessages: Message[] = assistantMessages.map((content, index) => ({
      id: `welcome-${index}-${Date.now()}`,
      content,
      role: 'assistant',
      timestamp: new Date()
    }));
    
    // Set messages
    setMessages(initialMessages);
    
    // Update chat title based on context
    if (currentChat && personalizationSettings) {
      let chatTitle = `${assistant.name} Chat`;
      
      if (assistant.id === 'career-coach' && personalizationSettings.careerPath) {
        chatTitle = `Career Path: ${personalizationSettings.careerPath}`;
      }
      
      const updatedChat = {
        ...currentChat,
        title: chatTitle
      };
      
      setCurrentChat(updatedChat);
      updateChat(updatedChat);
    }
  };

  const handleSendMessage = async (personalizationSettings?: PersonalizationSettings) => {
    if (!inputValue.trim() || isLoading) return;
    
    // Create user message
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      content: inputValue,
      role: 'user',
      timestamp: new Date()
    };
    
    // Update UI immediately
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    
    try {
      // Get context for career coach
      let context = '';
      if (assistant.id === 'career-coach' && personalizationSettings) {
        context = `The user is interested in a ${personalizationSettings.careerPath} career path in the ${personalizationSettings.careerFocus} field, with a target salary of $${personalizationSettings.salaryCap}.`;
      }
      
      // Call the backend function
      const functionName = assistant.id === 'career-coach' 
        ? 'evaluateCareerAdvice' 
        : 'assistant-ai';
        
      let payload: any = {
        query: userMessage.content,
        assistantType: assistant.name,
        context
      };
      
      // Add career coach specific parameters
      if (assistant.id === 'career-coach') {
        payload = {
          prompt: careerAdvicePrompt,
          PathwayQuestions: [], // We don't need these for chat responses
          pathwayAnswers: {},
          resumeText: ''
        };
      }
      
      // Add personalization settings if available
      if (personalizationSettings) {
        payload = {
          ...payload,
          ...personalizationSettings
        };
      }
      
      // Call Supabase edge function
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: payload
      });
      
      if (error) throw error;
      
      // Process response
      const responseContent = data?.generatedText || data?.response || 
        "I'm sorry, I couldn't process your request at this time.";
        
      // Create assistant response message
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        content: responseContent,
        role: 'assistant',
        timestamp: new Date()
      };
      
      // Update messages
      setMessages(prev => {
        const updatedMessages = [...prev, assistantMessage];
        // Keep message history manageable
        return updatedMessages.length > MAX_MESSAGES 
          ? updatedMessages.slice(updatedMessages.length - MAX_MESSAGES) 
          : updatedMessages;
      });
      
      // Update chat title if it's the first user message
      if (currentChat && messages.filter(m => m.role === 'user').length === 0) {
        const title = userMessage.content.length > 30
          ? `${userMessage.content.substring(0, 30)}...`
          : userMessage.content;
          
        const updatedChat = {
          ...currentChat,
          title
        };
        
        setCurrentChat(updatedChat);
        updateChat(updatedChat);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Add error message
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        content: "I'm sorry, I encountered an error processing your request. Please try again later.",
        role: 'assistant',
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, errorMessage]);
      
      toast({
        title: "Error",
        description: "Failed to get a response from the assistant.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return {
    assistant,
    messages,
    inputValue,
    isLoading,
    currentChat,
    setInputValue,
    handleAssistantChange,
    handleSendMessage,
    handleNewChat,
    loadChat,
    initializeChat
  };
}
