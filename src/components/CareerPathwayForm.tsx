
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

class CareerPathwayForm extends React.Component<CareerPathwayFormProps> {
  async processRequest(): Promise<any> {
    try {
      // Validate required fields
      if (!this.props.prompt) {
        throw new Error("Prompt is required");
      }
      
      if (!this.props.pathwayQuestions || !Array.isArray(this.props.pathwayQuestions) || this.props.pathwayQuestions.length === 0) {
        throw new Error("Pathway questions are required and must be an array");
      }
      
      if (!this.props.pathwayAnswers || typeof this.props.pathwayAnswers !== 'object' || Object.keys(this.props.pathwayAnswers).length === 0) {
        throw new Error("Pathway answers are required and must be an object");
      }
      
      // Build payload
      const payload = {
        prompt: this.props.prompt,
        pathwayQuestions: this.props.pathwayQuestions,
        pathwayAnswers: this.props.pathwayAnswers,
        resumeText: this.props.resumeText || '' // Empty string instead of undefined
      };
      
      console.log("Sending payload to evaluateCareerAdvice:", payload);
      
      // Call the Supabase Edge Function with proper headers
      const { data, error } = await supabase.functions.invoke('evaluateCareerAdvice', {
        method: 'POST',
        body: payload, // Do not stringify - let Supabase handle it
        headers: { 
          'Content-Type': 'application/json' 
        }
      });
      
      if (error) {
        console.error("Error calling evaluateCareerAdvice:", error);
        throw new Error(`Error evaluating career advice: ${error.message || 'Unknown error'}`);
      }
      
      console.log("Response from evaluateCareerAdvice:", data);
      return data;
    } catch (error) {
      console.error("Error in processRequest:", error);
      throw error;
    }
  }

  render() {
    // Component UI implementation
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [result, setResult] = useState<any>(null);
    const { toast } = useToast();
    
    const handleSubmit = async () => {
      try {
        setIsSubmitting(true);
        
        const data = await this.processRequest();
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
  }
}

// For functional component usage
export const CareerPathwayFormFunctional: React.FC<CareerPathwayFormProps> = (props) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { toast } = useToast();
  
  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      
      // Create an instance of the class component for processing
      const formInstance = new CareerPathwayForm(props);
      const data = await formInstance.processRequest();
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
