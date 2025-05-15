
import React, { useState, useEffect, useRef } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

type AnalysisStage = {
  id: string;
  message: string;
  duration: number; // Duration in milliseconds
};

interface ResumeAnalysisOverlayProps {
  isVisible: boolean;
  onClose?: () => void;
  userId: string | undefined;
  resumeId: string | undefined;
}

const ANALYSIS_STAGES: AnalysisStage[] = [
  { id: 'extract', message: 'Extracting resume content...', duration: 2500 },
  { id: 'parse', message: 'Parsing resume structure...', duration: 2000 },
  { id: 'bullets', message: 'Analyzing resume bullets...', duration: 3000 },
  { id: 'metrics', message: 'Evaluating metrics and achievements...', duration: 2000 },
  { id: 'action-words', message: 'Analyzing action verbs...', duration: 2000 },
  { id: 'structure', message: 'Reviewing resume structure...', duration: 2000 },
  { id: 'roast', message: 'Creating resume assessment...', duration: 3000 },
  { id: 'improvements', message: 'Generating improvement suggestions...', duration: 3000 },
  { id: 'scoring', message: 'Calculating final score...', duration: 2000 },
  { id: 'finalizing', message: 'Finalizing analysis results...', duration: 2000 },
];

export const ResumeAnalysisOverlay: React.FC<ResumeAnalysisOverlayProps> = ({ 
  isVisible, 
  onClose,
  userId,
  resumeId
}) => {
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [careerGoals, setCareerGoals] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [savedLocally, setSavedLocally] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { user } = useAuth();

  // Load career goals from localStorage on mount
  useEffect(() => {
    if (userId) {
      const savedGoals = localStorage.getItem(`career_goals_${userId}`);
      if (savedGoals) {
        setCareerGoals(savedGoals);
        setSavedLocally(true);
      }
    }
  }, [userId]);

  // Cycle through stages
  useEffect(() => {
    if (!isVisible) {
      setCurrentStageIndex(0);
      return;
    }

    if (currentStageIndex < ANALYSIS_STAGES.length - 1) {
      const currentStage = ANALYSIS_STAGES[currentStageIndex];
      
      timerRef.current = setTimeout(() => {
        setCurrentStageIndex(prev => prev + 1);
      }, currentStage.duration);
    } else if (currentStageIndex === ANALYSIS_STAGES.length - 1) {
      // Loop back to first stage when we reach the end
      timerRef.current = setTimeout(() => {
        setCurrentStageIndex(0);
      }, ANALYSIS_STAGES[currentStageIndex].duration);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [isVisible, currentStageIndex]);

  // Save career goals to localStorage
  const saveGoalsLocally = () => {
    if (userId && careerGoals) {
      localStorage.setItem(`career_goals_${userId}`, careerGoals);
      setSavedLocally(true);
    }
  };

  // Save career goals to database
  const saveGoalsToDatabase = async () => {
    if (!userId || !resumeId) return;
    
    setIsSaving(true);
    
    try {
      // First save locally
      saveGoalsLocally();
      
      // Then save to database
      const { error } = await supabase
        .from('resumes')
        .update({ career_goals: careerGoals })
        .eq('id', resumeId);
      
      if (error) {
        console.error('Error saving career goals:', error);
      } else {
        console.log('Career goals saved to database');
      }
    } catch (err) {
      console.error('Error in saving career goals:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Save on input change with debounce
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (careerGoals && userId && careerGoals.length > 5) {
        saveGoalsLocally();
      }
    }, 1000);

    return () => clearTimeout(debounceTimer);
  }, [careerGoals, userId]);

  if (!isVisible) return null;

  const currentStage = ANALYSIS_STAGES[currentStageIndex];

  return (
    <div className="fixed inset-0 bg-background/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-card shadow-lg rounded-lg max-w-2xl w-full p-6">
        <div className="space-y-6">
          <div className="flex flex-col items-center text-center space-y-4">
            <Spinner size="lg" className="text-primary" />
            <h2 className="text-2xl font-semibold text-foreground">
              Analyzing Your Resume
            </h2>
            <p className="text-muted-foreground animate-pulse">
              {currentStage.message}
            </p>
            <div className="w-full bg-muted rounded-full h-2">
              <div 
                className="bg-primary rounded-full h-2 transition-all" 
                style={{ 
                  width: `${((currentStageIndex + 1) / ANALYSIS_STAGES.length) * 100}%`,
                }}
              />
            </div>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 space-y-4">
            <h3 className="text-lg font-medium">
              While we analyze your resume, tell us about your career goals:
            </h3>
            <Textarea
              placeholder="What are your career aspirations? What roles are you targeting next? What skills are you looking to develop?"
              className="min-h-[120px] resize-none"
              value={careerGoals}
              onChange={(e) => setCareerGoals(e.target.value)}
            />
            <div className="flex justify-between items-center">
              <div className="text-sm text-muted-foreground">
                {savedLocally ? 'Saved locally' : ''}
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={saveGoalsToDatabase}
                disabled={isSaving || !careerGoals}
              >
                {isSaving ? <Spinner size="sm" className="mr-2" /> : null}
                Save Goals
              </Button>
            </div>
          </div>
          
          <div className="text-center text-sm text-muted-foreground">
            <p>Analysis typically takes 20-30 seconds to complete</p>
          </div>
        </div>
      </div>
    </div>
  );
};
