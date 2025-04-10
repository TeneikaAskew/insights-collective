
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

  // Parse the bullet text to identify different component types (same function as in BulletPointChart)
  const parseTextComponents = (text: string) => {
    if (!text) return [];
    
    const components = [];
    
    // Simple rule-based parsing to identify key components
    // Action words (usually at start)
    const actionWords = ['Spearheaded', 'Implemented', 'Developed', 'Led', 'Managed', 'Coordinated', 'Created', 'Built'];
    const measurableResults = /\d+%|\$\d+|\d+x|\d+ percent/g;
    
    let remainingText = text;
    
    // Find action words
    for (const word of actionWords) {
      if (text.startsWith(word)) {
        components.push({
          text: word,
          type: 'action'
        });
        remainingText = text.substring(word.length);
        break;
      }
    }
    
    // Split the remaining text by measurable results
    const matches = [...remainingText.matchAll(measurableResults)];
    if (matches.length > 0) {
      let lastIndex = 0;
      
      for (const match of matches) {
        const index = match.index!;
        
        // Add the text before the measurable result
        if (index > lastIndex) {
          // Check for skill words in this segment
          const segment = remainingText.substring(lastIndex, index);
          const skillTerms = ['new hire onboarding', 'training', 'technical', 'leadership', 'management'];
          
          let foundSkill = false;
          for (const skill of skillTerms) {
            if (segment.includes(skill)) {
              const skillIndex = segment.indexOf(skill);
              
              // Text before skill
              if (skillIndex > 0) {
                components.push({
                  text: segment.substring(0, skillIndex),
                  type: 'normal'
                });
              }
              
              // Skill text
              components.push({
                text: skill,
                type: 'skill'
              });
              
              // Text after skill
              if (skillIndex + skill.length < segment.length) {
                components.push({
                  text: segment.substring(skillIndex + skill.length),
                  type: 'normal'
                });
              }
              
              foundSkill = true;
              break;
            }
          }
          
          // If no skill found, add as normal text
          if (!foundSkill) {
            components.push({
              text: segment,
              type: 'normal'
            });
          }
        }
        
        // Add the measurable result
        components.push({
          text: match[0],
          type: 'measurable'
        });
        
        lastIndex = index! + match[0].length;
      }
      
      // Add any remaining text
      if (lastIndex < remainingText.length) {
        components.push({
          text: remainingText.substring(lastIndex),
          type: 'normal'
        });
      }
    } else {
      // No measurable results found
      components.push({
        text: remainingText,
        type: 'normal'
      });
    }
    
    return components;
  };

  const originalComponents = parseTextComponents(original || '');
  const rewrittenComponents = parseTextComponents(rewritten || '');

  return (
    <AccordionItem value={`bullet-${index}`} className="border rounded-lg p-1">
      <AccordionTrigger className="px-4 py-3 hover:no-underline">
        <div className="flex flex-1 items-center justify-between">
          <div className="flex-1 text-left mr-4 line-clamp-1">
            {original?.substring(0, 80)}...
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
              {originalComponents.map((part, idx) => (
                <span key={idx} className={
                  part.type === 'action' ? 'text-primary font-semibold' : 
                  part.type === 'skill' ? 'text-destructive font-semibold' : 
                  part.type === 'measurable' ? 'text-accent font-semibold' : 
                  ''
                }>
                  {part.text}
                </span>
              ))}
            </div>
            
            <h4 className="text-sm font-medium flex items-center">
              <span>Suggested Improvement:</span>
              <Button variant="ghost" size="sm" className="ml-2 h-6 p-1" onClick={() => setIsEditing(!isEditing)}>
                <Edit2 className="h-4 w-4" />
              </Button>
            </h4>
            <div className="text-sm bg-green-50 p-3 rounded">
              {rewrittenComponents.map((part, idx) => (
                <span key={idx} className={
                  part.type === 'action' ? 'text-primary font-semibold' : 
                  part.type === 'skill' ? 'text-destructive font-semibold' : 
                  part.type === 'measurable' ? 'text-accent font-semibold' : 
                  ''
                }>
                  {part.text}
                </span>
              ))}
            </div>
          </div>
          
          {/* Bullet Point Visualization */}
          <div className="mt-4">
            <h4 className="text-sm font-medium mb-2">Suggested Improved Bullet Analysis Visualization:</h4>
            <BulletPointChart bullet={bullet} />
          </div>
          
          {/* Score Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div className="space-y-2">
              <h4 className="text-sm font-medium mb-2">Word Balance ({word_balance_score}/25)</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>Industry: <span className={getScoreColor(word_balance.industry_pct, 45)}>{word_balance.industry_pct}%</span></div>
                <div>Common: <span className={getScoreColor(word_balance.common_pct, 25)}>{word_balance.common_pct}%</span></div>
                <div>Action: <span className={getScoreColor(word_balance.action_pct, 15)}>{word_balance.action_pct}%</span></div>
                <div>Metric: <span className={getScoreColor(word_balance.metric_pct, 15)}>{word_balance.metric_pct}%</span></div>
              </div>
            </div>
            
            <div className="space-y-2">
              <h4 className="text-sm font-medium mb-2">XYZ Quality ({xyz_scores.hard_soft + xyz_scores.action_words + xyz_scores.measurable_results + xyz_scores.clarity_focus}/20)</h4>
              <div className="space-y-1 text-sm">
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
          
          {/* Improvement Tips */}
          <div className="mt-4">
            <h4 className="text-sm font-medium">Improvement Tips:</h4>
            <p className="text-sm text-muted-foreground mt-1">{tips}</p>
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
};

export default BulletPointItem;
