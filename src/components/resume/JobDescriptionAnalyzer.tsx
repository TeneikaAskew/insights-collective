
import React, { useState, useRef, useEffect } from 'react';
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
import { functionErrorMessage } from '@/lib/functionErrorMessage';

// Storage keys for local storage
const STORAGE_KEYS = {
  JOB_URL: 'job_description_url',
  JOB_DESCRIPTION: 'job_description_text',
  ACTIVE_TAB: 'job_analyzer_active_tab',
  ANALYSIS_RESULT: 'job_analysis_result',
  USE_FILTERING: 'job_analyzer_use_filtering' // New storage key for the filtering toggle

};

// Import stopwords for keyword extraction
import { eng } from '@/lib/stopwords_eng';

import { createLogger } from '@/utils/logger';

const logger = createLogger('removeStopwords');

// Configuration for text filtering
const FILTERING_CONFIG = {
  // Default is true - enable filtering
  useFiltering: true,
  
  // Common important acronyms and abbreviations to preserve even if they're short
  importantShortTerms: [
    // Technical acronyms
    'ai', 'ml', 'bi', 'ui', 'ux', 'qa', 'pm', 'hr', 'pr', 'ar', 'vr',
    'crm', 'erp', 'seo', 'api', 'etl', 'sql', 'css', 'aws', 'gcp', 'mvc',
    // Technical abbreviations
    'dev', 'app', 'sys', 'eng', 'sec', 'ops', 'prd', 'tst', 'doc', 'db',
    // Education acronyms
    'phd', 'mba', 'bsc', 'bba', 'ms', 'ma', 'ba', 'bs',
    // Business acronyms
    'ceo', 'cto', 'cfo', 'coo', 'vp', 'roi', 'kpi', 'p&l', 'b2b', 'b2c', 'sla',
    // Common software and tools
    'sap', 'ios', 'git', 'jira', 'agile'
  ]
};

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

interface KeywordEvaluation {
  keyword: string;
  jobFrequency: number;
  resumeFrequency: number;
  matchPercentage: number;
  isImportant: boolean;
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
  const [useFiltering, setUseFiltering] = useState<boolean>(FILTERING_CONFIG.useFiltering);
  
  const form = useForm({
    defaultValues: {
      jobUrl: '',
      jobDescription: '',
    }
  });


