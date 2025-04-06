
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';

const HeroSection = () => {
  return (
    <section className="relative py-20 overflow-hidden bg-white dark:bg-gray-900">
      {/* Modern gradient background */}
      <div className="absolute inset-0 bg-gradient-to-r from-sky-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800">
        {/* Abstract data visualization elements */}
        <div className="absolute inset-0 overflow-hidden">
          {/* Network nodes */}
          <div className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full border border-primary/10 opacity-20"></div>
          <div className="absolute top-1/3 left-1/3 w-96 h-96 rounded-full border border-primary/10 opacity-15"></div>
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full border border-primary/10 opacity-20"></div>
          
          {/* Data flow lines */}
          <div className="absolute top-0 left-1/2 w-px h-full bg-gradient-to-b from-transparent via-primary/20 to-transparent opacity-20"></div>
          <div className="absolute top-1/2 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent opacity-20"></div>
          
          {/* Floating data points */}
          <div className="absolute top-1/4 left-1/4 w-2 h-2 rounded-full bg-primary animate-pulse"></div>
          <div className="absolute top-1/2 left-3/4 w-3 h-3 rounded-full bg-secondary animate-pulse" style={{ animationDelay: '1s' }}></div>
          <div className="absolute bottom-1/4 right-1/3 w-2 h-2 rounded-full bg-primary/80 animate-pulse" style={{ animationDelay: '1.5s' }}></div>
          <div className="absolute top-2/3 right-1/4 w-4 h-4 rounded-full bg-primary/40 animate-pulse" style={{ animationDelay: '0.7s' }}></div>
        </div>
      </div>
      
      {/* Content */}
      <div className="container relative z-10 mx-auto px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-6 text-gray-900 dark:text-white">
            Accelerate Your Data Science Career
          </h1>
          <p className="text-xl mb-8 text-gray-600 dark:text-gray-300">
            A modern e-learning platform designed to help you master data science skills with structured learning paths and expert guidance
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button size="lg" className="bg-primary hover:bg-primary/90" asChild>
              <Link to="/resources">Explore Resources</Link>
            </Button>
            <Button size="lg" variant="outline" className="border-primary text-primary hover:bg-primary hover:text-white" asChild>
              <Link to="/resources">
                <Search className="mr-2 h-4 w-4" />
                Explore Resources
              </Link>
            </Button>
          </div>
          
          <div className="mt-12 flex flex-wrap justify-center gap-8 text-sm text-gray-500 dark:text-gray-400">
            <div className="flex items-center">
              <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
              <span>50+ Professional Courses</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
              <span>Expert Instructors</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-purple-500 rounded-full mr-2"></div>
              <span>Industry-Recognized Certifications</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
