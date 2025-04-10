
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useResume } from '@/hooks/resume/useResume';
import { useResumeAnalysis } from '@/hooks/useResumeAnalysis';
import { ResumeAnalysis } from '@/components/assistants/types';

// Define proper interfaces to match the hook implementations
export interface ResumeHookData {
  resume: any;
  loading: boolean;
  uploading: boolean;
  uploadResume: (file: File) => Promise<boolean>;
  deleteResume: () => Promise<boolean>;
  refreshResume: () => Promise<void>;
}

export interface AnalysisHookData {
  analysis: ResumeAnalysis | null;
  isAnalyzing: boolean;
  analyzeResume: (file: File) => Promise<boolean>;
  setAnalysis: React.Dispatch<React.SetStateAction<ResumeAnalysis | null>>;
}

interface InitResult {
  isAuthenticated: boolean;
  isLoading: boolean;
  resumeHookData: ResumeHookData;
  analysisHookData: AnalysisHookData;
}

export const useResumeInit = (): InitResult => {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  
  // Initialize with empty default values
  let resumeHookData: ResumeHookData = { 
    resume: null, 
    loading: true, 
    uploading: false, 
    uploadResume: async (file: File) => false, 
    deleteResume: async () => false, 
    refreshResume: async () => {} 
  };
  
  let analysisHookData: AnalysisHookData = { 
    analysis: null, 
    isAnalyzing: false, 
    analyzeResume: async (file: File) => false,
    setAnalysis: () => {} 
  };

  // Force component to re-render after mount to ensure hooks are initialized properly
  useEffect(() => {
    setMounted(true);
    
    // Add a timeout to stop showing loading state even if something fails
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 3000);
    
    return () => clearTimeout(timer);
  }, []);
  
  // Carefully initialize hooks with error handling
  try {
    resumeHookData = useResume() as ResumeHookData;
    analysisHookData = useResumeAnalysis() as AnalysisHookData;
  } catch (error) {
    console.error("Error initializing hooks:", error);
    toast({
      title: "Error initializing page",
      description: "There was a problem loading your resume data. Please try refreshing the page.",
      variant: "destructive",
    });
  }

  // Ensure fresh data on mount and when auth changes
  useEffect(() => {
    if (isAuthenticated && mounted) {
      console.log("Refreshing resume data");
      resumeHookData.refreshResume().finally(() => {
        setIsLoading(false);
      });
    } else if (!isAuthenticated) {
      setIsLoading(false);
    }
  }, [isAuthenticated, mounted, resumeHookData.refreshResume]);

  return {
    isAuthenticated,
    isLoading,
    resumeHookData,
    analysisHookData
  };
};
