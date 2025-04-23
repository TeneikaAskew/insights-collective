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

  const {
    original = "",
    word_balance = { industry_pct: 0, common_pct: 0, action_pct: 0, metric_pct: 0 },
    word_balance_score = 0,
    xyz_scores,
    bullet_total = 0,
    rewritten = "",
    tips = ""
  } = bullet || {};

  const normalizedXyzScores = {
    action: (xyz_scores as any)?.action ?? (xyz_scores as any)?.action_words ?? 0,
    metrics: (xyz_scores as any)?.metrics ?? (xyz_scores as any)?.measurable_results ?? 0,
    clarity: (xyz_scores as any)?.clarity ?? (xyz_scores as any)?.clarity_focus ?? 0,
    industry: (xyz_scores as any)?.industry ?? (xyz_scores as any)?.hard_soft ?? 0,
    achievement: (xyz_scores as any)?.achievement ?? 0,
  };

  const handleEdit = () => {
    setEditedText(rewritten);
    setIsEditing(true);
  };

  const handleSave = () => {
    const improvedBullet: BulletAnalysis = {
      ...bullet,
      rewritten: editedText,
      bullet_total: Math.min(45, bullet_total + 10),
      xyz_scores: {
        action: Math.min(10, normalizedXyzScores.action + 2),
        metrics: Math.min(30, normalizedXyzScores.metrics + 5),
        clarity: Math.min(15, normalizedXyzScores.clarity + 3),
        industry: Math.min(25, normalizedXyzScores.industry + 5),
        achievement: Math.min(20, normalizedXyzScores.achievement + 3),
      },
      word_balance_score: Math.min(25, word_balance_score + 2),
      word_balance: {
        industry_pct: Math.min(45, word_balance.industry_pct + 2),
        common_pct: Math.max(25, word_balance.common_pct - 2),
        action_pct: Math.min(15, word_balance.action_pct + 2),
        metric_pct: Math.min(15, word_balance.metric_pct + 2)
      },
      original,
      tips
    };
    setEditedBullet(improvedBullet);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditedText(rewritten);
  };

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
                  <Button variant="outline" size="sm" onClick={handleCancel} className="flex items-center">
                    <X className="h-4 w-4 mr-1" /> Cancel
                  </Button>
                  <Button variant="default" size="sm" onClick={handleSave} className="flex items-center">
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

          <div className="mt-4">
            <h4 className="text-sm font-medium mb-2">Suggested Improved Bullet Analysis Visualization:</h4>
            <BulletPointChart bullet={displayBullet} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <WordBalanceScore wordBalance={displayBullet.word_balance} wordBalanceScore={displayBullet.word_balance_score} />

            <XYZQualityScore xyzScores={normalizedXyzScores} />
          </div>

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
