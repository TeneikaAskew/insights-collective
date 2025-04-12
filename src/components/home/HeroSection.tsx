
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Search, ArrowRight, ChevronDown } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { motion } from 'framer-motion';
import { useState, useEffect, useRef } from 'react';

// Rotating words component
const RotatingWords = () => {
  const words = ["Future", "Career", "Insights", "Impact", "Skills", "Edge", "Superpowers"];
  const [currentIndex, setCurrentIndex] = useState(0);
  const [wordWidth, setWordWidth] = useState(0);
  const wordRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % words.length);
    }, 2500); // Change word every 2.5 seconds

    return () => clearInterval(interval);
  }, []);

  // Update the underline width based on the current word
  useEffect(() => {
    if (wordRefs.current[currentIndex]) {
      // Get the width of the current word element
      const width = wordRefs.current[currentIndex]?.getBoundingClientRect().width || 0;
      setWordWidth(width);
      
      // Update container width to fit the word
      if (containerRef.current) {
        containerRef.current.style.minWidth = `${width + 10}px`;
      }
    }
  }, [currentIndex, words]);

  return (
    <span 
      ref={containerRef}
      className="relative inline-block h-[1.3em] align-bottom overflow-visible min-w-[120px] md:min-w-[180px] transition-all duration-300"
    >
      {words.map((word, index) => (
        <motion.span
          key={word}
          ref={el => wordRefs.current[index] = el}
          className="absolute inset-0 flex items-center justify-center font-bold text-slate-800 dark:text-primary-foreground drop-shadow-md"
          initial={{ opacity: 0, y: 40 }}
          animate={{
            opacity: index === currentIndex ? 1 : 0,
            y: index === currentIndex ? 0 : 40
          }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          aria-hidden={index !== currentIndex}
        >
          {word}
        </motion.span>
      ))}
      <span className="sr-only">
        {words.join(", ")}
      </span>
      
      {/* Dynamic underline that adapts to word width */}
      <motion.div 
        className="absolute bottom-0 left-1/2 h-2 bg-primary/40"
        animate={{
          width: wordWidth > 0 ? wordWidth + 10 : "100%",
          x: wordWidth > 0 ? -(wordWidth + 10) / 2 : "-50%"
        }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        style={{
          borderRadius: "100% 100% 0 0",
        }}
      />
    </span>
  );
};

const HeroSection = () => {
  const isMobile = useIsMobile();
  
  return (
    <section className="relative py-20 md:py-32 overflow-hidden">
      {/* Abstract background */}
      <div className="absolute inset-0 bg-gradient-radial from-primary/5 to-transparent">
        <div className="animated-grid"></div>
        
        {/* Animated blobs */}
        <div className="blob from-primary/30 to-accent/30 w-64 h-64 -top-10 -left-10"></div>
        <div className="blob from-accent/20 to-orange-400/20 w-96 h-96 top-1/4 -right-20 delay-700"></div>
        <div className="blob from-purple-400/20 to-primary/20 w-80 h-80 bottom-0 left-1/3 delay-500"></div>
        
        {/* Floating elements - hidden on mobile */}
        {!isMobile && (
          <>
            <div className="absolute top-1/4 left-[15%] w-2 h-2 rounded-full bg-primary animate-pulse"></div>
            <div className="absolute top-1/2 left-[85%] w-3 h-3 rounded-full bg-accent animate-pulse" style={{ animationDelay: '1s' }}></div>
            <div className="absolute bottom-1/4 right-[20%] w-2 h-2 rounded-full bg-orange-400 animate-pulse" style={{ animationDelay: '1.5s' }}></div>
            <div className="absolute top-[70%] right-[40%] w-2 h-2 rounded-full bg-purple-500 animate-pulse" style={{ animationDelay: '0.7s' }}></div>
          </>
        )}
      </div>
      
      {/* Content */}
      <div className="container relative z-10 mx-auto px-4">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-4xl md:text-6xl font-bold mb-6 font-display leading-tight bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
              Accelerate Your <RotatingWords />
            </h1>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <p className="text-lg md:text-xl mb-10 text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              A modern resource and learning platform designed to help you master data skills with structured learning paths, resources and expert guidance
            </p>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="flex flex-wrap justify-center gap-5"
          >
            <Button 
              size="lg" 
              className="bg-primary hover:bg-primary/90 shadow-lg hover:shadow-primary/30 modern-button text-lg" 
              asChild
            >
              <Link to="/register">
                Get Started <ArrowRight className="ml-1 h-5 w-5" />
              </Link>
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="border-primary text-primary hover:bg-primary hover:text-white modern-button text-lg" 
              asChild
            >
              <Link to="/resources">
                <Search className="mr-1 h-5 w-5" />
                Explore Resources
              </Link>
            </Button>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="mt-16 flex flex-wrap justify-center gap-8 text-sm text-gray-500 dark:text-gray-400"
          >
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
          </motion.div>
          
          {/* Scroll indicator - adjusted to not overlap with content on mobile */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 1 }}
            className="absolute bottom-[-10px] left-1/2 transform -translate-x-1/2 flex flex-col items-center text-gray-400 md:bottom-5"
          >
            <span className="text-sm mb-2">Scroll to explore</span>
            <ChevronDown className="w-5 h-5 animate-bounce" />
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
