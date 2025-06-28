
import React from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PathwayQuestion {
  id: string;
  label: string;
  placeholder: string;
}

interface CareerPathwayFormProps {
  prompt: string;
  pathwayQuestions: PathwayQuestion[];
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
      
      // Log the payload for debugging
      console.log("Sending payload to evaluateCareerAdvice:", JSON.stringify(payload));
      
      // Call the Supabase Edge Function with explicit content-type
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
      return data;
    } catch (error) {
      console.error("Error in processRequest:", error);
      throw error;
    }
  }

  render() {
    return null; // This class is used primarily for its processRequest method
  }
}

export default CareerPathwayForm;
