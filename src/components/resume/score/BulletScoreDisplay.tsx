
import React from 'react';
import { CheckCircle, AlertTriangle } from 'lucide-react';
import { ScoreWithIcon } from '../chart/ChartComponents';

// Helper function to get score color based on percentage
export const getScoreColor = (score: number, max: number) => {
  const percentage = score / max * 100;
  if (percentage >= 80) return "text-ss-good";
  if (percentage >= 60) return "text-ss-warn";
  return "text-ss-bad";
};

// Helper function to get badge color based on percentage
export const getBadgeColor = (score: number, max: number) => {
  const percentage = score / max * 100;
  if (percentage >= 80) return "bg-ss-good-chip text-ss-good border-ss-good/30";
  if (percentage >= 60) return "bg-ss-warn-chip text-ss-warn border-ss-warn/30";
  return "bg-ss-bad-chip text-ss-bad border-ss-bad/30";
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
    <div className="bg-ss-lav-chip p-4 rounded-2xl border border-ss-lav/30 shadow-sm hover:shadow-md transition-all duration-300">
      <h5 className="font-medium text-sm mb-3 text-ss-lav-deep flex items-center">
        <span className="inline-block w-6 h-6 rounded-full bg-card text-ss-lav-deep flex items-center justify-center mr-2 text-xs font-bold">
          XYZ
        </span>
        Quality Score ({totalScore}/100)
      </h5>
      <div className="space-y-3">
        <ScoreWithIcon score={xyzScores?.action || 0} maxScore={10} label="Action Words" />
        <ScoreWithIcon score={xyzScores?.metrics || 0} maxScore={30} label="Metrics/Results" />
        <ScoreWithIcon score={xyzScores?.clarity || 0} maxScore={15} label="Clarity/Conciseness" />
        <ScoreWithIcon score={xyzScores?.industry || 0} maxScore={25} label="Industry Keywords" />
        <ScoreWithIcon score={xyzScores?.achievement || 0} maxScore={20} label="Achievement Focus" />
      </div>
    </div>
  );
};
