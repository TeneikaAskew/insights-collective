
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AlertCircle, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface JobDescriptionAnalyzerProps {
  resumeText: string | null;
}

interface KeywordMatch {
  keyword: string;
  category: string;
  found: boolean;
}

interface AnalysisResult {
  technicalSkills: KeywordMatch[];
  functionalSkills: KeywordMatch[];
  softSkills: KeywordMatch[];
  responsibilities: KeywordMatch[];
  competencies: KeywordMatch[];
  overallMatchPercentage: number;
  categoryScores: {
    [key: string]: number;
  };
  improvementSuggestions: string[];
}

const CATEGORIES = {
  TECHNICAL: 'Technical Skills',
  FUNCTIONAL: 'Functional Skills',
  SOFT: 'Soft Skills',
  RESPONSIBILITIES: 'Responsibilities',
  COMPETENCIES: 'Core Competencies'
};

const JobDescriptionAnalyzer: React.FC<JobDescriptionAnalyzerProps> = ({ resumeText }) => {
  const [jobDescription, setJobDescription] = useState('');
  const [jobUrl, setJobUrl] = useState('');
  const [isFetchingUrl, setIsFetchingUrl] = useState(false);
  const [urlFetchError, setUrlFetchError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  // Function to try scraping job description from URL
  const fetchJobDescription = async () => {
    if (!jobUrl.trim()) return;
    
    setIsFetchingUrl(true);
    setUrlFetchError(null);
    
    try {
      // Call the edge function to scrape the job description
      const { data, error } = await supabase.functions.invoke('scrape-job-description', {
        body: { url: jobUrl }
      });
      
      if (error) throw new Error(error.message);
      
      if (data?.jobDescription) {
        setJobDescription(data.jobDescription);
        toast({
          title: "Success",
          description: "Job description extracted successfully.",
        });
      } else {
        throw new Error("Could not extract job description from URL.");
      }
    } catch (err) {
      console.error('Error fetching job description:', err);
      setUrlFetchError('Could not extract job description from this URL. Please paste it manually.');
      toast({
        title: "Extraction Failed",
        description: "Please paste the job description manually.",
        variant: "destructive"
      });
    } finally {
      setIsFetchingUrl(false);
    }
  };

  // Function to extract keywords from job description by category
  const extractKeywords = (text: string) => {
    // Common technical skills keywords
    const technicalSkillsRegex = /\b(javascript|react|typescript|python|java|c\+\+|sql|nosql|mongodb|aws|azure|docker|kubernetes|git|html|css|rest|api|scala|spark|hadoop|node\.js|golang|ruby|php|swift|kotlin|flutter|react native|vue\.js|angular|django|flask|spring|tensorflow|pytorch|ml|ai|blockchain|cloud|devops|data science|machine learning|deep learning|frontend|backend|fullstack|database|mysql|postgresql|oracle|programming|software|development|engineering|automation|cicd|jenkins|microservices|architecture)\b/gi;
    
    // Functional or role-specific skills
    const functionalSkillsRegex = /\b(project management|agile|scrum|kanban|product management|business analysis|data analysis|marketing|sales|customer service|operations|finance|accounting|hr|human resources|recruitment|talent acquisition|legal|compliance|research|quality assurance|testing|ux|ui|design|content|strategy|planning|forecasting)\b/gi;
    
    // Soft skills
    const softSkillsRegex = /\b(communication|teamwork|leadership|problem solving|problem-solving|critical thinking|time management|creativity|adaptability|flexibility|interpersonal|organizational|detail oriented|detail-oriented|self-motivated|proactive|collaborative|innovative|analytical|decision making|decision-making|conflict resolution|emotional intelligence|negotiation|persuasion|presentation|public speaking)\b/gi;
    
    // Responsibilities (action verbs)
    const responsibilitiesRegex = /\b(develop|implement|design|create|manage|lead|analyze|evaluate|coordinate|maintain|support|improve|optimize|research|oversee|direct|communicate|collaborate|solve|build|test|deploy|report|present|train|mentor|facilitate|drive|deliver|execute|establish|formulate|organize|prepare)\b/gi;
    
    // Core competencies
    const competenciesRegex = /\b(strategic thinking|cross-functional|stakeholder management|customer focus|results driven|results-driven|business acumen|industry knowledge|technical expertise|process improvement|innovation|relationship building|relationship-building|problem identification|resource management|change management|budget management|quality focus|continuous improvement|risk management|performance management)\b/gi;
    
    // Extract unique matches for each category
    const extractMatches = (regex: RegExp, text: string): string[] => {
      const matches = text.match(regex) || [];
      return [...new Set(matches.map(m => m.toLowerCase()))];
    };
    
    return {
      technicalSkills: extractMatches(technicalSkillsRegex, text),
      functionalSkills: extractMatches(functionalSkillsRegex, text),
      softSkills: extractMatches(softSkillsRegex, text),
      responsibilities: extractMatches(responsibilitiesRegex, text),
      competencies: extractMatches(competenciesRegex, text)
    };
  };

  // Main analysis function
  const analyzeJobMatch = async () => {
    if (!jobDescription.trim()) {
      toast({
        title: "Missing Information",
        description: "Please provide a job description to analyze.",
        variant: "destructive"
      });
      return;
    }
    
    if (!resumeText) {
      toast({
        title: "Missing Resume",
        description: "Resume text is required for analysis.",
        variant: "destructive"
      });
      return;
    }
    
    setIsAnalyzing(true);
    
    try {
      // Extract keywords from job description
      const jobKeywords = extractKeywords(jobDescription);
      
      // Check for matches in resume text
      const checkMatches = (keywords: string[], category: string): KeywordMatch[] => {
        return keywords.map(keyword => ({
          keyword,
          category,
          found: resumeText.toLowerCase().includes(keyword.toLowerCase())
        }));
      };
      
      // Generate matches for each category
      const technicalMatches = checkMatches(jobKeywords.technicalSkills, CATEGORIES.TECHNICAL);
      const functionalMatches = checkMatches(jobKeywords.functionalSkills, CATEGORIES.FUNCTIONAL);
      const softMatches = checkMatches(jobKeywords.softSkills, CATEGORIES.SOFT);
      const responsibilityMatches = checkMatches(jobKeywords.responsibilities, CATEGORIES.RESPONSIBILITIES);
      const competencyMatches = checkMatches(jobKeywords.competencies, CATEGORIES.COMPETENCIES);
      
      // Calculate scores for each category
      const calculateScore = (matches: KeywordMatch[]): number => {
        if (matches.length === 0) return 0;
        const matchCount = matches.filter(m => m.found).length;
        return Math.round((matchCount / matches.length) * 100);
      };
      
      const techScore = calculateScore(technicalMatches);
      const functionalScore = calculateScore(functionalMatches);
      const softScore = calculateScore(softMatches);
      const respScore = calculateScore(responsibilityMatches);
      const compScore = calculateScore(competencyMatches);
      
      // Calculate overall match percentage (weighted average)
      const weights = {
        [CATEGORIES.TECHNICAL]: 0.35,
        [CATEGORIES.FUNCTIONAL]: 0.25,
        [CATEGORIES.RESPONSIBILITIES]: 0.20,
        [CATEGORIES.COMPETENCIES]: 0.15,
        [CATEGORIES.SOFT]: 0.05
      };
      
      const allMatches = [
        ...technicalMatches, 
        ...functionalMatches, 
        ...softMatches, 
        ...responsibilityMatches,
        ...competencyMatches
      ];
      
      const overallMatchPercentage = Math.round(
        (techScore * weights[CATEGORIES.TECHNICAL]) +
        (functionalScore * weights[CATEGORIES.FUNCTIONAL]) +
        (respScore * weights[CATEGORIES.RESPONSIBILITIES]) +
        (compScore * weights[CATEGORIES.COMPETENCIES]) +
        (softScore * weights[CATEGORIES.SOFT])
      );
      
      // Generate improvement suggestions
      const missingKeywords = allMatches.filter(match => !match.found);
      const suggestions = generateImprovementSuggestions(missingKeywords);
      
      // Set analysis result
      setAnalysisResult({
        technicalSkills: technicalMatches,
        functionalSkills: functionalMatches,
        softSkills: softMatches,
        responsibilities: responsibilityMatches,
        competencies: competencyMatches,
        overallMatchPercentage,
        categoryScores: {
          [CATEGORIES.TECHNICAL]: techScore,
          [CATEGORIES.FUNCTIONAL]: functionalScore,
          [CATEGORIES.SOFT]: softScore,
          [CATEGORIES.RESPONSIBILITIES]: respScore,
          [CATEGORIES.COMPETENCIES]: compScore
        },
        improvementSuggestions: suggestions
      });
      
      toast({
        title: "Analysis Complete",
        description: `Your resume has a ${overallMatchPercentage}% match with this job description.`
      });
      
      // Store the analysis in Supabase if user is logged in
      if (user) {
        await storeJobAnalysis(overallMatchPercentage, jobDescription);
      }
      
    } catch (err) {
      console.error('Error analyzing job match:', err);
      toast({
        title: "Analysis Failed",
        description: "An error occurred during analysis. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsAnalyzing(false);
    }
  };
  
  // Generate improvement suggestions based on missing keywords
  const generateImprovementSuggestions = (missingKeywords: KeywordMatch[]): string[] => {
    const suggestions: string[] = [];
    
    // Group by category
    const byCategory: { [key: string]: string[] } = {};
    
    missingKeywords.forEach(match => {
      if (!byCategory[match.category]) {
        byCategory[match.category] = [];
      }
      byCategory[match.category].push(match.keyword);
    });
    
    // Generate suggestions for each category
    if (byCategory[CATEGORIES.TECHNICAL] && byCategory[CATEGORIES.TECHNICAL].length > 0) {
      const topTechSkills = byCategory[CATEGORIES.TECHNICAL].slice(0, 5).join(', ');
      suggestions.push(`Add these technical skills to your resume: ${topTechSkills}`);
    }
    
    if (byCategory[CATEGORIES.FUNCTIONAL] && byCategory[CATEGORIES.FUNCTIONAL].length > 0) {
      const topFuncSkills = byCategory[CATEGORIES.FUNCTIONAL].slice(0, 4).join(', ');
      suggestions.push(`Highlight these functional skills: ${topFuncSkills}`);
    }
    
    if (byCategory[CATEGORIES.RESPONSIBILITIES] && byCategory[CATEGORIES.RESPONSIBILITIES].length > 0) {
      const topVerbs = byCategory[CATEGORIES.RESPONSIBILITIES].slice(0, 5).join(', ');
      suggestions.push(`Use these action verbs in your experience section: ${topVerbs}`);
    }
    
    if (byCategory[CATEGORIES.COMPETENCIES] && byCategory[CATEGORIES.COMPETENCIES].length > 0) {
      const topComp = byCategory[CATEGORIES.COMPETENCIES].slice(0, 3).join(', ');
      suggestions.push(`Demonstrate these core competencies: ${topComp}`);
    }
    
    // Add general suggestions
    suggestions.push('Customize your resume summary to align with the job description');
    suggestions.push('Use the exact terminology from the job posting when applicable');
    
    return suggestions;
  };
  
  // Store the analysis in Supabase
  const storeJobAnalysis = async (matchScore: number, jobText: string) => {
    try {
      const { data: resumeData, error: resumeError } = await supabase
        .from('resumes')
        .select('id')
        .eq('user_id', user?.id)
        .order('uploaded_at', { ascending: false })
        .limit(1)
        .single();
      
      if (resumeError) throw resumeError;
      
      const resumeId = resumeData.id;
      
      // Store job analysis in a new table or in an existing one
      const { error } = await supabase
        .from('job_analyses')
        .insert({
          resume_id: resumeId,
          user_id: user?.id,
          job_description: jobText,
          match_score: matchScore,
          analyzed_at: new Date().toISOString()
        });
      
      if (error) throw error;
      
    } catch (err) {
      console.error('Error storing job analysis:', err);
      // Don't show an error toast as this is a background operation
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border border-muted">
        <CardHeader className="pb-3">
          <CardTitle className="text-xl">Job Description Analysis</CardTitle>
          <CardDescription>
            Enter a job description to analyze how well your resume matches the requirements
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* URL Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Job Posting URL</label>
            <div className="flex gap-2">
              <Input 
                type="url" 
                placeholder="https://example.com/job-posting" 
                value={jobUrl}
                onChange={(e) => setJobUrl(e.target.value)}
                disabled={isFetchingUrl}
                className="flex-grow"
              />
              <Button 
                onClick={fetchJobDescription} 
                disabled={!jobUrl.trim() || isFetchingUrl}
                variant="outline"
              >
                {isFetchingUrl ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Fetching</>
                ) : (
                  'Extract'
                )}
              </Button>
            </div>
            
            {urlFetchError && (
              <Alert variant="destructive" className="mt-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{urlFetchError}</AlertDescription>
              </Alert>
            )}
          </div>
          
          {/* Job Description Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Job Description</label>
            <Textarea 
              placeholder="Paste job description here..." 
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              rows={6}
              className="resize-none"
            />
          </div>
          
          <Button 
            onClick={analyzeJobMatch} 
            disabled={!jobDescription.trim() || isAnalyzing || !resumeText}
            className="w-full"
          >
            {isAnalyzing ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analyzing</>
            ) : (
              'Analyze Match'
            )}
          </Button>
        </CardContent>
      </Card>
      
      {analysisResult && (
        <Card className="border border-muted">
          <CardHeader className="pb-4">
            <div className="flex justify-between items-center">
              <CardTitle className="text-xl">Match Analysis Results</CardTitle>
              <div className="text-3xl font-bold text-green-600">
                {analysisResult.overallMatchPercentage}%
              </div>
            </div>
            <Progress value={analysisResult.overallMatchPercentage} className="h-2 mt-2" />
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* Category Scores */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {Object.entries(analysisResult.categoryScores).map(([category, score]) => (
                <div key={category} className="bg-muted/30 p-3 rounded-md text-center">
                  <p className="text-sm text-muted-foreground mb-1">{category}</p>
                  <p className={`text-xl font-semibold ${
                    score >= 80 ? 'text-green-600' :
                    score >= 60 ? 'text-amber-600' :
                    'text-red-600'
                  }`}>
                    {score}%
                  </p>
                </div>
              ))}
            </div>
            
            {/* Keyword Matches */}
            <div className="space-y-4">
              <h3 className="font-medium text-lg border-b pb-1">Keyword Analysis</h3>
              
              <div className="space-y-3">
                {/* Technical Skills */}
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground mb-2">Technical Skills</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {analysisResult.technicalSkills.map((match, index) => (
                      <Badge 
                        key={`${match.keyword}-${index}`}
                        variant={match.found ? "default" : "outline"} 
                        className={!match.found ? 'border-red-400 text-red-500' : ''}
                      >
                        {match.found ? <CheckCircle className="h-3 w-3 mr-1 inline" /> : <XCircle className="h-3 w-3 mr-1 inline" />}
                        {match.keyword}
                      </Badge>
                    ))}
                    {analysisResult.technicalSkills.length === 0 && (
                      <span className="text-sm text-muted-foreground">No technical skills detected in job description</span>
                    )}
                  </div>
                </div>
                
                {/* Functional Skills */}
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground mb-2">Functional Skills</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {analysisResult.functionalSkills.map((match, index) => (
                      <Badge 
                        key={`${match.keyword}-${index}`}
                        variant={match.found ? "default" : "outline"} 
                        className={!match.found ? 'border-red-400 text-red-500' : ''}
                      >
                        {match.found ? <CheckCircle className="h-3 w-3 mr-1 inline" /> : <XCircle className="h-3 w-3 mr-1 inline" />}
                        {match.keyword}
                      </Badge>
                    ))}
                    {analysisResult.functionalSkills.length === 0 && (
                      <span className="text-sm text-muted-foreground">No functional skills detected in job description</span>
                    )}
                  </div>
                </div>
                
                {/* Responsibilities */}
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground mb-2">Responsibilities (Action Verbs)</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {analysisResult.responsibilities.map((match, index) => (
                      <Badge 
                        key={`${match.keyword}-${index}`}
                        variant={match.found ? "default" : "outline"} 
                        className={!match.found ? 'border-red-400 text-red-500' : ''}
                      >
                        {match.found ? <CheckCircle className="h-3 w-3 mr-1 inline" /> : <XCircle className="h-3 w-3 mr-1 inline" />}
                        {match.keyword}
                      </Badge>
                    ))}
                    {analysisResult.responsibilities.length === 0 && (
                      <span className="text-sm text-muted-foreground">No action verbs detected in job description</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Improvement Suggestions */}
            <div className="bg-blue-50 border border-blue-100 rounded-md p-4">
              <h3 className="font-medium mb-2 text-blue-800">Improvement Suggestions</h3>
              <ul className="space-y-1 text-sm text-blue-700">
                {analysisResult.improvementSuggestions.map((suggestion, index) => (
                  <li key={index} className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>{suggestion}</span>
                  </li>
                ))}
              </ul>
            </div>
            
            {/* Export button */}
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => {
                const result = `
                  Job Match Analysis Results
                  Overall Match: ${analysisResult.overallMatchPercentage}%
                  
                  Category Scores:
                  ${Object.entries(analysisResult.categoryScores).map(([category, score]) => `- ${category}: ${score}%`).join('\n')}
                  
                  Improvement Suggestions:
                  ${analysisResult.improvementSuggestions.map(s => `- ${s}`).join('\n')}
                `.replace(/\s+/g, ' ').trim();
                
                navigator.clipboard.writeText(result);
                toast({
                  title: "Copied to Clipboard",
                  description: "Analysis results have been copied to your clipboard."
                });
              }}
            >
              Copy Results to Clipboard
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default JobDescriptionAnalyzer;
