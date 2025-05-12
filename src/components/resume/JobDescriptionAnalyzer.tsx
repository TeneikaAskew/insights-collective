import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Loader2, Copy, CheckCircle, AlertCircle, ExternalLink, Search } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { eng } from 'stopword';

interface JobDescriptionAnalyzerProps {
  resumeText: string | null;
}

interface SkillMatch {
  skill: string;
  found: boolean;
  importance: 'high' | 'medium' | 'low';
}

interface KeywordEvaluation {
  keyword: string;
  jobFrequency: number; // How many times it appears in job description
  resumeFrequency: number; // How many times it appears in resume
  matchPercentage: number; // Calculated percentage match
  isImportant: boolean; // Based on frequency in job description
}

interface JobAnalysis {
  technicalSkills: SkillMatch[];
  functionalSkills: SkillMatch[];
  responsibilities: SkillMatch[];
  overallScore: number;
  suggestions: string[];
  keywordEvaluation: KeywordEvaluation[];
  error?: string;
}

const initialAnalysisState: JobAnalysis = {
  technicalSkills: [],
  functionalSkills: [],
  responsibilities: [],
  overallScore: 0,
  suggestions: [],
  keywordEvaluation: []
};

const JobDescriptionAnalyzer: React.FC<JobDescriptionAnalyzerProps> = ({ resumeText }) => {
  const { toast } = useToast();
  const [jobDescription, setJobDescription] = useState<string>('');
  const [jobUrl, setJobUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isUrlProcessing, setIsUrlProcessing] = useState<boolean>(false);
  const [analysis, setAnalysis] = useState<JobAnalysis | null>(null);
  const [activeTab, setActiveTab] = useState<string>('input');
  const [showUrlError, setShowUrlError] = useState<boolean>(false);
  const [usedAI, setUsedAI] = useState<boolean>(false);
  const [keywordView, setKeywordView] = useState<'matched' | 'missing'>('matched');
  const analysisRef = useRef<HTMLDivElement>(null);

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobUrl) return;

    setIsUrlProcessing(true);
    setShowUrlError(false);

    try {
      console.log("Starting Job Description Extraction for: ", jobUrl)
      const response = await supabase.functions.invoke('scrape-job-description', {
        body: { url: jobUrl }
      });

      console.log("Job Description Response: ", response.data)

      if (response.data?.jobDescription) {
        setJobDescription(response.data.jobDescription);
        toast({
          title: "Job description extracted",
          description: "Successfully extracted content from the URL."
        });
      } else {
        setShowUrlError(true);
        toast({
          variant: "destructive",
          title: "Extraction failed",
          description: "Could not extract job description. Please paste it manually."
        });
      }
    } catch (error) {
      console.error("Error scraping URL:", error);
      setShowUrlError(true);
      toast({
        variant: "destructive",
        title: "Error processing URL",
        description: "An error occurred. Please paste the job description manually."
      });
    } finally {
      setIsUrlProcessing(false);
    }
  };

  // New function to extract and evaluate keywords
  const evaluateKeywords = (jobText: string, resumeText: string): KeywordEvaluation[] => {
    // Create a set from the English stopwords library for fast lookups
    const englishStopwords = new Set(eng);
    
    // Additional job-specific stopwords that aren't in the standard library
    const jobStopwords = new Set([
      // Common job posting words with little resume-matching value
      "job", "work", "position", "company", "team", "experience", "ability", "role", "candidate", "applicant", 
      "qualified", "qualification", "opportunity", "career", "employment", "salary", "compensation", "benefit",
      "benefits", "responsibilities", "requirements", "required", "preferred", "ideal", "strong", "excellent", 
      "outstanding", "exceptional", "proven", "demonstrated", "years", "month", "months", "year", "day", "days",
      "week", "weeks", "time", "full", "part", "duties", "tasks", "responsible", "responsibility", "successful",
      "success", "perform", "performing", "performs", "performed", "apply", "application", "applications", "please",
      "thank", "thanks", "contact", "email", "phone", "resume", "cover", "letter", "today", "ago", "new", "old",
      "good", "great", "best", "better", "within", "www", "http", "https", "com", "org", "net", "know", "knowledge",
      "information", "info", "provide", "provides", "provided", "providing", "support", "supports", "supported",
      "supporting", "include", "includes", "including", "included", "ensure", "ensures", "ensuring", "ensured"
    ]);
    
    // Combined stopwords set
    const stopwords = new Set([...englishStopwords, ...jobStopwords]);
    
    // Clean and extract words from job description
    const jobWords = jobText.toLowerCase()
      .replace(/[^\w\s-]/g, ' ')   // Remove punctuation except hyphens (to keep terms like "go-to-market")
      .split(/\s+/)                // Split by whitespace
      .filter(word => 
        word.length > 2 &&         // Filter out very short words
        !stopwords.has(word) &&    // Filter out stopwords
        !/^\d+$/.test(word)        // Filter out numbers
      );
    
    // Count frequency of each meaningful word in job description
    const jobWordFrequency: {[key: string]: number} = {};
    jobWords.forEach(word => {
      jobWordFrequency[word] = (jobWordFrequency[word] || 0) + 1;
    });
    
    // Also look for important compound terms (2-3 word phrases that appear multiple times)
    const extractCompoundTerms = (text: string): {[key: string]: number} => {
      const result: {[key: string]: number} = {};
      const words = text.toLowerCase().replace(/[^\w\s-]/g, ' ').split(/\s+/);
      
      // Extract 2-word and 3-word phrases
      for (let i = 0; i < words.length - 1; i++) {
        if (words[i].length > 2 && !stopwords.has(words[i]) && 
            words[i+1].length > 2 && !stopwords.has(words[i+1])) {
          // 2-word phrase
          const phrase = `${words[i]} ${words[i+1]}`;
          result[phrase] = (result[phrase] || 0) + 1;
        }
        
        // 3-word phrase
        if (i < words.length - 2 && 
            words[i].length > 2 && !stopwords.has(words[i]) && 
            words[i+1].length > 2 && !stopwords.has(words[i+1]) &&
            words[i+2].length > 2 && !stopwords.has(words[i+2])) {
          const phrase = `${words[i]} ${words[i+1]} ${words[i+2]}`;
          result[phrase] = (result[phrase] || 0) + 1;
        }
      }
      
      return result;
    };
    
    const compoundTerms = extractCompoundTerms(jobText);
    
    // Merge single words and important compound terms
    for (const [term, count] of Object.entries(compoundTerms)) {
      if (count >= 2) { // Only include terms that appear at least twice
        jobWordFrequency[term] = count;
      }
    }
    
    // Get top keywords by frequency (words that appear multiple times)
    const keywordsToEvaluate = Object.entries(jobWordFrequency)
      .filter(([_, count]) => count >= 2)  // Only words that appear at least twice
      .sort((a, b) => b[1] - a[1])         // Sort by frequency, highest first
      .slice(0, 30)                        // Take top 30 keywords
      .map(([word]) => word);
    
    // Now evaluate each keyword's presence in resume
    const keywordEvaluation: KeywordEvaluation[] = keywordsToEvaluate.map(keyword => {
      // Count occurrences in resume
      const resumeLower = resumeText.toLowerCase();
      const keywordRegex = new RegExp(`\\b${keyword}\\b`, 'g');
      const resumeMatches = (resumeLower.match(keywordRegex) || []).length;
      const jobMatches = jobWordFrequency[keyword];
      
      // Calculate a match percentage (capped at 100%)
      const matchPercentage = Math.min(100, Math.round((resumeMatches / jobMatches) * 100));
      
      return {
        keyword,
        jobFrequency: jobMatches,
        resumeFrequency: resumeMatches,
        matchPercentage,
        isImportant: jobMatches >= 3  // Consider keywords that appear 3+ times as important
      };
    });
    
    return keywordEvaluation;
  };

  const analyzeJobDescription = useCallback(async () => {
    if (!jobDescription || !resumeText) {
      toast({
        variant: "destructive",
        title: "Missing information",
        description: "Both job description and resume are required for analysis."
      });
      return;
    }

    setIsLoading(true);
    setAnalysis(null);

    try {
      // First try the AI-based analysis using the edge function
      const response = await supabase.functions.invoke('analyze-job-match', {
        body: { 
          jobDescription,
          resumeText
        }
      });

      if (response.data && !response.error) {
        // Add keyword evaluation to the AI analysis
        const keywordEval = evaluateKeywords(jobDescription, resumeText);
        
        setAnalysis({
          ...response.data,
          keywordEvaluation: keywordEval
        });
        
        setActiveTab('results');
        setUsedAI(true);
        if (analysisRef.current) {
          analysisRef.current.scrollIntoView({ behavior: 'smooth' });
        }
        return;
      } else {
        console.error("AI analysis failed, falling back to standard analysis:", response.error);
        // If AI analysis fails, continue to fallback
      }
    } catch (error) {
      console.error("Error with AI analysis, falling back to standard analysis:", error);
      // If AI analysis fails, continue to fallback
    }

    // Fallback to the current keyword matching approach
    try {
      // Extract keywords from job description (simple method)
      const techKeywords = extractKeywords(jobDescription, ['python', 'javascript', 'react', 'node', 'aws', 'sql', 'data', 'analyst', 'engineer', 'scientist', 'cloud', 'azure', 'machine learning', 'ai', 'database', 'analytics']);
      
      const functionalKeywords = extractKeywords(jobDescription, ['analysis', 'reporting', 'strategy', 'planning', 'leadership', 'management', 'research', 'development', 'testing', 'communication', 'presentation', 'coordination']);
      
      const actionVerbs = extractKeywords(jobDescription, ['develop', 'create', 'analyze', 'design', 'implement', 'manage', 'coordinate', 'lead', 'build', 'optimize', 'improve', 'enhance', 'collaborate', 'execute']);
      
      // Check resume for matches
      const techMatches = techKeywords.map(keyword => ({
        skill: keyword,
        found: resumeText.toLowerCase().includes(keyword.toLowerCase()),
        importance: determineImportance(jobDescription, keyword)
      }));
      
      const functionalMatches = functionalKeywords.map(keyword => ({
        skill: keyword,
        found: resumeText.toLowerCase().includes(keyword.toLowerCase()),
        importance: determineImportance(jobDescription, keyword)
      }));
      
      const responsibilityMatches = actionVerbs.map(keyword => ({
        skill: keyword,
        found: resumeText.toLowerCase().includes(keyword.toLowerCase()),
        importance: determineImportance(jobDescription, keyword)
      }));
      
      // Calculate overall match score
      const totalKeywords = techMatches.length + functionalMatches.length + responsibilityMatches.length;
      const matchedKeywords = 
        techMatches.filter(m => m.found).length + 
        functionalMatches.filter(m => m.found).length + 
        responsibilityMatches.filter(m => m.found).length;
      
      const overallScore = totalKeywords > 0 
        ? Math.round((matchedKeywords / totalKeywords) * 100) 
        : 0;
      
      // Generate suggestions
      const suggestions = generateSuggestions(techMatches, functionalMatches, responsibilityMatches);
      
      // Add the keyword evaluation
      const keywordEval = evaluateKeywords(jobDescription, resumeText);
      
      setAnalysis({
        technicalSkills: techMatches,
        functionalSkills: functionalMatches,
        responsibilities: responsibilityMatches,
        overallScore,
        suggestions,
        keywordEvaluation: keywordEval
      });
      
      setActiveTab('results');
      setUsedAI(false);
      
      if (analysisRef.current) {
        analysisRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    } catch (error) {
      console.error("Error analyzing job description:", error);
      setAnalysis({
        ...initialAnalysisState,
        error: "An error occurred during analysis. Please try again."
      });
    } finally {
      setIsLoading(false);
    }
  }, [jobDescription, resumeText, toast]);

  const extractKeywords = (text: string, keywordList: string[]): string[] => {
    const lowerText = text.toLowerCase();
    return keywordList.filter(keyword => lowerText.includes(keyword.toLowerCase()));
  };

  const determineImportance = (text: string, keyword: string): 'high' | 'medium' | 'low' => {
    const lowerText = text.toLowerCase();
    const keywordCount = (lowerText.match(new RegExp(keyword.toLowerCase(), 'g')) || []).length;
    
    if (keywordCount >= 3) return 'high';
    if (keywordCount >= 2) return 'medium';
    return 'low';
  };

  const generateSuggestions = (
    techMatches: SkillMatch[], 
    functionalMatches: SkillMatch[], 
    responsibilityMatches: SkillMatch[]
  ): string[] => {
    const suggestions: string[] = [];
    
    // Find missing high importance technical skills
    const missingTechSkills = techMatches
      .filter(m => !m.found && m.importance === 'high')
      .map(m => m.skill);
    
    if (missingTechSkills.length > 0) {
      suggestions.push(`Add these critical technical skills to your resume: ${missingTechSkills.join(', ')}`);
    }
    
    // Find missing high importance functional skills
    const missingFunctionalSkills = functionalMatches
      .filter(m => !m.found && m.importance === 'high')
      .map(m => m.skill);
    
    if (missingFunctionalSkills.length > 0) {
      suggestions.push(`Highlight these important functional skills: ${missingFunctionalSkills.join(', ')}`);
    }
    
    // Find missing high importance action verbs
    const missingActionVerbs = responsibilityMatches
      .filter(m => !m.found && m.importance === 'high')
      .map(m => m.skill);
    
    if (missingActionVerbs.length > 0) {
      suggestions.push(`Use these action verbs in your experience section: ${missingActionVerbs.join(', ')}`);
    }
    
    // General suggestion
    if (suggestions.length === 0) {
      suggestions.push("Your resume matches many key requirements. Consider quantifying your achievements for even greater impact.");
    }
    
    return suggestions;
  };

  const copyToClipboard = () => {
    if (!analysis) return;
    
    const content = `
Job-Resume Match Analysis

Overall Compatibility: ${analysis.overallScore}%

Technical Skills:
${analysis.technicalSkills.map(skill => `${skill.skill}: ${skill.found ? '✓' : '✗'} (${skill.importance} importance)`).join('\n')}

Functional Skills:
${analysis.functionalSkills.map(skill => `${skill.skill}: ${skill.found ? '✓' : '✗'} (${skill.importance} importance)`).join('\n')}

Responsibilities/Action Verbs:
${analysis.responsibilities.map(skill => `${skill.skill}: ${skill.found ? '✓' : '✗'} (${skill.importance} importance)`).join('\n')}

Top Keywords:
${analysis.keywordEvaluation.slice(0, 10).map(k => `${k.keyword}: ${k.matchPercentage}% match (appears ${k.jobFrequency} times in job description)`).join('\n')}

Improvement Suggestions:
${analysis.suggestions.map(s => `- ${s}`).join('\n')}
    `;
    
    navigator.clipboard.writeText(content).then(() => {
      toast({
        title: "Analysis copied",
        description: "Results have been copied to clipboard."
      });
    });
  };

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="input">Job Description</TabsTrigger>
          <TabsTrigger value="results" disabled={!analysis}>Analysis Results</TabsTrigger>
        </TabsList>
        
        <TabsContent value="input" className="space-y-4">
          <div className="grid gap-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <Label htmlFor="jobUrl">Job Posting URL (Optional)</Label>
                {isUrlProcessing && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              </div>
              
              <form onSubmit={handleUrlSubmit} className="flex items-center gap-2">
                <Input 
                  id="jobUrl"
                  placeholder="https://example.com/job-posting" 
                  value={jobUrl} 
                  onChange={(e) => setJobUrl(e.target.value)}
                  className="flex-1"
                />
                <Button 
                  type="submit" 
                  size="sm" 
                  variant="outline"
                  disabled={isUrlProcessing || !jobUrl}>
                  {isUrlProcessing ? 'Extracting...' : 'Extract'}
                </Button>
              </form>
              
              {showUrlError && (
                <Alert variant="destructive" className="mt-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Could not extract job description from URL. Please paste it manually below.
                  </AlertDescription>
                </Alert>
              )}
            </div>
            
            <div>
              <Label htmlFor="jobDescription" className="mb-2 block">Job Description</Label>
              <Textarea 
                id="jobDescription"
                placeholder="Paste the job description here..." 
                value={jobDescription} 
                onChange={(e) => setJobDescription(e.target.value)}
                className="min-h-[200px]"
              />
            </div>
            
            <Button 
              onClick={analyzeJobDescription} 
              disabled={isLoading || !jobDescription || !resumeText}
              className="w-full">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : 'Analyze Compatibility'}
            </Button>
          </div>
        </TabsContent>
        
        <TabsContent value="results">
          {analysis && (
            <div ref={analysisRef} className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium">Job Description Analysis</h3>
                  <p className="text-sm text-muted-foreground">
                    {usedAI ? "Using AI-powered analysis" : "Using keyword matching"}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={copyToClipboard}>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy Results
                </Button>
              </div>
              
              <Card>
                <CardContent className="pt-6">
                  <div className="mb-6">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="font-medium">Overall Compatibility</h4>
                      <span className={`font-bold ${
                        analysis.overallScore >= 80 ? 'text-green-600' :
                        analysis.overallScore >= 60 ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>{analysis.overallScore}%</span>
                    </div>
                    <Progress value={analysis.overallScore} className="h-2" />
                  </div>
                  
                  {/* New Keyword Evaluation Section */}
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium">Keyword Evaluation</h4>
                      <div className="flex gap-1">
                        <Button 
                          size="sm" 
                          variant={keywordView === 'matched' ? "default" : "outline"}
                          onClick={() => setKeywordView('matched')}
                          className="text-xs h-7 px-2"
                        >
                          Matched Keywords
                        </Button>
                        <Button 
                          size="sm" 
                          variant={keywordView === 'missing' ? "default" : "outline"}
                          onClick={() => setKeywordView('missing')}
                          className="text-xs h-7 px-2"
                        >
                          Missing Keywords
                        </Button>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-2 mb-2">
                      {keywordView === 'matched' ? (
                        // Show matched keywords (with non-zero match percentage)
                        <div className="space-y-3">
                          <p className="text-sm text-muted-foreground">Keywords in the job description that appear in your resume:</p>
                          <div className="flex flex-wrap gap-2">
                            {analysis.keywordEvaluation
                              .filter(k => k.matchPercentage > 0)
                              .sort((a, b) => b.jobFrequency - a.jobFrequency)
                              .map((keyword, i) => (
                                <Badge 
                                  key={i} 
                                  className={`
                                    flex items-center gap-1 py-1 px-2
                                    ${keyword.isImportant ? 'bg-green-100 text-green-800 border-green-200' : 'bg-blue-100 text-blue-800 border-blue-200'}
                                  `}
                                >
                                  <span>{keyword.keyword}</span>
                                  <span className="text-xs bg-white bg-opacity-30 rounded px-1">
                                    {keyword.matchPercentage}%
                                  </span>
                                </Badge>
                              ))}
                            {analysis.keywordEvaluation.filter(k => k.matchPercentage > 0).length === 0 && (
                              <p className="text-sm text-muted-foreground">No matching keywords found.</p>
                            )}
                          </div>
                          
                          <div className="text-xs text-muted-foreground flex items-center mt-2">
                            <Search className="h-3 w-3 mr-1" />
                            <span>
                              Frequency indicates how often a keyword appears in the job description.
                              Higher percentages indicate better matches.
                            </span>
                          </div>
                        </div>
                      ) : (
                        // Show missing keywords (with zero match percentage)
                        <div className="space-y-3">
                          <p className="text-sm text-muted-foreground">Important keywords from the job description missing in your resume:</p>
                          <div className="flex flex-wrap gap-2">
                            {analysis.keywordEvaluation
                              .filter(k => k.matchPercentage === 0)
                              .sort((a, b) => b.jobFrequency - a.jobFrequency)
                              .map((keyword, i) => (
                                <Badge 
                                  key={i} 
                                  variant="outline"
                                  className={`
                                    flex items-center gap-1 py-1 px-2
                                    ${keyword.isImportant ? 'border-red-400 text-red-500' : 'border-orange-400 text-orange-500'}
                                  `}
                                >
                                  <span>{keyword.keyword}</span>
                                  <span className="text-xs bg-white bg-opacity-10 rounded px-1">
                                    {keyword.jobFrequency}×
                                  </span>
                                </Badge>
                              ))}
                            {analysis.keywordEvaluation.filter(k => k.matchPercentage === 0).length === 0 && (
                              <p className="text-sm text-muted-foreground">Great job! No important missing keywords found.</p>
                            )}
                          </div>
                          
                          <div className="text-xs text-muted-foreground flex items-center mt-2">
                            <Search className="h-3 w-3 mr-1" />
                            <span>
                              Frequency indicates how often a keyword appears in the job description.
                              Higher frequencies indicate more important terms.
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                    

                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">Technical Skills</h4>
                      {analysis.technicalSkills.length > 0 ? (
                        <div className="space-y-1">
                          {analysis.technicalSkills.map((skill, i) => (
                            <div key={i} className="flex items-center justify-between">
                              <span className="text-sm flex items-center">
                                {skill.found ? 
                                  <CheckCircle className="h-3 w-3 text-green-500 mr-1" /> : 
                                  <AlertCircle className="h-3 w-3 text-red-500 mr-1" />
                                }
                                {skill.skill}
                              </span>
                              <Badge className={`
                                ${skill.importance === 'high' ? 'bg-red-100 text-red-800 border-red-200' : 
                                  skill.importance === 'medium' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                                  'bg-blue-100 text-blue-800 border-blue-200'}
                                text-xs font-normal
                              `}>
                                {skill.importance}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No technical skills identified</p>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">Functional Skills</h4>
                      {analysis.functionalSkills.length > 0 ? (
                        <div className="space-y-1">
                          {analysis.functionalSkills.map((skill, i) => (
                            <div key={i} className="flex items-center justify-between">
                              <span className="text-sm flex items-center">
                                {skill.found ? 
                                  <CheckCircle className="h-3 w-3 text-green-500 mr-1" /> : 
                                  <AlertCircle className="h-3 w-3 text-red-500 mr-1" />
                                }
                                {skill.skill}
                              </span>
                              <Badge className={`
                                ${skill.importance === 'high' ? 'bg-red-100 text-red-800 border-red-200' : 
                                  skill.importance === 'medium' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                                  'bg-blue-100 text-blue-800 border-blue-200'}
                                text-xs font-normal
                              `}>
                                {skill.importance}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No functional skills identified</p>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">Responsibilities</h4>
                      {analysis.responsibilities.length > 0 ? (
                        <div className="space-y-1">
                          {analysis.responsibilities.map((skill, i) => (
                            <div key={i} className="flex items-center justify-between">
                              <span className="text-sm flex items-center">
                                {skill.found ? 
                                  <CheckCircle className="h-3 w-3 text-green-500 mr-1" /> : 
                                  <AlertCircle className="h-3 w-3 text-red-500 mr-1" />
                                }
                                {skill.skill}
                              </span>
                              <Badge className={`
                                ${skill.importance === 'high' ? 'bg-red-100 text-red-800 border-red-200' : 
                                  skill.importance === 'medium' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                                  'bg-blue-100 text-blue-800 border-blue-200'}
                                text-xs font-normal
                              `}>
                                {skill.importance}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No responsibilities identified</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <h4 className="font-medium">Improvement Suggestions</h4>
                    {analysis.suggestions.length > 0 ? (
                      <ul className="list-disc pl-5 space-y-1">
                        {analysis.suggestions.map((suggestion, i) => (
                          <li key={i} className="text-sm">{suggestion}</li>
                        ))}
                        {/* Add suggestions based on keyword evaluation */}
                        {analysis.keywordEvaluation
                          .filter(k => k.isImportant && k.matchPercentage === 0)
                          .length > 0 && (
                          <li className="text-sm">
                            Add these frequently mentioned keywords to your resume: {
                              analysis.keywordEvaluation
                                .filter(k => k.isImportant && k.matchPercentage === 0)
                                .slice(0, 5)
                                .map(k => k.keyword)
                                .join(', ')
                            }
                          </li>
                        )}
                        <li className="text-sm">
                          Tailor your resume to the job description by highlighting relevant skills and experiences.
                        </li>
                        <li className="text-sm">
                          Consider adding coursework or certifications in relevant fields to increase competitiveness.
                        </li>
                        <li className="text-sm">
                          Emphasize transferable skills that can be applied to the role.
                        </li>
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground">No specific suggestions available</p>
                    )}
                  </div>
                </CardContent>
              </Card>
              
              <div className="text-xs text-muted-foreground flex items-center">
                <InfoIcon className="h-3 w-3 mr-1" />
                For best results, regularly update your resume and tailor it for specific job applications
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

const InfoIcon = (props: React.SVGProps<SVGSVGElement>) => {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
};

export default JobDescriptionAnalyzer;

// import React, { useState, useCallback, useRef, useEffect } from 'react';
// import { Button } from '@/components/ui/button';
// import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
// import { Textarea } from '@/components/ui/textarea';
// import { Input } from '@/components/ui/input';
// import { Alert, AlertDescription } from '@/components/ui/alert';
// import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
// import { Label } from '@/components/ui/label';
// import { Progress } from '@/components/ui/progress';
// import { Badge } from '@/components/ui/badge';
// import { Loader2, Copy, CheckCircle, AlertCircle, ExternalLink, Search } from 'lucide-react';
// import { useToast } from '@/components/ui/use-toast';
// import { supabase } from '@/integrations/supabase/client';

// interface JobDescriptionAnalyzerProps {
//   resumeText: string | null;
// }

// interface SkillMatch {
//   skill: string;
//   found: boolean;
//   importance: 'high' | 'medium' | 'low';
// }

// interface KeywordEvaluation {
//   keyword: string;
//   jobFrequency: number; // How many times it appears in job description
//   resumeFrequency: number; // How many times it appears in resume
//   matchPercentage: number; // Calculated percentage match
//   isImportant: boolean; // Based on frequency in job description
// }

// interface JobAnalysis {
//   technicalSkills: SkillMatch[];
//   functionalSkills: SkillMatch[];
//   responsibilities: SkillMatch[];
//   overallScore: number;
//   suggestions: string[];
//   keywordEvaluation: KeywordEvaluation[];
//   error?: string;
// }

// const initialAnalysisState: JobAnalysis = {
//   technicalSkills: [],
//   functionalSkills: [],
//   responsibilities: [],
//   overallScore: 0,
//   suggestions: [],
//   keywordEvaluation: []
// };

// const JobDescriptionAnalyzer: React.FC<JobDescriptionAnalyzerProps> = ({ resumeText }) => {
//   const { toast } = useToast();
//   const [jobDescription, setJobDescription] = useState<string>('');
//   const [jobUrl, setJobUrl] = useState<string>('');
//   const [isLoading, setIsLoading] = useState<boolean>(false);
//   const [isUrlProcessing, setIsUrlProcessing] = useState<boolean>(false);
//   const [analysis, setAnalysis] = useState<JobAnalysis | null>(null);
//   const [activeTab, setActiveTab] = useState<string>('input');
//   const [showUrlError, setShowUrlError] = useState<boolean>(false);
//   const [usedAI, setUsedAI] = useState<boolean>(false);
//   const [keywordView, setKeywordView] = useState<'matched' | 'missing'>('matched');
//   const analysisRef = useRef<HTMLDivElement>(null);

//   const handleUrlSubmit = async (e: React.FormEvent) => {
//     e.preventDefault();
//     if (!jobUrl) return;

//     setIsUrlProcessing(true);
//     setShowUrlError(false);

//     try {
//       console.log("Starting Job Description Extraction for: ", jobUrl)
//       const response = await supabase.functions.invoke('scrape-job-description', {
//         body: { url: jobUrl }
//       });

//       console.log("Job Description Response: ", response.data)

//       if (response.data?.jobDescription) {
//         setJobDescription(response.data.jobDescription);
//         toast({
//           title: "Job description extracted",
//           description: "Successfully extracted content from the URL."
//         });
//       } else {
//         setShowUrlError(true);
//         toast({
//           variant: "destructive",
//           title: "Extraction failed",
//           description: "Could not extract job description. Please paste it manually."
//         });
//       }
//     } catch (error) {
//       console.error("Error scraping URL:", error);
//       setShowUrlError(true);
//       toast({
//         variant: "destructive",
//         title: "Error processing URL",
//         description: "An error occurred. Please paste the job description manually."
//       });
//     } finally {
//       setIsUrlProcessing(false);
//     }
//   };

//   // New function to extract and evaluate keywords
//   const evaluateKeywords = (jobText: string, resumeText: string): KeywordEvaluation[] => {
//     // First, extract meaningful words from job description (excluding common words)
//     const commonWords = new Set([
//       "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for", "with", 
//       "by", "about", "as", "of", "that", "this", "these", "those", "it", "they", 
//       "we", "you", "he", "she", "is", "are", "was", "were", "be", "been", "being",
//       "have", "has", "had", "do", "does", "did", "will", "would", "should", "could",
//       "can", "may", "might", "must", "from", "job", "work", "position", "company",
//       "team", "experience", "ability", "role", "candidate", "applicant", "year", "years"
//     ]);
    
//     // Clean and extract words from job description
//     const jobWords = jobText.toLowerCase()
//       .replace(/[^\w\s]/g, ' ')  // Remove punctuation
//       .split(/\s+/)              // Split by whitespace
//       .filter(word => 
//         word.length > 2 &&       // Filter out very short words
//         !commonWords.has(word)   // Filter out common words
//       );
    
//     // Count frequency of each meaningful word in job description
//     const jobWordFrequency: {[key: string]: number} = {};
//     jobWords.forEach(word => {
//       jobWordFrequency[word] = (jobWordFrequency[word] || 0) + 1;
//     });
    
//     // Get top keywords by frequency (words that appear multiple times)
//     const keywordsToEvaluate = Object.entries(jobWordFrequency)
//       .filter(([_, count]) => count >= 2)  // Only words that appear at least twice
//       .sort((a, b) => b[1] - a[1])         // Sort by frequency, highest first
//       .slice(0, 30)                        // Take top 30 keywords
//       .map(([word]) => word);
    
//     // Now evaluate each keyword's presence in resume
//     const keywordEvaluation: KeywordEvaluation[] = keywordsToEvaluate.map(keyword => {
//       // Count occurrences in resume
//       const resumeLower = resumeText.toLowerCase();
//       const keywordRegex = new RegExp(`\\b${keyword}\\b`, 'g');
//       const resumeMatches = (resumeLower.match(keywordRegex) || []).length;
//       const jobMatches = jobWordFrequency[keyword];
      
//       // Calculate a match percentage (capped at 100%)
//       const matchPercentage = Math.min(100, Math.round((resumeMatches / jobMatches) * 100));
      
//       return {
//         keyword,
//         jobFrequency: jobMatches,
//         resumeFrequency: resumeMatches,
//         matchPercentage,
//         isImportant: jobMatches >= 3  // Consider keywords that appear 3+ times as important
//       };
//     });
    
//     return keywordEvaluation;
//   };

//   const analyzeJobDescription = useCallback(async () => {
//     if (!jobDescription || !resumeText) {
//       toast({
//         variant: "destructive",
//         title: "Missing information",
//         description: "Both job description and resume are required for analysis."
//       });
//       return;
//     }

//     setIsLoading(true);
//     setAnalysis(null);

//     try {
//       // First try the AI-based analysis using the edge function
//       const response = await supabase.functions.invoke('analyze-job-match', {
//         body: { 
//           jobDescription,
//           resumeText
//         }
//       });

//       if (response.data && !response.error) {
//         // Add keyword evaluation to the AI analysis
//         const keywordEval = evaluateKeywords(jobDescription, resumeText);
        
//         setAnalysis({
//           ...response.data,
//           keywordEvaluation: keywordEval
//         });
        
//         setActiveTab('results');
//         setUsedAI(true);
//         if (analysisRef.current) {
//           analysisRef.current.scrollIntoView({ behavior: 'smooth' });
//         }
//         return;
//       } else {
//         console.error("AI analysis failed, falling back to standard analysis:", response.error);
//         // If AI analysis fails, continue to fallback
//       }
//     } catch (error) {
//       console.error("Error with AI analysis, falling back to standard analysis:", error);
//       // If AI analysis fails, continue to fallback
//     }

//     // Fallback to the current keyword matching approach
//     try {
//       // Extract keywords from job description (simple method)
//       const techKeywords = extractKeywords(jobDescription, ['python', 'javascript', 'react', 'node', 'aws', 'sql', 'data', 'analyst', 'engineer', 'scientist', 'cloud', 'azure', 'machine learning', 'ai', 'database', 'analytics']);
      
//       const functionalKeywords = extractKeywords(jobDescription, ['analysis', 'reporting', 'strategy', 'planning', 'leadership', 'management', 'research', 'development', 'testing', 'communication', 'presentation', 'coordination']);
      
//       const actionVerbs = extractKeywords(jobDescription, ['develop', 'create', 'analyze', 'design', 'implement', 'manage', 'coordinate', 'lead', 'build', 'optimize', 'improve', 'enhance', 'collaborate', 'execute']);
      
//       // Check resume for matches
//       const techMatches = techKeywords.map(keyword => ({
//         skill: keyword,
//         found: resumeText.toLowerCase().includes(keyword.toLowerCase()),
//         importance: determineImportance(jobDescription, keyword)
//       }));
      
//       const functionalMatches = functionalKeywords.map(keyword => ({
//         skill: keyword,
//         found: resumeText.toLowerCase().includes(keyword.toLowerCase()),
//         importance: determineImportance(jobDescription, keyword)
//       }));
      
//       const responsibilityMatches = actionVerbs.map(keyword => ({
//         skill: keyword,
//         found: resumeText.toLowerCase().includes(keyword.toLowerCase()),
//         importance: determineImportance(jobDescription, keyword)
//       }));
      
//       // Calculate overall match score
//       const totalKeywords = techMatches.length + functionalMatches.length + responsibilityMatches.length;
//       const matchedKeywords = 
//         techMatches.filter(m => m.found).length + 
//         functionalMatches.filter(m => m.found).length + 
//         responsibilityMatches.filter(m => m.found).length;
      
//       const overallScore = totalKeywords > 0 
//         ? Math.round((matchedKeywords / totalKeywords) * 100) 
//         : 0;
      
//       // Generate suggestions
//       const suggestions = generateSuggestions(techMatches, functionalMatches, responsibilityMatches);
      
//       // Add the keyword evaluation
//       const keywordEval = evaluateKeywords(jobDescription, resumeText);
      
//       setAnalysis({
//         technicalSkills: techMatches,
//         functionalSkills: functionalMatches,
//         responsibilities: responsibilityMatches,
//         overallScore,
//         suggestions,
//         keywordEvaluation: keywordEval
//       });
      
//       setActiveTab('results');
//       setUsedAI(false);
      
//       if (analysisRef.current) {
//         analysisRef.current.scrollIntoView({ behavior: 'smooth' });
//       }
//     } catch (error) {
//       console.error("Error analyzing job description:", error);
//       setAnalysis({
//         ...initialAnalysisState,
//         error: "An error occurred during analysis. Please try again."
//       });
//     } finally {
//       setIsLoading(false);
//     }
//   }, [jobDescription, resumeText, toast]);

//   const extractKeywords = (text: string, keywordList: string[]): string[] => {
//     const lowerText = text.toLowerCase();
//     return keywordList.filter(keyword => lowerText.includes(keyword.toLowerCase()));
//   };

//   const determineImportance = (text: string, keyword: string): 'high' | 'medium' | 'low' => {
//     const lowerText = text.toLowerCase();
//     const keywordCount = (lowerText.match(new RegExp(keyword.toLowerCase(), 'g')) || []).length;
    
//     if (keywordCount >= 3) return 'high';
//     if (keywordCount >= 2) return 'medium';
//     return 'low';
//   };

//   const generateSuggestions = (
//     techMatches: SkillMatch[], 
//     functionalMatches: SkillMatch[], 
//     responsibilityMatches: SkillMatch[]
//   ): string[] => {
//     const suggestions: string[] = [];
    
//     // Find missing high importance technical skills
//     const missingTechSkills = techMatches
//       .filter(m => !m.found && m.importance === 'high')
//       .map(m => m.skill);
    
//     if (missingTechSkills.length > 0) {
//       suggestions.push(`Add these critical technical skills to your resume: ${missingTechSkills.join(', ')}`);
//     }
    
//     // Find missing high importance functional skills
//     const missingFunctionalSkills = functionalMatches
//       .filter(m => !m.found && m.importance === 'high')
//       .map(m => m.skill);
    
//     if (missingFunctionalSkills.length > 0) {
//       suggestions.push(`Highlight these important functional skills: ${missingFunctionalSkills.join(', ')}`);
//     }
    
//     // Find missing high importance action verbs
//     const missingActionVerbs = responsibilityMatches
//       .filter(m => !m.found && m.importance === 'high')
//       .map(m => m.skill);
    
//     if (missingActionVerbs.length > 0) {
//       suggestions.push(`Use these action verbs in your experience section: ${missingActionVerbs.join(', ')}`);
//     }
    
//     // General suggestion
//     if (suggestions.length === 0) {
//       suggestions.push("Your resume matches many key requirements. Consider quantifying your achievements for even greater impact.");
//     }
    
//     return suggestions;
//   };

//   const copyToClipboard = () => {
//     if (!analysis) return;
    
//     const content = `
// Job-Resume Match Analysis

// Overall Compatibility: ${analysis.overallScore}%

// Technical Skills:
// ${analysis.technicalSkills.map(skill => `${skill.skill}: ${skill.found ? '✓' : '✗'} (${skill.importance} importance)`).join('\n')}

// Functional Skills:
// ${analysis.functionalSkills.map(skill => `${skill.skill}: ${skill.found ? '✓' : '✗'} (${skill.importance} importance)`).join('\n')}

// Responsibilities/Action Verbs:
// ${analysis.responsibilities.map(skill => `${skill.skill}: ${skill.found ? '✓' : '✗'} (${skill.importance} importance)`).join('\n')}

// Top Keywords:
// ${analysis.keywordEvaluation.slice(0, 10).map(k => `${k.keyword}: ${k.matchPercentage}% match (appears ${k.jobFrequency} times in job description)`).join('\n')}

// Improvement Suggestions:
// ${analysis.suggestions.map(s => `- ${s}`).join('\n')}
//     `;
    
//     navigator.clipboard.writeText(content).then(() => {
//       toast({
//         title: "Analysis copied",
//         description: "Results have been copied to clipboard."
//       });
//     });
//   };

//   return (
//     <div className="space-y-6">
//       <Tabs value={activeTab} onValueChange={setActiveTab}>
//         <TabsList className="grid w-full grid-cols-2">
//           <TabsTrigger value="input">Job Description</TabsTrigger>
//           <TabsTrigger value="results" disabled={!analysis}>Analysis Results</TabsTrigger>
//         </TabsList>
        
//         <TabsContent value="input" className="space-y-4">
//           <div className="grid gap-4">
//             <div>
//               <div className="flex justify-between items-center mb-2">
//                 <Label htmlFor="jobUrl">Job Posting URL (Optional)</Label>
//                 {isUrlProcessing && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
//               </div>
              
//               <form onSubmit={handleUrlSubmit} className="flex items-center gap-2">
//                 <Input 
//                   id="jobUrl"
//                   placeholder="https://example.com/job-posting" 
//                   value={jobUrl} 
//                   onChange={(e) => setJobUrl(e.target.value)}
//                   className="flex-1"
//                 />
//                 <Button 
//                   type="submit" 
//                   size="sm" 
//                   variant="outline"
//                   disabled={isUrlProcessing || !jobUrl}>
//                   {isUrlProcessing ? 'Extracting...' : 'Extract'}
//                 </Button>
//               </form>
              
//               {showUrlError && (
//                 <Alert variant="destructive" className="mt-2">
//                   <AlertCircle className="h-4 w-4" />
//                   <AlertDescription>
//                     Could not extract job description from URL. Please paste it manually below.
//                   </AlertDescription>
//                 </Alert>
//               )}
//             </div>
            
//             <div>
//               <Label htmlFor="jobDescription" className="mb-2 block">Job Description</Label>
//               <Textarea 
//                 id="jobDescription"
//                 placeholder="Paste the job description here..." 
//                 value={jobDescription} 
//                 onChange={(e) => setJobDescription(e.target.value)}
//                 className="min-h-[200px]"
//               />
//             </div>
            
//             <Button 
//               onClick={analyzeJobDescription} 
//               disabled={isLoading || !jobDescription || !resumeText}
//               className="w-full">
//               {isLoading ? (
//                 <>
//                   <Loader2 className="mr-2 h-4 w-4 animate-spin" />
//                   Analyzing...
//                 </>
//               ) : 'Analyze Compatibility'}
//             </Button>
//           </div>
//         </TabsContent>
        
//         <TabsContent value="results">
//           {analysis && (
//             <div ref={analysisRef} className="space-y-6">
//               <div className="flex items-center justify-between">
//                 <div>
//                   <h3 className="text-lg font-medium">Job Description Analysis</h3>
//                   <p className="text-sm text-muted-foreground">
//                     {usedAI ? "Using AI-powered analysis" : "Using keyword matching"}
//                   </p>
//                 </div>
//                 <Button variant="outline" size="sm" onClick={copyToClipboard}>
//                   <Copy className="mr-2 h-4 w-4" />
//                   Copy Results
//                 </Button>
//               </div>
              
//               <Card>
//                 <CardContent className="pt-6">
//                   <div className="mb-6">
//                     <div className="flex justify-between items-center mb-2">
//                       <h4 className="font-medium">Overall Compatibility</h4>
//                       <span className={`font-bold ${
//                         analysis.overallScore >= 80 ? 'text-green-600' :
//                         analysis.overallScore >= 60 ? 'text-yellow-600' :
//                         'text-red-600'
//                       }`}>{analysis.overallScore}%</span>
//                     </div>
//                     <Progress value={analysis.overallScore} className="h-2" />
//                   </div>
                  
//                   {/* New Keyword Evaluation Section */}
//                   <div className="mb-6">
//                     <div className="flex items-center justify-between mb-3">
//                       <h4 className="font-medium">Keyword Evaluation</h4>
//                       <div className="flex gap-1">
//                         <Button 
//                           size="sm" 
//                           variant={keywordView === 'matched' ? "default" : "outline"}
//                           onClick={() => setKeywordView('matched')}
//                           className="text-xs h-7 px-2"
//                         >
//                           Matched Keywords
//                         </Button>
//                         <Button 
//                           size="sm" 
//                           variant={keywordView === 'missing' ? "default" : "outline"}
//                           onClick={() => setKeywordView('missing')}
//                           className="text-xs h-7 px-2"
//                         >
//                           Missing Keywords
//                         </Button>
//                       </div>
//                     </div>
                    
//                     <div className="grid grid-cols-1 gap-2 mb-2">
//                       {keywordView === 'matched' ? (
//                         // Show matched keywords (with non-zero match percentage)
//                         <div className="space-y-3">
//                           <p className="text-sm text-muted-foreground">Keywords in the job description that appear in your resume:</p>
//                           <div className="flex flex-wrap gap-2">
//                             {analysis.keywordEvaluation
//                               .filter(k => k.matchPercentage > 0)
//                               .sort((a, b) => b.jobFrequency - a.jobFrequency)
//                               .map((keyword, i) => (
//                                 <Badge 
//                                   key={i} 
//                                   className={`
//                                     flex items-center gap-1 py-1 px-2
//                                     ${keyword.isImportant ? 'bg-green-100 text-green-800 border-green-200' : 'bg-blue-100 text-blue-800 border-blue-200'}
//                                   `}
//                                 >
//                                   <span>{keyword.keyword}</span>
//                                   <span className="text-xs bg-white bg-opacity-30 rounded px-1">
//                                     {keyword.matchPercentage}%
//                                   </span>
//                                 </Badge>
//                               ))}
//                             {analysis.keywordEvaluation.filter(k => k.matchPercentage > 0).length === 0 && (
//                               <p className="text-sm text-muted-foreground">No matching keywords found.</p>
//                             )}
//                           </div>
//                         </div>
//                       ) : (
//                         // Show missing keywords (with zero match percentage)
//                         <div className="space-y-3">
//                           <p className="text-sm text-muted-foreground">Important keywords from the job description missing in your resume:</p>
//                           <div className="flex flex-wrap gap-2">
//                             {analysis.keywordEvaluation
//                               .filter(k => k.matchPercentage === 0)
//                               .sort((a, b) => b.jobFrequency - a.jobFrequency)
//                               .map((keyword, i) => (
//                                 <Badge 
//                                   key={i} 
//                                   variant="outline"
//                                   className={`
//                                     flex items-center gap-1 py-1 px-2
//                                     ${keyword.isImportant ? 'border-red-400 text-red-500' : 'border-orange-400 text-orange-500'}
//                                   `}
//                                 >
//                                   <span>{keyword.keyword}</span>
//                                   <span className="text-xs bg-white bg-opacity-10 rounded px-1">
//                                     {keyword.jobFrequency}×
//                                   </span>
//                                 </Badge>
//                               ))}
//                             {analysis.keywordEvaluation.filter(k => k.matchPercentage === 0).length === 0 && (
//                               <p className="text-sm text-muted-foreground">Great job! No important missing keywords found.</p>
//                             )}
//                           </div>
//                         </div>
//                       )}
//                     </div>
                    
//                     <div className="text-xs text-muted-foreground flex items-center mt-2">
//                       <Search className="h-3 w-3 mr-1" />
//                       <span>
//                         Frequency indicates how often a keyword appears in the job description.
//                         {keywordView === 'matched' ? ' Higher percentages indicate better matches.' : ' Higher frequencies indicate more important terms.'}
//                       </span>
//                     </div>
//                   </div>
                  
//                   <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
//                     <div className="space-y-2">
//                       <h4 className="font-medium text-sm">Technical Skills</h4>
//                       {analysis.technicalSkills.length > 0 ? (
//                         <div className="space-y-1">
//                           {analysis.technicalSkills.map((skill, i) => (
//                             <div key={i} className="flex items-center justify-between">
//                               <span className="text-sm flex items-center">
//                                 {skill.found ? 
//                                   <CheckCircle className="h-3 w-3 text-green-500 mr-1" /> : 
//                                   <AlertCircle className="h-3 w-3 text-red-500 mr-1" />
//                                 }
//                                 {skill.skill}
//                               </span>
//                               <Badge className={`
//                                 ${skill.importance === 'high' ? 'bg-red-100 text-red-800 border-red-200' : 
//                                   skill.importance === 'medium' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
//                                   'bg-blue-100 text-blue-800 border-blue-200'}
//                                 text-xs font-normal
//                               `}>
//                                 {skill.importance}
//                               </Badge>
//                             </div>
//                           ))}
//                         </div>
//                       ) : (
//                         <p className="text-sm text-muted-foreground">No technical skills identified</p>
//                       )}
//                     </div>
                    
//                     <div className="space-y-2">
//                       <h4 className="font-medium text-sm">Functional Skills</h4>
//                       {analysis.functionalSkills.length > 0 ? (
//                         <div className="space-y-1">
//                           {analysis.functionalSkills.map((skill, i) => (
//                             <div key={i} className="flex items-center justify-between">
//                               <span className="text-sm flex items-center">
//                                 {skill.found ? 
//                                   <CheckCircle className="h-3 w-3 text-green-500 mr-1" /> : 
//                                   <AlertCircle className="h-3 w-3 text-red-500 mr-1" />
//                                 }
//                                 {skill.skill}
//                               </span>
//                               <Badge className={`
//                                 ${skill.importance === 'high' ? 'bg-red-100 text-red-800 border-red-200' : 
//                                   skill.importance === 'medium' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
//                                   'bg-blue-100 text-blue-800 border-blue-200'}
//                                 text-xs font-normal
//                               `}>
//                                 {skill.importance}
//                               </Badge>
//                             </div>
//                           ))}
//                         </div>
//                       ) : (
//                         <p className="text-sm text-muted-foreground">No functional skills identified</p>
//                       )}
//                     </div>
                    
//                     <div className="space-y-2">
//                       <h4 className="font-medium text-sm">Responsibilities</h4>
//                       {analysis.responsibilities.length > 0 ? (
//                         <div className="space-y-1">
//                           {analysis.responsibilities.map((skill, i) => (
//                             <div key={i} className="flex items-center justify-between">
//                               <span className="text-sm flex items-center">
//                                 {skill.found ? 
//                                   <CheckCircle className="h-3 w-3 text-green-500 mr-1" /> : 
//                                   <AlertCircle className="h-3 w-3 text-red-500 mr-1" />
//                                 }
//                                 {skill.skill}
//                               </span>
//                               <Badge className={`
//                                 ${skill.importance === 'high' ? 'bg-red-100 text-red-800 border-red-200' : 
//                                   skill.importance === 'medium' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
//                                   'bg-blue-100 text-blue-800 border-blue-200'}
//                                 text-xs font-normal
//                               `}>
//                                 {skill.importance}
//                               </Badge>
//                             </div>
//                           ))}
//                         </div>
//                       ) : (
//                         <p className="text-sm text-muted-foreground">No responsibilities identified</p>
//                       )}
//                     </div>
//                   </div>
                  
//                   <div className="space-y-2">
//                     <h4 className="font-medium">Improvement Suggestions</h4>
//                     {analysis.suggestions.length > 0 ? (
//                       <ul className="list-disc pl-5 space-y-1">
//                         {analysis.suggestions.map((suggestion, i) => (
//                           <li key={i} className="text-sm">{suggestion}</li>
//                         ))}
//                         {/* Add suggestions based on keyword evaluation */}
//                         {analysis.keywordEvaluation
//                           .filter(k => k.isImportant && k.matchPercentage === 0)
//                           .length > 0 && (
//                           <li className="text-sm">
//                             Add these frequently mentioned keywords to your resume: {
//                               analysis.keywordEvaluation
//                                 .filter(k => k.isImportant && k.matchPercentage === 0)
//                                 .slice(0, 5)
//                                 .map(k => k.keyword)
//                                 .join(', ')
//                             }
//                           </li>
//                         )}
//                       </ul>
//                     ) : (
//                       <p className="text-sm text-muted-foreground">No specific suggestions available</p>
//                     )}
//                   </div>
//                 </CardContent>
//               </Card>
              
//               <div className="text-xs text-muted-foreground flex items-center">
//                 <InfoIcon className="h-3 w-3 mr-1" />
//                 For best results, regularly update your resume and tailor it for specific job applications
//               </div>
//             </div>
//           )}
//         </TabsContent>
//       </Tabs>
//     </div>
//   );
// };

// const InfoIcon = (props: React.SVGProps<SVGSVGElement>) => {
//   return (
//     <svg
//       {...props}
//       xmlns="http://www.w3.org/2000/svg"
//       width="24"
//       height="24"
//       viewBox="0 0 24 24"
//       fill="none"
//       stroke="currentColor"
//       strokeWidth="2"
//       strokeLinecap="round"
//       strokeLinejoin="round"
//     >
//       <circle cx="12" cy="12" r="10" />
//       <path d="M12 16v-4" />
//       <path d="M12 8h.01" />
//     </svg>
//   );
// };

// export default JobDescriptionAnalyzer;
// // import React, { useState, useCallback, useRef } from 'react';
// // import { Button } from '@/components/ui/button';
// // import { Card, CardContent } from '@/components/ui/card';
// // import { Textarea } from '@/components/ui/textarea';
// // import { Input } from '@/components/ui/input';
// // import { Alert, AlertDescription } from '@/components/ui/alert';
// // import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
// // import { Label } from '@/components/ui/label';
// // import { Progress } from '@/components/ui/progress';
// // import { Badge } from '@/components/ui/badge';
// // import { Loader2, Copy, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';
// // import { useToast } from '@/components/ui/use-toast';
// // import { supabase } from '@/integrations/supabase/client';

// // interface JobDescriptionAnalyzerProps {
// //   resumeText: string | null;
// // }

// // interface SkillMatch {
// //   skill: string;
// //   found: boolean;
// //   importance: 'high' | 'medium' | 'low';
// // }

// // interface JobAnalysis {
// //   technicalSkills: SkillMatch[];
// //   functionalSkills: SkillMatch[];
// //   responsibilities: SkillMatch[];
// //   overallScore: number;
// //   suggestions: string[];
// //   error?: string;
// // }

// // const initialAnalysisState: JobAnalysis = {
// //   technicalSkills: [],
// //   functionalSkills: [],
// //   responsibilities: [],
// //   overallScore: 0,
// //   suggestions: []
// // };

// // const JobDescriptionAnalyzer: React.FC<JobDescriptionAnalyzerProps> = ({ resumeText }) => {
// //   const { toast } = useToast();
// //   const [jobDescription, setJobDescription] = useState<string>('');
// //   const [jobUrl, setJobUrl] = useState<string>('');
// //   const [isLoading, setIsLoading] = useState<boolean>(false);
// //   const [isUrlProcessing, setIsUrlProcessing] = useState<boolean>(false);
// //   const [analysis, setAnalysis] = useState<JobAnalysis | null>(null);
// //   const [activeTab, setActiveTab] = useState<string>('input');
// //   const [showUrlError, setShowUrlError] = useState<boolean>(false);
// //   const [usedAI, setUsedAI] = useState<boolean>(false);
// //   const analysisRef = useRef<HTMLDivElement>(null);

// //   const handleUrlSubmit = async (e: React.FormEvent) => {
// //     e.preventDefault();
// //     if (!jobUrl) return;

// //     setIsUrlProcessing(true);
// //     setShowUrlError(false);

// //     try {
// //       console.log("Starting Job Description Extraction for: ", jobUrl)
// //       const response = await supabase.functions.invoke('scrape-job-description', {
// //         body: { url: jobUrl }
// //       });

// //       // console.log("Job Description Response: ", response)
// //       console.log("Job Description Response: ", response.data)

// //       if (response.data?.jobDescription) {
        
// //         setJobDescription(response.data.jobDescription);
// //         toast({
// //           title: "Job description extracted",
// //           description: "Successfully extracted content from the URL."
// //         });
// //       } else {
// //         setShowUrlError(true);
// //         toast({
// //           variant: "destructive",
// //           title: "Extraction failed",
// //           description: "Could not extract job description. Please paste it manually."
// //         });
// //       }
// //     } catch (error) {
// //       console.error("Error scraping URL:", error);
// //       setShowUrlError(true);
// //       toast({
// //         variant: "destructive",
// //         title: "Error processing URL",
// //         description: "An error occurred. Please paste the job description manually."
// //       });
// //     } finally {
// //       setIsUrlProcessing(false);
// //     }
// //   };

// //   const analyzeJobDescription = useCallback(async () => {
// //     if (!jobDescription || !resumeText) {
// //       toast({
// //         variant: "destructive",
// //         title: "Missing information",
// //         description: "Both job description and resume are required for analysis."
// //       });
// //       return;
// //     }

// //     setIsLoading(true);
// //     setAnalysis(null);

// //     try {
// //       // First try the AI-based analysis using the edge function
// //       const response = await supabase.functions.invoke('analyze-job-match', {
// //         body: { 
// //           jobDescription,
// //           resumeText
// //         }
// //       });

// //       if (response.data && !response.error) {
// //         setAnalysis(response.data);
// //         setActiveTab('results');
// //         setUsedAI(true);
// //         if (analysisRef.current) {
// //           analysisRef.current.scrollIntoView({ behavior: 'smooth' });
// //         }
// //         return;
// //       } else {
// //         console.error("AI analysis failed, falling back to standard analysis:", response.error);
// //         // If AI analysis fails, continue to fallback
// //       }
// //     } catch (error) {
// //       console.error("Error with AI analysis, falling back to standard analysis:", error);
// //       // If AI analysis fails, continue to fallback
// //     }

// //     // Fallback to the current keyword matching approach
// //     try {
// //       // Extract keywords from job description (simple method)
// //       const techKeywords = extractKeywords(jobDescription, ['python', 'javascript', 'react', 'node', 'aws', 'sql', 'data', 'analyst', 'engineer', 'scientist', 'cloud', 'azure', 'machine learning', 'ai', 'database', 'analytics']);
      
// //       const functionalKeywords = extractKeywords(jobDescription, ['analysis', 'reporting', 'strategy', 'planning', 'leadership', 'management', 'research', 'development', 'testing', 'communication', 'presentation', 'coordination']);
      
// //       const actionVerbs = extractKeywords(jobDescription, ['develop', 'create', 'analyze', 'design', 'implement', 'manage', 'coordinate', 'lead', 'build', 'optimize', 'improve', 'enhance', 'collaborate', 'execute']);
      
// //       // Check resume for matches
// //       const techMatches = techKeywords.map(keyword => ({
// //         skill: keyword,
// //         found: resumeText.toLowerCase().includes(keyword.toLowerCase()),
// //         importance: determineImportance(jobDescription, keyword)
// //       }));
      
// //       const functionalMatches = functionalKeywords.map(keyword => ({
// //         skill: keyword,
// //         found: resumeText.toLowerCase().includes(keyword.toLowerCase()),
// //         importance: determineImportance(jobDescription, keyword)
// //       }));
      
// //       const responsibilityMatches = actionVerbs.map(keyword => ({
// //         skill: keyword,
// //         found: resumeText.toLowerCase().includes(keyword.toLowerCase()),
// //         importance: determineImportance(jobDescription, keyword)
// //       }));
      
// //       // Calculate overall match score
// //       const totalKeywords = techMatches.length + functionalMatches.length + responsibilityMatches.length;
// //       const matchedKeywords = 
// //         techMatches.filter(m => m.found).length + 
// //         functionalMatches.filter(m => m.found).length + 
// //         responsibilityMatches.filter(m => m.found).length;
      
// //       const overallScore = totalKeywords > 0 
// //         ? Math.round((matchedKeywords / totalKeywords) * 100) 
// //         : 0;
      
// //       // Generate suggestions
// //       const suggestions = generateSuggestions(techMatches, functionalMatches, responsibilityMatches);
      
// //       setAnalysis({
// //         technicalSkills: techMatches,
// //         functionalSkills: functionalMatches,
// //         responsibilities: responsibilityMatches,
// //         overallScore,
// //         suggestions
// //       });
      
// //       setActiveTab('results');
// //       setUsedAI(false);
      
// //       if (analysisRef.current) {
// //         analysisRef.current.scrollIntoView({ behavior: 'smooth' });
// //       }
// //     } catch (error) {
// //       console.error("Error analyzing job description:", error);
// //       setAnalysis({
// //         ...initialAnalysisState,
// //         error: "An error occurred during analysis. Please try again."
// //       });
// //     } finally {
// //       setIsLoading(false);
// //     }
// //   }, [jobDescription, resumeText, toast]);

// //   const extractKeywords = (text: string, keywordList: string[]): string[] => {
// //     const lowerText = text.toLowerCase();
// //     return keywordList.filter(keyword => lowerText.includes(keyword.toLowerCase()));
// //   };

// //   const determineImportance = (text: string, keyword: string): 'high' | 'medium' | 'low' => {
// //     const lowerText = text.toLowerCase();
// //     const keywordCount = (lowerText.match(new RegExp(keyword.toLowerCase(), 'g')) || []).length;
    
// //     if (keywordCount >= 3) return 'high';
// //     if (keywordCount >= 2) return 'medium';
// //     return 'low';
// //   };

// //   const generateSuggestions = (
// //     techMatches: SkillMatch[], 
// //     functionalMatches: SkillMatch[], 
// //     responsibilityMatches: SkillMatch[]
// //   ): string[] => {
// //     const suggestions: string[] = [];
    
// //     // Find missing high importance technical skills
// //     const missingTechSkills = techMatches
// //       .filter(m => !m.found && m.importance === 'high')
// //       .map(m => m.skill);
    
// //     if (missingTechSkills.length > 0) {
// //       suggestions.push(`Add these critical technical skills to your resume: ${missingTechSkills.join(', ')}`);
// //     }
    
// //     // Find missing high importance functional skills
// //     const missingFunctionalSkills = functionalMatches
// //       .filter(m => !m.found && m.importance === 'high')
// //       .map(m => m.skill);
    
// //     if (missingFunctionalSkills.length > 0) {
// //       suggestions.push(`Highlight these important functional skills: ${missingFunctionalSkills.join(', ')}`);
// //     }
    
// //     // Find missing high importance action verbs
// //     const missingActionVerbs = responsibilityMatches
// //       .filter(m => !m.found && m.importance === 'high')
// //       .map(m => m.skill);
    
// //     if (missingActionVerbs.length > 0) {
// //       suggestions.push(`Use these action verbs in your experience section: ${missingActionVerbs.join(', ')}`);
// //     }
    
// //     // General suggestion
// //     if (suggestions.length === 0) {
// //       suggestions.push("Your resume matches many key requirements. Consider quantifying your achievements for even greater impact.");
// //     }
    
// //     return suggestions;
// //   };

// //   const copyToClipboard = () => {
// //     if (!analysis) return;
    
// //     const content = `
// // Job-Resume Match Analysis

// // Overall Compatibility: ${analysis.overallScore}%

// // Technical Skills:
// // ${analysis.technicalSkills.map(skill => `${skill.skill}: ${skill.found ? '✓' : '✗'} (${skill.importance} importance)`).join('\n')}

// // Functional Skills:
// // ${analysis.functionalSkills.map(skill => `${skill.skill}: ${skill.found ? '✓' : '✗'} (${skill.importance} importance)`).join('\n')}

// // Responsibilities/Action Verbs:
// // ${analysis.responsibilities.map(skill => `${skill.skill}: ${skill.found ? '✓' : '✗'} (${skill.importance} importance)`).join('\n')}

// // Improvement Suggestions:
// // ${analysis.suggestions.map(s => `- ${s}`).join('\n')}
// //     `;
    
// //     navigator.clipboard.writeText(content).then(() => {
// //       toast({
// //         title: "Analysis copied",
// //         description: "Results have been copied to clipboard."
// //       });
// //     });
// //   };

// //   return (
// //     <div className="space-y-6">
// //       <Tabs value={activeTab} onValueChange={setActiveTab}>
// //         <TabsList className="grid w-full grid-cols-2">
// //           <TabsTrigger value="input">Job Description</TabsTrigger>
// //           <TabsTrigger value="results" disabled={!analysis}>Analysis Results</TabsTrigger>
// //         </TabsList>
        
// //         <TabsContent value="input" className="space-y-4">
// //           <div className="grid gap-4">
// //             <div>
// //               <div className="flex justify-between items-center mb-2">
// //                 <Label htmlFor="jobUrl">Job Posting URL (Optional)</Label>
// //                 {isUrlProcessing && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
// //               </div>
              
// //               <form onSubmit={handleUrlSubmit} className="flex items-center gap-2">
// //                 <Input 
// //                   id="jobUrl"
// //                   placeholder="https://example.com/job-posting" 
// //                   value={jobUrl} 
// //                   onChange={(e) => setJobUrl(e.target.value)}
// //                   className="flex-1"
// //                 />
// //                 <Button 
// //                   type="submit" 
// //                   size="sm" 
// //                   variant="outline"
// //                   disabled={isUrlProcessing || !jobUrl}>
// //                   {isUrlProcessing ? 'Extracting...' : 'Extract'}
// //                 </Button>
// //               </form>
              
// //               {showUrlError && (
// //                 <Alert variant="destructive" className="mt-2">
// //                   <AlertCircle className="h-4 w-4" />
// //                   <AlertDescription>
// //                     Could not extract job description from URL. Please paste it manually below.
// //                   </AlertDescription>
// //                 </Alert>
// //               )}
// //             </div>
            
// //             <div>
// //               <Label htmlFor="jobDescription" className="mb-2 block">Job Description</Label>
// //               <Textarea 
// //                 id="jobDescription"
// //                 placeholder="Paste the job description here..." 
// //                 value={jobDescription} 
// //                 onChange={(e) => setJobDescription(e.target.value)}
// //                 className="min-h-[200px]"
// //               />
// //             </div>
            
// //             <Button 
// //               onClick={analyzeJobDescription} 
// //               disabled={isLoading || !jobDescription || !resumeText}
// //               className="w-full">
// //               {isLoading ? (
// //                 <>
// //                   <Loader2 className="mr-2 h-4 w-4 animate-spin" />
// //                   Analyzing...
// //                 </>
// //               ) : 'Analyze Compatibility'}
// //             </Button>
// //           </div>
// //         </TabsContent>
        
// //         <TabsContent value="results">
// //           {analysis && (
// //             <div ref={analysisRef} className="space-y-6">
// //               <div className="flex items-center justify-between">
// //                 <div>
// //                   <h3 className="text-lg font-medium">Job Description Analysis</h3>
// //                   <p className="text-sm text-muted-foreground">
// //                     {usedAI ? "Using AI-powered analysis" : "Using keyword matching"}
// //                   </p>
// //                 </div>
// //                 <Button variant="outline" size="sm" onClick={copyToClipboard}>
// //                   <Copy className="mr-2 h-4 w-4" />
// //                   Copy Results
// //                 </Button>
// //               </div>
              
// //               <Card>
// //                 <CardContent className="pt-6">
// //                   <div className="mb-6">
// //                     <div className="flex justify-between items-center mb-2">
// //                       <h4 className="font-medium">Overall Compatibility</h4>
// //                       <span className={`font-bold ${
// //                         analysis.overallScore >= 80 ? 'text-green-600' :
// //                         analysis.overallScore >= 60 ? 'text-yellow-600' :
// //                         'text-red-600'
// //                       }`}>{analysis.overallScore}%</span>
// //                     </div>
// //                     <Progress value={analysis.overallScore} className="h-2" />
// //                   </div>
                  
// //                   <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
// //                     <div className="space-y-2">
// //                       <h4 className="font-medium text-sm">Technical Skills</h4>
// //                       {analysis.technicalSkills.length > 0 ? (
// //                         <div className="space-y-1">
// //                           {analysis.technicalSkills.map((skill, i) => (
// //                             <div key={i} className="flex items-center justify-between">
// //                               <span className="text-sm flex items-center">
// //                                 {skill.found ? 
// //                                   <CheckCircle className="h-3 w-3 text-green-500 mr-1" /> : 
// //                                   <AlertCircle className="h-3 w-3 text-red-500 mr-1" />
// //                                 }
// //                                 {skill.skill}
// //                               </span>
// //                               <Badge className={`
// //                                 ${skill.importance === 'high' ? 'bg-red-100 text-red-800 border-red-200' : 
// //                                   skill.importance === 'medium' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
// //                                   'bg-blue-100 text-blue-800 border-blue-200'}
// //                                 text-xs font-normal
// //                               `}>
// //                                 {skill.importance}
// //                               </Badge>
// //                             </div>
// //                           ))}
// //                         </div>
// //                       ) : (
// //                         <p className="text-sm text-muted-foreground">No technical skills identified</p>
// //                       )}
// //                     </div>
                    
// //                     <div className="space-y-2">
// //                       <h4 className="font-medium text-sm">Functional Skills</h4>
// //                       {analysis.functionalSkills.length > 0 ? (
// //                         <div className="space-y-1">
// //                           {analysis.functionalSkills.map((skill, i) => (
// //                             <div key={i} className="flex items-center justify-between">
// //                               <span className="text-sm flex items-center">
// //                                 {skill.found ? 
// //                                   <CheckCircle className="h-3 w-3 text-green-500 mr-1" /> : 
// //                                   <AlertCircle className="h-3 w-3 text-red-500 mr-1" />
// //                                 }
// //                                 {skill.skill}
// //                               </span>
// //                               <Badge className={`
// //                                 ${skill.importance === 'high' ? 'bg-red-100 text-red-800 border-red-200' : 
// //                                   skill.importance === 'medium' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
// //                                   'bg-blue-100 text-blue-800 border-blue-200'}
// //                                 text-xs font-normal
// //                               `}>
// //                                 {skill.importance}
// //                               </Badge>
// //                             </div>
// //                           ))}
// //                         </div>
// //                       ) : (
// //                         <p className="text-sm text-muted-foreground">No functional skills identified</p>
// //                       )}
// //                     </div>
                    
// //                     <div className="space-y-2">
// //                       <h4 className="font-medium text-sm">Responsibilities</h4>
// //                       {analysis.responsibilities.length > 0 ? (
// //                         <div className="space-y-1">
// //                           {analysis.responsibilities.map((skill, i) => (
// //                             <div key={i} className="flex items-center justify-between">
// //                               <span className="text-sm flex items-center">
// //                                 {skill.found ? 
// //                                   <CheckCircle className="h-3 w-3 text-green-500 mr-1" /> : 
// //                                   <AlertCircle className="h-3 w-3 text-red-500 mr-1" />
// //                                 }
// //                                 {skill.skill}
// //                               </span>
// //                               <Badge className={`
// //                                 ${skill.importance === 'high' ? 'bg-red-100 text-red-800 border-red-200' : 
// //                                   skill.importance === 'medium' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
// //                                   'bg-blue-100 text-blue-800 border-blue-200'}
// //                                 text-xs font-normal
// //                               `}>
// //                                 {skill.importance}
// //                               </Badge>
// //                             </div>
// //                           ))}
// //                         </div>
// //                       ) : (
// //                         <p className="text-sm text-muted-foreground">No responsibilities identified</p>
// //                       )}
// //                     </div>
// //                   </div>
                  
// //                   <div className="space-y-2">
// //                     <h4 className="font-medium">Improvement Suggestions</h4>
// //                     {analysis.suggestions.length > 0 ? (
// //                       <ul className="list-disc pl-5 space-y-1">
// //                         {analysis.suggestions.map((suggestion, i) => (
// //                           <li key={i} className="text-sm">{suggestion}</li>
// //                         ))}
// //                       </ul>
// //                     ) : (
// //                       <p className="text-sm text-muted-foreground">No specific suggestions available</p>
// //                     )}
// //                   </div>
// //                 </CardContent>
// //               </Card>
              
// //               <div className="text-xs text-muted-foreground flex items-center">
// //                 <InfoIcon className="h-3 w-3 mr-1" />
// //                 For best results, regularly update your resume and tailor it for specific job applications
// //               </div>
// //             </div>
// //           )}
// //         </TabsContent>
// //       </Tabs>
// //     </div>
// //   );
// // };

// // const InfoIcon = (props: React.SVGProps<SVGSVGElement>) => {
// //   return (
// //     <svg
// //       {...props}
// //       xmlns="http://www.w3.org/2000/svg"
// //       width="24"
// //       height="24"
// //       viewBox="0 0 24 24"
// //       fill="none"
// //       stroke="currentColor"
// //       strokeWidth="2"
// //       strokeLinecap="round"
// //       strokeLinejoin="round"
// //     >
// //       <circle cx="12" cy="12" r="10" />
// //       <path d="M12 16v-4" />
// //       <path d="M12 8h.01" />
// //     </svg>
// //   );
// // };

// // export default JobDescriptionAnalyzer;
