import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { useNavigate, useLocation } from 'react-router-dom';

const WelcomeModal: React.FC = () => {
  const { isFirstVisit, startTour, skipTour } = useOnboarding();
  const navigate = useNavigate();
  const location = useLocation();

  // Don't show modal on course edit pages or other management pages
  const isManagementPage = location.pathname.includes('/edit') || 
                          location.pathname.includes('/manage') ||
                          location.pathname.includes('/settings');
  
  // Only show on home page for first-time visitors
  const shouldShow = isFirstVisit && location.pathname === '/' && !isManagementPage;

  const handleStartTour = () => {
    // First close the welcome modal by marking it as dismissed
    skipTour();
    // Then force-start the tour (bypassing the dismissed check)
    setTimeout(() => {
      startTour('home', true);
    }, 100);
  };

  const handleSkip = () => {
    skipTour();
  };

  const handleGetStarted = (path: string) => {
    skipTour(); // Mark as dismissed since user is choosing to skip the modal
    navigate(path);
  };

  return (
    <AnimatePresence>
      {shouldShow && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 z-[1100] flex items-center justify-center p-4"
          onClick={handleSkip}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <Card className="border-primary shadow-2xl">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSkip}
                className="absolute right-2 top-2 h-8 w-8 p-0 z-10 rounded-full"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </Button>

              <CardHeader className="text-center pb-3 pt-6">
                <div className="h-12 w-12 mx-auto bg-gradient-to-br from-blue-500 to-violet-600 rounded-full flex items-center justify-center mb-2">
                  <Sparkles className="h-6 w-6 text-white" />
                </div>
                <CardTitle className="text-lg">Welcome to Insights Collective!</CardTitle>
                <p className="text-muted-foreground text-xs">
                  Your AI-powered platform for data career success
                </p>
              </CardHeader>
              <CardContent className="space-y-3 pb-5">
                <Button
                  onClick={() => handleGetStarted('/career-agent')}
                  className="w-full h-auto py-2.5"
                  variant="default"
                >
                  <div className="text-left w-full">
                    <div className="font-medium text-sm">Start Career Assessment</div>
                    <div className="text-[11px] opacity-80">Get personalized recommendations</div>
                  </div>
                </Button>
                <Button
                  onClick={() => handleGetStarted('/resume')}
                  className="w-full h-auto py-2.5"
                  variant="outline"
                >
                  <div className="text-left w-full">
                    <div className="font-medium text-sm">Analyze My Resume</div>
                    <div className="text-[11px] opacity-60">Get AI-powered resume feedback</div>
                  </div>
                </Button>

                <div className="flex justify-between pt-1">
                  <Button variant="ghost" size="sm" onClick={handleStartTour} className="text-xs text-muted-foreground">
                    Take tour
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleSkip} className="text-xs text-muted-foreground">
                    Skip
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default WelcomeModal;
