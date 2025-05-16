
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { AlertTriangle, AlertCircle, Info, Check } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { filterEEOKeywords, filterEEOStatements, isEEOorHiringStatement } from '@/utils/eeoFilter';

// Enhanced stopwords list with EEO and hiring statement phrases
const jobStopwords = [
  // Original HR-related terms
  "gender", "religion", "sex", "age", "equal", "opportunity", "employer", "eeo",
  
  // EEO and protected class related terms
  "discriminate", "protected", "veteran", "disability", "legally", "status",
  "race", "color", "national", "origin", "sexual", "orientation", "identity",
  "ethnicity", "marital", "citizenship", "ancestry", "genetic", "information",
  "accommodation", "reasonable", "affirmative", "action", "diversity", "inclusive",
  "inclusion", "minority", "minorities", "retaliation", "harassment", "recruit",
  "pregnancy", "pregnant", "parental", "familial", "caregiver", "military", "service",
  "applicant", "applicants", "qualified", "regardless", "requirement", "requirement",
  
  // Multi-word EEO phrases to split and filter
  "equal opportunity", "disability status", "protected veteran", "veteran status", 
  "legally protected", "protected status", "basis protected", "protected characteristics",
  "discriminate basis", "basis race", "color religion", "religion sex",
  
  // Geographic and location terms
  "los angeles", "angeles county", "york city", "san francisco", "chicago", 
  "boston", "seattle", "austin", "remote", "hybrid", "onsite", "in-office",
  
  // Employment relationship terms
  "employees supervisors", "supervisors staff", "staff members", "reports to",
  "direct reports", "team lead", "team leads", "management team", "executive team",
  
  // Company culture boilerplate often in job descriptions
  "outfit athletes", "athletes explore", "explore potential", "potential obliterate",
  "obliterate boundaries", "boundaries push", "push edges", "edges looks",
  "looks people", "people grow", "grow dream", "dream create", "create culture",
  "culture thrives", "thrives embracing", "embracing diversity", "diversity rewarding",
  "rewarding imagination", "imagination brand", "brand seeks", "seeks achievers",
  "achievers leaders", "leaders visionaries", "visionaries nike", "nike bringing",
  "bringing skills", "skills passion", "passion challenging", "challenging constantly",
  "constantly evolving", "specialist production", "production icon",
  
  // General job boilerplate terms
  "competitive salary", "benefits package", "health insurance", "dental", "vision",
  "401k", "pto", "paid time", "vacation", "bonus", "compensation", "salary range",
  "schedule", "shifts", "hours", "workweek", "work week", "employment type", "full time",
  "part time", "contract", "contractor", "temp", "temporary", "permanent", "probation",
  "probationary", "application process", "interview process", "background check",
  "drug test", "education requirement", "degree requirement", "experience requirement"
];

