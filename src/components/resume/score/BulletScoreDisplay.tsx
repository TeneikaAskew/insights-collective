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

// NOTE: WordBalanceScore and XYZQualityScore components are removed as their logic
// is now directly incorporated into BulletPointsAnalysisCard.tsx
// This file may be removed or repurposed if these helper functions are moved or no longer needed.
