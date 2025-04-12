
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { storeQuizAttempt, startCareerCoachConversation } from '@/services/quizService';
import { CareerTrack } from '@/data/careerQuizData';
import { useAuth } from '@/contexts/AuthContext';

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

  const initiateCareerCoachChat = async (
    answers: Record<number, number | string>,
    scores: Record<CareerTrack, number>
  ) => {
    // Check if user is authenticated
    if (!isAuthenticated) {
      // Store the career coach path for redirect after login
      storeRedirectPath('/assistant/career-coach');
      
      // Store quiz scores for after login
      localStorage.setItem('quizScores', JSON.stringify(scores));
      
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
      localStorage.setItem('activeQuizAttemptId', quizAttemptId);
      localStorage.setItem('activeConversationId', conversationId);
      localStorage.setItem('recommendedCareerPath', topCareerPath);
      localStorage.setItem('recommendedSalary', recommendedSalary.toString());
      
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
