import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, Check, SkipForward } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { onboardingTours } from '@/data/onboardingTours';

interface OnboardingGuideProps {
  tourId: string;
}

const OnboardingGuide: React.FC<OnboardingGuideProps> = ({ tourId }) => {
  const {
    isOnboardingActive,
    currentTour,
    currentStep,
    nextStep,
    prevStep,
    skipTour,
    completeTour,
  } = useOnboarding();

  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);
  const [overlayPosition, setOverlayPosition] = useState({ top: 0, left: 0 });
  const [elementNotFound, setElementNotFound] = useState(false);

  const tour = onboardingTours[tourId];
  const currentStepData = tour?.steps[currentStep];
  
  useEffect(() => {
    if (currentStepData?.target && isOnboardingActive && currentTour === tourId) {
      let retryCount = 0;
      const maxRetries = 5;
      
      const findElement = () => {
        const element = document.querySelector(currentStepData.target) as HTMLElement;
        
        if (element) {
          setTargetElement(element);
          setElementNotFound(false);
          
          // Scroll element into view
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          
          // Position overlay after scroll
          setTimeout(() => {
            try {
              const rect = element.getBoundingClientRect();
              const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
              const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
              
              setOverlayPosition({
                top: rect.top + scrollTop,
                left: rect.left + scrollLeft,
              });
              
              // Execute step action if exists
              if (currentStepData.action) {
                currentStepData.action();
              }
            } catch (error) {
              console.error('Onboarding: Error positioning element', error);
            }
          }, 800);
        } else {
          retryCount++;
          if (retryCount < maxRetries) {
            // Retry after a delay
            setTimeout(findElement, 500);
          } else {
            console.warn(`Onboarding: Element not found after ${maxRetries} attempts: "${currentStepData.target}"`);
            setElementNotFound(true);
            setTargetElement(null);
          }
        }
      };
      
      // Initial delay to allow DOM to render
      setTimeout(findElement, 200);
    } else {
      setTargetElement(null);
      setElementNotFound(false);
    }
  }, [currentStep, currentStepData, isOnboardingActive, currentTour, tourId]);

  const handleNext = () => {
    if (!tour) return;
    
    if (currentStep < tour.steps.length - 1) {
      nextStep();
    } else {
      completeTour();
    }
  };

  const handleSkip = () => {
    skipTour();
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      prevStep();
    }
  };

  const getTooltipPosition = () => {
    // Show tooltip in center if no target element or position
    if (!targetElement || !currentStepData?.position || elementNotFound) {
      return { 
        top: '50%', 
        left: '50%', 
        transform: 'translate(-50%, -50%)',
        position: 'fixed' as const
      };
    }

    const rect = targetElement.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    
    let position: any = {};

    switch (currentStepData.position) {
      case 'top':
        position = {
          top: rect.top + scrollTop - 20,
          left: rect.left + scrollLeft + rect.width / 2,
          transform: 'translate(-50%, -100%)',
        };
        break;
      case 'bottom':
        position = {
          top: rect.bottom + scrollTop + 20,
          left: rect.left + scrollLeft + rect.width / 2,
          transform: 'translate(-50%, 0)',
        };
        break;
      case 'left':
        position = {
          top: rect.top + scrollTop + rect.height / 2,
          left: rect.left + scrollLeft - 20,
          transform: 'translate(-100%, -50%)',
        };
        break;
      case 'right':
        position = {
          top: rect.top + scrollTop + rect.height / 2,
          left: rect.right + scrollLeft + 20,
          transform: 'translate(0, -50%)',
        };
        break;
      default:
        position = {
          top: rect.top + scrollTop + rect.height + 20,
          left: rect.left + scrollLeft + rect.width / 2,
          transform: 'translate(-50%, 0)',
        };
    }

    // Keep tooltip within viewport bounds
    if (position.left < 0) position.left = 20;
    if (position.left > viewportWidth - 400) position.left = viewportWidth - 420;
    if (position.top < 0) position.top = 20;

    return position;
  };

  if (!isOnboardingActive || currentTour !== tourId || !currentStepData) {
    return null;
  }

  return (
    <>
      {/* Backdrop overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-[1000]"
        onClick={handleSkip}
      />

      {/* Highlight overlay for target element */}
      {targetElement && currentStepData.highlight && !elementNotFound && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed z-[1001] pointer-events-none"
          style={{
            top: overlayPosition.top - 8,
            left: overlayPosition.left - 8,
            width: targetElement.offsetWidth + 16,
            height: targetElement.offsetHeight + 16,
            border: '3px solid #3b82f6',
            borderRadius: '8px',
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
          }}
        />
      )}

      {/* Tooltip */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
        className="fixed z-[1002] max-w-sm min-w-[320px]"
        style={getTooltipPosition()}
      >
        <Card className="border-primary shadow-2xl">
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {currentStep + 1} of {tour.steps.length}
                </Badge>
                <span className="text-xs text-muted-foreground">{tour.name}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSkip}
                className="h-6 w-6 p-0 hover:bg-destructive hover:text-destructive-foreground"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>

            <h3 className="font-semibold text-sm mb-2">{currentStepData.title}</h3>
            <p className="text-sm text-muted-foreground mb-4">{currentStepData.description}</p>

            {elementNotFound && (
              <div className="mb-4 p-2 bg-yellow-100 border border-yellow-300 rounded text-xs text-yellow-800">
                Section not currently visible. You can continue the tour or skip to explore on your own.
              </div>
            )}

            <div className="flex items-center justify-between gap-2">
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSkip}
                  className="gap-1"
                >
                  <SkipForward className="h-3 w-3" />
                  Skip Tour
                </Button>
              </div>

              <div className="flex gap-1">
                {currentStep > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePrevious}
                    className="gap-1"
                  >
                    <ChevronLeft className="h-3 w-3" />
                    Back
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={handleNext}
                  className="gap-1"
                >
                  {currentStep < tour.steps.length - 1 ? (
                    <>
                      Next
                      <ChevronRight className="h-3 w-3" />
                    </>
                  ) : (
                    <>
                      <Check className="h-3 w-3" />
                      Complete Tour
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </>
  );
};

export default OnboardingGuide;
