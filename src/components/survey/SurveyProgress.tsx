
import React from 'react';
import { Progress } from '@/components/ui/progress';

interface SurveyProgressProps {
  currentStep: number;
  totalSteps: number;
}

const SurveyProgress: React.FC<SurveyProgressProps> = ({ currentStep, totalSteps }) => {
  const progress = ((currentStep + 1) / totalSteps) * 100;
  const sections = ['Personal Information', 'Work And Education', 'Skills and Interests', 'Demographics', 'Media Release and Agreements'];

  return (
    <div className="mb-6">
      <Progress 
        value={progress} 
        className="h-2 mb-4" 
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        {sections.map((section, index) => (
          <div 
            key={index}
            className={`text-center ${currentStep === index ? 'text-primary font-medium' : ''} ${index === 0 ? 'text-left' : ''} ${index === sections.length - 1 ? 'text-right' : ''}`}
            style={{ width: `${100/sections.length}%` }}
          >
            <div className="hidden sm:block">{section}</div>
            <div className="sm:hidden">{index + 1}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SurveyProgress;
