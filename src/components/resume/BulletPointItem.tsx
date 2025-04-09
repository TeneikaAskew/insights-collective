
import React, { useState } from 'react';
import { BulletAnalysis } from '@/components/assistants/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, AlertTriangle, Edit2 } from 'lucide-react';
import { AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import BulletPointChart from './BulletPointChart';

interface BulletPointItemProps {
  bullet: BulletAnalysis;
  index: number;
}

const BulletPointItem: React.FC<BulletPointItemProps> = ({
  bullet,
  index
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const {
    original,
    word_balance,
    word_balance_score,
    xyz_scores,
    bullet_total,
    rewritten,
    tips
  } = bullet;
  
  const getScoreColor = (score: number, max: number) => {
    const percentage = score / max * 100;
    if (percentage >= 80) return "text-green-600";
    if (percentage >= 60) return "text-yellow-600";
    return "text-red-600";
  };
  
  const getBadgeColor = (score: number, max: number) => {
    const percentage = score / max * 100;
    if (percentage >= 80) return "bg-green-100 text-green-800 border-green-200";
    if (percentage >= 60) return "bg-yellow-100 text-yellow-800 border-yellow-200";
    return "bg-red-100 text-red-800 border-red-200";
  };
  
  return (
    <AccordionItem value={`bullet-${index}`} className="border rounded-lg p-1">
      <AccordionTrigger className="px-4 py-2 hover:no-underline">
        <div className="flex items-center justify-between w-full pr-4">
          <div className="text-left font-medium truncate max-w-[80%]">
            {original.substring(0, 60)}{original.length > 60 ? '...' : ''}
          </div>
          <Badge className={getBadgeColor(bullet_total, 45)}>
            Score: {bullet_total}/45
          </Badge>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-4 pt-2">
        <div className="space-y-4">
          {/* Original vs Rewritten */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Original:</h4>
            <p className="text-sm bg-slate-50 p-2 rounded">{original}</p>
            
            <h4 className="text-sm font-medium flex items-center">
              <span>Suggested Improvement:</span>
              <Button variant="ghost" size="sm" className="ml-2 h-6 p-1" onClick={() => setIsEditing(!isEditing)}>
                <Edit2 className="h-4 w-4" />
              </Button>
            </h4>
            <p className="text-sm bg-green-50 p-2 rounded">{rewritten}</p>
          </div>
          
          {/* Bullet Point Visualization */}
          <div className="mt-4">
            <h4 className="text-sm font-medium mb-2">Bullet Analysis Visualization:</h4>
            <BulletPointChart bullet={bullet} />
          </div>
          
          {/* Score Breakdown */}
          <div>
            <h4 className="text-sm font-medium mb-2">Score Breakdown:</h4>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <p className="text-xs font-medium">Word Balance ({word_balance_score}/25)</p>
                <div className="grid grid-cols-2 gap-1 text-xs">
                  <div>Industry: <span className={getScoreColor(word_balance.industry_pct, 45)}>{word_balance.industry_pct}%</span></div>
                  <div>Common: <span className={getScoreColor(word_balance.common_pct, 25)}>{word_balance.common_pct}%</span></div>
                  <div>Action: <span className={getScoreColor(word_balance.action_pct, 15)}>{word_balance.action_pct}%</span></div>
                  <div>Metric: <span className={getScoreColor(word_balance.metric_pct, 15)}>{word_balance.metric_pct}%</span></div>
                </div>
              </div>
              
              <div className="space-y-1">
                <p className="text-xs font-medium">XYZ Quality ({xyz_scores.hard_soft + xyz_scores.action_words + xyz_scores.measurable_results + xyz_scores.clarity_focus}/20)</p>
                <div className="grid grid-cols-1 gap-1 text-xs">
                  <div className="flex items-center">
                    {xyz_scores.hard_soft >= 3 ? <CheckCircle className="h-3 w-3 text-green-500 mr-1" /> : <AlertTriangle className="h-3 w-3 text-red-500 mr-1" />}
                    <span>Hard/Soft Skills: {xyz_scores.hard_soft}/5</span>
                  </div>
                  <div className="flex items-center">
                    {xyz_scores.action_words >= 3 ? <CheckCircle className="h-3 w-3 text-green-500 mr-1" /> : <AlertTriangle className="h-3 w-3 text-red-500 mr-1" />}
                    <span>Action Words: {xyz_scores.action_words}/5</span>
                  </div>
                  <div className="flex items-center">
                    {xyz_scores.measurable_results >= 3 ? <CheckCircle className="h-3 w-3 text-green-500 mr-1" /> : <AlertTriangle className="h-3 w-3 text-red-500 mr-1" />}
                    <span>Measurable Results: {xyz_scores.measurable_results}/5</span>
                  </div>
                  <div className="flex items-center">
                    {xyz_scores.clarity_focus >= 3 ? <CheckCircle className="h-3 w-3 text-green-500 mr-1" /> : <AlertTriangle className="h-3 w-3 text-red-500 mr-1" />}
                    <span>Clarity & Focus: {xyz_scores.clarity_focus}/5</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Improvement Tips */}
          <div className="mt-2">
            <h4 className="text-sm font-medium">Improvement Tips:</h4>
            <p className="text-xs text-muted-foreground">{tips}</p>
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
};

export default BulletPointItem;
