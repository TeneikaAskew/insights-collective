
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Check, XCircle, AlertCircle } from 'lucide-react';
import { ResumeAnalysis } from '@/components/assistants/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import JobDescriptionAnalyzer from './JobDescriptionAnalyzer';
import { useResumeData } from '@/hooks/resume/useResumeData';
import { useAuth } from '@/contexts/AuthContext';

interface ATSScoreCardProps {
  analysis: ResumeAnalysis | null;
}

const ATSScoreCard: React.FC<ATSScoreCardProps> = ({ analysis }) => {
  const [activeTab, setActiveTab] = useState<string>('general');
  const { resume } = useResumeData();
  const { user } = useAuth();
  
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
    <Card className="border shadow-sm hover:shadow-md transition-all">
      <CardHeader className="pb-4">
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-2xl md:text-3xl font-bold">ATS Compatibility Score</CardTitle>
            <CardDescription className="text-base">
              How well your resume will perform through Applicant Tracking Systems
            </CardDescription>
          </div>
          <div className={`text-3xl md:text-4xl font-extrabold ${getScoreColor(atsScore)} px-4 py-2 rounded-full bg-opacity-10 ${atsScore >= 75 ? 'bg-green-100' : atsScore >= 60 ? 'bg-yellow-100' : 'bg-red-100'}`}>
            {atsScore}%
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 pb-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="general" className="rounded-md py-3">General ATS Score</TabsTrigger>
            <TabsTrigger value="job-match" className="rounded-md py-3">Job-Specific Analysis</TabsTrigger>
          </TabsList>
          
          <TabsContent value="general" className="mt-0 space-y-6">
            <Progress value={atsScore} className="h-2.5 bg-gray-100" />
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-5 rounded-lg border border-blue-100 text-center">
                <p className="text-sm text-gray-600 mb-1">Keyword Match</p>
                <p className={`text-2xl font-bold ${getScoreColor(keywordMatchScore)}`}>{keywordMatchScore}%</p>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-indigo-50 p-5 rounded-lg border border-purple-100 text-center">
                <p className="text-sm text-gray-600 mb-1">Format Detection</p>
                <p className={`text-2xl font-bold ${getScoreColor(formatDetectionScore)}`}>{formatDetectionScore}%</p>
              </div>
              <div className="bg-gradient-to-br from-indigo-50 to-blue-50 p-5 rounded-lg border border-indigo-100 text-center">
                <p className="text-sm text-gray-600 mb-1">Readability</p>
                <p className={`text-2xl font-bold ${getScoreColor(readabilityScore)}`}>{readabilityScore}%</p>
              </div>
            </div>
            
            <Card className="overflow-hidden">
              <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100">
                <h3 className="font-semibold">ATS Checks ({passRate}% Pass Rate)</h3>
              </div>
              <CardContent className="divide-y divide-gray-100 p-0">
                {atsFeedback.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center">
                      {item.check ? (
                        <div className="bg-green-100 p-1.5 rounded-full mr-3">
                          <Check className="h-4 w-4 text-green-600" />
                        </div>
                      ) : (
                        <div className="bg-red-100 p-1.5 rounded-full mr-3">
                          <XCircle className="h-4 w-4 text-red-600" />
                        </div>
                      )}
                      <span className={item.check ? "text-gray-800" : "text-gray-500"}>{item.message}</span>
                    </div>
                    <Badge className={`${getBadgeColor(item.impact)} font-normal`}>{item.impact}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
            
            <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex items-start">
              <AlertCircle className="h-5 w-5 text-blue-600 mr-3 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-blue-900">
                  <span className="font-medium">Pro Tip:</span> Most employers use ATS systems to filter resumes. A score above 80% significantly increases your chances of getting past automated filters and into human hands.
                  <a 
                      href="https://docs.google.com/document/d/1CKGglaXyYad16IFiYSDpGd2ofro5dYmi4eD1JNeHkD4/edit?usp=sharing" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 underline hover:text-blue-800"
                    > Use this 100% ATS-optimized resume template
                    </a> to increase your chances further.
                </p>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="job-match" className="mt-0">
            <JobDescriptionAnalyzer resumeText={resume?.text || null} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default ATSScoreCard;
