
import React, { useState } from 'react';
import { Brain, BarChart3, Database, Presentation } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Quiz from './Quiz';

const QuizSection: React.FC = () => {
  const [showQuiz, setShowQuiz] = useState(false);

  return (
    <section className="py-16 bg-gradient-to-br from-blue-50 to-indigo-50">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-3xl mx-auto mb-10">
          <h2 className="text-3xl font-bold mb-4">Find Your Data Career Path</h2>
          <p className="text-lg mb-6">
            Take our interactive quiz to discover which data career path best matches your 
            interests, skills, and working style.
          </p>
          
          {!showQuiz && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <div className="p-4 rounded-lg bg-white shadow-sm flex flex-col items-center">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-3">
                    <Brain className="h-6 w-6 text-blue-600" />
                  </div>
                  <h3 className="font-medium text-sm md:text-base">AI/ML</h3>
                </div>
                
                <div className="p-4 rounded-lg bg-white shadow-sm flex flex-col items-center">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-3">
                    <BarChart3 className="h-6 w-6 text-green-600" />
                  </div>
                  <h3 className="font-medium text-sm md:text-base">Analytics</h3>
                </div>
                
                <div className="p-4 rounded-lg bg-white shadow-sm flex flex-col items-center">
                  <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mb-3">
                    <Database className="h-6 w-6 text-purple-600" />
                  </div>
                  <h3 className="font-medium text-sm md:text-base">Data Engineering</h3>
                </div>
                
                <div className="p-4 rounded-lg bg-white shadow-sm flex flex-col items-center">
                  <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mb-3">
                    <Presentation className="h-6 w-6 text-amber-600" />
                  </div>
                  <h3 className="font-medium text-sm md:text-base">Business Intelligence</h3>
                </div>
              </div>
              
              <Button onClick={() => setShowQuiz(true)} size="lg">
                Take the Career Quiz
              </Button>
            </>
          )}
        </div>
        
        {showQuiz && (
          <div className="bg-white p-6 rounded-xl shadow-md">
            <Quiz />
          </div>
        )}
      </div>
    </section>
  );
};

export default QuizSection;
