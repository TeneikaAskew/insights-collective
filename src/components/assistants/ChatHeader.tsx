
import React from 'react';
import { PanelLeft, PanelRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Assistant } from '@/types/assistants';
import { allAssistants, careerExplorerAssistant } from '@/data/assistantData';

interface ChatHeaderProps {
  assistant: Assistant;
  onAssistantChange: (assistantId: string) => void;
  onToggleLeftSidebar: () => void;
  onToggleRightSidebar: () => void;
}

const ChatHeader: React.FC<ChatHeaderProps> = ({ 
  assistant, 
  onAssistantChange, 
  onToggleLeftSidebar, 
  onToggleRightSidebar 
}) => {
  const IconComponent = assistant.icon.component;
  
  return (
    <div className="flex items-center justify-between p-4 border-b">
      <Button 
        variant="ghost" 
        size="sm" 
        onClick={onToggleLeftSidebar}
      >
        <PanelLeft className="h-5 w-5" />
      </Button>
      
      <div className="flex items-center space-x-2">
        <div className="p-1.5 bg-slate-100 rounded-full">
          <IconComponent {...assistant.icon.props} />
        </div>
        <Select 
          value={assistant.id} 
          onValueChange={onAssistantChange}
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
        onClick={onToggleRightSidebar}
      >
        <PanelRight className="h-5 w-5" />
      </Button>
    </div>
  );
};

export default ChatHeader;
