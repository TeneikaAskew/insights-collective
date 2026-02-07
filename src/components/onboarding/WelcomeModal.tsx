import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Users, TrendingUp, BookOpen, X } from 'lucide-react';
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
          className="fixed inset-0 bg-black/50 z-[1100] flex items-start sm:items-center justify-center p-4 overflow-y-auto"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            className="relative max-w-2xl w-full my-4 sm:my-0"
          >
            <Card className="border-primary shadow-2xl max-h-[90vh] overflow-y-auto">
              {/* Sticky close button for mobile */}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSkip}
                className="absolute right-2 top-2 h-8 w-8 p-0 z-10 bg-background/80 hover:bg-background rounded-full"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </Button>
              
              <CardHeader className="text-center pb-4 pt-10 sm:pt-6">
                <div className="h-16 w-16 mx-auto bg-gradient-to-br from-blue-500 to-violet-600 rounded-full flex items-center justify-center mb-4">
                  <Sparkles className="h-8 w-8 text-white" />
                </div>
                <CardTitle className="text-xl sm:text-2xl">Welcome to Insights Collective! 🚀</CardTitle>
                <p className="text-muted-foreground text-sm sm:text-base">
                  Your AI-powered platform for data career success
                </p>
              </CardHeader>
              <CardContent className="space-y-4 sm:space-y-6 pb-6">
                <div className="text-center">
                  <h3 className="font-semibold mb-2 text-sm sm:text-base">You're joining a community of data professionals who are:</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mt-4">
                    <div className="text-center p-2 sm:p-3">
                      <Users className="h-6 w-6 sm:h-8 sm:w-8 mx-auto mb-2 text-blue-500" />
                      <p className="text-sm font-medium">Building careers</p>
                      <p className="text-xs text-muted-foreground">in data science & analytics</p>
                    </div>
                    <div className="text-center p-2 sm:p-3">
                      <TrendingUp className="h-6 w-6 sm:h-8 sm:w-8 mx-auto mb-2 text-green-500" />
                      <p className="text-sm font-medium">Growing skills</p>
                      <p className="text-xs text-muted-foreground">with AI-powered guidance</p>
                    </div>
                    <div className="text-center p-2 sm:p-3">
                      <BookOpen className="h-6 w-6 sm:h-8 sm:w-8 mx-auto mb-2 text-purple-500" />
                      <p className="text-sm font-medium">Learning continuously</p>
                      <p className="text-xs text-muted-foreground">with curated resources</p>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-semibold text-center mb-4 text-sm sm:text-base">Choose your next step:</h4>
                  <div className="grid grid-cols-1 gap-3">
                    <Button
                      onClick={() => handleGetStarted('/career-agent')}
                      className="w-full justify-start gap-3 h-auto p-3 sm:p-4"
                      variant="default"
                    >
                      <div className="text-left">
                        <div className="font-medium text-sm sm:text-base">Start Career Assessment</div>
                        <div className="text-xs opacity-80">Get personalized career recommendations</div>
                      </div>
                    </Button>
                    <Button
                      onClick={() => handleGetStarted('/resume')}
                      className="w-full justify-start gap-3 h-auto p-3 sm:p-4"
                      variant="outline"
                    >
                      <div className="text-left">
                        <div className="font-medium text-sm sm:text-base">Analyze My Resume</div>
                        <div className="text-xs opacity-60">Get AI-powered resume feedback</div>
                      </div>
                    </Button>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row justify-center gap-2 sm:gap-3 pt-2">
                  <Button variant="outline" onClick={handleStartTour} className="text-sm">
                    Take Platform Tour
                  </Button>
                  <Button variant="ghost" onClick={handleSkip} className="text-muted-foreground text-sm">
                    I'll explore on my own
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
