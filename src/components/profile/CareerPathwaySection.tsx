// Updated: CareerPathwaySection now fetches saved career advice instead of generating it
import React, { useEffect, useState } from 'react';
import { pathwayQuestions } from '@/data/careerPathwayData';
import { supabase } from '@/integrations/supabase/client';
import { Spinner } from '@/components/ui/spinner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';

type CareerPathwaySectionProps = {
  pathwayAnswers: Record<number, number | string>;
};

const CareerPathwaySection: React.FC<CareerPathwaySectionProps> = ({ pathwayAnswers }) => {
  const { user } = useAuth();
  const [careerAdviceReport, setCareerAdviceReport] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [resumeFound, setResumeFound] = useState(false);

  useEffect(() => {
    const allAnswersProvided = Object.keys(pathwayAnswers).length === pathwayQuestions.length;
    if (!allAnswersProvided || !user) {
      setCareerAdviceReport('');
      setResumeFound(false);
      return;
    }

    const fetchSavedCareerAdvice = async () => {
      setLoading(true);
      try {
        // Check if resume exists
        const { data: resumeData, error: resumeError } = await supabase
          .from('resumes')
          .select('text')
          .eq('user_id', user.id)
          .limit(1)
          .maybeSingle();

        if (resumeError) {
          console.error('Error checking resume for career advice:', resumeError);
        } else if (resumeData && resumeData.text) {
          setResumeFound(true);
        } else {
          setResumeFound(false);
        }

        // Fetch the latest career advice report from the database
        const { data: adviceData, error: adviceError } = await supabase
          .from('career_pathway_results')
          .select('report')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (adviceError) {
          console.error('Error fetching career advice:', adviceError);
          setCareerAdviceReport('Failed to get career advice. Please try again later.');
          return;
        }

        if (adviceData && adviceData.report) {
          setCareerAdviceReport(adviceData.report);
        } else {
          setCareerAdviceReport('No career pathway report found. Please complete the career pathway chat first.');
        }
      } catch (err) {
        console.error('Unknown error fetching career advice:', err);
        setCareerAdviceReport('Failed to get career advice. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchSavedCareerAdvice();
  }, [quizAnswers, user]);

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
            <span className="ml-2 text-muted-foreground">Loading report...</span>
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