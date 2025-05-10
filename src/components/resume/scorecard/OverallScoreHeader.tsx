
import React from 'react';
import { CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface OverallScoreHeaderProps {
  letterGrade: string;
  resumePercent: number;
}

const getLetterGradeColor = (grade: string) => {
  switch (grade) {
    case 'A':
      return "text-green-600";
    case 'B':
      return "text-emerald-600";
    case 'C':
      return "text-yellow-600";
    case 'D':
      return "text-orange-600";
    default:
      return "text-red-600";
  }
};

export const OverallScoreHeader: React.FC<OverallScoreHeaderProps> = ({ letterGrade, resumePercent }) => {
  return (
    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
      <div>
        <CardTitle>Resume Grade</CardTitle>
        <CardDescription>
          Overall assessment based on industry standards
        </CardDescription>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-center">
          <Progress value={resumePercent} className="h-2 w-16" />
          <span className="text-xs text-muted-foreground">{resumePercent}%</span>
        </div>
        <div className={`text-4xl font-bold ${getLetterGradeColor(letterGrade)} bg-muted/20 h-16 w-16 rounded-full flex items-center justify-center`}>
          {letterGrade}
        </div>
      </div>
    </div>
  );
};
