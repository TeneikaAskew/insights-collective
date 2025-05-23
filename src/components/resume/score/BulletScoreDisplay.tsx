
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
        <ScoreWithItem score={xyzScores?.action || 0} maxScore={10} label="Action Words" />
        <ScoreWithItem score={xyzScores?.metrics || 0} maxScore={30} label="Metrics/Results" />
        <ScoreWithItem score={xyzScores?.clarity || 0} maxScore={15} label="Clarity/Conciseness" />
        <ScoreWithItem score={xyzScores?.industry || 0} maxScore={25} label="Industry Keywords" />
        <ScoreWithItem score={xyzScores?.achievement || 0} maxScore={20} label="Achievement Focus" />
      </div>
    </div>
  );
};

// Creating a compatible ScoreWithItem component that accepts label prop
const ScoreWithItem: React.FC<{
  score: number;
  maxScore: number;
  label: string;
}> = ({
  score,
  maxScore,
  label
}) => {
  const isPassing = score >= maxScore * 0.6; // 60% threshold

  return <div className="flex items-center">
      {isPassing ? <CheckCircle className="h-4 w-4 text-green-500 mr-2" /> : <AlertTriangle className="h-4 w-4 text-red-500 mr-2" />}
      <span>{label}: {score}/{maxScore}</span>
    </div>;
};
