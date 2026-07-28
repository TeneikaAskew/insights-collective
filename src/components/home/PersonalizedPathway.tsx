
import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowRight, Sparkles, BarChart2, BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { useAuthenticatedNavigation } from '@/hooks/useAuthenticatedNavigation';

const PersonalizedPathway = () => {
  const { navigateWithAuth, isAuthenticated } = useAuthenticatedNavigation();
  
  const handleExploreClick = () => {
    navigateWithAuth('/career-pathway', {
      requireAuth: true,
      message: "Sign in to create your personalized learning pathway",
      title: "Authentication Required"
    });
  };

  return (
    <section className="py-16 ss-wash" data-tour="personalizedPathway">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto text-center mb-10">
          <Badge className="mb-4 px-3 py-1 bg-primary/10 text-primary border-primary/20 hover:bg-primary/20">
            <Sparkles className="w-3.5 h-3.5 mr-1" />
            New Feature
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold font-display text-foreground mb-4">
            Your Personalized <span className="text-ss-lav-deep">Data Career Path</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            Discover the perfect learning journey tailored to your skills, experience, and career goals
            in the world of data science and analytics.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-card p-6 rounded-lg shadow-md border border-border">
            <div className="h-12 w-12 bg-ss-teal-chip rounded-lg flex items-center justify-center mb-4">
              <BarChart2 className="h-6 w-6 text-ss-teal" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Skill Assessment</h3>
            <p className="text-muted-foreground mb-4">
              Evaluate your current technical and soft skills to establish your baseline competencies.
            </p>
            <ul className="space-y-2 text-sm mb-4">
              <li className="flex items-center">
                <span className="bg-ss-good-chip p-1 rounded-full mr-2">
                  <svg className="h-2 w-2 text-ss-good" fill="currentColor" viewBox="0 0 8 8">
                    <circle cx="4" cy="4" r="3" />
                  </svg>
                </span>
                Interactive quiz assessment
              </li>
              <li className="flex items-center">
                <span className="bg-ss-good-chip p-1 rounded-full mr-2">
                  <svg className="h-2 w-2 text-ss-good" fill="currentColor" viewBox="0 0 8 8">
                    <circle cx="4" cy="4" r="3" />
                  </svg>
                </span>
                Technical expertise evaluation
              </li>
              <li className="flex items-center">
                <span className="bg-ss-good-chip p-1 rounded-full mr-2">
                  <svg className="h-2 w-2 text-ss-good" fill="currentColor" viewBox="0 0 8 8">
                    <circle cx="4" cy="4" r="3" />
                  </svg>
                </span>
                Baseline competency mapping
              </li>
            </ul>
          </div>

          <div className="bg-card p-6 rounded-lg shadow-md border border-border">
            <div className="h-12 w-12 bg-ss-lav-chip rounded-lg flex items-center justify-center mb-4">
              <BookOpen className="h-6 w-6 text-ss-lav-deep" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Career Mapping</h3>
            <p className="text-muted-foreground mb-4">
              Connect your goals with recommended courses and resources tailored for your aspirations.
            </p>
            <ul className="space-y-2 text-sm mb-4">
              <li className="flex items-center">
                <span className="bg-ss-good-chip p-1 rounded-full mr-2">
                  <svg className="h-2 w-2 text-ss-good" fill="currentColor" viewBox="0 0 8 8">
                    <circle cx="4" cy="4" r="3" />
                  </svg>
                </span>
                AI-powered path recommendations
              </li>
              <li className="flex items-center">
                <span className="bg-ss-good-chip p-1 rounded-full mr-2">
                  <svg className="h-2 w-2 text-ss-good" fill="currentColor" viewBox="0 0 8 8">
                    <circle cx="4" cy="4" r="3" />
                  </svg>
                </span>
                Industry-aligned curriculum
              </li>
              <li className="flex items-center">
                <span className="bg-ss-good-chip p-1 rounded-full mr-2">
                  <svg className="h-2 w-2 text-ss-good" fill="currentColor" viewBox="0 0 8 8">
                    <circle cx="4" cy="4" r="3" />
                  </svg>
                </span>
                Role-specific learning tracks
              </li>
            </ul>
          </div>

          <div className="bg-card p-6 rounded-lg shadow-md border border-border">
            <div className="h-12 w-12 bg-ss-warn-chip rounded-lg flex items-center justify-center mb-4">
              <Sparkles className="h-6 w-6 text-ss-warn" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Progress Tracking</h3>
            <p className="text-muted-foreground mb-4">
              Monitor your development journey with clear milestones and achievement tracking.
            </p>
            <ul className="space-y-2 text-sm mb-4">
              <li className="flex items-center">
                <span className="bg-ss-good-chip p-1 rounded-full mr-2">
                  <svg className="h-2 w-2 text-ss-good" fill="currentColor" viewBox="0 0 8 8">
                    <circle cx="4" cy="4" r="3" />
                  </svg>
                </span>
                Visual skill development graphs
              </li>
              <li className="flex items-center">
                <span className="bg-ss-good-chip p-1 rounded-full mr-2">
                  <svg className="h-2 w-2 text-ss-good" fill="currentColor" viewBox="0 0 8 8">
                    <circle cx="4" cy="4" r="3" />
                  </svg>
                </span>
                Completion certificates
              </li>
              <li className="flex items-center">
                <span className="bg-ss-good-chip p-1 rounded-full mr-2">
                  <svg className="h-2 w-2 text-ss-good" fill="currentColor" viewBox="0 0 8 8">
                    <circle cx="4" cy="4" r="3" />
                  </svg>
                </span>
                Industry skill benchmarking
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 text-center">
          <Button 
            size="lg" 
            onClick={handleExploreClick}
            className="rounded-full font-medium shadow-lg transition-all duration-300"
          >
            Discover Your Path <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          
          {!isAuthenticated && (
            <p className="mt-3 text-sm text-muted-foreground">
              Already know what you're looking for? <Link to="/courses" className="text-primary hover:underline">
                Browse all courses
              </Link>
            </p>
          )}
        </div>
      </div>
    </section>
  );
};

export default PersonalizedPathway;
