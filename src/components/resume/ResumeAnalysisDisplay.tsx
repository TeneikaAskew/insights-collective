
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertTriangle, Edit2, MessageSquare } from 'lucide-react';
import { ResumeAnalysis, BulletAnalysis } from '@/components/assistants/types';
import BulletPointChart from './BulletPointChart';

interface ResumeAnalysisDisplayProps {
  analysis: ResumeAnalysis | null;
  onStartCareerChat: () => void;
}

const ResumeAnalysisDisplay: React.FC<ResumeAnalysisDisplayProps> = ({
  analysis,
  onStartCareerChat
}) => {
  if (!analysis) return null;
  
  const {
    bullets,
    resume_average,
    resume_percent,
    letter_grade,
    themes,
    elevator_pitch,
    explanation
  } = analysis;
  
  const getBadgeColor = (score: number) => {
    if (score >= 35) return "bg-green-100 text-green-800 border-green-200";
    if (score >= 25) return "bg-yellow-100 text-yellow-800 border-yellow-200";
    return "bg-red-100 text-red-800 border-red-200";
  };
  
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
  
  return <div className="space-y-6">
      {/* Overall Resume Score */}
      <Card>
        <CardHeader>
          <CardTitle className="flex justify-between items-center">
            <span>Resume Score</span>
            <span className={`text-3xl font-bold ${getLetterGradeColor(letter_grade)}`}>
              {letter_grade} ({resume_percent}%)
            </span>
          </CardTitle>
          <CardDescription>
            Overall assessment of your resume based on industry standards and best practices
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Progress value={resume_percent} className="h-2" />
          
          <div className="bg-accent/20 border border-accent rounded-md p-4">
            <p className="font-medium mb-2">Elevator Pitch:</p>
            <p className="text-sm italic">{elevator_pitch}</p>
          </div>
          
          <div>
            <h3 className="font-medium mb-2">Key Improvement Themes:</h3>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              {themes.map((theme, index) => <li key={index}>{theme}</li>)}
            </ul>
          </div>
          
          <Separator />
          
          <div>
            <h3 className="font-medium mb-2">Detailed Explanation:</h3>
            <p className="text-sm">{explanation}</p>
          </div>
          
          <div className="mt-6 p-4 bg-blue-50 rounded-md border border-blue-100">
            <h3 className="font-medium mb-2 text-blue-800">What's next? Let's talk about your experience:</h3>
            <p className="text-sm italic text-blue-700">
              What specific challenges did you tackle in your first listed role, what actions did you take, and what measurable results did you achieve?
            </p>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={onStartCareerChat} className="w-full bg-blue-600 hover:bg-blue-700 gap-2">
            <MessageSquare className="h-4 w-4" />
            Start Resume Improvement Chat
          </Button>
        </CardFooter>
      </Card>
      
      {/* Bullet Point Analysis */}
      <Card>
        <CardHeader>
          <CardTitle>Bullet Point Analysis</CardTitle>
          <CardDescription>Detailed breakdown and improvement suggestions for bullet points</CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="space-y-4">
            {bullets.map((bullet, index) => <BulletPointItem key={index} bullet={bullet} index={index} />)}
          </Accordion>
        </CardContent>
      </Card>
    </div>;
};

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
  
  return <AccordionItem value={`bullet-${index}`} className="border rounded-lg p-1">
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
    </AccordionItem>;
};

export default ResumeAnalysisDisplay;
