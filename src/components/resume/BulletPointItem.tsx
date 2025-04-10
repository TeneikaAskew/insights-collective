
import React, { useState, useMemo } from 'react';
import { BulletAnalysis } from '@/components/assistants/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Edit2 } from 'lucide-react';
import { AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import BulletPointChart from './BulletPointChart';
import { HighlightedBulletText } from './text/BulletTextParser';
import { WordBalanceScore, XYZQualityScore, getBadgeColor } from './score/BulletScoreDisplay';

interface BulletPointItemProps {
  bullet: BulletAnalysis;
  index: number;
}

const BulletPointItem: React.FC<BulletPointItemProps> = ({
  bullet,
  index
}) => {
  const [isEditing, setIsEditing] = useState(false);
  
  // Create a stable, unique identifier for this bullet
  const bulletId = useMemo(() => {
    // Create a more unique identifier using bullet text and score
    const textPart = bullet?.original?.slice(0, 30).replace(/\W+/g, '-') || '';
    const scorePart = bullet?.bullet_total || 0;
    return `bullet-${index}-${scorePart}-${textPart}`;
  }, [bullet, index]);
  
  // Add default values to prevent undefined errors
  const {
    original = "",
    word_balance = { industry_pct: 0, common_pct: 0, action_pct: 0, metric_pct: 0 },
    word_balance_score = 0,
    xyz_scores = { hard_soft: 0, action_words: 0, measurable_results: 0, clarity_focus: 0 },
    bullet_total = 0,
    rewritten = "",
    tips = ""
  } = bullet || {};

  return (
    <AccordionItem value={bulletId} className="border rounded-lg p-1">
      <AccordionTrigger className="px-4 py-3 hover:no-underline">
        <div className="flex flex-1 items-center justify-between">
          <div className="flex-1 text-left mr-4 line-clamp-1">
            {original ? original.substring(0, 80) + '...' : `Bullet point ${index + 1}`}
          </div>
          <Badge className={getBadgeColor(bullet_total, 45)}>
            Score: {bullet_total}/45
          </Badge>
        </div>
      </AccordionTrigger>
      
      <AccordionContent className="px-4 pb-4 pt-2">
        <div className="space-y-6">
          {/* Original vs Rewritten */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Original:</h4>
            <div className="text-sm bg-slate-50 p-3 rounded">
              <HighlightedBulletText text={original} />
            </div>
            
            <h4 className="text-sm font-medium flex items-center">
              <span>Suggested Improvement:</span>
              <Button variant="ghost" size="sm" className="ml-2 h-6 p-1" onClick={() => setIsEditing(!isEditing)}>
                <Edit2 className="h-4 w-4" />
              </Button>
            </h4>
            <div className="text-sm bg-green-50 p-3 rounded">
              <HighlightedBulletText text={rewritten} />
            </div>
          </div>
          
          {/* Bullet Point Visualization */}
          <div className="mt-4">
            <h4 className="text-sm font-medium mb-2">Suggested Improved Bullet Analysis Visualization:</h4>
            <BulletPointChart bullet={bullet} />
          </div>
          
          {/* Score Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <WordBalanceScore 
              wordBalance={word_balance}
              wordBalanceScore={word_balance_score}
            />
            
            <XYZQualityScore xyzScores={xyz_scores} />
          </div>
          
          {/* Improvement Tips */}
          <div className="mt-4">
            <h4 className="text-sm font-medium">Improvement Tips:</h4>
            <p className="text-sm text-muted-foreground mt-1">{tips || "No improvement tips available"}</p>
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
};

export default BulletPointItem;
