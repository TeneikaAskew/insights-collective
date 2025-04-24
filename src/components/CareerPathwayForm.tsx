
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from '@/integrations/supabase/client';

interface CareerPathwayFormProps {
  prompt: string;
  pathwayQuestions: string[];
  pathwayAnswers: Record<string, string>;
  resumeText?: string;
}

const CareerPathwayForm: React.FC<CareerPathwayFormProps> = ({
  prompt,
  pathwayQuestions,
  pathwayAnswers,
  resumeText
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { toast } = useToast();
  
  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      
      // Validate required fields
      if (!prompt) {
        throw new Error("Prompt is required");
      }
      
      if (!pathwayQuestions || !Array.isArray(pathwayQuestions) || pathwayQuestions.length === 0) {
        throw new Error("Pathway questions are required and must be an array");
      }
      
      if (!pathwayAnswers || typeof pathwayAnswers !== 'object' || Object.keys(pathwayAnswers).length === 0) {
        throw new Error("Pathway answers are required and must be an object");
      }
      
      // Build payload
      const payload = {
        prompt,
        pathwayQuestions,
        pathwayAnswers,
        resumeText: resumeText || undefined // Only include if it has a value
      };
      
      console.log("Sending payload to evaluateCareerAdvice:", payload);
      
      // Call the Supabase Edge Function with proper headers
      const { data, error } = await supabase.functions.invoke('evaluateCareerAdvice', {
        body: JSON.stringify(payload),
        headers: { 
          'Content-Type': 'application/json' 
        }
      });
      
      if (error) {
        console.error("Error calling evaluateCareerAdvice:", error);
        throw new Error(`Error evaluating career advice: ${error.message || 'Unknown error'}`);
      }
      
      console.log("Response from evaluateCareerAdvice:", data);
      setResult(data);
      
      toast({
        title: "Analysis Complete",
        description: "Your career pathway analysis has been completed.",
      });
    } catch (error) {
      console.error("Error in handleSubmit:", error);
      toast({
        title: "Error",
        description: error.message || "An error occurred while processing your request.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Career Pathway Analysis</h3>
            <p className="text-sm text-muted-foreground">
              Complete this form to receive a personalized career assessment.
            </p>
            <Button 
              onClick={handleSubmit} 
              disabled={isSubmitting}
              className="w-full"
            >
              {isSubmitting ? "Processing..." : "Analyze My Career Pathway"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-lg font-medium mb-4">Your Career Analysis</h3>
            <pre className="bg-muted p-4 rounded text-sm overflow-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CareerPathwayForm;
