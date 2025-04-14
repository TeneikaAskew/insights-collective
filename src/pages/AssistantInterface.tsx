
import React, { useState, useEffect } from 'react';
import { useParams, Navigate, useLocation } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import LoginWall from '@/components/common/LoginWall';
import AssistantChatInterface from '@/components/assistants/AssistantChatInterface';
import { Assistant } from '@/types/assistants';
import { allAssistants, careerExplorerAssistant } from '@/data/assistantData';
import { useToast } from '@/hooks/use-toast';
import { storeQuizAttempt, startCareerCoachConversation } from '@/services/quizService';
import { CareerTrack } from '@/data/careerQuizData';

const AssistantInterface = () => {
  const { assistantId } = useParams();
  const { isAuthenticated, storeRedirectPath } = useAuth();
  const location = useLocation();
  const { toast } = useToast();
  const [selectedAssistant, setSelectedAssistant] = useState<Assistant | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Store the current path for redirect after login
  useEffect(() => {
    if (!isAuthenticated) {
      storeRedirectPath(location.pathname);
    }
  }, [isAuthenticated, location.pathname, storeRedirectPath]);
  
  // Check for and process stored quiz data after authentication
  useEffect(() => {
    const initializeCareerCoach = async () => {
      // Only run for career coach assistant and when authenticated
      if (assistantId === 'career-coach' && isAuthenticated) {
        const storedScores = localStorage.getItem('quizScores');
        const storedAnswers = localStorage.getItem('quizAnswers');
        
        if (storedScores && storedAnswers) {
          setIsProcessing(true);
          
          try {
            const scores = JSON.parse(storedScores);
            const answers = JSON.parse(storedAnswers);
            
            // If we have valid data and don't already have an active quiz attempt
            if (Object.keys(scores).length > 0 && 
                Object.keys(answers).length > 0 && 
                !localStorage.getItem('activeQuizAttemptId')) {
              
              console.log('Initializing career coach with stored quiz data');
              
              // Store quiz attempt
              const quizAttemptId = await storeQuizAttempt(answers, scores);
              
              if (quizAttemptId) {
                // Start conversation
                const conversationId = await startCareerCoachConversation(quizAttemptId);
                
                if (conversationId) {
                  // Determine top career path from scores
                  const sortedTracks = Object.entries(scores)
                    .sort(([, scoreA], [, scoreB]) => Number(scoreB) - Number(scoreA));
                  
                  const topCareerPath = sortedTracks[0][0];
                  
                  // Store settings for the assistant interface to use
                  localStorage.setItem('activeQuizAttemptId', quizAttemptId);
                  localStorage.setItem('activeConversationId', conversationId);
                  localStorage.setItem('recommendedCareerPath', topCareerPath);
                  
                  // Clear stored quiz data as it's now in Supabase
                  localStorage.removeItem('quizScores');
                  localStorage.removeItem('quizAnswers');
                  
                  toast({
                    title: "Quiz Results Saved",
                    description: "Your career quiz results have been saved and are being used by the Career Coach.",
                    duration: 5000,
                  });
                }
              }
            }
          } catch (error) {
            console.error('Error initializing career coach:', error);
            toast({
              title: "Error Initializing Career Coach",
              description: "There was an issue loading your quiz results. The Career Coach may not have access to your quiz data.",
              variant: "destructive",
              duration: 5000,
            });
          } finally {
            setIsProcessing(false);
          }
        }
      }
    };
    
    initializeCareerCoach();
  }, [assistantId, isAuthenticated, toast]);
  
  // Get assistant from URL params
  useEffect(() => {
    if (assistantId) {
      // Find assistant by ID
      const assistant = [...allAssistants, careerExplorerAssistant].find(
        a => a.id === assistantId
      );
      if (assistant) {
        setSelectedAssistant(assistant);
      } else {
        // Default to career explorer if assistant not found
        setSelectedAssistant(careerExplorerAssistant);
      }
    } else {
      // Default to career explorer if no assistant specified
      setSelectedAssistant(careerExplorerAssistant);
    }
  }, [assistantId]);

  // If not authenticated, show login wall
  if (!isAuthenticated) {
    return (
      <LoginWall 
        message="Please log in to use our AI assistants" 
        visibleItems={0} 
        totalItems={allAssistants.length + 1} // +1 for career explorer assistant
      />
    );
  }
  
  // If processing quiz data, show loading state
  if (isProcessing) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <div className="flex flex-col items-center">
            <div className="animate-spin h-10 w-10 border-4 border-primary border-t-transparent rounded-full mb-4"></div>
            <p className="text-lg font-medium">Setting up your Career Coach...</p>
            <p className="text-sm text-muted-foreground">Loading your quiz results</p>
          </div>
        </div>
      </AppLayout>
    );
  }
  
  // If no assistant is selected yet, show loading
  if (!selectedAssistant) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <div className="animate-pulse">Loading assistant...</div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <AssistantChatInterface initialAssistant={selectedAssistant} />
    </AppLayout>
  );
};

export default AssistantInterface;
