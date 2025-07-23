import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Rubric, RubricCriteria, RubricLevel } from '@/types/course';
import { CheckCircle2, AlertCircle } from 'lucide-react';

interface RubricGradingProps {
  rubric: Rubric;
  onGradeSubmit: (grade: RubricGradingResult) => void;
  initialGrade?: RubricGradingResult;
  readonly?: boolean;
}

export interface RubricGradingResult {
  rubric_id: string;
  total_points: number;
  criteria_scores: {
    criteria_id: string;
    selected_level_index: number;
    points: number;
    comments?: string;
  }[];
  overall_comments?: string;
}

interface CriteriaGradingProps {
  criteria: RubricCriteria;
  onScoreChange: (criteriaId: string, levelIndex: number, points: number) => void;
  onCommentChange: (criteriaId: string, comment: string) => void;
  selectedLevelIndex?: number;
  comment?: string;
  readonly?: boolean;
}

const CriteriaGrading: React.FC<CriteriaGradingProps> = ({
  criteria,
  onScoreChange,
  onCommentChange,
  selectedLevelIndex,
  comment = '',
  readonly = false,
}) => {
  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{criteria.title}</CardTitle>
          <span className="text-sm text-gray-500">{criteria.points} points</span>
        </div>
        {criteria.description && (
          <p className="text-sm text-gray-600 mt-1">{criteria.description}</p>
        )}
      </CardHeader>
      <CardContent>
        <RadioGroup
          value={selectedLevelIndex?.toString()}
          onValueChange={(value) => {
            const index = parseInt(value);
            const level = criteria.levels[index];
            onScoreChange(criteria.id, index, level.points);
          }}
          disabled={readonly}
        >
          <div className="space-y-3">
            {criteria.levels.map((level, index) => (
              <div
                key={index}
                className={`border rounded-lg p-3 transition-colors ${
                  selectedLevelIndex === index ? 'border-primary bg-primary/5' : 'border-gray-200'
                }`}
              >
                <div className="flex items-start space-x-2">
                  <RadioGroupItem value={index.toString()} id={`${criteria.id}-${index}`} />
                  <div className="flex-1">
                    <Label
                      htmlFor={`${criteria.id}-${index}`}
                      className="flex items-center justify-between cursor-pointer"
                    >
                      <span className="font-medium">{level.title}</span>
                      <span className="text-sm text-gray-500">{level.points} pts</span>
                    </Label>
                    {level.description && (
                      <p className="text-sm text-gray-600 mt-1">{level.description}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </RadioGroup>
        
        <div className="mt-4">
          <Label className="text-sm font-medium">Additional Comments (optional)</Label>
          <Textarea
            value={comment}
            onChange={(e) => onCommentChange(criteria.id, e.target.value)}
            placeholder="Add specific feedback for this criteria..."
            rows={2}
            className="mt-1"
            disabled={readonly}
          />
        </div>
      </CardContent>
    </Card>
  );
};

export const RubricGrading: React.FC<RubricGradingProps> = ({
  rubric,
  onGradeSubmit,
  initialGrade,
  readonly = false,
}) => {
  const [criteriaScores, setCriteriaScores] = useState<Record<string, {
    levelIndex: number;
    points: number;
    comment: string;
  }>>({});
  const [overallComments, setOverallComments] = useState('');

  useEffect(() => {
    if (initialGrade) {
      const scores: Record<string, any> = {};
      initialGrade.criteria_scores.forEach(score => {
        scores[score.criteria_id] = {
          levelIndex: score.selected_level_index,
          points: score.points,
          comment: score.comments || '',
        };
      });
      setCriteriaScores(scores);
      setOverallComments(initialGrade.overall_comments || '');
    }
  }, [initialGrade]);

  const handleScoreChange = (criteriaId: string, levelIndex: number, points: number) => {
    setCriteriaScores({
      ...criteriaScores,
      [criteriaId]: {
        ...criteriaScores[criteriaId],
        levelIndex,
        points,
      },
    });
  };

  const handleCommentChange = (criteriaId: string, comment: string) => {
    setCriteriaScores({
      ...criteriaScores,
      [criteriaId]: {
        ...criteriaScores[criteriaId],
        comment,
      },
    });
  };

  const calculateTotalScore = () => {
    return Object.values(criteriaScores).reduce((total, score) => total + (score.points || 0), 0);
  };

  const calculateMaxScore = () => {
    return rubric.criteria?.reduce((total, criteria) => total + criteria.points, 0) || 0;
  };

  const isComplete = () => {
    return rubric.criteria?.every(criteria => criteriaScores[criteria.id]?.levelIndex !== undefined) || false;
  };

  const handleSubmit = () => {
    const result: RubricGradingResult = {
      rubric_id: rubric.id,
      total_points: calculateTotalScore(),
      criteria_scores: Object.entries(criteriaScores).map(([criteriaId, score]) => ({
        criteria_id: criteriaId,
        selected_level_index: score.levelIndex,
        points: score.points,
        comments: score.comment || undefined,
      })),
      overall_comments: overallComments || undefined,
    };
    onGradeSubmit(result);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{rubric.title}</CardTitle>
          {rubric.description && (
            <p className="text-sm text-gray-600">{rubric.description}</p>
          )}
        </CardHeader>
      </Card>

      {rubric.criteria?.map((criteria) => (
        <CriteriaGrading
          key={criteria.id}
          criteria={criteria}
          onScoreChange={handleScoreChange}
          onCommentChange={handleCommentChange}
          selectedLevelIndex={criteriaScores[criteria.id]?.levelIndex}
          comment={criteriaScores[criteria.id]?.comment}
          readonly={readonly}
        />
      ))}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Overall Comments</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={overallComments}
            onChange={(e) => setOverallComments(e.target.value)}
            placeholder="Add overall feedback for the student..."
            rows={4}
            disabled={readonly}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-gray-600">Total Score</p>
              <p className="text-2xl font-bold">
                {calculateTotalScore()} / {calculateMaxScore()} points
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Percentage</p>
              <p className="text-2xl font-bold">
                {calculateMaxScore() > 0 
                  ? Math.round((calculateTotalScore() / calculateMaxScore()) * 100)
                  : 0}%
              </p>
            </div>
          </div>
          
          {!readonly && (
            <>
              {!isComplete() && (
                <div className="flex items-center gap-2 mb-4 text-amber-600">
                  <AlertCircle className="h-4 w-4" />
                  <p className="text-sm">Please score all criteria before submitting.</p>
                </div>
              )}
              
              <Button
                onClick={handleSubmit}
                disabled={!isComplete()}
                className="w-full"
              >
                {isComplete() && <CheckCircle2 className="h-4 w-4 mr-2" />}
                Submit Grade
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};