
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { storeQuizAttempt, startCareerCoachConversation } from '@/services/quizService';
import { CareerTrack } from '@/data/careerQuizData';
import { useAuth } from '@/contexts/AuthContext';
import { LocalStorageUtils } from '@/utils/localStorageUtils';

// Define typical salary ranges for each career path
const careerPathSalaries: Record<CareerTrack, number> = {
  'AI/ML': 160000,
  'Analytics': 110000,
  'Data Engineering': 140000,
  'Business Intelligence': 120000
};

export function useCareerCoach() {
  const [isProcessing, setIsProcessing] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAuthenticated, storeRedirectPath } = useAuth();

  // Check for stored quiz results on authentication
  useEffect(() => {
    const syncQuizResultsToSupabase = async () => {
      if (isAuthenticated) {
        // Use safely retrieve quiz data from localStorage
        let storedScores = null;
        let storedAnswers = null;
        
        try {
          const scoresStr = localStorage.getItem('quizScores');
          const answersStr = localStorage.getItem('quizAnswers');
          
          if (scoresStr) storedScores = JSON.parse(scoresStr);
          if (answersStr) storedAnswers = JSON.parse(answersStr);
        } catch (error) {
          console.error('Error parsing stored quiz data:', error);
        }
        
        if (storedScores && storedAnswers) {
          try {
            // Only sync if we have valid data
            if (Object.keys(storedScores).length > 0 && Object.keys(storedAnswers).length > 0) {
              console.log('Syncing stored quiz results to Supabase silently');
              const quizAttemptId = await storeQuizAttempt(storedAnswers, storedScores);
              
              if (quizAttemptId) {
                console.log('Successfully synced quiz results to Supabase');
                
                // If the user was redirected to login from career coach, initialize conversation
                const redirectPath = localStorage.getItem('redirectAfterLogin');
                if (redirectPath === '/assistant/career-coach') {
                  // Store the quiz attempt ID for later use
                  localStorage.setItem('activeQuizAttemptId', quizAttemptId);
                  
                  // Only start conversation if redirected from career coach
                  const conversationId = await startCareerCoachConversation(quizAttemptId);
                  if (conversationId) {
                    localStorage.setItem('activeConversationId', conversationId);
                  }
                }
              }
            }
          } catch (error) {
            console.error('Error syncing quiz results to Supabase:', error);
          }
        }
      }
    };
    
    syncQuizResultsToSupabase();
  }, [isAuthenticated]);

  const initiateCareerCoachChat = async (
    answers: Record<number, number | string>,
    scores: Record<CareerTrack, number>
  ) => {
    // Check if user is authenticated
    if (!isAuthenticated) {
      // Store the career coach path for redirect after login
      storeRedirectPath('/assistant/career-coach');
      
      // Safely store quiz data for after login
      const storeScores = LocalStorageUtils.safelyStoreItem('quizScores', JSON.stringify(scores));
      const storeAnswers = LocalStorageUtils.safelyStoreItem('quizAnswers', JSON.stringify(answers));
      
      if (!storeScores || !storeAnswers) {
        toast({
          title: "Storage Warning",
          description: "Quiz data may be partially stored due to browser limitations. Please complete your login promptly.",
          variant: "destructive"
        });
      }
      
      // Redirect to login
      toast({
        title: "Login Required",
        description: "Please log in to chat with our Career Coach.",
        variant: "default"
      });
      
      navigate('/login');
      return false;
    }
    
    setIsProcessing(true);
    
    try {
      // Step 1: Store quiz attempt
      const quizAttemptId = await storeQuizAttempt(answers, scores);
      
      if (!quizAttemptId) {
        throw new Error('Failed to store quiz attempt');
      }
      
      // Step 2: Start conversation
      const conversationId = await startCareerCoachConversation(quizAttemptId);
      
      if (!conversationId) {
        throw new Error('Failed to start conversation');
      }
      
      // Step 3: Determine top career path from scores
      const sortedTracks = Object.entries(scores)
        .sort(([, scoreA], [, scoreB]) => scoreB - scoreA);
      
      const topCareerPath = sortedTracks[0][0] as CareerTrack;
      const recommendedSalary = careerPathSalaries[topCareerPath];
      
      // Step 4: Store settings for the assistant interface to use
      const storageOps = [
        LocalStorageUtils.safelyStoreItem('activeQuizAttemptId', quizAttemptId),
        LocalStorageUtils.safelyStoreItem('activeConversationId', conversationId),
        LocalStorageUtils.safelyStoreItem('recommendedCareerPath', topCareerPath),
        LocalStorageUtils.safelyStoreItem('recommendedSalary', recommendedSalary.toString())
      ];
      
      // Check if any storage operations failed
      if (storageOps.some(success => !success)) {
        toast({
          title: "Storage Warning",
          description: "Some session data couldn't be saved due to browser limitations. The experience may be affected.",
          variant: "destructive"
        });
      }
      
      // Clear stored quiz data as it's now in Supabase
      localStorage.removeItem('quizScores');
      localStorage.removeItem('quizAnswers');
      
      // Navigate to the career coach assistant
      navigate('/assistant/career-coach');
      
      return true;
    } catch (error) {
      console.error('Error initiating career coach chat:', error);
      
      toast({
        title: "Error starting chat",
        description: "There was an issue connecting to the Career Coach. Please try again.",
        variant: "destructive",
      });
      
      return false;
    } finally {
      setIsProcessing(false);
    }
  };
  
  return {
    initiateCareerCoachChat,
    isProcessing
  };
}
