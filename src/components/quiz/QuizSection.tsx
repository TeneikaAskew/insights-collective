
import React, { useState } from 'react';
import { Brain, BarChart3, Database, Presentation, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { Reveal, stagger } from '@/components/home/motion/Reveal';
import Quiz from './Quiz';

// The four tracks the quiz scores against. Kept in the same order as
// `trackPersonas`, so the preview cards and the result screen agree.
const careerPaths = [
  { title: 'AI/ML', icon: Brain, description: 'Build intelligent systems and ML models' },
  { title: 'Analytics', icon: BarChart3, description: 'Extract insights from business data' },
  { title: 'Data Engineering', icon: Database, description: 'Design and optimize data pipelines' },
  { title: 'Business Intelligence', icon: Presentation, description: 'Create dashboards and visualizations' },
];

const QuizSection: React.FC = () => {
  const [showQuiz, setShowQuiz] = useState(false);

  return (
    <section
      id="career-quiz"
      className="py-20 relative overflow-hidden border-y border-studio-border bg-studio-cardWarm"
    >
      {/* Decorative washes, matching the hero. */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div
          className="studio-wash"
          style={{ width: 360, height: 360, top: -170, left: -110, background: 'var(--studio-wash-lav)' }}
        />
        <div
          className="studio-wash"
          style={{ width: 340, height: 340, bottom: -180, right: -100, background: 'var(--studio-wash-peach)' }}
        />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <Reveal>
            <h2 className="text-3xl md:text-4xl font-bold text-studio-ink">
              Find Your Data Career Path
            </h2>
            <p className="text-lg mt-4 text-studio-muted">
              Take our interactive quiz to discover which data career path best matches your
              interests, skills, and working style.
            </p>
          </Reveal>

          {!showQuiz && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mt-10">
                {careerPaths.map((path, index) => (
                  <Reveal key={path.title} delay={stagger(index)}>
                    <div className="studio-card h-full p-5 md:p-6 flex flex-col items-center text-center hover:-translate-y-0.5 transition-transform duration-300">
                      <div className="w-12 h-12 rounded-xl bg-studio-lavChip flex items-center justify-center mb-4">
                        <path.icon className="h-6 w-6 text-studio-lavDeep" />
                      </div>
                      <h3 className="font-semibold text-studio-ink">{path.title}</h3>
                      <p className="text-sm text-studio-muted mt-1.5 hidden md:block">
                        {path.description}
                      </p>
                    </div>
                  </Reveal>
                ))}
              </div>

              <Reveal delay={0.3}>
                <Button
                  onClick={() => setShowQuiz(true)}
                  size="lg"
                  className="mt-10 rounded-full bg-studio-lavDeep hover:bg-studio-lavDeeper text-white px-8 py-6 h-auto text-base group"
                >
                  Take the Career Quiz
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform duration-300" />
                </Button>
              </Reveal>
            </>
          )}
        </div>

        {showQuiz && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="studio-card p-6 md:p-8 max-w-4xl mx-auto"
          >
            <Quiz />
          </motion.div>
        )}
      </div>
    </section>
  );
};

export default QuizSection;
