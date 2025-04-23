import { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Assistant } from '@/types/assistants';
import { Message, Chat, PersonalizationSettings } from '@/components/assistants/types';
import { starterMessages } from '@/data/careerPathwayData';

export function useAssistantChat(initialAssistant: Assistant) {
  const [assistant, setAssistant] = useState<Assistant>(initialAssistant);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [currentChat, setCurrentChat] = useState<Chat | null>(null);

  useEffect(() => {
    setAssistant(initialAssistant);
  }, [initialAssistant]);

  const handleAssistantChange = (newAssistant: Assistant) => {
    setAssistant(newAssistant);
    // Reset chat state when changing assistants
    setMessages([]);
    setInputValue('');
    setCurrentChat(null);
  };

  const createNewChat = (settings: PersonalizationSettings): Chat => ({
    id: uuidv4(),
    assistantId: assistant.id, // Add this line to fix the TypeScript error
    title: 'New Chat',
    createdAt: new Date(),
    updatedAt: new Date(),
    messages: []
  });

  const handleNewChat = (settings: PersonalizationSettings) => {
    const newChat = createNewChat(settings);
    setCurrentChat(newChat);
    setMessages([]); // Clear existing messages
    
    // Add welcome message and personalization reminder
    const welcomeMessage: Message = {
      id: uuidv4(),
      role: 'system',
      content: `${starterMessages[0]}\n${starterMessages[1]}`,
      timestamp: new Date(),
    };
    setMessages([welcomeMessage]);
  };

  const loadChat = (chat: Chat) => {
    setCurrentChat(chat);
    setMessages(chat.messages);
  };

  const initializeChat = (settings: PersonalizationSettings) => {
    if (!currentChat) {
      handleNewChat(settings);
    }
  };

  const handleSendMessage = async (settings: PersonalizationSettings) => {
    if (!inputValue.trim()) return;

    setIsLoading(true);
    const userMessage: Message = {
      id: uuidv4(),
      role: 'user',
      content: inputValue,
      timestamp: new Date(),
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInputValue('');

    // Simulate assistant response
    setTimeout(() => {
      const assistantMessage: Message = {
        id: uuidv4(),
        role: 'assistant',
        content: `This is a simulated response based on your message: ${inputValue}. Career Focus: ${settings.careerFocus}, Career Path: ${settings.careerPath}, Salary Cap: ${settings.salaryCap}`,
        timestamp: new Date(),
      };

      setMessages([...updatedMessages, assistantMessage]);
      setIsLoading(false);
    }, 1000);

    // Update current chat with new messages
    if (currentChat) {
      const updatedChat: Chat = {
        ...currentChat,
        messages: [...updatedMessages, userMessage],
        updatedAt: new Date(),
      };
      setCurrentChat(updatedChat);
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
