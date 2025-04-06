
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const HeroSection = () => {
  return (
    <section className="relative py-20 overflow-hidden">
      {/* Modern data-themed background */}
      <div className="absolute inset-0 bg-gradient-to-r from-learnflow-900 to-learnflow-700 opacity-90">
        {/* Abstract data visualization elements */}
        <div className="absolute inset-0 overflow-hidden">
          {/* Network nodes */}
          <div className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full border border-white/10 opacity-20"></div>
          <div className="absolute top-1/3 left-1/3 w-96 h-96 rounded-full border border-white/10 opacity-15"></div>
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full border border-white/10 opacity-20"></div>
          
          {/* Data flow lines */}
          <div className="absolute top-0 left-1/2 w-px h-full bg-gradient-to-b from-transparent via-white/20 to-transparent opacity-20"></div>
          <div className="absolute top-1/2 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-20"></div>
          
          {/* Floating data points */}
          <div className="absolute top-1/4 left-1/4 w-2 h-2 rounded-full bg-primary animate-pulse"></div>
          <div className="absolute top-1/2 left-3/4 w-3 h-3 rounded-full bg-secondary animate-pulse" style={{ animationDelay: '1s' }}></div>
          <div className="absolute bottom-1/4 right-1/3 w-2 h-2 rounded-full bg-primary/80 animate-pulse" style={{ animationDelay: '1.5s' }}></div>
          <div className="absolute top-2/3 right-1/4 w-4 h-4 rounded-full bg-primary/40 animate-pulse" style={{ animationDelay: '0.7s' }}></div>
        </div>
      </div>
      
      {/* Content */}
      <div className="container relative z-10 mx-auto px-4">
        <div className="max-w-3xl mx-auto text-center text-white">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            Welcome to Insights Collective
          </h1>
          <p className="text-xl mb-8">
            A modern e-learning platform designed to help you achieve your educational goals
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button size="lg" asChild>
              <Link to="/register">Get Started</Link>
            </Button>
            <Button size="lg" variant="outline" className="bg-transparent hover:bg-white/10" asChild>
              <Link to="/login">Sign In</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