const JobDescriptionAnalyzer = () => {
  const [jobDescription, setJobDescription] = useState('');
  const [analysisResult, setAnalysisResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [resumeText, setResumeText] = useState('');
  const [activeTab, setActiveTab] = useState('keywords');
  const [jobUrl, setJobUrl] = useState('');
  const [jobScrapingError, setJobScrapingError] = useState(null);
  const [jobScrapingSuccess, setJobScrapingSuccess] = useState(false);
  const [useEEOFiltering, setUseEEOFiltering] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();

  // Load saved job description and analysis from localStorage on component mount
  useEffect(() => {
    const savedJobDescriptionUrl = localStorage.getItem('job_description_url');
    const savedJobDescriptionText = localStorage.getItem('job_description_text');
    const savedActiveTab = localStorage.getItem('job_analyzer_active_tab');
    const savedAnalysisResult = localStorage.getItem('job_analysis_result');
    const savedUseEEOFiltering = localStorage.getItem('job_analyzer_use_filtering');
    
    if (savedJobDescriptionUrl) {
      setJobUrl(savedJobDescriptionUrl);
    }
    
    if (savedJobDescriptionText) {
      setJobDescription(savedJobDescriptionText);
    }
    
    if (savedActiveTab) {
      setActiveTab(savedActiveTab);
    }
    
    if (savedAnalysisResult) {
      try {
        setAnalysisResult(JSON.parse(savedAnalysisResult));
      } catch (error) {
        console.error('Error parsing saved analysis result:', error);
      }
    }
    
    if (savedUseEEOFiltering !== null) {
      setUseEEOFiltering(savedUseEEOFiltering === 'true');
    }
    
    // Get resume text from localStorage (if available)
    const savedResumeText = localStorage.getItem('resume_text');
    if (savedResumeText) {
      setResumeText(savedResumeText);
    }
  }, []);

  // Save state to localStorage whenever it changes
  useEffect(() => {
    if (jobUrl) {
      localStorage.setItem('job_description_url', jobUrl);
    }
    
    if (jobDescription) {
      localStorage.setItem('job_description_text', jobDescription);
    }
    
    localStorage.setItem('job_analyzer_active_tab', activeTab);
    
    if (analysisResult) {
      localStorage.setItem('job_analysis_result', JSON.stringify(analysisResult));
    }
    
    localStorage.setItem('job_analyzer_use_filtering', useEEOFiltering.toString());
  }, [jobUrl, jobDescription, activeTab, analysisResult, useEEOFiltering]);

  // Helper function to extract keywords from text
  const extractKeywords = (text) => {
    if (!text) return [];
    
    // Normalize text
    const normalizedText = text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ');

    // Split into words and short phrases (1-3 word ngrams)
    const words = normalizedText.split(' ');
    const oneGrams = words.filter(word => word.length > 2);
    
    // Create 2-grams and 3-grams
    const twoGrams = [];
    const threeGrams = [];
    
    for (let i = 0; i < words.length - 1; i++) {
      if (words[i].length > 1 && words[i+1].length > 1) {
        twoGrams.push(`${words[i]} ${words[i+1]}`);
      }
      
      if (i < words.length - 2 && words[i].length > 1 && words[i+1].length > 1 && words[i+2].length > 1) {
        threeGrams.push(`${words[i]} ${words[i+1]} ${words[i+2]}`);
      }
    }
    
    // Combine all n-grams
    const allPhrases = [...oneGrams, ...twoGrams, ...threeGrams];
    
    // Filter out stopwords and EEO statements if filtering is enabled
    const filteredPhrases = allPhrases.filter(phrase => {
      // Always filter out stopwords
      if (jobStopwords.includes(phrase)) return false;
      
      // Apply EEO filtering if enabled
      if (useEEOFiltering && isEEOorHiringStatement(phrase)) return false;
      
      return true;
    });
    
    // Count occurrences
    const phraseCounts = {};
    filteredPhrases.forEach(phrase => {
      phraseCounts[phrase] = (phraseCounts[phrase] || 0) + 1;
    });
    
    // Sort by frequency and return top keywords
    return Object.entries(phraseCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50)
      .map(([phrase, count]) => ({ phrase, count }));
  };

  const analyzeJobDescription = () => {
    setIsLoading(true);
    setAnalysisResult(null);
    
    try {
      const keywords = extractKeywords(jobDescription);
      
      // Prepare data for analysis
      const data = {
        jobDescription: jobDescription,
        resumeText: resumeText,
        keywords: keywords.map(k => k.phrase)
      };
      
      // Log the data being sent to the function
      console.log('Data sent to analyze-job-match function:', data);
      
      // Call the Supabase edge function
      supabase.functions.invoke('analyze-job-match', {
        body: data
      })
      .then(res => {
        console.log('Raw response from analyze-job-match function:', res);
        
        if (res.error) {
          console.error('Error from analyze-job-match function:', res.error);
          toast({
            title: "Analysis error",
            description: `Could not analyze job description: ${res.error.message || 'Unknown error'}`,
            variant: "destructive"
          });
          setAnalysisResult(null);
        } else if (res.data) {
          console.log('Data from analyze-job-match function:', res.data);
          setAnalysisResult(res.data);
          toast({
            title: "Analysis complete",
            description: "Job description analysis complete.",
            variant: "default"
          });
        } else {
          console.warn('No data or error received from analyze-job-match function');
          toast({
            title: "Analysis incomplete",
            description: "No results received from job description analysis.",
            // Fix the variant type error by using a supported variant type
            variant: "destructive"
          });
          setAnalysisResult(null);
        }
      })
      .catch(err => {
        console.error('Error calling analyze-job-match function:', err);
        toast({
          title: "Analysis error",
          description: `Could not analyze job description: ${err.message || 'Unknown error'}`,
          variant: "destructive"
        });
        setAnalysisResult(null);
      })
      .finally(() => {
        setIsLoading(false);
      });
    } catch (error) {
      console.error('Error during job description analysis:', error);
      toast({
        title: "Analysis error",
        description: `Could not analyze job description: ${error.message || 'Unknown error'}`,
        variant: "destructive"
      });
      setAnalysisResult(null);
      setIsLoading(false);
    }
  };

  const handleScrapeJob = async () => {
    setIsLoading(true);
    setJobScrapingError(null);
    setJobScrapingSuccess(false);
    
    try {
      const { data, error } = await supabase.functions.invoke('scrape-job-description', {
        body: { url: jobUrl }
      });
      
      if (error) {
        console.error('Error scraping job description:', error);
        setJobScrapingError(error.message || 'Failed to scrape job description.');
        toast({
          title: "Scraping error",
          description: error.message || 'Failed to scrape job description.',
          variant: "destructive"
        });
      } else if (data && data.text) {
        setJobDescription(data.text);
        setJobScrapingSuccess(true);
        toast({
          title: "Scraping complete",
          description: "Successfully scraped job description.",
          variant: "default"
        });
      } else {
        console.warn('No data received from scrape-job-description function');
        setJobScrapingError('No data received from job scraping.');
        toast({
          title: "Scraping incomplete",
          description: "No data received from job scraping.",
          // Fix the variant type error by using a supported variant type
          variant: "destructive"
        });
      }
    } catch (err) {
      console.error('Error calling scrape-job-description function:', err);
      setJobScrapingError(err.message || 'Unknown error occurred during scraping.');
      toast({
        title: "Scraping error",
        description: err.message || 'Unknown error occurred during scraping.',
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resetAnalysis = () => {
    setAnalysisResult(null);
  };

  const renderKeywordResults = () => {
    if (!analysisResult || !analysisResult.keywords) {
      return <div className="text-muted-foreground">No keywords found.</div>;
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {analysisResult.keywords.map((keyword, index) => (
          <Card key={index} className="border">
            <CardContent className="p-3">
              <div className="text-sm font-medium">{keyword.phrase}</div>
              <div className="text-xs text-muted-foreground">
                {keyword.count} occurrences
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <div className="container max-w-4xl py-6">
      <h1 className="text-2xl font-bold mb-4">Job Description Analyzer</h1>

      {/* Job URL Input and Scraping */}
      <div className="mb-4">
        <Label htmlFor="jobUrl">Job Description URL</Label>
        <div className="flex mt-2">
          <Input
            id="jobUrl"
            type="url"
            placeholder="Enter job description URL"
            value={jobUrl}
            onChange={(e) => setJobUrl(e.target.value)}
            className="flex-1"
          />
          <Button onClick={handleScrapeJob} disabled={isLoading} className="ml-2">
            {isLoading ? (
              <>
                <Spinner className="mr-2" />
                Scraping...
              </>
            ) : (
              "Scrape Job"
            )}
          </Button>
        </div>
        {jobScrapingError && (
          <div className="text-red-500 mt-2 flex items-center">
            <AlertTriangle className="h-4 w-4 mr-1" />
            {jobScrapingError}
          </div>
        )}
        {jobScrapingSuccess && (
          <div className="text-green-500 mt-2 flex items-center">
            <Check className="h-4 w-4 mr-1" />
            Successfully scraped job description.
          </div>
        )}
      </div>

      {/* Job Description Input */}
      <div className="mb-4">
        <Label htmlFor="jobDescription">Job Description</Label>
        <textarea
          id="jobDescription"
          placeholder="Paste job description here"
          value={jobDescription}
          onChange={(e) => setJobDescription(e.target.value)}
          className="w-full h-40 p-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* Resume Text Input */}
      <div className="mb-4">
        <Label htmlFor="resumeText">Resume Text</Label>
        <textarea
          id="resumeText"
          placeholder="Paste your resume text here"
          value={resumeText}
          onChange={(e) => setResumeText(e.target.value)}
          className="w-full h-40 p-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>
      
      {/* EEO Filtering Toggle */}
      <div className="mb-4 flex items-center justify-between">
        <Label htmlFor="useEEOFiltering" className="mr-2">
          Use EEO Filtering
        </Label>
        <Switch
          id="useEEOFiltering"
          checked={useEEOFiltering}
          onCheckedChange={(checked) => setUseEEOFiltering(checked)}
        />
      </div>

      {/* Analysis Button and Reset */}
      <div className="flex justify-between mb-4">
        <Button onClick={analyzeJobDescription} disabled={isLoading}>
          {isLoading ? (
            <>
              <Spinner className="mr-2" />
              Analyzing...
            </>
          ) : (
            "Analyze Job Description"
          )}
        </Button>
        <Button onClick={resetAnalysis} variant="secondary">
          Reset Analysis
        </Button>
      </div>

      {/* Analysis Result Tabs */}
      {analysisResult && (
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value)}>
          <TabsList>
            <TabsTrigger value="keywords">Keywords</TabsTrigger>
            <TabsTrigger value="skills">Skills Analysis</TabsTrigger>
          </TabsList>
          <TabsContent value="keywords">
            <h3 className="text-lg font-semibold mb-2">Keyword Analysis</h3>
            {renderKeywordResults()}
          </TabsContent>
          <TabsContent value="skills">
            <h3 className="text-lg font-semibold mb-2">Skills Analysis</h3>
            {analysisResult.technicalSkills && (
              <div>
                <h4 className="text-md font-semibold">Technical Skills</h4>
                <ul>
                  {analysisResult.technicalSkills.map((skill, index) => (
                    <li key={index}>
                      {skill.skill} ({skill.importance}, Matched: {skill.matched ? 'Yes' : 'No'})
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {analysisResult.functionalSkills && (
              <div>
                <h4 className="text-md font-semibold">Functional Skills</h4>
                <ul>
                  {analysisResult.functionalSkills.map((skill, index) => (
                    <li key={index}>
                      {skill.skill} ({skill.importance}, Matched: {skill.matched ? 'Yes' : 'No'})
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {analysisResult.responsibilities && (
              <div>
                <h4 className="text-md font-semibold">Responsibilities</h4>
                <ul>
                  {analysisResult.responsibilities.map((responsibility, index) => (
                    <li key={index}>
                      {responsibility.skill} ({responsibility.importance}, Matched: {responsibility.matched ? 'Yes' : 'No'})
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {analysisResult.improvementSuggestions && (
              <div>
                <h4 className="text-md font-semibold">Improvement Suggestions</h4>
                <ul>
                  {analysisResult.improvementSuggestions.map((suggestion, index) => (
                    <li key={index}>{suggestion}</li>
                  ))}
                </ul>
              </div>
            )}
            {!analysisResult.technicalSkills &&
              !analysisResult.functionalSkills &&
              !analysisResult.responsibilities &&
              !analysisResult.improvementSuggestions && (
                <div className="text-muted-foreground">No skills analysis found.</div>
              )}
          </TabsContent>
        </Tabs>
      )}

      {/* Info Alert */}
      {!analysisResult && !isLoading && (
        <div className="rounded-md border bg-muted p-4 mt-4">
          <div className="flex items-center space-x-2 font-medium">
            <Info className="h-4 w-4" />
            Job Description Analyzer
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Enter a job description and your resume text to analyze the key skills and keywords.
          </p>
        </div>
      )}
    </div>
  );
};

export default JobDescriptionAnalyzer;