   // Save to localStorage whenever these values change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.JOB_URL, jobUrl);
  }, [jobUrl]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.JOB_DESCRIPTION, jobDescription);
  }, [jobDescription]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB, activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (analysisResult) {
      localStorage.setItem(STORAGE_KEYS.ANALYSIS_RESULT, JSON.stringify(analysisResult));
    }
  }, [analysisResult]);

     // Additional useEffect to handle the filtering preference
  useEffect(() => {
    const savedFilteringPref = localStorage.getItem(STORAGE_KEYS.USE_FILTERING);
    if (savedFilteringPref !== null) {
      setUseFiltering(savedFilteringPref === 'true');
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.USE_FILTERING, useFiltering.toString());
  }, [useFiltering]);


  // Job-specific stopwords
  const jobStopwords = [
    // Original stopwords - generic job posting terminology
    "job", "work", "position", "company", "team", "experience", "ability", "role", "candidate", "applicant", 
    "qualified", "qualification", "opportunity", "career", "employment", "salary", "compensation", "benefit",
    "benefits", "responsibilities", "requirements", "required", "preferred", "ideal", "strong", "excellent", 
    "outstanding", "exceptional", "proven", "demonstrated", "years", "month", "months", "year", "day", "days",
    "week", "weeks", "time", "full", "part", "duties", "tasks", "responsible", "responsibility", "successful",
    "success", "perform", "performing", "performs", "performed", "apply", "application", "applications", "please",
    "thank", "thanks", "contact", "email", "phone", "resume", "cover", "letter", "today", "ago", "new", "old",
    "good", "great", "best", "better", "within", "www", "http", "https", "com", "org", "net", "know", "knowledge",
    "information", "info", "provide", "provides", "provided", "providing", "support", "supports", "supported",
    "supporting", "include", "includes", "including", "included", "ensure", "ensures", "ensuring", "ensured", 
    "gender", "religion", "sex", "age", "inc", "llc", "ltd",
    
    // Added job posting jargon (should be filtered as stopwords)
    "environment", "environments", "dynamic", "fast-paced", "fast", "paced", "growth", "growing",
    "mission", "vision", "minimum", "maximum", "entry", "level", "senior", "junior", "mid", "lead",
    "deadline", "deadlines", "target", "targets", "goal", "goals", "objective", "objectives",
    "equal", "opportunity", "employer", "remote", "hybrid", "onsite", "on-site", "in-office", 
    "telecommute", "telecommuting", "virtual", "office", "location", "locations", "based",
    "industry", "industries", "sector", "sectors", "field", "fields", "department", "departmental",
    "division", "divisions", "unit", "units", "organization", "organizational", "corporation", "corporate",
    "enterprise", "enterprises", "agency", "agencies", "firm", "firms", "startup", "startups", "institution",
    "institutions", "group", "groups", "primary", "secondary", "main", "core", "key", "critical", "crucial",
    "essential", "important", "significant", "relevant", "appropriate", "suitable", "desirable", "necessary",
    "welcome", "welcomes", "welcoming", "welcomed", "join", "joining", "joins", "joined", "qualified",
    "extensive", "possibilities", "possibility", "option", "options", "attractive",
    "amazing", "exciting", "lifestyle", "life", "balance", "balanced",
    
    // Common phrases from images that appear as n-grams but should be filtered
    "will", "person", "every", "place", "does", "think", "world", "meets", "rest", "inc",
    "game", "premium", "studios", "products", "composition", "timelines"
  ];
  
  // Important soft skills and capabilities (should NOT be in stopwords - these are valuable matching points)
  const valuableSoftSkills = [
    // Leadership & interpersonal skills
    "leadership", "manage", "management", "managing", "manages", "managed", 
    "oversee", "overseeing", "oversees", "oversaw", 
    "supervise", "supervising", "supervises", "supervised",
    "interpersonal", "communication", "verbal", "written", "oral",
    "collaborate", "collaboration", "collaborating",
    "coordinate", "coordinates", "coordinating", "coordinated",
    
    // Problem solving & analytical skills
    "problem", "problems", "solve", "solves", "solving", "solved", 
    "solution", "solutions", "detail", "details", "detailed", "oriented",
    "multi", "task", "tasking", "prioritize", "prioritizes", "prioritizing", "prioritized",
    
    // Personal qualities & attributes
    "passion", "passionate", "culture", "innovative", "skilled", "skill", "skills",
    "dedication", "dedicated", "commitment", "committed", 
    "enthusiastic", "enthusiasm", "competitive", "competency", "competencies", 
    "proficiency", "proficient", "thorough", "understanding", "understands",
    "values", "integrity", "professional", "professionalism",
    "initiative", "initiatives", "drive", "drives", "driving", "driven",
    "flexible", "flexibility", "adaptable", "adaptability",
    "diverse", "diversity", "inclusive", "inclusion",
    "thriving", "thrives", "thrive", "challenging", "challenge", "challenges", "challenged",
    "rewarding", "reward", "rewards", "rewarded", 
    "satisfying", "satisfaction", "satisfactory", 
    "fulfilling", "fulfillment", "fulfill", "fulfils",
    
    // Technical / execution skills
    "implement", "implements", "implementing", "implemented", 
    "develop", "develops", "developing", "developed",
    "maintain", "maintains", "maintaining", "maintained", 
    "establish", "establishes", "establishing", "established",
    
    // Valuable terms from the images
    "grow", "dream", "people", "create", "push", "edges", "looks", "quality", 
    "obliterate", "boundaries", "explore", "potential", "constantly", "evolving", 
    "mindset", "achievers", "leaders", "visionaries", "imagination", "seeks", 
    "expertise", "speed", "standards", "outfit"
  ];
    // Function to remove stopwords manually
  const removeStopwords = (words: string[], stopwords: string[]): string[] => {
    const stopwordSet = new Set(stopwords);
    return words.filter(word => !stopwordSet.has(word));
  };
  
  // Function to filter text while preserving important acronyms
    const filterText = (text: string, preserveAcronyms = true): string => {
      if (!useFiltering) return text;
      
      const importantTermsSet = new Set(FILTERING_CONFIG.importantShortTerms);
      
      // First pass: split and clean the text
      const words = text.toLowerCase()
        .replace(/[^\w\s-]/g, ' ')  // Remove punctuation except hyphens
        .split(/\s+/)               // Split by whitespace
        .filter(word => {
          // Keep words longer than 2 chars OR important acronyms regardless of length
          return word.length > 2 || (preserveAcronyms && importantTermsSet.has(word.toLowerCase()));
        })
        .filter(word => !/^\d+$/.test(word)); // Filter out numbers
      
      // Second pass: remove stopwords
      const filteredWords = useFiltering ? 
        removeStopwords(words, [...eng, ...jobStopwords]) : 
        words;
      
      // Rejoin the filtered words
      return filteredWords.join(' ');
    };
