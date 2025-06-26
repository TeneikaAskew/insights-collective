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
  const [, forceUpdate] = useState({});

  const tour = onboardingTours[tourId];
  const currentStepData = tour?.steps[currentStep];
  
  useEffect(() => {
    if (currentStepData?.target && isOnboardingActive && currentTour === tourId) {
      let retryCount = 0;
      const maxRetries = 10;
      let timeoutId: NodeJS.Timeout;
      
      const findElement = () => {
        const element = document.querySelector(currentStepData.target) as HTMLElement;
        
        if (element) {
          setTargetElement(element);
          setElementNotFound(false);
          
          // Check if element is visible
          const rect = element.getBoundingClientRect();
          const isVisible = rect.width > 0 && rect.height > 0;
          
          if (!isVisible) {
            // Element exists but not visible, retry
            retryCount++;
            if (retryCount < maxRetries) {
              timeoutId = setTimeout(findElement, 500);
              return;
            }
          }
          
          // Scroll element into view with better positioning
          const scrollPadding = 100; // Extra padding for tooltip
          const elementTop = rect.top + window.pageYOffset;
          const elementMiddle = elementTop + rect.height / 2;
          const viewportMiddle = window.innerHeight / 2;
          
          // Calculate scroll position to center element
          const scrollTo = elementMiddle - viewportMiddle;
          
          window.scrollTo({
            top: Math.max(0, scrollTo),
            behavior: 'smooth'
          });
          
          // Execute step action after scroll completes
          setTimeout(() => {
            if (currentStepData.action) {
              currentStepData.action();
            }
          }, 500);
        } else {
          retryCount++;
          if (retryCount < maxRetries) {
            // Retry with exponential backoff
            const delay = Math.min(500 * Math.pow(1.5, retryCount), 2000);
            timeoutId = setTimeout(findElement, delay);
          } else {
            console.warn(`Onboarding: Element not found after ${maxRetries} attempts: "${currentStepData.target}"`);
            setElementNotFound(true);
            setTargetElement(null);
          }
        }
      };
      
      // Initial delay to allow DOM to render
      timeoutId = setTimeout(findElement, 100);
      
      // Cleanup function
      return () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      };
    } else {
      setTargetElement(null);
      setElementNotFound(false);
    }
  }, [currentStep, currentStepData, isOnboardingActive, currentTour, tourId]);

  // Handle window resize to update positions
  useEffect(() => {
    if (!targetElement || !isOnboardingActive) return;

    const handleResize = () => {
      // Force re-render to recalculate positions
      forceUpdate({});
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize);
    };
  }, [targetElement, isOnboardingActive]);

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
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const tooltipWidth = 400; // Approximate tooltip width
    const tooltipHeight = 200; // Approximate tooltip height
    const padding = 20;
    
    let position: any = {
      position: 'fixed' as const
    };

    // Calculate base position based on target position preference
    switch (currentStepData.position) {
      case 'top':
        position.top = rect.top - tooltipHeight - padding;
        position.left = rect.left + rect.width / 2;
        position.transform = 'translateX(-50%)';
        break;
      case 'bottom':
        position.top = rect.bottom + padding;
        position.left = rect.left + rect.width / 2;
        position.transform = 'translateX(-50%)';
        break;
      case 'left':
        position.top = rect.top + rect.height / 2;
        position.left = rect.left - tooltipWidth - padding;
        position.transform = 'translateY(-50%)';
        break;
      case 'right':
        position.top = rect.top + rect.height / 2;
        position.left = rect.right + padding;
        position.transform = 'translateY(-50%)';
        break;
      default:
        position.top = rect.bottom + padding;
        position.left = rect.left + rect.width / 2;
        position.transform = 'translateX(-50%)';
    }

    // Adjust position to keep tooltip within viewport
    // Check vertical bounds
    if (position.top < padding) {
      // If tooltip would go above viewport, position it below target
      position.top = rect.bottom + padding;
      if (currentStepData.position === 'top') {
        // Override the original position preference
        position.top = Math.min(rect.bottom + padding, viewportHeight - tooltipHeight - padding);
      }
    } else if (position.top + tooltipHeight > viewportHeight - padding) {
      // If tooltip would go below viewport, position it above target
      position.top = Math.max(padding, rect.top - tooltipHeight - padding);
    }

    // Check horizontal bounds
    if (currentStepData.position === 'left' || currentStepData.position === 'right') {
      // For left/right positioned tooltips
      if (position.left < padding) {
        position.left = rect.right + padding;
      } else if (position.left + tooltipWidth > viewportWidth - padding) {
        position.left = rect.left - tooltipWidth - padding;
      }
    } else {
      // For top/bottom positioned tooltips (centered horizontally)
      const centerX = position.left - tooltipWidth / 2;
      if (centerX < padding) {
        position.left = padding + tooltipWidth / 2;
      } else if (centerX + tooltipWidth > viewportWidth - padding) {
        position.left = viewportWidth - padding - tooltipWidth / 2;
      }
    }

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
            top: targetElement.getBoundingClientRect().top - 8,
            left: targetElement.getBoundingClientRect().left - 8,
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
