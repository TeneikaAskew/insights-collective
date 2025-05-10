
import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MessageSquare } from 'lucide-react';

interface CoachingCallToActionProps {
  onStartCareerChat: () => void;
  hasAnalysis?: boolean;
}

export const CoachingCallToAction: React.FC<CoachingCallToActionProps> = ({ onStartCareerChat, hasAnalysis = false }) => {
  const [isFlashing, setIsFlashing] = useState(false);
  const [hasBeenClicked, setHasBeenClicked] = useState(false);
  const flashIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!hasAnalysis || hasBeenClicked) {
      if (flashIntervalRef.current) {
        clearInterval(flashIntervalRef.current);
        setIsFlashing(false); // Ensure flashing stops immediately
      }
      return;
    }

    // Clear any existing interval before starting a new one
    if (flashIntervalRef.current) {
      clearInterval(flashIntervalRef.current);
    }

    flashIntervalRef.current = setInterval(() => {
      setIsFlashing(prev => !prev);
    }, 1000);

    return () => {
      if (flashIntervalRef.current) {
        clearInterval(flashIntervalRef.current);
      }
    };
  }, [hasAnalysis, hasBeenClicked]);

  const handleButtonClick = () => {
    setHasBeenClicked(true);
    if (flashIntervalRef.current) {
      clearInterval(flashIntervalRef.current);
      setIsFlashing(false);
    }
    onStartCareerChat();
  };

  const getButtonClass = () => {
    if (hasAnalysis && hasBeenClicked) {
      return 'bg-green-600 hover:bg-green-700';
    } else if (hasAnalysis && isFlashing && !hasBeenClicked) {
      return 'bg-teal-600 hover:bg-teal-700';
    } else {
      return 'bg-blue-600 hover:bg-blue-700'; // Default or initial state
    }
  };

  return (
    <Card className="bg-blue-50 border-blue-100">
      <CardContent className="p-4">
        <div className="flex items-start space-x-3">
          <MessageSquare className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="font-medium text-blue-900">Get Personalized Coaching</h4>
            <p className="text-sm text-blue-700 mb-3">
              Speak with our AI career coach for detailed guidance on how to address these improvement areas.
            </p>
            <Button
              onClick={handleButtonClick}
              className={`w-full gap-2 transition-colors duration-300 ${getButtonClass()}`}
            >
              <MessageSquare className="h-4 w-4" />
              {hasAnalysis && hasBeenClicked ? 'Continue Career Chat' : 'Start Career Chat'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
