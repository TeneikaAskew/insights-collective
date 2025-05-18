import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';

interface STARFeedbackProps {
  responseId: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  onFeedbackReceived?: () => void;
}

export const STARFeedback: React.FC<STARFeedbackProps> = ({
  responseId,
  situation,
  task,
  action,
  result,
  onFeedbackReceived
}) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const requestFeedback = async () => {
    setIsLoading(true);

    try {
      // Call your edge function for STAR response evaluation
      const { data: feedbackData, error: feedbackError } = await supabase.functions.invoke(
        'evaluate-star-response',
        {
          body: {
            situation,
            task,
            action,
            result
          }
        }
      );

      if (feedbackError) throw feedbackError;

      // Update the response with the feedback
      const { error: updateError } = await supabase
        .from('star_responses')
        .update({
          ai_feedback: {
            clarity: feedbackData.clarity,
            completeness: feedbackData.completeness,
            relevance: feedbackData.relevance,
            suggestions: feedbackData.suggestions
          }
        })
        .eq('id', responseId);

      if (updateError) throw updateError;

      toast({
        title: 'Feedback Generated',
        description: 'AI feedback has been generated for your response.',
      });

      if (onFeedbackReceived) {
        onFeedbackReceived();
      }
    } catch (error) {
      console.error('Error generating feedback:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate feedback. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">AI Feedback</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Get instant AI feedback on your STAR response. Our AI will evaluate:
          </p>
          <ul className="list-disc list-inside text-sm text-gray-600">
            <li>Clarity of your response</li>
            <li>Completeness of each STAR component</li>
            <li>Relevance to typical interview scenarios</li>
            <li>Specific suggestions for improvement</li>
          </ul>
          <Button
            onClick={requestFeedback}
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? 'Generating Feedback...' : 'Get AI Feedback'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}; 