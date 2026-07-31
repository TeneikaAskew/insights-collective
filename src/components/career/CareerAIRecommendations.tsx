
import React, { useState } from 'react';
import { useTogetherAI } from '@/hooks/useTogetherAI';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { SparklesIcon, RotateCcw } from 'lucide-react';

interface CareerAIRecommendationsProps {
  careerPath?: string;
  userSkills?: string[];
}

export default function CareerAIRecommendations({ careerPath, userSkills = [] }: CareerAIRecommendationsProps) {
  const [recommendation, setRecommendation] = useState<string | null>(null);
  const { generateText, isLoading, error } = useTogetherAI({
    model: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
    maxTokens: 500
  });

  const [userPrompt, setUserPrompt] = useState('');
  const [showCustomPrompt, setShowCustomPrompt] = useState(false);

  const handleGenerateRecommendation = async () => {
    let prompt;
    
    if (showCustomPrompt && userPrompt) {
      prompt = userPrompt;
    } else {
      prompt = `As a career advisor, please provide personalized career development suggestions for someone in ${careerPath || 'the technology field'}. ${
        userSkills.length > 0 
          ? `They already have skills in: ${userSkills.join(', ')}. ` 
          : ''
      }Provide specific, actionable advice in 3-5 bullet points that will help them advance their career in the next 3-6 months.`;
    }
    
    const result = await generateText(prompt);
    if (result) {
      setRecommendation(result);
    }
  };

  return (
    <Card className="w-full mt-6">
      <CardHeader className="bg-accent ">
        <div className="flex items-center gap-2">
          <SparklesIcon className="h-5 w-5 text-primary" />
          <CardTitle>AI Career Recommendations</CardTitle>
        </div>
        <CardDescription>
          Get personalized career advice powered by Together.ai
        </CardDescription>
      </CardHeader>
      
      <CardContent className="pt-6">
        {showCustomPrompt ? (
          <div className="mb-4">
            <Textarea
              placeholder="Enter your career-related question here..."
              value={userPrompt}
              onChange={(e) => setUserPrompt(e.target.value)}
              className="min-h-[100px]"
            />
            <div className="flex justify-end mt-2">
              <Button 
                variant="link" 
                size="sm"
                onClick={() => setShowCustomPrompt(false)}
              >
                Use default prompt
              </Button>
            </div>
          </div>
        ) : (
          <div className="mb-4">
            <p className="text-sm text-muted-foreground mb-2">
              Get AI-powered career recommendations based on your career path
              {careerPath ? ` in ${careerPath}` : ''}.
            </p>
            <Button 
              variant="link" 
              size="sm" 
              onClick={() => setShowCustomPrompt(true)}
            >
              Use custom prompt
            </Button>
          </div>
        )}
        
        {error && (
          <div className="bg-ss-bad-chip p-4 rounded-md mb-4 text-ss-bad ">
            Error: {error}
          </div>
        )}
        
        {recommendation && (
          <div className="bg-accent p-4 rounded-lg mt-4">
            <h3 className="font-semibold mb-2">Your Career Recommendations:</h3>
            <div className="whitespace-pre-line text-sm">
              {recommendation}
            </div>
          </div>
        )}
      </CardContent>
      
      <CardFooter className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => setRecommendation(null)}
          disabled={!recommendation || isLoading}
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          Clear
        </Button>
        
        <Button
          onClick={handleGenerateRecommendation}
          disabled={isLoading || (showCustomPrompt && !userPrompt)}
        >
          {isLoading ? (
            <>
              <span className="animate-spin mr-2">⟳</span>
              Generating...
            </>
          ) : (
            <>
              <SparklesIcon className="h-4 w-4 mr-2" />
              Generate Recommendations
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
