
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { useParallax } from './motion/useParallax';
import { useIsMobile } from '@/hooks/use-mobile';
//import { motion } from 'framer-motion';
//import { useState, useEffect, useRef } from 'react';

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const RotatingWords = () => {
  const words = ["Future", "Career", "Insights", "Impact", "Skills", "Edge", "Superpowers"];
  const [currentIndex, setCurrentIndex] = useState(0);
  
  useEffect(() => {
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
          className="inline-block font-bold text-studio-lavDeep"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -30 }}
          transition={{ duration: 0.4 }}
        >
          {words[currentIndex]}
          <motion.span 
            layoutId="underline" 
            className="absolute left-0 -bottom-1 h-1 w-full bg-studio-peach rounded-t-full"
          />
        </motion.span>
      </AnimatePresence>
    </span>
  );
};

const HeroSection = () => {
  const isMobile = useIsMobile();
  const { ref, y } = useParallax(90);

  const scrollToQuiz = () => {
    document.getElementById('career-quiz')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <section
      ref={ref}
      className="relative py-20 md:py-28 overflow-hidden"
    >
      {/* Soft Studio washes — decorative, drift against the scroll. */}
      <motion.div className="absolute inset-0 pointer-events-none" style={{ y }} aria-hidden="true">
        <div
          className="studio-wash"
          style={{
            width: 460,
            height: 460,
            top: -210,
            left: -140,
            background: 'var(--studio-wash-lav)',
          }}
        />
        <div
          className="studio-wash"
          style={{
            width: 400,
            height: 400,
            top: -180,
            right: -130,
            background: 'var(--studio-wash-peach)',
          }}
        />
      </motion.div>

      <div className="container relative z-10 mx-auto px-4">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-block text-[11px] font-bold uppercase tracking-[0.14em] text-studio-peachDeep bg-studio-warnChip rounded-full px-3.5 py-1.5">
              Free career quiz · 10 questions
            </span>
            {/* The rotating word is the site's signature — kept, in Soft Studio colours. */}
            <h1 className="mt-5 text-4xl md:text-6xl font-bold leading-[1.07] text-studio-ink">
              Accelerate Your <RotatingWords />
            </h1>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
          >
            <p className="mt-5 text-lg md:text-xl text-studio-muted max-w-2xl mx-auto">
              A modern resource and learning platform designed to help you master data skills with
              structured learning paths, resources and expert guidance
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-8 flex flex-wrap justify-center gap-4"
          >
            <Button
              size="lg"
              onClick={scrollToQuiz}
              className="rounded-full bg-studio-lavDeep hover:bg-studio-lavDeeper text-white text-base shadow-sm"
            >
              Find your path <ArrowRight className="ml-1 h-5 w-5" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="rounded-full border-studio-border text-studio-ink hover:bg-studio-card text-base"
              asChild
            >
              <Link to="/register">Get Started</Link>
            </Button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.45 }}
            className="mt-10 flex flex-wrap justify-center gap-x-8 gap-y-3 text-sm text-studio-muted"
          >
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-studio-teal" />
              Professional Courses
            </span>
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-studio-lav" />
              Expert Instructors
            </span>
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-studio-peach" />
              Industry-Recognized Certifications
            </span>
          </motion.div>

          {!isMobile && (
            <motion.button
              type="button"
              onClick={scrollToQuiz}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.9 }}
              className="mt-12 flex flex-col items-center gap-1 text-studio-muted hover:text-studio-ink transition-colors mx-auto"
            >
              <span className="text-sm">Scroll to explore</span>
              <ChevronDown className="w-5 h-5 animate-bounce" />
            </motion.button>
          )}
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
