
import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Users, TrendingUp, BookOpen, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { useNavigate } from 'react-router-dom';

const WelcomeModal: React.FC = () => {
  const { isFirstVisit, startTour, completeTour } = useOnboarding();
  const navigate = useNavigate();

  const handleStartTour = () => {
    startTour('home');
  };

  const handleSkip = () => {
    completeTour();
  };

  const handleGetStarted = (path: string) => {
    completeTour();
    navigate(path);
  };

  // Don't render if not first visit
  if (!isFirstVisit) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 z-[1100] flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        className="relative max-w-2xl w-full"
      >
        <Card className="border-primary shadow-2xl">
          <CardHeader className="text-center pb-4 relative">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSkip}
              className="absolute right-4 top-4 h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
            <div className="h-16 w-16 mx-auto bg-gradient-to-br from-blue-500 to-violet-600 rounded-full flex items-center justify-center mb-4">
              <Sparkles className="h-8 w-8 text-white" />
            </div>
            <CardTitle className="text-2xl">Welcome to Insights Collective! 🚀</CardTitle>
            <p className="text-muted-foreground">
              Your AI-powered platform for data career success
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center">
              <h3 className="font-semibold mb-2">You're joining a community of data professionals who are:</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                <div className="text-center p-3">
                  <Users className="h-8 w-8 mx-auto mb-2 text-blue-500" />
                  <p className="text-sm font-medium">Building careers</p>
                  <p className="text-xs text-muted-foreground">in data science & analytics</p>
                </div>
                <div className="text-center p-3">
                  <TrendingUp className="h-8 w-8 mx-auto mb-2 text-green-500" />
                  <p className="text-sm font-medium">Growing skills</p>
                  <p className="text-xs text-muted-foreground">with AI-powered guidance</p>
                </div>
                <div className="text-center p-3">
                  <BookOpen className="h-8 w-8 mx-auto mb-2 text-purple-500" />
                  <p className="text-sm font-medium">Learning continuously</p>
                  <p className="text-xs text-muted-foreground">with curated resources</p>
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-semibold text-center mb-4">Choose your next step:</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Button
                  onClick={() => handleGetStarted('/career-agent')}
                  className="w-full justify-start gap-3 h-auto p-4"
                  variant="default"
                >
                  <div className="text-left">
                    <div className="font-medium">Start Career Assessment</div>
                    <div className="text-xs opacity-80">Get personalized career recommendations</div>
                  </div>
                </Button>
                <Button
                  onClick={() => handleGetStarted('/resume')}
                  className="w-full justify-start gap-3 h-auto p-4"
                  variant="outline"
                >
                  <div className="text-left">
                    <div className="font-medium">Analyze My Resume</div>
                    <div className="text-xs opacity-60">Get AI-powered resume feedback</div>
                  </div>
                </Button>
              </div>
            </div>

            <div className="flex justify-center gap-3 pt-2">
              <Button variant="outline" onClick={handleStartTour}>
                Take Platform Tour
              </Button>
              <Button variant="ghost" onClick={handleSkip} className="text-muted-foreground">
                I'll explore on my own
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
};

export default WelcomeModal;
