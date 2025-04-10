
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

// Word Balance Score display component
export const WordBalanceScore: React.FC<{
  wordBalance: {
    industry_pct: number;
    common_pct: number;
    action_pct: number;
    metric_pct: number;
  };
  wordBalanceScore: number;
}> = ({ wordBalance, wordBalanceScore }) => {
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium mb-2">Word Balance ({wordBalanceScore}/25)</h4>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>Industry: <span className={getScoreColor(wordBalance.industry_pct || 0, 45)}>{wordBalance.industry_pct || 0}%</span></div>
        <div>Common: <span className={getScoreColor(wordBalance.common_pct || 0, 25)}>{wordBalance.common_pct || 0}%</span></div>
        <div>Action: <span className={getScoreColor(wordBalance.action_pct || 0, 15)}>{wordBalance.action_pct || 0}%</span></div>
        <div>Metric: <span className={getScoreColor(wordBalance.metric_pct || 0, 15)}>{wordBalance.metric_pct || 0}%</span></div>
      </div>
    </div>
  );
};

// XYZ Quality Score display component
export const XYZQualityScore: React.FC<{
  xyzScores: {
    hard_soft: number;
    action_words: number;
    measurable_results: number;
    clarity_focus: number;
  };
}> = ({ xyzScores }) => {
  const totalXyzScore = (xyzScores.hard_soft || 0) + 
                        (xyzScores.action_words || 0) + 
                        (xyzScores.measurable_results || 0) + 
                        (xyzScores.clarity_focus || 0);
  
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium mb-2">XYZ Quality ({totalXyzScore}/20)</h4>
      <div className="space-y-1 text-sm">
        <ScoreWithIcon score={xyzScores.hard_soft || 0} maxScore={5} label="Hard/Soft Skills" />
        <ScoreWithIcon score={xyzScores.action_words || 0} maxScore={5} label="Action Words" />
        <ScoreWithIcon score={xyzScores.measurable_results || 0} maxScore={5} label="Measurable Results" />
        <ScoreWithIcon score={xyzScores.clarity_focus || 0} maxScore={5} label="Clarity & Focus" />
      </div>
    </div>
  );
};
