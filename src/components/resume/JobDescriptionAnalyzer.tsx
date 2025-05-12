
import React, { useState, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Check, X, AlertCircle, CopyIcon, ArrowDown, Info, TrendingUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Spinner } from '@/components/ui/spinner';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Form, FormControl, FormField, FormItem } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';

interface JobDescriptionAnalyzerProps {
  resumeText: string | null;
}

interface KeywordMatch {
  keyword: string;
  frequency: number;
  matched: boolean;
}

interface SkillMatch {
  skill: string;
  importance: 'high' | 'medium' | 'low';
  matched: boolean;
}

interface AnalysisResult {
  overallScore: number;
  keywordMatches: KeywordMatch[];
  missingKeywords: string[];
  technicalSkills: SkillMatch[];
  functionalSkills: SkillMatch[];
  responsibilities: SkillMatch[];
  improvementSuggestions: string[];
  error?: string;
}

const JobDescriptionAnalyzer: React.FC<JobDescriptionAnalyzerProps> = ({ resumeText }) => {
  const [activeTab, setActiveTab] = useState<string>('job-input');
  const [jobUrl, setJobUrl] = useState<string>('');
  const [jobDescription, setJobDescription] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const { toast } = useToast();
  const resultRef = useRef<HTMLDivElement>(null);
  
  const form = useForm({
    defaultValues: {
      jobUrl: '',
      jobDescription: '',
    }
  });

  const handleUrlExtract = async () => {
    if (!jobUrl) {
      toast({
        title: "URL Required",
        description: "Please enter a job posting URL",
        variant: "destructive",
      });
      return;
    }

    setIsExtracting(true);
    try {
      console.log("Starting Job Extraction from: ", jobUrl)
      const { data, error } = await supabase.functions.invoke('scrape-job-description', {
        body: { url: jobUrl }
      });

      if (error) throw new Error(error.message);
      
      if (data?.jobDescription) {
        setJobDescription(data.jobDescription);
        toast({
          title: "Description Extracted",
          jobDescription: "Job description was successfully extracted",
        });
      } else {
        toast({
          title: "Extraction Failed",
          jobDescription: "Could not extract job description from URL",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error extracting job description:", error);
      toast({
        title: "Extraction Error",
        description: "An error occurred while extracting the job description",
        variant: "destructive",
      });
    } finally {
      setIsExtracting(false);
    }
  };

  const analyzeJobMatch = async () => {
    if (!resumeText) {
      toast({
        title: "Resume Required",
        description: "Please upload your resume first",
        variant: "destructive",
      });
      return;
    }

    if (!jobDescription) {
      toast({
        title: "Job Description Required",
        description: "Please enter or extract a job description",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);
    setActiveTab('results');

    try {
      // First try to use the AI-powered analysis
      let result;
      try {
        const { data, error } = await supabase.functions.invoke('analyze-job-match', {
          body: { resumeText, jobDescription }
        });

        if (error) throw new Error(error.message);
        result = data;
      } catch (aiError) {
        console.error("AI analysis failed, falling back to basic analysis:", aiError);
        
        // Fallback to basic keyword matching
        const jobDescLower = jobDescription.toLowerCase();
        const resumeLower = resumeText.toLowerCase();
        
        // Extract keywords (simple approach)
        const keywords = extractKeywords(jobDescLower);
        const matchedWords = keywords.filter(word => resumeLower.includes(word));
        
        // Calculate simple score
        const matchScore = Math.round((matchedWords.length / keywords.length) * 100);
        
        // Create fallback result
        result = {
          overallScore: Math.min(100, matchScore),
          keywordMatches: keywords.map(keyword => ({
            keyword,
            frequency: countOccurrences(jobDescLower, keyword),
            matched: resumeLower.includes(keyword)
          })),
          missingKeywords: keywords.filter(word => !resumeLower.includes(word)),
          technicalSkills: extractSkills(jobDescLower, resumeLower, 'technical'),
          functionalSkills: extractSkills(jobDescLower, resumeLower, 'functional'),
          responsibilities: extractSkills(jobDescLower, resumeLower, 'responsibility'),
          improvementSuggestions: [
            "Tailor your resume to include more keywords from the job description.",
            "Add specific examples that demonstrate your relevant experience.",
            "Consider reorganizing your resume to highlight the most relevant skills first."
          ]
        };
      }

      setAnalysisResult(result);

      // Scroll to results after a brief delay to allow rendering
      setTimeout(() => {
        if (resultRef.current) {
          resultRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
      
      toast({
        title: "Analysis Complete",
        description: "Your resume has been analyzed against the job description.",
      });
    } catch (error) {
      console.error("Error analyzing job match:", error);
      toast({
        title: "Analysis Error",
        description: "An error occurred during analysis. Please try again.",
        variant: "destructive",
      });
      setAnalysisResult({
        overallScore: 0,
        keywordMatches: [],
        missingKeywords: [],
        technicalSkills: [],
        functionalSkills: [],
        responsibilities: [],
        improvementSuggestions: [],
        error: "Analysis failed. Please try again."
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const extractKeywords = (text: string): string[] => {
    const commonWords = ['and', 'the', 'in', 'to', 'of', 'for', 'a', 'an', 'with', 'by', 'on', 'at'];
    const words = text.split(/\W+/).filter(word => 
      word.length > 3 && !commonWords.includes(word)
    );
    return Array.from(new Set(words));
  };

  const countOccurrences = (text: string, word: string): number => {
    return text.split(new RegExp(`\\b${word}\\b`, 'gi')).length - 1;
  };

  const extractSkills = (jobDesc: string, resume: string, type: string): SkillMatch[] => {
    // Placeholder implementation - would be replaced by actual AI analysis
    const skills: SkillMatch[] = [];
    
    if (type === 'technical') {
      const technicalSkills = ['sql', 'python', 'java', 'react', 'tableau', 'power bi', 'excel'];
      technicalSkills.forEach(skill => {
        if (jobDesc.includes(skill)) {
          skills.push({
            skill,
            importance: jobDesc.split(new RegExp(`\\b${skill}\\b`, 'gi')).length > 2 ? 'high' : 'medium',
            matched: resume.includes(skill)
          });
        }
      });
    } else if (type === 'functional') {
      const functionalSkills = ['leadership', 'communication', 'project management', 'strategy', 'analytics'];
      functionalSkills.forEach(skill => {
        if (jobDesc.includes(skill)) {
          skills.push({
            skill,
            importance: jobDesc.split(new RegExp(`\\b${skill}\\b`, 'gi')).length > 2 ? 'high' : 'medium',
            matched: resume.includes(skill)
          });
        }
      });
    } else {
      const responsibilities = ['manage', 'develop', 'implement', 'analyze', 'create', 'lead', 'design'];
      responsibilities.forEach(resp => {
        if (jobDesc.includes(resp)) {
          skills.push({
            skill: resp,
            importance: jobDesc.split(new RegExp(`\\b${resp}\\b`, 'gi')).length > 2 ? 'high' : 'medium',
            matched: resume.includes(resp)
          });
        }
      });
    }
    
    return skills;
  };

  const copyResults = () => {
    if (!analysisResult) return;
    
    const resultText = `
Job Description Analysis Results:
Overall Compatibility: ${analysisResult.overallScore}%

Matched Keywords: ${analysisResult.keywordMatches
  .filter(k => k.matched)
  .map(k => k.keyword)
  .join(', ')}

Missing Keywords: ${analysisResult.missingKeywords.join(', ')}

Improvement Suggestions:
${analysisResult.improvementSuggestions.map(s => `- ${s}`).join('\n')}
    `;
    
    navigator.clipboard.writeText(resultText);
    toast({
      title: "Copied to Clipboard",
      description: "Analysis results have been copied to your clipboard",
    });
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-amber-600";
    return "text-red-600";
  };
  
  const getScoreBackground = (score: number) => {
    if (score >= 80) return "bg-green-100";
    if (score >= 60) return "bg-amber-100";
    return "bg-red-100";
  };

  const getImportanceBadge = (importance: string) => {
    switch(importance) {
      case 'high':
        return <Badge className="bg-red-100 text-red-800 border border-red-200">high</Badge>;
      case 'medium':
        return <Badge className="bg-amber-100 text-amber-800 border border-amber-200">medium</Badge>;
      default:
        return <Badge className="bg-blue-100 text-blue-800 border border-blue-200">low</Badge>;
    }
  };

  return (
    <div className="space-y-6 w-full">
      <Tabs 
        defaultValue="job-input" 
        value={activeTab}
        onValueChange={setActiveTab}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="job-input" disabled={isAnalyzing}>Job Description</TabsTrigger>
          <TabsTrigger value="results" disabled={!analysisResult && !isAnalyzing}>Analysis Results</TabsTrigger>
        </TabsList>
        
        <TabsContent value="job-input" className="space-y-4 pt-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Job Posting URL (Optional)</h3>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  placeholder="https://example.com/jobs/123"
                  value={jobUrl}
                  onChange={(e) => setJobUrl(e.target.value)}
                  className="flex-1"
                />
                <Button 
                  onClick={handleUrlExtract} 
                  disabled={isExtracting || !jobUrl}
                  className="whitespace-nowrap"
                >
                  {isExtracting ? <Spinner size="sm" className="mr-2" /> : null}
                  {isExtracting ? "Extracting..." : "Extract Description"}
                </Button>
              </div>
            </div>
            
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Job Description</h3>
              <Textarea
                placeholder="Paste the job description here..."
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                rows={10}
                className="resize-none"
              />
            </div>
            
            <div className="pt-2">
              <Button 
                onClick={analyzeJobMatch} 
                disabled={isAnalyzing || !jobDescription || !resumeText}
                className="w-full sm:w-auto"
              >
                {isAnalyzing ? <Spinner size="sm" className="mr-2" /> : null}
                {isAnalyzing ? "Analyzing..." : "Analyze Compatibility"}
              </Button>
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="results" className="space-y-6 pt-4" ref={resultRef}>
          {isAnalyzing ? (
            <div className="flex flex-col items-center justify-center p-8 space-y-4">
              <Spinner size="lg" />
              <p className="text-lg font-medium text-center">
                Analyzing your resume against the job description...
              </p>
              <p className="text-sm text-muted-foreground text-center">
                This may take a moment as we perform a detailed analysis of compatibility.
              </p>
            </div>
          ) : analysisResult ? (
            <div className="space-y-8">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <h2 className="text-xl font-semibold">Job Description Analysis</h2>
                  <p className="text-sm text-muted-foreground">Using AI-powered analysis</p>
                </div>
                <Button variant="outline" size="sm" onClick={copyResults}>
                  <CopyIcon className="h-4 w-4 mr-2" />
                  Copy Results
                </Button>
              </div>

              {/* Overall Compatibility Score */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <h3 className="font-medium text-lg">Overall Compatibility</h3>
                  <span className={`text-2xl font-bold ${getScoreColor(analysisResult.overallScore)}`}>
                    {analysisResult.overallScore}%
                  </span>
                </div>
                <Progress 
                  value={analysisResult.overallScore} 
                  className="h-3 bg-gray-100" 
                />
              </div>

              {/* Keyword Analysis with Tabs */}
              <div className="space-y-4">
                <h3 className="font-medium text-lg">Keyword Evaluation</h3>
                <Tabs defaultValue="matched" className="w-full">
                  <TabsList className="grid grid-cols-2 mb-4">
                    <TabsTrigger value="matched">
                      Matched Keywords
                      <span className="ml-2 bg-green-100 text-green-800 text-xs font-medium px-2 py-0.5 rounded">
                        {analysisResult.keywordMatches.filter(k => k.matched).length}
                      </span>
                    </TabsTrigger>
                    <TabsTrigger value="missing">
                      Missing Keywords
                      <span className="ml-2 bg-red-100 text-red-800 text-xs font-medium px-2 py-0.5 rounded">
                        {analysisResult.missingKeywords.length}
                      </span>
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="matched" className="mt-0">
                    <div className="bg-muted/30 rounded-md p-4">
                      <p className="text-sm text-muted-foreground mb-3">
                        Keywords in the job description that appear in your resume:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {analysisResult.keywordMatches
                          .filter(k => k.matched)
                          .map((match, index) => (
                            <Badge key={index} className="bg-green-100 text-green-800 border border-green-200">
                              {match.keyword} {match.frequency > 1 ? `${match.frequency}×` : ''}
                            </Badge>
                          ))
                        }
                        {analysisResult.keywordMatches.filter(k => k.matched).length === 0 && (
                          <p className="text-sm italic text-muted-foreground">No matched keywords found</p>
                        )}
                      </div>
                    </div>
                  </TabsContent>
                  <TabsContent value="missing" className="mt-0">
                    <div className="bg-muted/30 rounded-md p-4">
                      <p className="text-sm text-muted-foreground mb-3">
                        Important keywords in the job description missing from your resume:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {analysisResult.missingKeywords.map((keyword, index) => (
                          <Badge key={index} variant="outline" className="bg-red-50 border-red-200">
                            {keyword}
                          </Badge>
                        ))}
                        {analysisResult.missingKeywords.length === 0 && (
                          <p className="text-sm italic text-muted-foreground">No missing keywords found</p>
                        )}
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
              
              {/* Skills Section */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Technical Skills */}
                <Card>
                  <CardContent className="p-4 space-y-3">
                    <h4 className="font-semibold">Technical Skills</h4>
                    <ScrollArea className="h-[200px] pr-4">
                      <div className="space-y-2">
                        {analysisResult.technicalSkills.map((skill, index) => (
                          <div key={index} className="flex justify-between items-center p-2 rounded-md bg-muted/30">
                            <div className="flex items-center gap-2">
                              {skill.matched ? 
                                <Check className="h-4 w-4 text-green-600" /> : 
                                <X className="h-4 w-4 text-red-600" />
                              }
                              <span>{skill.skill}</span>
                            </div>
                            {getImportanceBadge(skill.importance)}
                          </div>
                        ))}
                        {analysisResult.technicalSkills.length === 0 && (
                          <p className="text-sm italic text-muted-foreground">No technical skills identified</p>
                        )}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
                
                {/* Functional Skills */}
                <Card>
                  <CardContent className="p-4 space-y-3">
                    <h4 className="font-semibold">Functional Skills</h4>
                    <ScrollArea className="h-[200px] pr-4">
                      <div className="space-y-2">
                        {analysisResult.functionalSkills.map((skill, index) => (
                          <div key={index} className="flex justify-between items-center p-2 rounded-md bg-muted/30">
                            <div className="flex items-center gap-2">
                              {skill.matched ? 
                                <Check className="h-4 w-4 text-green-600" /> : 
                                <X className="h-4 w-4 text-red-600" />
                              }
                              <span>{skill.skill}</span>
                            </div>
                            {getImportanceBadge(skill.importance)}
                          </div>
                        ))}
                        {analysisResult.functionalSkills.length === 0 && (
                          <p className="text-sm italic text-muted-foreground">No functional skills identified</p>
                        )}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
                
                {/* Responsibilities */}
                <Card>
                  <CardContent className="p-4 space-y-3">
                    <h4 className="font-semibold">Responsibilities</h4>
                    <ScrollArea className="h-[200px] pr-4">
                      <div className="space-y-2">
                        {analysisResult.responsibilities.map((resp, index) => (
                          <div key={index} className="flex justify-between items-center p-2 rounded-md bg-muted/30">
                            <div className="flex items-center gap-2">
                              {resp.matched ? 
                                <Check className="h-4 w-4 text-green-600" /> : 
                                <X className="h-4 w-4 text-red-600" />
                              }
                              <span>{resp.skill}</span>
                            </div>
                            {getImportanceBadge(resp.importance)}
                          </div>
                        ))}
                        {analysisResult.responsibilities.length === 0 && (
                          <p className="text-sm italic text-muted-foreground">No responsibilities identified</p>
                        )}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
              
              {/* Improvement Suggestions */}
              <Card className={`${getScoreBackground(analysisResult.overallScore)} border-0`}>
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp className={`h-5 w-5 ${getScoreColor(analysisResult.overallScore)}`} />
                    <h3 className="font-semibold">Improvement Suggestions</h3>
                  </div>
                  <ul className="space-y-2 list-disc pl-5">
                    {analysisResult.improvementSuggestions.map((suggestion, index) => (
                      <li key={index} className="text-sm">{suggestion}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              {/* Pro Tip */}
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 flex items-start space-x-3">
                <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm text-blue-900">
                    <span className="font-medium">Pro Tip:</span> Tailoring your resume for each job application increases your chances of passing ATS filters by up to 60%. Focus on incorporating the missing keywords and skills identified above.
                  </p>
                </div>
              </div>

              {/* Jump back to input button */}
              <div className="pt-4 flex justify-center">
                <Button 
                  variant="outline" 
                  onClick={() => setActiveTab('job-input')}
                  className="flex items-center gap-2"
                >
                  <ArrowDown className="h-4 w-4 rotate-90" />
                  Try Another Job Description
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-8 space-y-4 text-center">
              <AlertCircle className="h-12 w-12 text-muted-foreground" />
              <h3 className="text-lg font-medium">No Analysis Results Yet</h3>
              <p className="text-muted-foreground">
                Enter a job description and click "Analyze Compatibility" to see how your resume matches the position.
              </p>
              <Button onClick={() => setActiveTab('job-input')}>Enter Job Description</Button>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default JobDescriptionAnalyzer;
