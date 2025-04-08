
import React from 'react';
import { Assistant } from '@/types/assistants';
import { Badge } from '@/components/ui/badge';

interface AssistantCardProps {
  assistant: Assistant;
  featured?: boolean;
  onLaunch?: (assistant: Assistant) => void;
}

export const AssistantCard = ({ assistant, featured = false, onLaunch }: AssistantCardProps) => {
  const IconComponent = assistant.icon.component;
  
  const handleLaunch = () => {
    if (onLaunch) {
      onLaunch(assistant);
    }
  };
  
  return (
    <div className={`bg-white rounded-lg border ${featured ? 'border-energeticAmber' : 'border-gray-200'} overflow-hidden`}>
      <div className={`p-4 ${featured ? 'border-b border-energeticAmber/20' : ''}`}>
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-full ${featured ? 'bg-blue-100' : 'bg-slate-100'}`}>
              <IconComponent {...assistant.icon.props} />
            </div>
            <h3 className="text-lg font-medium">{assistant.name}</h3>
          </div>
          {assistant.popular && (
            <Badge className="bg-blue-50 text-blue-600 hover:bg-blue-50 border border-blue-200">Popular</Badge>
          )}
          {featured && (
            <Badge className="bg-blue-50 text-blue-600 hover:bg-blue-50 border border-blue-200">Featured</Badge>
          )}
        </div>
        <p className="mt-2 text-gray-600 text-sm">{assistant.description}</p>
      </div>
      
      <div className="p-4 space-y-4">
        {featured && (
          <div className="space-y-2">
            <div className="flex items-center text-sm gap-2">
              <span className="text-yellow-500">★</span>
              <span>Personalized career recommendations</span>
            </div>
            <div className="flex items-center text-sm gap-2">
              <span className="text-yellow-500">📍</span>
              <span>Considers quiz results & chat input</span>
            </div>
            <div className="flex items-center text-sm gap-2">
              <span className="text-yellow-500">😊</span>
              <span>Acts as your personal career coach</span>
            </div>
            <div className="flex items-center text-sm gap-2">
              <span className="text-yellow-500">⚡</span>
              <span>Pre-loaded with skills/interest data</span>
            </div>
          </div>
        )}
        
        {!featured && (
          <div className="space-y-2">
            <div className="flex items-center text-sm gap-2">
              <span className="text-yellow-500">★</span>
              <span>Smart recommendations</span>
            </div>
            <div className="flex items-center text-sm gap-2">
              <span className="text-yellow-500">💬</span>
              <span>Unlimited queries</span>
            </div>
            <div className="flex items-center text-sm gap-2">
              <span className="text-yellow-500">📚</span>
              <span>Learning-centered design</span>
            </div>
          </div>
        )}
        
        <button 
          onClick={handleLaunch}
          className={`w-full py-2 px-4 rounded-md font-medium text-white text-center ${
            featured 
              ? 'bg-gradient-to-r from-energeticAmber to-blue-500 hover:opacity-90' 
              : 'bg-gradient-to-r from-blue-400 to-teal-400 hover:opacity-90'
          }`}
        >
          Launch Assistant
        </button>
      </div>
    </div>
  );
};
