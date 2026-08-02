
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Search, ArrowRight, ChevronDown } from 'lucide-react';
//import { motion } from 'framer-motion';
//import { useState, useEffect, useRef } from 'react';

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const RotatingWords = () => {
  const words = ["Future", "Career", "Insights", "Impact", "Skills", "Edge", "Superpowers"];
  const [currentIndex, setCurrentIndex] = useState(0);
  
  useEffect(() => {
    // A headline word that swaps itself every 2.5s is exactly the kind of
    // unrequested motion "prefers-reduced-motion: reduce" exists to stop, so
    // settle on the first word instead of cycling. It also makes the landing
    // page deterministic for the visual-regression snapshots, which set the
    // same preference.
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    const interval = setInterval(() => {
      setCurrentIndex(prevIndex => (prevIndex + 1) % words.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);
  
  return (
    <span className="relative inline-flex align-baseline min-w-[120px]">
      <AnimatePresence mode="wait">
        <motion.span 
          key={words[currentIndex]} 
          layout 
          className="inline-block font-bold text-ss-lav-deep"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -30 }}
          transition={{ duration: 0.4 }}
        >
          {words[currentIndex]}
          <motion.span 
            layoutId="underline" 
            className="absolute left-0 -bottom-1 h-1 w-full bg-primary/40 rounded-t-full" 
          />
        </motion.span>
      </AnimatePresence>
    </span>
  );
};

const HeroSection = () => {
  return (
    <section className="relative py-20 md:py-32 overflow-hidden ss-wash" data-tour="hero">
      {/* Content */}
      <div className="container relative z-10 mx-auto px-4">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-4xl md:text-6xl font-bold mb-6 font-display leading-tight text-foreground">
              Accelerate Your <RotatingWords />
            </h1>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <p className="text-lg md:text-xl mb-10 text-muted-foreground max-w-3xl mx-auto">
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
              className="rounded-full shadow-lg text-lg"
              asChild
            >
              <Link to="/register">
                Get Started <ArrowRight className="ml-1 h-5 w-5" />
              </Link>
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="rounded-full border-primary text-primary hover:bg-primary hover:text-primary-foreground text-lg"
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
            className="mt-16 mb-10 flex flex-wrap justify-center gap-8 text-sm text-muted-foreground"
          >
            <div className="flex items-center">
              <div className="w-3 h-3 bg-ss-good rounded-full mr-2"></div>
              <span>Professional Courses</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-ss-teal rounded-full mr-2"></div>
              <span>Expert Instructors</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-ss-lav rounded-full mr-2"></div>
              <span>Industry-Recognized Certifications</span>
            </div>
          </motion.div>
          
          {/* Scroll indicator - fixed positioning and responsive adjustments */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 1 }}
            className="relative mt-4 flex flex-col items-center text-muted-foreground md:absolute md:bottom-[-130px] md:left-1/2 md:transform md:-translate-x-1/2 px-0"
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
