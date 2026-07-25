import React, { useState, useEffect } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import LoginWall from '@/components/common/LoginWall';
import AssistantChatInterface from '@/components/assistants/AssistantChatInterface';
import { Assistant } from '@/types/assistants';
import { allAssistants, careerExplorerAssistant } from '@/data/assistantData';
import { useToast } from '@/hooks/use-toast';
import { storeQuizAttempt, startCareerCoachConversation } from '@/services/quizService';
import { CareerTrack } from '@/data/careerQuizData';
import { useAuthenticatedNavigation } from '@/hooks/useAuthenticatedNavigation';

import { createLogger } from '@/utils/logger';

const logger = createLogger('AssistantInterface');

const AssistantInterface = () => {
  // The route is /assistant/:id — reading a non-existent `assistantId` param
  // made every assistant card silently open the default Career Explorer.
  const { id: assistantId } = useParams();
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [selectedAssistant, setSelectedAssistant] = useState<Assistant | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Removed useStoreRedirectPath() - we'll handle navigation with useAuthenticatedNavigation
  
  useEffect(() => {
    const initializeCareerCoach = async () => {
      if (assistantId === 'career-coach' && isAuthenticated) {
        const storedScores = localStorage.getItem('quizScores');
        const storedAnswers = localStorage.getItem('quizAnswers');
        
        if (storedScores && storedAnswers) {
          setIsProcessing(true);
          
          try {
            const scores = JSON.parse(storedScores);
            const answers = JSON.parse(storedAnswers);
            
            if (Object.keys(scores).length > 0 && 
                Object.keys(answers).length > 0 && 
                !localStorage.getItem('activeQuizAttemptId')) {
              
              logger.log('Initializing career coach with stored quiz data');
              
              const quizAttemptId = await storeQuizAttempt(answers, scores);
              
              if (quizAttemptId) {
                const conversationId = await startCareerCoachConversation(quizAttemptId);
                
                if (conversationId) {
                  const sortedTracks = Object.entries(scores)
                    .sort(([, scoreA], [, scoreB]) => Number(scoreB) - Number(scoreA));
                  
                  const topCareerPath = sortedTracks[0][0];
                  
                  localStorage.setItem('activeQuizAttemptId', quizAttemptId);
                  localStorage.setItem('activeConversationId', conversationId);
                  localStorage.setItem('recommendedCareerPath', topCareerPath);
                  
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
            logger.error('Error initializing career coach:', error);
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
  
  useEffect(() => {
    if (assistantId) {
      const assistant = [...allAssistants, careerExplorerAssistant].find(
        a => a.id === assistantId
      );
      if (assistant) {
        setSelectedAssistant(assistant);
      } else {
        setSelectedAssistant(careerExplorerAssistant);
      }
    } else {
      setSelectedAssistant(careerExplorerAssistant);
    }
  }, [assistantId]);

  // We don't need to replace this with useAuthenticatedNavigation because 
  // we're not redirecting to login - we're showing a LoginWall component instead
  if (!isAuthenticated) {
    return (
      <LoginWall 
        message="Please log in to use our AI assistants" 
        visibleItems={0} 
        totalItems={allAssistants.length + 1} // +1 for career explorer assistant
      />
    );
  }
  
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