// Enhanced evaluateKeywords function for better keyword extraction and matching
const evaluateKeywords = (jobText: string, resumeText: string): KeywordEvaluation[] => {
  // Apply text filtering (this is already done in the main function)
  const processedJobText = jobText;
  const processedResumeText = resumeText;
  
  // Convert to lowercase for case-insensitive matching
  const jobTextLower = processedJobText.toLowerCase();
  const resumeTextLower = processedResumeText.toLowerCase();
  
  // Clean and extract words from job description
  const jobWords = jobTextLower
    .replace(/[^\w\s-]/g, ' ')   // Remove punctuation except hyphens
    .split(/\s+/)                // Split by whitespace
    .filter(word => 
      (word.length > 2 || FILTERING_CONFIG.importantShortTerms.includes(word)) && // Keep important short terms
      !/^\d+$/.test(word)        // Filter out numbers
    );
  
  // Remove stopwords if filtering is enabled
  const filteredJobWords = useFiltering ? 
    removeStopwords(jobWords, [...eng, ...jobStopwords]) : 
    jobWords;
  
  // Count frequency of each word in job description
  const jobWordFrequency: {[key: string]: number} = {};
  filteredJobWords.forEach(word => {
    jobWordFrequency[word] = (jobWordFrequency[word] || 0) + 1;
  });
  
  // Extract important compound terms (2-3 word phrases that appear multiple times)
  const extractCompoundTerms = (text: string): {[key: string]: number} => {
    const result: {[key: string]: number} = {};
    const words = text.toLowerCase()
      .replace(/[^\w\s-]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !/^\d+$/.test(w));
    
    if (useFiltering) {
      // Only look for compound terms with meaningful words
      const filteredWords = removeStopwords(words, [...eng, ...jobStopwords]);
      
      // Extract 2-word phrases from filtered words
      for (let i = 0; i < filteredWords.length - 1; i++) {
        const phrase = `${filteredWords[i]} ${filteredWords[i+1]}`;
        result[phrase] = (result[phrase] || 0) + 1;
      }
      
      // Extract 3-word phrases
      for (let i = 0; i < filteredWords.length - 2; i++) {
        const phrase = `${filteredWords[i]} ${filteredWords[i+1]} ${filteredWords[i+2]}`;
        result[phrase] = (result[phrase] || 0) + 1;
      }
    } else {
      // If filtering is disabled, use all words for compound terms
      for (let i = 0; i < words.length - 1; i++) {
        const phrase = `${words[i]} ${words[i+1]}`;
        result[phrase] = (result[phrase] || 0) + 1;
      }
      
      for (let i = 0; i < words.length - 2; i++) {
        const phrase = `${words[i]} ${words[i+1]} ${words[i+2]}`;
        result[phrase] = (result[phrase] || 0) + 1;
      }
    }
    
    return result;
  };
  
  const compoundTerms = extractCompoundTerms(processedJobText);
  
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
    .slice(0, 100)                       // Take top 100 keywords (we'll limit matched/unmatched later)
    .map(([word]) => word);
  
  // Now evaluate each keyword's presence in resume
  const keywordEvaluation: KeywordEvaluation[] = keywordsToEvaluate.map(keyword => {
    // Create a regex to properly count occurrences with word boundaries
    const escapedKeyword = keyword.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const keywordRegex = new RegExp(`\\b${escapedKeyword}\\b`, 'gi');
    const resumeMatches = (resumeTextLower.match(keywordRegex) || []).length;
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
      logger.log("Starting Job Extraction from: ", jobUrl)
      const { data, error } = await supabase.functions.invoke('scrape-job-description', {
        body: { url: jobUrl }
      });

      if (error) throw error;

      if (data?.jobDescription) {
        setJobDescription(data.jobDescription);
        toast({
          title: "Description Extracted",
          description: "Job description was successfully extracted",
        });
      } else {
        toast({
          title: "Extraction Failed",
          description: "Could not extract job description from URL",
          variant: "destructive",
        });
      }
    } catch (error) {
      logger.error("Error extracting job description:", error);
      const serverMessage = await functionErrorMessage(error);
      toast({
        title: "Extraction Error",
        description: serverMessage ?? "An error occurred while extracting the job description",
        variant: "destructive",
      });
    } finally {
      setIsExtracting(false);
    }
  };
// Modified analyzeJobMatch function that:
// 1. Uses standard keyword matching locally
// 2. Still uses LLM for skills and improvement suggestions
// 3. Limits matched/unmatched keywords to 50 each

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
    // Apply text filtering if enabled
    const processedResumeText = useFiltering ? filterText(resumeText) : resumeText;
    const processedJobDescription = useFiltering ? filterText(jobDescription) : jobDescription;

    logger.log("[Job Description Analyzer] Starting local keyword analysis");
    
    // STEP 1: Perform standard keyword evaluation locally
    const keywordEvaluations = evaluateKeywords(processedJobDescription, processedResumeText);
    
    // Sort keywords by importance (frequency in job description)
    const sortedKeywords = keywordEvaluations.sort((a, b) => b.jobFrequency - a.jobFrequency);
    
    // Extract matched keywords (limit to 50)
    const matchedKeywords = sortedKeywords
      .filter(kw => kw.resumeFrequency > 0)
      .slice(0, 50)
      .map(kw => ({
        keyword: kw.keyword,
        frequency: kw.jobFrequency,
        matched: true
      }));
    
    // Extract missing keywords (limit to 50)
    const missingKeywords = sortedKeywords
      .filter(kw => kw.resumeFrequency === 0)
      .slice(0, 150)
      .map(kw => kw.keyword);
    
    // Calculate basic match score based on keyword matches
    const keywordCount = sortedKeywords.length;
    const matchedCount = sortedKeywords.filter(kw => kw.resumeFrequency > 0).length;
    const keywordScore = Math.round((matchedCount / (keywordCount || 1)) * 100);
    
    logger.log(`[Job Description Analyzer] Keyword analysis complete. Match Score: ${keywordScore}%`);
    logger.log(`[Job Description Analyzer] Matched keywords: ${matchedKeywords.length}, Missing keywords: ${missingKeywords.length} `);
    
    // STEP 2: Try to use AI for the skill analysis and improvement suggestions
    let analysisResult;
    let usedFallbackAnalysis = false;
    const preCalculatedKeywords = {
      matchedKeywords: matchedKeywords.map(k => k.keyword),
      missingKeywords: missingKeywords
    };
    
    try {
      logger.log("[Job Description Analyzer] Calling AI for skill analysis\n", processedResumeText, processedJobDescription, preCalculatedKeywords);
      
      // Call AI for skill analysis only
      const { data, error } = await supabase.functions.invoke('analyze-job-match', {
        body: {
          resumeText: processedResumeText, 
          jobDescription: processedJobDescription,
          // Pass the pre-calculated keywords to avoid duplicating work
          preCalculatedKeywords
        }
      });

      if (error) throw new Error(error.message);
      
      // Combine standard keyword analysis with AI skill analysis
      analysisResult = {
        // Use our calculated score as a base, but allow the AI to adjust it if provided
        overallScore: data.overallScore || keywordScore,
        // Use our standard keyword matching results
        keywordMatches: matchedKeywords,
        missingKeywords: missingKeywords,
        // Use AI-generated skill analysis
        technicalSkills: data.technicalSkills || [],
        functionalSkills: data.functionalSkills || [],
        responsibilities: data.responsibilities || [],
        improvementSuggestions: data.improvementSuggestions || []
      };
      
      logger.log("[Job Description Analyzer] AI skill analysis complete");
    } catch (aiError) {
      logger.error("AI skill analysis failed, using basic analysis for all parts:", aiError);
      usedFallbackAnalysis = true;

      // Fallback to completely local analysis using the old methods
      analysisResult = {
        overallScore: keywordScore,
        keywordMatches: matchedKeywords,
        missingKeywords: missingKeywords,
        technicalSkills: extractSkills(processedJobDescription, processedResumeText, 'technical'),
        functionalSkills: extractSkills(processedJobDescription, processedResumeText, 'functional'),
        responsibilities: extractSkills(processedJobDescription, processedResumeText, 'responsibility'),
        improvementSuggestions: [
          "Tailor your resume to include the missing keywords from the job description.",
          "Add specific examples that demonstrate your relevant experience.",
          "Consider reorganizing your resume to highlight the most relevant skills first.",
          "Include metrics and achievements that show your impact in previous roles.",
          "Focus on matching both technical and soft skills mentioned in the job posting."
        ]
      };
      
      logger.log("[Job Description Analyzer] Fallback local analysis complete");
    }

    // Set the analysis result for rendering
    setAnalysisResult(analysisResult);

    // Scroll to results after a brief delay to allow rendering
    setTimeout(() => {
      if (resultRef.current) {
        resultRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
    
    // Never present the keyword-scan fallback as a completed AI analysis.
    if (usedFallbackAnalysis) {
      toast({
        title: "AI analysis unavailable",
        description: "Showing a basic keyword comparison instead — the AI-powered analysis failed. Try again for full results.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Analysis Complete",
        description: "Your resume has been analyzed against the job description.",
      });
    }
  } catch (error) {
    logger.error("Error analyzing job match:", error);
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
    if (score >= 80) return "text-ss-good";
    if (score >= 60) return "text-ss-warn";
    return "text-ss-bad";
  };
  
  const getScoreBackground = (score: number) => {
    if (score >= 80) return "bg-ss-good-chip";
    if (score >= 60) return "bg-ss-warn-chip";
    return "bg-ss-bad-chip";
  };

  const getImportanceBadge = (importance: string) => {
    switch(importance) {
      case 'high':
        return <Badge className="bg-ss-bad-chip text-ss-bad border border-ss-bad/30 rounded-full">high</Badge>;
      case 'medium':
        return <Badge className="bg-ss-warn-chip text-ss-warn border border-ss-warn/30 rounded-full">medium</Badge>;
      default:
        return <Badge className="bg-ss-lav-chip text-ss-lav-deep border border-ss-lav/30 rounded-full">low</Badge>;
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
        
        <TabsContent value="job-input" className="space-y-5 pt-5">
          <div className="space-y-5">
            {/* Job URL Input Section - Enhanced for mobile */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Job Posting URL <span className="text-sm font-normal text-muted-foreground">(Optional)</span></h3>
              <div className="flex flex-col sm:flex-row gap-3">
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
                  variant="secondary"
                >
                  {isExtracting ? <Spinner size="sm" className="mr-2" /> : null}
                  {isExtracting ? "Extracting..." : "Extract Description"}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Paste a job posting URL and click extract to automatically import the job description
              </p>
            </div>
            {/* Added Advanced Options Section */}
            <div className="space-y-3 p-3 border border-dashed border-muted-foreground/30 rounded-md bg-muted/10">
              <div className="flex justify-between items-center">
                <h4 className="text-sm font-semibold">Advanced Options</h4>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 px-2"
                  onClick={() => setUseFiltering(!useFiltering)}
                >
                  <span className={`mr-2 h-4 w-4 rounded-full ${useFiltering ? 'bg-primary' : 'bg-muted-foreground/30'}`}></span>
                  {useFiltering ? 'Enhanced Filtering On' : 'Basic Analysis'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Enhanced filtering removes common words and preserves important terms like "AI", "ML", "UI/UX", etc. 
                for more accurate matching.
              </p>
            </div>
            {/* Job Description Textarea - Enhanced for usability */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Job Description</h3>
              <Textarea
                placeholder="Paste the job description here..."
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                rows={10}
                className="resize-none"
              />
              <p className="text-sm text-muted-foreground">
                Enter the complete job description to get the most accurate analysis
              </p>
            </div>
            
            {/* Action Button - Enhanced with clear state indication */}
            <div className="pt-2">
              <Button 
                onClick={analyzeJobMatch} 
                disabled={isAnalyzing || !jobDescription || !resumeText}
                className="w-full sm:w-auto"
                size="lg"
              >
                {isAnalyzing ? <Spinner size="sm" className="mr-2" /> : null}
                {isAnalyzing ? 
                  "Analyzing..." : 
                  !resumeText ? 
                    "Upload Resume First" : 
                    !jobDescription ? 
                      "Enter Job Description" : 
                      "Analyze Compatibility"
                }
              </Button>
              {!resumeText && (
                <p className="text-sm text-ss-warn mt-2">
                  <AlertCircle className="h-4 w-4 inline-block mr-1" />
                  You need to upload your resume first before analyzing
                </p>
              )}
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="results" className="space-y-6 pt-5" ref={resultRef}>
          {isAnalyzing ? (
            <div className="flex flex-col items-center justify-center p-8 space-y-4">
              <Spinner size="lg" className="text-primary" />
              <p className="text-lg font-medium text-center">
                Analyzing your resume against the job description...
              </p>
              <p className="text-sm text-muted-foreground text-center">
                Our AI is comparing your skills and experience with the job requirements.
              </p>
            </div>
          ) : analysisResult ? (
            <div className="space-y-8">
              {/* Header Section - Redesigned */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-muted/20 p-4 rounded-lg">
                <div>
                  <h2 className="text-xl font-semibold">Job Match Analysis</h2>
                  <p className="text-sm text-muted-foreground">AI-powered compatibility assessment</p>
                </div>
                <Button variant="outline" size="sm" onClick={copyResults} className="gap-2">
                  <CopyIcon className="h-4 w-4" />
                  Copy Results
                </Button>
              </div>

              {/* Overall Compatibility Score - Enhanced visual presentation */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-medium text-lg">Overall Compatibility</h3>
                  <span className={`text-2xl font-bold px-4 py-2 rounded-full ${getScoreBackground(analysisResult.overallScore)} ${getScoreColor(analysisResult.overallScore)}`}>
                    {analysisResult.overallScore}%
                  </span>
                </div>
                <div className="relative pt-1">
                  <Progress 
                    value={analysisResult.overallScore} 
                    className="h-3 rounded-full bg-ss-track"
                    indicatorClassName={
                      analysisResult.overallScore >= 80 ? 'bg-ss-good' :
                      analysisResult.overallScore >= 60 ? 'bg-ss-warn' :
                      'bg-ss-bad'
                    }
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>Low Match</span>
                    <span>Moderate Match</span>
                    <span>Strong Match</span>
                  </div>
                </div>
              </div>

              {/* Keyword Analysis with Tabs - Enhanced for clarity */}
              <div className="space-y-4">
                <h3 className="font-medium text-lg">Keyword Evaluation</h3>
                <Tabs defaultValue="matched" className="w-full">
                  <TabsList className="grid grid-cols-2 mb-4">
                    <TabsTrigger value="matched">
                      <span className="flex items-center gap-1">
                        <Check className="h-4 w-4 text-ss-good" />
                        Matched Keywords 
                        <Badge variant="outline" className="bg-ss-good-chip text-ss-good ml-1">
                          {analysisResult.keywordMatches.filter(k => k.matched).length}
                        </Badge>
                      </span>
                    </TabsTrigger>
                    <TabsTrigger value="missing">
                      <span className="flex items-center gap-1">
                        <X className="h-4 w-4 text-ss-bad" />
                        Missing Keywords
                        <Badge variant="outline" className="bg-ss-bad-chip text-ss-bad ml-1">
                          {analysisResult.missingKeywords.length}
                        </Badge>
                      </span>
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="matched" className="mt-0">
                    <Card className="border-ss-good/30">
                      <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground mb-3">
                          Keywords in the job description that appear in your resume:
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {analysisResult.keywordMatches
                            .filter(k => k.matched)
                            .map((match, index) => (
                              <Badge key={index} className="bg-ss-good-chip text-ss-good border border-ss-good/30 py-1 rounded-full">
                                {match.keyword} {match.frequency > 1 ? `${match.frequency}×` : ''}
                              </Badge>
                            ))
                          }
                          {analysisResult.keywordMatches.filter(k => k.matched).length === 0 && (
                            <p className="text-sm italic text-muted-foreground">No matched keywords found</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                  <TabsContent value="missing" className="mt-0">
                    <Card className="border-ss-bad/30">
                      <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground mb-3">
                          Important keywords in the job description missing from your resume:
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {analysisResult.missingKeywords.map((keyword, index) => (
                            <Badge key={index} variant="outline" className="bg-ss-bad-chip border-ss-bad/30 text-ss-bad py-1 rounded-full">
                              {keyword}
                            </Badge>
                          ))}
                          {analysisResult.missingKeywords.length === 0 && (
                            <p className="text-sm italic text-muted-foreground">No missing keywords found</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </div>

              {/* Skills Section - Enhanced for better readability */}
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Technical Skills - UPDATED to show matched skills first */}
                <Card>
                  <CardContent className="p-4 pt-5 space-y-3">
                    <h4 className="font-semibold flex items-center gap-2">
                      <Badge className="bg-ss-lav-chip text-ss-lav-deep rounded-full">Technical</Badge>
                      Skills
                    </h4>
                    <ScrollArea className="h-[350px] pr-4">
                      <div className="space-y-2">
                        {/* Show matched skills first */}
                        {analysisResult.technicalSkills
                          .sort((a, b) => {
                            // Sort by matched status first (true comes before false)
                            if (a.matched && !b.matched) return -1;
                            if (!a.matched && b.matched) return 1;
                            
                            // Then sort by importance
                            const importanceOrder = { high: 0, medium: 1, low: 2 };
                            return importanceOrder[a.importance] - importanceOrder[b.importance];
                          })
                          .map((skill, index) => (
                            <div key={index} className={`flex justify-between items-center p-2 rounded-md ${skill.matched ? 'bg-ss-good-chip' : 'bg-muted/30'}`}>
                              <div className="flex items-center gap-2">
                                {skill.matched ? 
                                  <Check className="h-4 w-4 text-ss-good" /> : 
                                  <X className="h-4 w-4 text-ss-bad" />
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
                
                {/* Functional Skills - UPDATED to show matched skills first */}
                <Card>
                  <CardContent className="p-4 pt-5 space-y-3">
                    <h4 className="font-semibold flex items-center gap-2">
                      <Badge className="bg-ss-teal-chip text-ss-teal rounded-full">Functional</Badge>
                      Skills
                    </h4>
                    <ScrollArea className="h-[350px] pr-4">
                      <div className="space-y-2">
                        {analysisResult.functionalSkills
                          .sort((a, b) => {
                            // Sort by matched status first (true comes before false)
                            if (a.matched && !b.matched) return -1;
                            if (!a.matched && b.matched) return 1;
                            
                            // Then sort by importance
                            const importanceOrder = { high: 0, medium: 1, low: 2 };
                            return importanceOrder[a.importance] - importanceOrder[b.importance];
                          })
                          .map((skill, index) => (
                            <div key={index} className={`flex justify-between items-center p-2 rounded-md ${skill.matched ? 'bg-ss-good-chip' : 'bg-muted/30'}`}>
                              <div className="flex items-center gap-2">
                                {skill.matched ? 
                                  <Check className="h-4 w-4 text-ss-good" /> : 
                                  <X className="h-4 w-4 text-ss-bad" />
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
                
                {/* Responsibilities - UPDATED to show matched responsibilities first */}
                <Card>
                  <CardContent className="p-4 pt-5 space-y-3">
                    <h4 className="font-semibold flex items-center gap-2">
                      <Badge className="bg-ss-warn-chip text-ss-warn rounded-full">Key</Badge>
                      Responsibilities
                    </h4>
                    <ScrollArea className="h-[350px] pr-4">
                      <div className="space-y-2">
                        {analysisResult.responsibilities
                          .sort((a, b) => {
                            // Sort by matched status first (true comes before false)
                            if (a.matched && !b.matched) return -1;
                            if (!a.matched && b.matched) return 1;
                            
                            // Then sort by importance
                            const importanceOrder = { high: 0, medium: 1, low: 2 };
                            return importanceOrder[a.importance] - importanceOrder[b.importance];
                          })
                          .map((resp, index) => (
                            <div key={index} className={`flex justify-between items-center p-2 rounded-md ${resp.matched ? 'bg-ss-good-chip' : 'bg-muted/30'}`}>
                              <div className="flex items-center gap-2">
                                {resp.matched ? 
                                  <Check className="h-4 w-4 text-ss-good" /> : 
                                  <X className="h-4 w-4 text-ss-bad" />
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
              
              {/* Improvement Suggestions - Enhanced visual appeal */}
              <Card className={`${getScoreBackground(analysisResult.overallScore)} border-0 overflow-hidden`}>
                <div className="absolute top-0 right-0 w-24 h-24 bg-black/5 rounded-full -mr-12 -mt-12"></div>
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp className={`h-5 w-5 ${getScoreColor(analysisResult.overallScore)}`} />
                    <h3 className="font-semibold">Improvement Suggestions</h3>
                  </div>
                  <ul className="space-y-3 list-none">
                    {analysisResult.improvementSuggestions.map((suggestion, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="flex-shrink-0 rounded-full bg-card w-5 h-5 flex items-center justify-center mt-0.5">
                          {index + 1}
                        </span>
                        <span className="text-sm">{suggestion}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              {/* Pro Tip - Enhanced visual appeal */}
              <div className="ss-card-warm border border-ss-peach/40 rounded-2xl p-4 flex items-start space-x-3">
                <Info className="h-5 w-5 text-ss-teal mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm text-foreground">
                    <span className="font-medium">Pro Tip:</span> Tailoring your resume for each job application increases your chances of passing ATS filters by up to 60%. 
                    Focus on incorporating the missing keywords and skills identified above. <a 
                      href="https://docs.google.com/document/d/1CKGglaXyYad16IFiYSDpGd2ofro5dYmi4eD1JNeHkD4/edit?usp=sharing" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary underline hover:text-ss-lav-deep"
                    > Use this 100% ATS-optimized resume template </a> to increase your chances further.
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
