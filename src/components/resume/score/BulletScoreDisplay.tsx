
import React from 'react';
import { CheckCircle, AlertTriangle } from 'lucide-react';
import { ScoreWithIcon } from '../chart/ChartComponents';

// Helper function to get score color based on percentage
export const getScoreColor = (score: number, max: number) => {
  const percentage = score / max * 100;
  if (percentage >= 80) return "text-green-600";
  if (percentage >= 60) return "text-yellow-600";
  return "text-red-600";
};

// Helper function to get badge color based on percentage
export const getBadgeColor = (score: number, max: number) => {
  const percentage = score / max * 100;
  if (percentage >= 80) return "bg-green-100 text-green-800 border-green-200";
  if (percentage >= 60) return "bg-yellow-100 text-yellow-800 border-yellow-200";
  return "bg-red-100 text-red-800 border-red-200";
};

// XYZ Quality Score component implementation
export const XYZQualityScore: React.FC<{
  xyzScores: { action: number; metrics: number; clarity: number; industry: number; achievement: number };
}> = ({ xyzScores }) => {
  const totalScore = 
    (xyzScores?.action || 0) +
    (xyzScores?.metrics || 0) +
    (xyzScores?.clarity || 0) +
    (xyzScores?.industry || 0) +
    (xyzScores?.achievement || 0);

  return (
    <div className="bg-gradient-to-br from-purple-50 to-indigo-50 p-4 rounded-lg border border-purple-100 shadow-md hover:shadow-lg transition-all duration-300">
      <h5 className="font-medium text-sm mb-3 text-indigo-700 flex items-center">
        <span className="inline-block w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center mr-2 text-xs font-bold">
          XYZ
        </span>
        Quality Score ({totalScore}/100)
      </h5>
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium">Action Words</span>
          <ScoreWithIcon score={xyzScores?.action || 0} maxScore={10} />
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium">Metrics/Results</span>
          <ScoreWithIcon score={xyzScores?.metrics || 0} maxScore={30} />
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium">Clarity/Conciseness</span>
          <ScoreWithIcon score={xyzScores?.clarity || 0} maxScore={15} />
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium">Industry Keywords</span>
          <ScoreWithIcon score={xyzScores?.industry || 0} maxScore={25} />
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium">Achievement Focus</span>
          <ScoreWithIcon score={xyzScores?.achievement || 0} maxScore={20} />
        </div>
      </div>
    </div>
  );
};
