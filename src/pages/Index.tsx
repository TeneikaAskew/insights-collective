import React, { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import PublicNavBar from '@/components/home/PublicNavBar';
import HeroSection from '@/components/home/HeroSection';
import QuizSection from '@/components/quiz/QuizSection';
import LearningJourney from '@/components/home/LearningJourney';
import CareerPaths from '@/components/home/CareerPaths';
import CareerTools from '@/components/home/CareerTools';
import FeaturedCourses from '@/components/home/FeaturedCourses';
import BlueprintSeries from '@/components/home/BlueprintSeries';
import UpcomingEvents from '@/components/home/UpcomingEvents';
import CTASection from '@/components/home/CTASection';
import Footer from '@/components/layout/Footer';
import { useInView } from 'react-intersection-observer';
import { usePublicCourses } from '@/hooks/usePublicCourses';
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

  // Stays true while a tour runs, or the guide would spotlight an invisible section.
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
  // Public catalog read — useCoursesManagement is auth-gated and always returned [] here.
  const { data: featuredCourses = [], isLoading: coursesLoading } = usePublicCourses(3);
  const { data: upcomingEvents = [] } = useRecentEvents(3);
  const { isFirstVisit, isOnboardingActive } = useOnboarding();

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

  // data-tour ids must stay in sync with the `home` tour in src/data/onboardingTours.ts
  const sections = [
    { id: 'hero', Component: HeroSection, threshold: 0.1 },
    { id: 'quiz', Component: QuizSection, threshold: 0.2 },
    { id: 'journey', Component: LearningJourney, threshold: 0.15 },
    { id: 'paths', Component: CareerPaths, threshold: 0.15 },
    { id: 'tools', Component: CareerTools, threshold: 0.15 },
    {
      id: 'courses',
      Component: () => <FeaturedCourses courses={featuredCourses as any} isLoading={coursesLoading} />,
      threshold: 0.15,
    },
    { id: 'blueprint', Component: BlueprintSeries, threshold: 0.15 },
    { id: 'events', Component: () => <UpcomingEvents events={upcomingEvents} />, threshold: 0.15 },
    { id: 'cta', Component: CTASection, threshold: 0.2 },
  ];

  return (
    <div className="soft-studio min-h-screen flex flex-col overflow-x-hidden">
      <Helmet>
        <title>Insights Collective — Accelerating Your Life</title>
        <meta
          name="description"
          content="Find your data career path with a free 10-question quiz, then follow a structured learning path with courses, resume review, interview practice and portfolio tools."
        />
        <link rel="canonical" href="https://insightscollective.org/" />
        <meta property="og:title" content="Insights Collective — Accelerating Your Life" />
        <meta
          property="og:description"
          content="Find your data career path with a free 10-question quiz, then follow a structured learning path built around it."
        />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://insightscollective.org/" />
      </Helmet>

      <WelcomeModal />
      <OnboardingGuide tourId="home" />

      {/* Onboarding trigger button */}
      {!isFirstVisit && !isOnboardingActive && (
        <div className="fixed bottom-4 right-4 z-50">
          <OnboardingTrigger tourId="home" variant="button" />
        </div>
      )}

      <PublicNavBar />

      <main>
        {sections.map(({ id, Component, threshold }) => (
          <SectionItem
            key={id}
            id={id}
            Component={Component}
            threshold={threshold}
            isOnboardingActive={isOnboardingActive}
          />
        ))}
      </main>
      <Footer />
    </div>
  );
};

export default Index;
