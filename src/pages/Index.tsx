
import { mockService } from '@/lib/mock';
import HeroSection from '@/components/home/HeroSection';
import BlueprintBanner from '@/components/home/BlueprintBanner';
import QuizSection from '@/components/quiz/QuizSection';
import FeaturesSection from '@/components/home/FeaturesSection';
import FeaturedCourses from '@/components/home/FeaturedCourses';
import UpcomingEvents from '@/components/home/UpcomingEvents';
import CTASection from '@/components/home/CTASection';
import Footer from '@/components/layout/Footer';
import LearningJourney from '@/components/home/LearningJourney';
import ExploreTools from '@/components/home/ExploreTools';
import AnalyticsDashboard from '@/components/home/AnalyticsDashboard';

const Index = () => {
  const featuredCourses = mockService.getAllCourses().slice(0, 3);
  const upcomingEvents = mockService.getEvents().slice(0, 3);
  
  return (
    <div className="min-h-screen flex flex-col">
      <HeroSection />
      <LearningJourney />
      <ExploreTools />
      <FeaturedCourses courses={featuredCourses} />
      <AnalyticsDashboard />
      <BlueprintBanner />
      <QuizSection />
      <UpcomingEvents events={upcomingEvents} />
      <CTASection />
      <Footer />
    </div>
  );
};

export default Index;
