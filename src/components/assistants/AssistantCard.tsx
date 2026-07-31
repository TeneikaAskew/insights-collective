
import React from 'react';
import { Assistant } from '@/types/assistants';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useAuthenticatedNavigation } from '@/hooks/useAuthenticatedNavigation';
import { Star, MapPin, Smile, Zap, MessageCircle, BookOpen } from 'lucide-react';



interface AssistantCardProps {
  assistant: Assistant;
  featured?: boolean;
  onLaunch?: (assistant: Assistant) => void;
}

export const AssistantCard = ({ assistant, featured = false, onLaunch }: AssistantCardProps) => {
  const IconComponent = assistant.icon.component;
  // const { isAuthenticated } = useAuth();
  // const navigate = useNavigate();
  const { navigateWithAuth } = useAuthenticatedNavigation();
  const handleLaunch = () => {
    const targetPath = `/assistant/${assistant.id}`;
    
    navigateWithAuth(targetPath, {
      requireAuth: true,
      message: "Please log in to use our AI assistants",
      title: "Authentication Required"
    });
    
    if (onLaunch) {
      onLaunch(assistant);
    }
  };
  
  return (
    <div className={`bg-card rounded-lg border ${featured ? 'border-ss-warn' : 'border-border'} overflow-hidden`}>
      <div className={`p-4 ${featured ? 'border-b border-ss-warn/30' : ''}`}>
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-full ${featured ? 'bg-accent' : 'bg-muted'}`}>
              <IconComponent {...assistant.icon.props} />
            </div>
            <h3 className="text-lg font-medium">{assistant.name}</h3>
          </div>
          {assistant.popular && (
            <Badge className="bg-accent text-accent-foreground hover:bg-accent border">Popular</Badge>
          )}
          {featured && (
            <Badge className="bg-accent text-accent-foreground hover:bg-accent border">Featured</Badge>
          )}
        </div>
        <p className="mt-2 text-muted-foreground text-sm">{assistant.description}</p>
      </div>
      
      <div className="p-4 space-y-4">
        {featured && (
          <div className="space-y-2">
            <div className="flex items-center text-sm gap-2">
              <Star className="h-4 w-4 text-primary" />
              <span>Personalized career recommendations</span>
            </div>
            <div className="flex items-center text-sm gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              <span>Considers quiz results & chat input</span>
            </div>
            <div className="flex items-center text-sm gap-2">
              <Smile className="h-4 w-4 text-primary" />
              <span>Acts as your personal career coach</span>
            </div>
            <div className="flex items-center text-sm gap-2">
              <Zap className="h-4 w-4 text-primary" />
              <span>Pre-loaded with skills/interest data</span>
            </div>
          </div>
        )}
        
        {!featured && (
          <div className="space-y-2">
            <div className="flex items-center text-sm gap-2">
              <Star className="h-4 w-4 text-primary" />
              <span>Smart recommendations</span>
            </div>
            <div className="flex items-center text-sm gap-2">
              <MessageCircle className="h-4 w-4 text-primary" />
              <span>Unlimited queries</span>
            </div>
            <div className="flex items-center text-sm gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              <span>Learning-centered design</span>
            </div>
          </div>
        )}
        
        <button 
          onClick={handleLaunch}
          className={`w-full py-2 px-4 rounded-md font-medium text-primary-foreground text-center ${
            featured 
              ? 'bg-primary hover:bg-primary/90' 
              : 'bg-gradient-to-r from-ss-lav to-ss-lav-deep hover:opacity-90'
          }`}
        >
          Launch Assistant
        </button>
      </div>
    </div>
  );
};
