
import React, { useEffect, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import HeroSection from '@/components/home/HeroSection';
import QuizSection from '@/components/quiz/QuizSection';
import FeaturedCourses from '@/components/home/FeaturedCourses';
import UpcomingEvents from '@/components/home/UpcomingEvents';
import CTASection from '@/components/home/CTASection';
import Footer from '@/components/layout/Footer';
import LearningJourney from '@/components/home/LearningJourney';
import AnalyticsDashboard from '@/components/home/AnalyticsDashboard';
import { useInView } from 'react-intersection-observer';
import { useCoursesManagement } from '@/hooks/useCoursesManagement';
import PersonalizedPathway from '@/components/home/PersonalizedPathway';
import InteractiveShowcase from '@/components/home/InteractiveShowcase';
import CommunityShowcase from '@/components/home/CommunityShowcase';
import FeaturesSection from '@/components/home/FeaturesSection';
import ExploreTools from '@/components/home/ExploreTools';
import WelcomeModal from '@/components/onboarding/WelcomeModal';
import OnboardingGuide from '@/components/onboarding/OnboardingGuide';
import OnboardingTrigger from '@/components/onboarding/OnboardingTrigger';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { useRecentEvents } from '@/hooks/useEvents';
import { useAuth } from '@/hooks/useAuth';

// Individual section wrapper to safely use useInView per-section
function SectionItem({ id, Component, threshold, isOnboardingActive }: {
  id: string;
  Component: React.ComponentType;
  threshold: number;
  isOnboardingActive: boolean;
}) {
  const { ref, inView } = useInView({
    triggerOnce: !isOnboardingActive,
    threshold,
    rootMargin: '-50px 0px',
  });

  const shouldBeVisible = inView || isOnboardingActive;

  return (
    <div
      ref={ref}
      data-tour={id}
      className={`transition-opacity duration-700 ${shouldBeVisible ? 'opacity-100' : 'opacity-0'}`}
    >
      <Component />
    </div>
  );
}

const Index = () => {
  const { user, loading } = useAuth();
  const { courses } = useCoursesManagement();
  const featuredCourses = courses.filter(course => course.published).slice(0, 3);
  const { data: upcomingEvents = [], isLoading: eventsLoading } = useRecentEvents(3);
  const { isFirstVisit, completedTours, dismissedTours, startTour, isOnboardingActive, currentTour } = useOnboarding();

  // Smooth scrolling effect
  useEffect(() => {
    const handleScroll = () => {
      document.documentElement.style.setProperty(
        '--scroll',
        (window.scrollY / (document.body.offsetHeight - window.innerHeight)).toString()
      );
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Redirect authenticated users — restore last visited path if available
  if (!loading && user) {
    const lastPath = sessionStorage.getItem('lastVisitedPath');
    if (lastPath) {
      sessionStorage.removeItem('lastVisitedPath');
      return <Navigate to={lastPath} replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  // Create sections array with reordered sections - career quiz before personalized pathway
  const sections = [
    { id: 'hero', Component: HeroSection, threshold: 0.1 },
    { id: 'quiz', Component: QuizSection, threshold: 0.3 },
    { id: 'personalizedPathway', Component: PersonalizedPathway, threshold: 0.3 },
    { id: 'interactiveShowcase', Component: InteractiveShowcase, threshold: 0.2 },
    { id: 'features', Component: FeaturesSection, threshold: 0.3 },
    { id: 'journey', Component: LearningJourney, threshold: 0.2 },
    { id: 'courses', Component: () => <FeaturedCourses courses={featuredCourses as any} />, threshold: 0.2 },
    { id: 'tools', Component: ExploreTools, threshold: 0.3 },
    { id: 'analytics', Component: AnalyticsDashboard, threshold: 0.2 },
    { id: 'communityShowcase', Component: CommunityShowcase, threshold: 0.2 },
    { id: 'events', Component: () => <UpcomingEvents events={upcomingEvents} />, threshold: 0.2 },
    { id: 'cta', Component: CTASection, threshold: 0.3 },
  ];

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden">
      <WelcomeModal />
      <OnboardingGuide tourId="home" />
      
      {/* Onboarding trigger button */}
      {!isFirstVisit && !isOnboardingActive && (
        <div className="fixed bottom-4 right-4 z-50">
          <OnboardingTrigger tourId="home" variant="button" />
        </div>
      )}
      
      {sections.map(({ id, Component, threshold }) => (
        <SectionItem
          key={id}
          id={id}
          Component={Component}
          threshold={threshold}
          isOnboardingActive={isOnboardingActive}
        />
      ))}
      <Footer />
    </div>
  );
};

export default Index;
