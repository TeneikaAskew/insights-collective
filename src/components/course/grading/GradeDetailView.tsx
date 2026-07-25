import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { GradeHistoryViewer } from './GradeHistoryViewer';
import { SubmissionComments } from './SubmissionComments';
import {
  History,
  MessageSquare,
  BarChart3,
  FileText,
  Clock,
  User,
  Award
} from 'lucide-react';
import { formatProfileName } from '@/lib/utils';

interface GradeDetailViewProps {
  gradeId: string;
  submissionId?: string;
  submissionType?: 'assignment' | 'quiz';
  studentId?: string;
  courseId?: string;
  grade?: {
    points_earned?: number;
    points_possible?: number;
    percentage?: number;
    letter_grade?: string;
    comments?: string;
    graded_at?: string;
    graded_by?: string;
    assignment?: {
      title: string;
      due_date?: string;
    };
    quiz?: {
      title: string;
      time_limit?: number;
    };
    student?: {
      first_name: string | null;
      last_name: string | null;
      avatar_url?: string;
    };
  };
  showComments?: boolean;
  allowNewComments?: boolean;
  isInstructor?: boolean;
}

export const GradeDetailView: React.FC<GradeDetailViewProps> = ({
  gradeId,
  submissionId,
  submissionType,
  studentId,
  courseId,
  grade,
  showComments = true,
  allowNewComments = true,
  isInstructor = false,
}) => {
  const formatGradeDisplay = () => {
    if (!grade) return 'No grade';
    
    const parts = [];
    
    if (grade.points_earned !== null && grade.points_earned !== undefined && 
        grade.points_possible !== null && grade.points_possible !== undefined) {
      parts.push(`${grade.points_earned}/${grade.points_possible} pts`);
    }
    
    if (grade.percentage !== null && grade.percentage !== undefined) {
      parts.push(`${grade.percentage}%`);
    }
    
    if (grade.letter_grade) {
      parts.push(grade.letter_grade);
    }

    return parts.join(' • ') || 'No grade';
  };

  const getGradeColor = () => {
    if (!grade?.percentage) return 'text-gray-600';
    
    if (grade.percentage >= 90) return 'text-green-600';
    if (grade.percentage >= 80) return 'text-blue-600';
    if (grade.percentage >= 70) return 'text-yellow-600';
    if (grade.percentage >= 60) return 'text-orange-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-6">
      {/* Grade Summary Card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5" />
                {grade?.assignment?.title || grade?.quiz?.title || 'Grade Details'}
              </CardTitle>
              {grade?.student && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <User className="h-4 w-4" />
                  {formatProfileName(grade.student)}
                </div>
              )}
            </div>
            
            <div className="text-right">
              <div className={`text-2xl font-bold ${getGradeColor()}`}>
                {formatGradeDisplay()}
              </div>
              {grade?.graded_at && (
                <div className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                  <Clock className="h-3 w-3" />
                  Graded {new Date(grade.graded_at).toLocaleDateString()}
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        
        {(grade?.comments || grade?.assignment?.due_date || grade?.quiz?.time_limit) && (
          <CardContent>
            <div className="space-y-3">
              {grade?.comments && (
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm font-medium text-blue-800 mb-1">Instructor Feedback</p>
                  <p className="text-sm text-blue-700">{grade.comments}</p>
                </div>
              )}
              
              <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                {grade?.assignment?.due_date && (
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    Due: {new Date(grade.assignment.due_date).toLocaleDateString()}
                  </div>
                )}
                
                {grade?.quiz?.time_limit && (
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    Time Limit: {grade.quiz.time_limit} minutes
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* History and Comments Tabs */}
      <Tabs defaultValue="history" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Grade History
          </TabsTrigger>
          {showComments && submissionId && submissionType && (
            <TabsTrigger value="comments" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Comments
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="history" className="mt-6">
          <GradeHistoryViewer
            gradeId={gradeId}
            viewType="single"
          />
        </TabsContent>

        {showComments && submissionId && submissionType && (
          <TabsContent value="comments" className="mt-6">
            <SubmissionComments
              submissionId={submissionId}
              submissionType={submissionType}
              allowComments={allowNewComments}
              showPrivateComments={isInstructor}
            />
          </TabsContent>
        )}
      </Tabs>

      {/* Additional Grade Analytics (if instructor) */}
      {isInstructor && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Grade Analytics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {grade?.percentage || 0}%
                </div>
                <p className="text-sm text-gray-600">Current Score</p>
              </div>
              
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">A</div>
                <p className="text-sm text-gray-600">Class Average</p>
              </div>
              
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">85%</div>
                <p className="text-sm text-gray-600">Percentile</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};