
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from '@/integrations/supabase/client';
import { parseReport } from '@/utils/reportParser';
import PageTitle from '@/components/PageTitle';
import { Loader2, ArrowRight } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

// Interface for the parsed report
interface ParsedReport {
  summary: string;
  recommendedRoles: string[];
  skills: Array<{ skill: string; course: string }>;
  nextSteps: string[];
  potentialRoles: string[];
  careerPath: string[];
  remoteConsiderations: string;
}

export default function CareerPathway() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ParsedReport | null>(null);
  const [hasCompletedAssessment, setHasCompletedAssessment] = useState(false);

  useEffect(() => {
    async function fetchCareerPathwayResults() {
      try {
        setLoading(true);
        
        const { data: user } = await supabase.auth.getUser();
        
        if (!user.user) {
          setLoading(false);
          setHasCompletedAssessment(false);
          return;
        }

        // Fetch the results
        const { data, error } = await supabase
          .from('career_pathway_results')
          .select('report, session_id')
          .eq('user_id', user.user.id)
          .order('created_at', { ascending: false })
          .limit(1);

        if (error) {
          console.error('Error fetching career pathway results:', error);
          setError('Failed to fetch your career pathway results. Please try again later.');
          setLoading(false);
          setHasCompletedAssessment(false);
          return;
        }

        if (!data || data.length === 0) {
          setLoading(false);
          setHasCompletedAssessment(false);
          return;
        }
        
        setHasCompletedAssessment(true);
        
        // Parse the report
        try {
          const reportJson = data[0].report;
          const reportText = typeof reportJson === 'string' ? reportJson : JSON.stringify(reportJson);
          
          console.log("Raw report text:", reportText);
          const parsedReport = parseReport(reportText);
          console.log("Parsed report:", parsedReport);
          
          setReport(parsedReport);
        } catch (parseError) {
          console.error('Error parsing report:', parseError);
          setError('There was an issue displaying your career pathway results.');
        }
        
      } catch (err) {
        console.error('Unexpected error in fetchCareerPathwayResults:', err);
        setError('An unexpected error occurred. Please try again later.');
      } finally {
        setLoading(false);
      }
    }

    fetchCareerPathwayResults();
  }, []);

  const handleTakeAssessment = () => {
    navigate('/assessment');
  };

  const renderReportSection = (title: string, content: React.ReactNode) => (
    <div className="mb-6">
      <h3 className="text-lg font-semibold text-primary mb-2">{title}</h3>
      {content}
    </div>
  );

  const renderList = (items: string[]) => (
    <ul className="list-disc pl-5 space-y-1">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );

  const renderSkillsTable = (skills: Array<{ skill: string; course: string }>) => (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Skill</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Course</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {skills.map((item, index) => (
            <tr key={index}>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.skill}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.course}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-lg">Loading your career pathway results...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <PageTitle title="Career Pathway" />
        <Card>
          <CardHeader>
            <CardTitle>Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-500">{error}</p>
          </CardContent>
          <CardFooter>
            <Button onClick={handleTakeAssessment}>Take Assessment</Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (!hasCompletedAssessment || !report) {
    return (
      <div className="container mx-auto px-4 py-8">
        <PageTitle title="Career Pathway" />
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Complete Your Career Assessment</CardTitle>
            <CardDescription>
              To receive your personalized career pathway results, complete the assessment first.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              The assessment will help us understand your skills, interests, and career goals so we can provide you with tailored recommendations.
            </p>
          </CardContent>
          <CardFooter>
            <Button onClick={handleTakeAssessment}>
              Take Assessment <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <PageTitle title="Your Career Pathway" />
      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle>Personalized Career Advice Report</CardTitle>
          <CardDescription>
            Based on your assessment responses, we've created a tailored career pathway for you.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Summary */}
          {renderReportSection("Summary", <p>{report.summary}</p>)}
          
          {/* Recommended Roles */}
          {report.recommendedRoles.length > 0 && 
            renderReportSection("Recommended Roles", renderList(report.recommendedRoles))}
          
          {/* Skills and Matching Courses */}
          {report.skills.length > 0 && 
            renderReportSection("Skills and Matching Courses", renderSkillsTable(report.skills))}
          
          {/* Next Steps */}
          {report.nextSteps.length > 0 && 
            renderReportSection("Next-Step Career Recommendations", renderList(report.nextSteps))}
          
          {/* Potential Roles */}
          {report.potentialRoles.length > 0 && 
            renderReportSection("Roles that Might be Right for You", renderList(report.potentialRoles))}
          
          {/* Career Path */}
          {report.careerPath.length > 0 && 
            renderReportSection("Path to Your Aspirational Role", renderList(report.careerPath))}
          
          {/* Remote Work */}
          {report.remoteConsiderations && 
            renderReportSection("Remote Work Considerations", <p>{report.remoteConsiderations}</p>)}
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline" onClick={handleTakeAssessment}>
            Retake Assessment
          </Button>
          <Button onClick={() => navigate('/courses')}>
            Explore Related Courses <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
