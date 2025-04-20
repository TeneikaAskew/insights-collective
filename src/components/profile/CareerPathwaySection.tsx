
// Fix: Improve user's resume presence message and clean code
import React, { useEffect, useState } from 'react';
import { quizQuestions } from '@/data/careerQuizData';
import { supabase } from '@/integrations/supabase/client';
import { Spinner } from '@/components/ui/spinner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type CareerPathwaySectionProps = {
  quizAnswers: Record<number, number | string>;
};

const careerAdvicePrompt = `Here are outputs from a career chat:
• A set of recommended roles with descriptions & salary bands
• A table of skills and matching courses
• A narrative of next-step career recommendations
• A 'Roles that might be right for you' list
• A 'Path to your aspirational role' carousel
Please combine these data points with the user’s quiz answers to generate a personalized career-advice report.`;

const CareerPathwaySection: React.FC<CareerPathwaySectionProps> = ({ quizAnswers }) => {
  const [careerAdviceReport, setCareerAdviceReport] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [resumeFound, setResumeFound] = useState(false);

  useEffect(() => {
    const allAnswersProvided = Object.keys(quizAnswers).length === quizQuestions.length;
    if (!allAnswersProvided) {
      setCareerAdviceReport('');
      setResumeFound(false);
      return;
    }

    const fetchCareerAdvice = async () => {
      setLoading(true);
      try {
        const { data: resumeData, error: resumeError } = await supabase
          .from('resumes')
          .select('text')
          .limit(1)
          .maybeSingle();

        let resumeText = null;
        if (resumeError) {
          console.error('Error checking resume for career advice:', resumeError);
        } else if (resumeData && resumeData.text) {
          resumeText = resumeData.text;
          setResumeFound(true);
        } else {
          setResumeFound(false);
        }

        const payload = {
          prompt: careerAdvicePrompt,
          Quizquestions: quizQuestions,
          quizAnswers: quizAnswers,
          resumeText,
        };

        const { data, error } = await supabase.functions.invoke('evaluateCareerAdvice', {
          method: 'POST',
          body: JSON.stringify(payload),
        });

        if (error) {
          console.error('Error invoking evaluateCareerAdvice:', error);
          setCareerAdviceReport('Failed to get career advice. Please try again later.');
          return;
        }

        const responseText =
          typeof data === 'string'
            ? data
            : (data && data.generatedText) || JSON.stringify(data);

        setCareerAdviceReport(responseText);
      } catch (err) {
        console.error('Unknown error invoking career advice function:', err);
        setCareerAdviceReport('Failed to get career advice. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchCareerAdvice();
  }, [quizAnswers]);

  return (
    <Card id="career-pathway-report" className="mt-6">
      <CardHeader>
        <CardTitle>Personalized Career Pathway Report</CardTitle>
        <CardDescription>
          Based on your quiz answers and data analysis, here is your personalized career pathway report.
        </CardDescription>
      </CardHeader>
      <CardContent className="min-h-[150px]">
        {loading ? (
          <div className="flex justify-center items-center h-full">
            <Spinner className="w-8 h-8" />
            <span className="ml-2 text-muted-foreground">Generating report...</span>
          </div>
        ) : (
          <>
            {resumeFound && (
              <div className="mb-4 p-2 bg-green-100 text-green-700 rounded border border-green-300">
                Resume found and incorporated into career advice.
              </div>
            )}
            <pre className="whitespace-pre-wrap text-sm text-gray-800">{careerAdviceReport}</pre>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default CareerPathwaySection;
