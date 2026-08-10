
import React, { useState, useEffect } from 'react';
import { Brain, BarChart3, Database, Presentation, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, useAnimation } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import Quiz from './Quiz';

const QuizSection: React.FC = () => {
  const [showQuiz, setShowQuiz] = useState(false);
  const controls = useAnimation();
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.2 });

  useEffect(() => {
    if (inView) {
      controls.start('visible');
    }
  }, [controls, inView]);

  // Variants for card animations
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2
      }
    }
  };

  const cardVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { 
        type: "spring" as const, 
        stiffness: 100,
        damping: 10
      }
    }
  };

  // Career path data with enhanced details
  const careerPaths = [
    {
      title: "AI/ML",
      icon: Brain,
      color: "blue",
      description: "Build intelligent systems and ML models"
    },
    {
      title: "Analytics",
      icon: BarChart3,
      color: "green",
      description: "Extract insights from business data"
    },
    {
      title: "Data Engineering",
      icon: Database,
      color: "purple",
      description: "Design and optimize data pipelines"
    },
    {
      title: "Business Intelligence",
      icon: Presentation,
      color: "amber",
      description: "Create dashboards and visualizations"
    }
  ];
  
  // Color mapping
  const colorMap = {
    blue: {
      bg: "bg-ss-teal-chip",
      text: "text-ss-teal",
      border: "border-border",
      shadow: ""
    },
    green: {
      bg: "bg-ss-good-chip",
      text: "text-ss-good",
      border: "border-border", 
      shadow: ""
    },
    purple: {
      bg: "bg-accent",
      text: "text-primary",
      border: "border-border",
      shadow: ""
    },
    amber: {
      bg: "bg-ss-warn-chip",
      text: "text-ss-peach-deep",
      border: "border-border",
      shadow: ""
    }
  };

  return (
    <section className="py-20 relative overflow-hidden bg-gradient-to-b from-background to-muted " data-tour="quiz">
      {/* Background pattern */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMCwwLDAsMC4wNSkiLz48L3N2Zz4=')] bg-[length:20px_20px] opacity-50"></div>
      
      {/* Decorative elements */}
      <div className="absolute top-0 left-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-accent/5 rounded-full blur-3xl translate-x-1/3 translate-y-1/3"></div>
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 font-display">Find Your Data Career Path</h2>
          <p className="text-lg mb-8 text-muted-foreground ">
            Take our interactive quiz to discover which data career path best matches your 
            interests, skills, and working style.
          </p>
          
          {!showQuiz && (
            <motion.div
              ref={ref}
              variants={containerVariants}
              initial="hidden"
              animate={controls}
            >
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-10">
                {careerPaths.map((path, index) => (
                  <motion.div 
                    key={path.title}
                    variants={cardVariants}
                    className={`relative p-5 md:p-6 rounded-xl bg-card/80 backdrop-blur-sm flex flex-col items-center border ${colorMap[path.color].border} ${colorMap[path.color].shadow} shadow-lg hover:shadow-xl transition-all duration-300 group`}
                  >
                    <div className={`w-14 h-14 md:w-16 md:h-16 ${colorMap[path.color].bg} rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                      <path.icon className={`h-7 w-7 ${colorMap[path.color].text}`} />
                    </div>
                    <h3 className="font-semibold text-lg mb-1">{path.title}</h3>
                    <p className="text-sm text-muted-foreground text-center hidden md:block">
                      {path.description}
                    </p>
                    
                    {/* Decorative circle */}
                    <div className="absolute -z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 w-full h-full rounded-full bg-gradient-to-br from-transparent to-primary/5 blur-xl top-0 left-0"></div>
                  </motion.div>
                ))}
              </div>
              
              <Button 
                onClick={() => setShowQuiz(true)} 
                size="lg"
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium px-8 py-6 h-auto text-lg rounded-full shadow-lg hover:shadow-primary/20 transform transition-all duration-300 hover:-translate-y-1 group"
              >
                <span className="relative z-10 flex items-center">
                  Take the Career Quiz 
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform duration-300" />
                </span>
                <span className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-primary via-accent to-primary bg-[length:200%_100%] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 animate-gradient-x"></span>
              </Button>
            </motion.div>
          )}
        </div>
        
        {showQuiz && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="bg-card p-4 sm:p-6 md:p-8 rounded-xl shadow-xl border "
          >
            <Quiz />
          </motion.div>
        )}
      </div>
    </section>
  );
};

export default QuizSection;
