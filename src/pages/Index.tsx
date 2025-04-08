
import { mockService } from '@/lib/mock';
import HeroSection from '@/components/home/HeroSection';
import BlueprintBanner from '@/components/home/BlueprintBanner';
import QuizSection from '@/components/quiz/QuizSection';
import FeaturedCourses from '@/components/home/FeaturedCourses';
import UpcomingEvents from '@/components/home/UpcomingEvents';
import CTASection from '@/components/home/CTASection';
import Footer from '@/components/layout/Footer';
import LearningJourney from '@/components/home/LearningJourney';
import AnalyticsDashboard from '@/components/home/AnalyticsDashboard';
import LearningProgressChart from '@/components/home/LearningProgressChart';

const Index = () => {
  const featuredCourses = mockService.getAllCourses().slice(0, 3);
  const upcomingEvents = mockService.getEvents().slice(0, 3);
  
  return (
    <div className="min-h-screen flex flex-col">
      <HeroSection />
      <BlueprintBanner />
      <QuizSection />
      <LearningJourney />
      <FeaturedCourses courses={featuredCourses} />
      <div className="container mx-auto py-12">
        <h2 className="text-2xl font-bold mb-6">Learning Performance Overview</h2>
        <LearningProgressChart />
      </div>
      <AnalyticsDashboard />
      <UpcomingEvents events={upcomingEvents} />
      <CTASection />
      <Footer />
    </div>
  );
};

export default Index;
