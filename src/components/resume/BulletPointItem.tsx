
import React, { useState } from 'react';
import { BulletAnalysis } from '@/components/assistants/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Edit2, Check, X } from 'lucide-react';
import { AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import BulletPointChart from './BulletPointChart';
import { HighlightedBulletText } from './text/BulletTextParser';
import { WordBalanceScore, XYZQualityScore, getBadgeColor } from './score/BulletScoreDisplay';
import { Textarea } from '@/components/ui/textarea';

interface BulletPointItemProps {
  bullet: BulletAnalysis;
  index: number;
}

const BulletPointItem: React.FC<BulletPointItemProps> = ({
  bullet,
  index
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(bullet?.rewritten || "");
  const [editedBullet, setEditedBullet] = useState<BulletAnalysis | null>(null);
  
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

  const handleEdit = () => {
    setEditedText(rewritten);
    setIsEditing(true);
  };

// Handle save button click
const handleSave = () => {
  // Create a simulated analysis of the edited text
  // In a real implementation, you would call the actual analysis API
  const improvedBullet = {
    ...bullet,
    rewritten: editedText,
    // Simulate improved scores based on edits
    bullet_total: Math.min(100, bullet_total + 10),
    xyz_scores: {
      action: Math.min(10, (xyz_scores.action || 0) + 2),
      metrics: Math.min(30, (xyz_scores.metrics || 0) + 5),
      clarity: Math.min(15, (xyz_scores.clarity || 0) + 3),
      industry: Math.min(25, (xyz_scores.industry || 0) + 5),
      achievement: Math.min(20, (xyz_scores.achievement || 0) + 3)
    },
    word_balance_score: Math.min(25, word_balance_score + 2),
    word_balance: {
      industry_pct: Math.min(45, word_balance.industry_pct + 2),
      common_pct: Math.max(25, word_balance.common_pct - 2),
      action_pct: Math.min(15, word_balance.action_pct + 2),
      metric_pct: Math.min(15, word_balance.metric_pct + 2)
    }
  };
  
  setEditedBullet(improvedBullet);
  setIsEditing(false);
};
  
  // const handleSave = () => {
  //   // Create a simulated analysis of the edited text
  //   // In a real implementation, you would call the actual analysis API
  //   const improvedBullet = {
  //     ...bullet,
  //     rewritten: editedText,
  //     // Simulate improved scores based on edits
  //     bullet_total: Math.min(45, bullet_total + 5),
  //     xyz_scores: {
  //       hard_soft: Math.min(5, xyz_scores.hard_soft + 0.5),
  //       action_words: Math.min(5, xyz_scores.action_words + 0.5),
  //       measurable_results: Math.min(5, xyz_scores.measurable_results + 0.5),
  //       clarity_focus: Math.min(5, xyz_scores.clarity_focus + 0.5)
  //     },
  //     word_balance_score: Math.min(25, word_balance_score + 2),
  //     word_balance: {
  //       industry_pct: Math.min(45, word_balance.industry_pct + 2),
  //       common_pct: Math.max(25, word_balance.common_pct - 2),
  //       action_pct: Math.min(15, word_balance.action_pct + 2),
  //       metric_pct: Math.min(15, word_balance.metric_pct + 2)
  //     }
  //   };
    
  //   setEditedBullet(improvedBullet);
  //   setIsEditing(false);
  // };

  const handleCancel = () => {
    setIsEditing(false);
    setEditedText(rewritten);
  };

  // Display the edited bullet or the original bullet
  const displayBullet = editedBullet || bullet;

  return (
    <AccordionItem value={`bullet-${index}`} className="border rounded-lg p-1">
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
              <Button 
                variant="ghost" 
                size="sm" 
                className="ml-2 h-6 p-1" 
                onClick={isEditing ? undefined : handleEdit}
                disabled={isEditing}
              >
                <Edit2 className="h-4 w-4" />
              </Button>
            </h4>
            
            {isEditing ? (
              <div className="space-y-2">
                <Textarea 
                  value={editedText} 
                  onChange={(e) => setEditedText(e.target.value)}
                  className="min-h-[100px] text-sm"
                  placeholder="Edit your bullet point here..."
                />
                <div className="flex space-x-2 justify-end">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleCancel}
                    className="flex items-center"
                  >
                    <X className="h-4 w-4 mr-1" /> Cancel
                  </Button>
                  <Button 
                    variant="default" 
                    size="sm" 
                    onClick={handleSave}
                    className="flex items-center"
                  >
                    <Check className="h-4 w-4 mr-1" /> Save
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-sm bg-green-50 p-3 rounded">
                <HighlightedBulletText text={displayBullet.rewritten} />
              </div>
            )}
          </div>
          
          {/* Bullet Point Visualization */}
          <div className="mt-4">
            <h4 className="text-sm font-medium mb-2">Suggested Improved Bullet Analysis Visualization:</h4>
            <BulletPointChart bullet={displayBullet} />
          </div>
          
          {/* Score Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <WordBalanceScore 
              wordBalance={displayBullet.word_balance}
              wordBalanceScore={displayBullet.word_balance_score}
            />
            
            <XYZQualityScore xyzScores={displayBullet.xyz_scores} />
          </div>
          
          {/* Improvement Tips */}
          <div className="mt-4">
            <h4 className="text-sm font-medium">Improvement Tips:</h4>
            <p className="text-sm text-muted-foreground mt-1">{displayBullet.tips || "No improvement tips available"}</p>
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
};

export default BulletPointItem;
