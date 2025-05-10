
import React from 'react';

interface ExpertAnalysisDisplayProps {
  explanation: string;
}

export const ExpertAnalysisDisplay: React.FC<ExpertAnalysisDisplayProps> = ({ explanation }) => {
  return (
    <div>
      <h3 className="font-medium mb-2">Expert Analysis:</h3>
      <p className="text-sm">{explanation || "No expert analysis available."}</p>
    </div>
  );
};
