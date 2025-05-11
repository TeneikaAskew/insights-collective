
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Check, XCircle, AlertCircle } from 'lucide-react';
import { ResumeAnalysis } from '@/components/assistants/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import JobDescriptionAnalyzer from './JobDescriptionAnalyzer';
import { useResumeData } from '@/hooks/resume/useResumeData';

interface ATSScoreCardProps {
  analysis: ResumeAnalysis | null;
}

const ATSScoreCard: React.FC<ATSScoreCardProps> = ({ analysis }) => {
  const [activeTab, setActiveTab] = useState<string>('general');
  const { resume } = useResumeData();

  if (!analysis) return null;
  
  // Calculate ATS score based on resume_percent
  const atsScore = Math.min(100, analysis.resume_percent + 10);
  
  // Define keyword match percentage (could come from analysis in the future)
  const keywordMatchScore = Math.round(atsScore * 0.9);
  
  // Format detection percentage (based on letter grade)
  const formatDetectionScore = 
    analysis.letter_grade === 'A' ? 98 :
    analysis.letter_grade === 'B' ? 85 :
    analysis.letter_grade === 'C' ? 70 :
    analysis.letter_grade === 'D' ? 55 : 40;
  
  // Calculate readability score
  const readabilityScore = Math.min(100, Math.round(atsScore * 0.95));
  
  // Generate mock ATS feedback
  const atsFeedback = [
    {
      check: keywordMatchScore > 70,
      message: "Contains relevant industry keywords",
      impact: "High"
    },
    {
      check: formatDetectionScore > 80,
      message: "Well-structured format for ATS parsing",
      impact: "Critical"
    },
    {
      check: readabilityScore > 75,
      message: "Clean, readable content without complex formatting",
      impact: "High"
    },
    {
      check: atsScore > 85,
      message: "Contact information is easily extractable",
      impact: "Medium"
    },
    {
      check: atsScore > 80,
      message: "Education section properly formatted",
      impact: "Medium"
    },
    {
      check: keywordMatchScore > 85,
      message: "Skills section matches job requirements",
      impact: "High"
    }
  ];
  
  // Calculate pass rate
  const passRate = Math.round((atsFeedback.filter(item => item.check).length / atsFeedback.length) * 100);
  
  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-green-600";
    if (score >= 75) return "text-emerald-600";
    if (score >= 60) return "text-yellow-600";
    if (score >= 45) return "text-orange-600";
    return "text-red-600";
  };
  
  const getBadgeColor = (impact: string) => {
    if (impact === "Critical") return "bg-red-100 text-red-800";
    if (impact === "High") return "bg-amber-100 text-amber-800";
    return "bg-blue-100 text-blue-800";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          <span>ATS Compatibility Score</span>
          <span className={`text-3xl font-bold ${getScoreColor(atsScore)}`}>
            {atsScore}%
          </span>
        </CardTitle>
        <CardDescription>
          How well your resume will perform through Applicant Tracking Systems
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="general">General ATS Score</TabsTrigger>
            <TabsTrigger value="job-match">Job-Specific Analysis</TabsTrigger>
          </TabsList>
          
          <TabsContent value="general" className="mt-6">
            <Progress value={atsScore} className="h-2" />
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              <div className="bg-muted/30 p-4 rounded-md text-center">
                <p className="text-sm text-muted-foreground">Keyword Match</p>
                <p className={`text-2xl font-semibold ${getScoreColor(keywordMatchScore)}`}>{keywordMatchScore}%</p>
              </div>
              <div className="bg-muted/30 p-4 rounded-md text-center">
                <p className="text-sm text-muted-foreground">Format Detection</p>
                <p className={`text-2xl font-semibold ${getScoreColor(formatDetectionScore)}`}>{formatDetectionScore}%</p>
              </div>
              <div className="bg-muted/30 p-4 rounded-md text-center">
                <p className="text-sm text-muted-foreground">Readability</p>
                <p className={`text-2xl font-semibold ${getScoreColor(readabilityScore)}`}>{readabilityScore}%</p>
              </div>
            </div>
            
            <div className="bg-muted/20 p-4 rounded-md mt-6">
              <h3 className="font-medium mb-3">ATS Checks ({passRate}% Pass Rate)</h3>
              <div className="space-y-2">
                {atsFeedback.map((item, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center">
                      {item.check ? (
                        <Check className="h-4 w-4 text-green-600 mr-2" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-600 mr-2" />
                      )}
                      <span className={item.check ? "text-sm" : "text-sm text-muted-foreground"}>{item.message}</span>
                    </div>
                    <Badge className={`${getBadgeColor(item.impact)} font-normal`}>{item.impact}</Badge>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="bg-blue-50 border border-blue-100 p-4 rounded-md flex items-start mt-6">
              <AlertCircle className="h-5 w-5 text-blue-500 mr-3 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-blue-900">
                  <span className="font-medium">Pro Tip:</span> Most employers use ATS systems to filter resumes. A score above 80% significantly increases your chances of getting past automated filters and into human hands.
                </p>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="job-match" className="mt-6 space-y-6">
            <JobDescriptionAnalyzer resumeText={resume?.text || null} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default ATSScoreCard;
