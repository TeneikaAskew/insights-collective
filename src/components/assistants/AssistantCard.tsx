
import React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Assistant } from '@/types/assistants';
import { useNavigate } from 'react-router-dom';

interface AssistantCardProps {
  assistant: Assistant;
  featured?: boolean;
  onLaunch?: (assistant: Assistant) => void;
}

export const AssistantCard = ({ assistant, featured = false, onLaunch }: AssistantCardProps) => {
  const navigate = useNavigate();
  const IconComponent = assistant.icon.component;
  
  const handleLaunch = () => {
    // Navigate to the dedicated assistant interface with the assistant data
    navigate(`/assistant/${assistant.id}`, { state: { assistant } });
  };
  
  return (
    <Card className={`overflow-hidden ${featured ? 'border-primary' : ''}`}>
      <CardHeader className={`pb-2 ${featured ? 'bg-primary/10' : ''}`}>
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-slate-100 rounded-full">
              <IconComponent {...assistant.icon.props} />
            </div>
            <CardTitle className="text-lg">{assistant.name}</CardTitle>
          </div>
          {assistant.popular && (
            <Badge variant="secondary">Popular</Badge>
          )}
        </div>
        <CardDescription className="mt-2">{assistant.description}</CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="text-sm text-muted-foreground">
          <span className="font-medium">Category:</span> {assistant.category.charAt(0).toUpperCase() + assistant.category.slice(1)}
        </div>
      </CardContent>
      <CardFooter className="pt-2">
        <Button 
          onClick={handleLaunch} 
          className="w-full"
          variant={featured ? "default" : "outline"}
        >
          Launch Assistant
        </Button>
      </CardFooter>
    </Card>
  );
};
