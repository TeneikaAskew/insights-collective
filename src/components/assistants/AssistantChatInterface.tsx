
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Assistant } from '@/types/assistants';
import { allAssistants, careerExplorerAssistant } from '@/data/assistantData';
import AssistantChatSidebar from './AssistantChatSidebar';
import AssistantControlPanel from './AssistantControlPanel';
import { ChevronLeft, ChevronRight, Send, PanelLeft, PanelRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';

export type Message = {
  id: string;
  role: 'assistant' | 'user';
  content: string;
  timestamp: Date;
};

export type Chat = {
  id: string;
  title: string;
  messages: Message[];
  assistantId: string;
  createdAt: Date;
  updatedAt: Date;
};

const AssistantChatInterface = ({ 
  initialAssistant 
}: { 
  initialAssistant: Assistant;
}) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [assistant, setAssistant] = useState<Assistant>(initialAssistant);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showLeftSidebar, setShowLeftSidebar] = useState(true);
  const [showRightSidebar, setShowRightSidebar] = useState(true);
  const [currentChat, setCurrentChat] = useState<Chat | null>(null);
  const [careerFocus, setCareerFocus] = useState<string>('Technology');
  const [salaryCap, setSalaryCap] = useState<number>(100000);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Scroll to bottom whenever messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Initialize with welcome message
  useEffect(() => {
    const welcomeMessage: Message = {
      id: `welcome-${Date.now()}`,
      role: 'assistant',
      content: `Hello! I'm your ${assistant.name} assistant. ${assistant.description} How can I help you today?`,
      timestamp: new Date(),
    };
    
    setMessages([welcomeMessage]);
    
    // Create new chat
    const newChat: Chat = {
      id: `chat-${Date.now()}`,
      title: `New ${assistant.name} Chat`,
      messages: [welcomeMessage],
      assistantId: assistant.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    setCurrentChat(newChat);
    
    // Save to localStorage
    const savedChats = JSON.parse(localStorage.getItem('assistantChats') || '[]');
    savedChats.push(newChat);
    localStorage.setItem('assistantChats', JSON.stringify(savedChats));
  }, [assistant]);

  const handleAssistantChange = (assistantId: string) => {
    const newAssistant = [...allAssistants, careerExplorerAssistant].find(
      a => a.id === assistantId
    ) || careerExplorerAssistant;
    
    setAssistant(newAssistant);
    
    // Update URL without reloading
    navigate(`/assistant/${assistantId}`, { replace: true });
  };

  const handleSendMessage = async () => {
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
    
    // In a real application, this would be an API call to OpenAI
    // For now, we'll simulate a response after a short delay
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
      
      // Simulate AI response delay
      setTimeout(() => {
        // Create context-aware response based on assistant type and user settings
        let contextResponse = `Based on your interest in ${careerFocus} careers`;
        if (salaryCap) {
          contextResponse += ` with a target salary range up to $${(salaryCap/1000).toFixed(0)}K`;
        }
        
        const assistantMessage: Message = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: `${contextResponse}, I recommend exploring roles like Senior Data Analyst or ML Engineer. These positions align with your technical interests and offer competitive compensation. Would you like more specific information about either of these paths?`,
          timestamp: new Date(),
        };
        
        setMessages(prevMessages => [...prevMessages, assistantMessage]);
        setIsLoading(false);
        
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
      }, 1500);
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: "Failed to get a response. Please try again.",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  const handleNewChat = () => {
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const IconComponent = assistant.icon.component;

  return (
    <div className="flex h-full">
      {/* Left Sidebar - Chat Management */}
      <div className={`h-[calc(100vh-4rem)] md:block ${showLeftSidebar ? 'block' : 'hidden'} 
                     transition-all duration-300 border-r w-full max-w-xs`}>
        <AssistantChatSidebar 
          currentChat={currentChat}
          onNewChat={handleNewChat}
          onChatSelect={loadChat}
        />
      </div>

      {/* Main Chat Window */}
      <div className="flex flex-col flex-1">
        {/* Header with Assistant Type Selector */}
        <div className="flex items-center justify-between p-4 border-b">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setShowLeftSidebar(!showLeftSidebar)}
          >
            <PanelLeft className="h-5 w-5" />
          </Button>
          
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-slate-100 rounded-full">
              <IconComponent {...assistant.icon.props} />
            </div>
            <Select 
              value={assistant.id} 
              onValueChange={handleAssistantChange}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select Assistant" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={careerExplorerAssistant.id}>
                  {careerExplorerAssistant.name}
                </SelectItem>
                {allAssistants.map(assistant => (
                  <SelectItem key={assistant.id} value={assistant.id}>
                    {assistant.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setShowRightSidebar(!showRightSidebar)}
          >
            <PanelRight className="h-5 w-5" />
          </Button>
        </div>
        
        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <div 
              key={message.id}
              className={`flex ${message.role === 'assistant' ? 'justify-start' : 'justify-end'}`}
            >
              <div className={`max-w-3xl p-3 rounded-lg ${
                message.role === 'assistant' 
                  ? 'bg-slate-100 text-slate-800' 
                  : 'bg-blue-600 text-white'
              }`}>
                {message.content}
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
          <div ref={messagesEndRef} />
        </div>
        
        {/* Input Area */}
        <div className="p-4 border-t">
          <div className="flex space-x-2">
            <Textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message here..."
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
        </div>
      </div>

      {/* Right Sidebar - Control Panel */}
      <div className={`h-[calc(100vh-4rem)] md:block ${showRightSidebar ? 'block' : 'hidden'} 
                     transition-all duration-300 border-l w-full max-w-xs`}>
        <AssistantControlPanel 
          careerFocus={careerFocus}
          onCareerFocusChange={setCareerFocus}
          salaryCap={salaryCap}
          onSalaryCapChange={setSalaryCap}
        />
      </div>
    </div>
  );
};

export default AssistantChatInterface;
