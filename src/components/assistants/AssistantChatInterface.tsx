import React, { useState, useEffect } from 'react';
import { Assistant } from '@/types/assistants';
import AssistantChatSidebar from './AssistantChatSidebar';
import AssistantControlPanel from './AssistantControlPanel';
import ChatHeader from './ChatHeader';
import MessageList from './MessageList';
import ChatInput from './ChatInput';
import { PersonalizationSettings } from './types';
import { useAssistantChat } from '@/hooks/useAssistantChat';
import { CareerTrack } from '@/data/careerQuizData';

// Re-export types for backward compatibility
export type { Message, Chat } from './types';

interface AssistantChatInterfaceProps { 
  initialAssistant: Assistant;
}

const AssistantChatInterface: React.FC<AssistantChatInterfaceProps> = ({ initialAssistant }) => {
  const [showLeftSidebar, setShowLeftSidebar] = useState(true);
  const [showRightSidebar, setShowRightSidebar] = useState(true);
  
  // Initialize with default values or values from quiz results
  const initialCareerFocus = 'Technology';
  const initialCareerPath = localStorage.getItem('recommendedCareerPath') as CareerTrack || 'Data Engineering';
  const initialSalaryCap = parseInt(localStorage.getItem('recommendedSalary') || '100000');
  
  const [personalizationSettings, setPersonalizationSettings] = useState<PersonalizationSettings>({
    careerFocus: initialCareerFocus,
    careerPath: initialCareerPath,
    salaryCap: initialSalaryCap
  });
  
  // Clean up localStorage once we've used the values
  useEffect(() => {
    if (initialAssistant.id === 'career-coach') {
      // We keep these for the conversation context
      // but can remove the personalization setting items
      localStorage.removeItem('recommendedCareerPath');
      localStorage.removeItem('recommendedSalary');
    }
  }, [initialAssistant.id]);
  
  const {
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
  } = useAssistantChat(initialAssistant);

  // Initialize with welcome message and personalization reminder
  useEffect(() => {
    initializeChat(personalizationSettings);
  }, [assistant, personalizationSettings.careerFocus, personalizationSettings.careerPath, personalizationSettings.salaryCap]);

  const handleCareerFocusChange = (value: string) => {
    setPersonalizationSettings(prev => ({ ...prev, careerFocus: value }));
  };

  const handleCareerPathChange = (value: string) => {
    setPersonalizationSettings(prev => ({ ...prev, careerPath: value }));
  };

  const handleSalaryCapChange = (value: number) => {
    setPersonalizationSettings(prev => ({ ...prev, salaryCap: value }));
  };

  return (
    <div className="flex h-full">
      {/* Left Sidebar - Chat Management */}
      <div className={`h-[calc(100vh-4rem)] md:block ${showLeftSidebar ? 'block' : 'hidden'} 
                     transition-all duration-300 border-r w-full max-w-xs`}>
        <AssistantChatSidebar 
          currentChat={currentChat}
          onNewChat={() => handleNewChat(personalizationSettings)}
          onChatSelect={loadChat}
        />
      </div>

      {/* Main Chat Window */}
      <div className="flex flex-col flex-1">
        {/* Header with Assistant Type Selector */}
        <ChatHeader 
          assistant={assistant}
          onAssistantChange={handleAssistantChange}
          onToggleLeftSidebar={() => setShowLeftSidebar(!showLeftSidebar)}
          onToggleRightSidebar={() => setShowRightSidebar(!showRightSidebar)}
        />
        
        {/* Messages Area */}
        <MessageList 
          messages={messages} 
          isLoading={isLoading} 
        />
        
        {/* Input Area */}
        <ChatInput 
          inputValue={inputValue}
          isLoading={isLoading}
          onInputChange={setInputValue}
          onSendMessage={() => handleSendMessage(personalizationSettings)}
          personalizationSettings={personalizationSettings}
        />
      </div>

      {/* Right Sidebar - Control Panel */}
      <div className={`h-[calc(100vh-4rem)] md:block ${showRightSidebar ? 'block' : 'hidden'} 
                     transition-all duration-300 border-l w-full max-w-xs`}>
        <AssistantControlPanel 
          careerFocus={personalizationSettings.careerFocus}
          onCareerFocusChange={handleCareerFocusChange}
          careerPath={personalizationSettings.careerPath}
          onCareerPathChange={handleCareerPathChange}
          salaryCap={personalizationSettings.salaryCap}
          onSalaryCapChange={handleSalaryCapChange}
        />
      </div>
    </div>
  );
};

export default AssistantChatInterface;
