
import React from 'react';
import HeroSection from '@/components/home/HeroSection';
import BlueprintBanner from '@/components/home/BlueprintBanner';
import QuizSection from '@/components/quiz/QuizSection';
import FeaturedCourses from '@/components/home/FeaturedCourses';
import UpcomingEvents from '@/components/home/UpcomingEvents';
import CTASection from '@/components/home/CTASection';
import Footer from '@/components/layout/Footer';
import LearningJourney from '@/components/home/LearningJourney';
import AnalyticsDashboard from '@/components/home/AnalyticsDashboard';
import { useInView } from 'react-intersection-observer';
import { useEffect } from 'react';
import { mockService } from '@/lib/mock';
import PersonalizedPathway from '@/components/home/PersonalizedPathway';
import InteractiveShowcase from '@/components/home/InteractiveShowcase';
import CommunityShowcase from '@/components/home/CommunityShowcase';
import FeaturesSection from '@/components/home/FeaturesSection';
import ExploreTools from '@/components/home/ExploreTools';

const Index = () => {
  const featuredCourses = mockService.getAllCourses().slice(0, 3);
  const upcomingEvents = mockService.getEvents().slice(0, 3);
  
  // Create sections array first
  const sections = [
    { id: 'hero', Component: HeroSection, threshold: 0.1 },
    { id: 'personalizedPathway', Component: PersonalizedPathway, threshold: 0.3 },
    { id: 'interactiveShowcase', Component: InteractiveShowcase, threshold: 0.2 },
    { id: 'features', Component: FeaturesSection, threshold: 0.3 },
    { id: 'blueprint', Component: BlueprintBanner, threshold: 0.3 },
    { id: 'quiz', Component: QuizSection, threshold: 0.3 },
    { id: 'journey', Component: LearningJourney, threshold: 0.2 },
    { id: 'courses', Component: () => <FeaturedCourses courses={featuredCourses} />, threshold: 0.2 },
    { id: 'tools', Component: ExploreTools, threshold: 0.3 },
    { id: 'analytics', Component: AnalyticsDashboard, threshold: 0.2 },
    { id: 'communityShowcase', Component: CommunityShowcase, threshold: 0.2 },
    { id: 'events', Component: () => <UpcomingEvents events={upcomingEvents} />, threshold: 0.2 },
    { id: 'cta', Component: CTASection, threshold: 0.3 },
  ];
  
  // Create refs for sections
  const sectionRefs = sections.map(section => {
    const { ref, inView } = useInView({
      triggerOnce: true,
      threshold: section.threshold,
      rootMargin: '-50px 0px',
    });
    
    return { 
      id: section.id, 
      ref, 
      inView, 
      Component: section.Component 
    };
  });
  
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
  
  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden">
      {sectionRefs.map(({ id, ref, inView, Component }) => (
        <div 
          key={id} 
          ref={ref} 
          className={`transition-opacity duration-700 ${inView ? 'opacity-100' : 'opacity-0'}`}
        >
          <Component />
        </div>
      ))}
      <Footer />
    </div>
  );
};

export default Index;