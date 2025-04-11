
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { storeQuizAttempt, startCareerCoachConversation } from '@/services/quizService';
import { CareerTrack } from '@/data/careerQuizData';

export function useCareerCoach() {
  const [isProcessing, setIsProcessing] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const initiateCareerCoachChat = async (
    answers: Record<number, number | string>,
    scores: Record<CareerTrack, number>
  ) => {
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
      
      // Step 3: Navigate to assistant interface
      // We're storing the quiz context in localStorage for the assistant to use
      localStorage.setItem('activeQuizAttemptId', quizAttemptId);
      localStorage.setItem('activeConversationId', conversationId);
      
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
