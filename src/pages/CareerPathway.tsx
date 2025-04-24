
import React, { useState, useEffect } from 'react';
import { useToast } from "@/components/ui/use-toast";
import CareerPathwayForm from '@/components/CareerPathwayForm';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PathwayQuestion } from '@/data/careerPathwayData';

const CareerPathway: React.FC = () => {
  const [questions, setQuestions] = useState<PathwayQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [resumeText, setResumeText] = useState<string | undefined>();
  const { toast } = useToast();
  
  // Example of how you might load questions
  useEffect(() => {
    // In a real app, you might fetch these from an API
    const careerPathwayQuestions: PathwayQuestion[] = [
      {
        id: "skill",
        label: "Skills",
        placeholder: "What skills are you most proud of?"
      },
      {
        id: "environment",
        label: "Work Environment",
        placeholder: "What type of work environment do you prefer?"
      },
      {
        id: "goals",
        label: "Career Goals",
        placeholder: "What are your long-term career goals?"
      }
    ];
    
    setQuestions(careerPathwayQuestions);
  }, []);
  
  const handleAnswerChange = (questionId: string, answer: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }));
  };
  
  const validateData = () => {
    if (questions.length === 0) {
      toast({
        title: "Missing Questions",
        description: "Career pathway questions haven't loaded yet.",
        variant: "destructive"
      });
      return false;
    }
    
    const answeredQuestions = Object.keys(answers).length;
    if (answeredQuestions === 0) {
      toast({
        title: "No Answers Provided",
        description: "Please answer at least one question to receive an analysis.",
        variant: "destructive"
      });
      return false;
    }
    
    return true;
  };
  
  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Career Pathway Assessment</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-6">
            Answer the following questions to receive personalized career advice and recommendations.
          </p>
          
          {questions.map((question) => (
            <div key={question.id} className="mb-6">
              <h3 className="text-base font-medium mb-2">{question.label}</h3>
              <textarea 
                className="w-full min-h-[100px] p-2 border rounded"
                value={answers[question.id] || ''}
                onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                placeholder={question.placeholder}
              />
            </div>
          ))}
        </CardContent>
      </Card>
      
      {validateData() && (
        <CareerPathwayForm
          prompt="Analyze the following career pathway questions and answers to provide personalized career advice."
          pathwayQuestions={questions}
          pathwayAnswers={answers}
          resumeText={resumeText}
        />
      )}
    </div>
  );
};

export default CareerPathway;
