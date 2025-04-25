
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Brain, BarChart3, Database, Presentation, Award, GraduationCap, Star, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { formatCareerPathwayReport } from '@/components/assistants/utils/CareerReportParser';
import { Progress } from '@/components/ui/progress';

type CareerPathwaySectionProps = {
  pathwayAnswers: Record<number, number | string>;
};

const CareerPathwaySection: React.FC<CareerPathwaySectionProps> = ({ pathwayAnswers }) => {
  const { user } = useAuth();
  const [careerAdviceReport, setCareerAdviceReport] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [resumeFound, setResumeFound] = useState(false);

  useEffect(() => {
    const allAnswersProvided = Object.keys(pathwayAnswers).length > 0;
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

        if (!resumeError && resumeData?.text) {
          setResumeFound(true);
        }

        // Fetch the latest career advice report
        const { data: adviceData, error: adviceError } = await supabase
          .from('career_pathway_results')
          .select('report')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (adviceError) {
          console.error('Error fetching career advice:', adviceError);
          return;
        }

        if (adviceData?.report) {
          const rawReport = typeof adviceData.report === 'string' 
            ? adviceData.report 
            : JSON.stringify(adviceData.report);
          
          const formattedReport = formatCareerPathwayReport(rawReport.trim());
          setCareerAdviceReport(formattedReport);
        }
      } catch (err) {
        console.error('Unknown error fetching career advice:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSavedCareerAdvice();
  }, [pathwayAnswers, user]);

  return (
    <Card id="career-pathway-report" className="mt-6">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Star className="h-5 w-5 text-primary" />
          <CardTitle>Career Pathway Report</CardTitle>
        </div>
        <CardDescription>
          Your personalized career pathway based on assessment results
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center items-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <>
            {resumeFound && (
              <div className="mb-4 p-2 bg-green-100 text-green-700 rounded border border-green-300 flex items-center gap-2">
                <Award className="h-4 w-4" />
                Resume analysis included in career advice
              </div>
            )}
            <div 
              className="career-advice-report prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: careerAdviceReport }}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default CareerPathwaySection;
