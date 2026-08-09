
import React, { lazy, Suspense, useEffect, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import HeroSection from '@/components/home/HeroSection';
import QuizSection from '@/components/quiz/QuizSection';
import FeaturedCourses from '@/components/home/FeaturedCourses';
import UpcomingEvents from '@/components/home/UpcomingEvents';
import CTASection from '@/components/home/CTASection';
import Footer from '@/components/layout/Footer';
import LearningJourney from '@/components/home/LearningJourney';
import { useInView } from 'react-intersection-observer';
import { usePublishedCourses } from '@/hooks/usePublishedCourses';
import PersonalizedPathway from '@/components/home/PersonalizedPathway';
import CommunityShowcase from '@/components/home/CommunityShowcase';
import FeaturesSection from '@/components/home/FeaturesSection';
import ExploreTools from '@/components/home/ExploreTools';
import WelcomeModal from '@/components/onboarding/WelcomeModal';
import OnboardingGuide from '@/components/onboarding/OnboardingGuide';
import OnboardingTrigger from '@/components/onboarding/OnboardingTrigger';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { useRecentEvents } from '@/hooks/useEvents';
import { useAuth } from '@/hooks/useAuth';
import PageSeo, { SITE_NAME, SITE_URL } from '@/components/seo/PageSeo';


// The only two sections on this page that pull in recharts — InteractiveShowcase
// directly, AnalyticsDashboard through LearningProgressChart. Between them they
// were putting a 336KB charting library into the entry graph, plus its
// modulepreload tag, so every first-time visitor downloaded and parsed it before
// the landing page could paint. Nobody sees a chart until they scroll.
//
// lazy() alone is not enough, which is worth stating because it is the easy
// mistake here: React starts a lazy import when the component RENDERS, and the
// existing useInView gate controls opacity, not mounting — every section is in
// the DOM from the start. So a lazy section that is merely transparent still
// downloads its chunk during the first render, and a visitor who never scrolls
// still pays for recharts. Only the modulepreload goes away.
//
// So these two — and only these two — also wait for `deferUntilVisible`. The
// reason the rest cannot is that dropping a section from the DOM collapses the
// page, which brings everything below it into view at once and defeats the
// observer cascade. These two can, because SectionFallback holds their space
// while they are absent.
const InteractiveShowcase = lazy(() => import('@/components/home/InteractiveShowcase'));
const AnalyticsDashboard = lazy(() => import('@/components/home/AnalyticsDashboard'));

// Approximate, and only has to be: its job is to stop the page collapsing in the
// moment between first paint and the chart chunk arriving. Viewport-relative
// rather than a pixel guess, because these are full-width marketing sections
// whose real height depends on the viewport anyway.
const SectionFallback = () => <div className="min-h-[50vh]" aria-hidden="true" />;

// Individual section wrapper to safely use useInView per-section
function SectionItem({ id, Component, threshold, isOnboardingActive, deferUntilVisible = false }: {
  id: string;
  Component: React.ComponentType;
  threshold: number;
  isOnboardingActive: boolean;
  /** Hold the section out of the DOM until it is near the viewport, so its
   *  lazy chunk is not requested during the first render. Only safe for
   *  sections whose height SectionFallback can stand in for. */
  deferUntilVisible?: boolean;
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
      {deferUntilVisible && !shouldBeVisible ? (
        <SectionFallback />
      ) : (
        <Suspense fallback={<SectionFallback />}>
          <Component />
        </Suspense>
      )}
    </div>
  );
}

const Index = () => {
  const { user, loading } = useAuth();
  // This page redirects authenticated visitors to /dashboard (below), so every
  // visitor who reaches it is signed out. `useCoursesManagement` returns an
  // empty list and logs a CRITICAL line when there is no user, which meant
  // Featured Courses rendered for nobody. The published-courses read works
  // for anonymous visitors, which is the only kind this page has.
  const { courses } = usePublishedCourses();
  const featuredCourses = useMemo(
    () =>
      courses.slice(0, 3).map(course => ({
        ...course,
        // Same precedence as the catalog: image_url first, thumbnail as the
        // fallback, and no stock-photo substitute when both are absent.
        thumbnail: course.image_url || course.thumbnail || undefined,
      })),
    [courses]
  );
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
    { id: 'interactiveShowcase', Component: InteractiveShowcase, threshold: 0.2, deferUntilVisible: true },
    { id: 'features', Component: FeaturesSection, threshold: 0.3 },
    { id: 'journey', Component: LearningJourney, threshold: 0.2 },
    { id: 'courses', Component: () => <FeaturedCourses courses={featuredCourses} />, threshold: 0.2 },
    { id: 'tools', Component: ExploreTools, threshold: 0.3 },
    { id: 'analytics', Component: AnalyticsDashboard, threshold: 0.2, deferUntilVisible: true },
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
      
      {sections.map(({ id, Component, threshold, deferUntilVisible }) => (
        <SectionItem
          key={id}
          id={id}
          Component={Component}
          threshold={threshold}
          isOnboardingActive={isOnboardingActive}
          deferUntilVisible={deferUntilVisible}
        />
      ))}
      <Footer />
    </div>
  );
};

export default Index;
