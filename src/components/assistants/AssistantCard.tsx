
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Brain, Compass, Lightbulb, RefreshCw, Sparkles } from "lucide-react";
import { Assistant } from "@/types/assistants";
import { createElement } from "react";

interface AssistantCardProps {
  assistant: Assistant;
  featured?: boolean;
  onLaunch: (assistant: Assistant) => void;
}

export function AssistantCard({ 
  assistant, 
  featured = false, 
  onLaunch 
}: AssistantCardProps) {
  // Render the icon from the assistant object
  const renderIcon = () => {
    if (!assistant.icon) return null;
    
    // Check if icon is in the format created by createIcon function
    if (typeof assistant.icon === 'object' && 'component' in assistant.icon && 'props' in assistant.icon) {
      const { component, props } = assistant.icon as any;
      return createElement(component, props);
    }
    
    // Fallback for any other icon format
    return assistant.icon;
  };

  return (
    <Card className={`h-full flex flex-col card-hover ${featured ? 'border-2 border-insightBlue' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between mb-2">
          <div className={`h-10 w-10 rounded-full ${featured ? 'bg-insightBlue/20 text-insightBlue' : 'bg-aquaTeal/20 text-insightBlue'} flex items-center justify-center`}>
            {renderIcon()}
          </div>
          {(assistant.popular || featured) && (
            <div className={`px-2 py-1 ${featured ? 'bg-insightBlue/20 text-viraDeepBlue' : 'bg-aquaTeal/20 text-viraDeepBlue'} text-xs font-medium rounded-full`}>
              {featured ? 'Featured' : 'Popular'}
            </div>
          )}
        </div>
        <CardTitle className="text-xl">{assistant.name}</CardTitle>
        <CardDescription className={`${featured ? 'line-clamp-none' : 'line-clamp-2'}`}>
          {assistant.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow">
        <ul className="space-y-2 text-sm">
          {featured ? (
            <>
              <li className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-energeticAmber" />
                <span>Personalized career recommendations</span>
              </li>
              <li className="flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-energeticAmber" />
                <span>Considers quiz results & chat input</span>
              </li>
              <li className="flex items-center gap-2">
                <Compass className="h-4 w-4 text-energeticAmber" />
                <span>Acts as your personal career coach</span>
              </li>
              <li className="flex items-center gap-2">
                <Brain className="h-4 w-4 text-energeticAmber" />
                <span>Pre-loaded with skills/interest data</span>
              </li>
            </>
          ) : (
            <>
              <li className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-energeticAmber" />
                <span>Smart recommendations</span>
              </li>
              <li className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-energeticAmber" />
                <span>Unlimited queries</span>
              </li>
              <li className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-energeticAmber" />
                <span>Learning-centered design</span>
              </li>
            </>
          )}
        </ul>
      </CardContent>
      <CardFooter>
        <Button 
          className={`w-full ${featured ? 'bg-gradient-to-r from-energeticAmber to-insightBlue hover:from-energeticAmber/90 hover:to-insightBlue/90' : 'bg-gradient-to-r from-insightBlue to-aquaTeal hover:from-insightBlue/90 hover:to-aquaTeal/90'} text-white`}
          onClick={() => onLaunch(assistant)}
        >
          Launch Assistant
        </Button>
      </CardFooter>
    </Card>
  );
}
