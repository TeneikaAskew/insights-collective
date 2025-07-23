import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { 
  History, 
  TrendingUp, 
  TrendingDown, 
  Plus, 
  Edit, 
  Trash2, 
  Clock,
  User,
  FileText,
  HelpCircle
} from 'lucide-react';
import { useGradeHistory, useStudentGradeHistory, useCourseGradeHistory } from '@/hooks/useGradeHistory';
import { GradeHistoryEntry } from '@/services/gradeHistoryService';
import { formatDistanceToNow } from 'date-fns';

interface GradeHistoryViewerProps {
  gradeId?: string;
  studentId?: string;
  courseId?: string;
  viewType?: 'single' | 'student' | 'course';
  limit?: number;
}

export const GradeHistoryViewer: React.FC<GradeHistoryViewerProps> = ({
  gradeId,
  studentId,
  courseId,
  viewType = 'single',
  limit = 50,
}) => {
  const { history: singleHistory, isLoading: singleLoading } = useGradeHistory(
    viewType === 'single' ? gradeId : undefined
  );
  
  const { history: studentHistory, isLoading: studentLoading } = useStudentGradeHistory(
    viewType === 'student' ? studentId : undefined,
    viewType === 'student' ? courseId : undefined
  );
  
  const { history: courseHistory, isLoading: courseLoading } = useCourseGradeHistory(
    viewType === 'course' ? courseId : undefined,
    limit
  );

  const history = singleHistory || studentHistory || courseHistory || [];
  const isLoading = singleLoading || studentLoading || courseLoading;

  const getChangeIcon = (changeType: string) => {
    switch (changeType) {
      case 'created':
        return <Plus className="h-4 w-4 text-green-600" />;
      case 'updated':
        return <Edit className="h-4 w-4 text-blue-600" />;
      case 'deleted':
        return <Trash2 className="h-4 w-4 text-red-600" />;
      case 'excused':
        return <Clock className="h-4 w-4 text-orange-600" />;
      case 'unexcused':
        return <Clock className="h-4 w-4 text-gray-600" />;
      default:
        return <Edit className="h-4 w-4 text-gray-600" />;
    }
  };

  const getChangeBadgeColor = (changeType: string) => {
    switch (changeType) {
      case 'created':
        return 'bg-green-100 text-green-800';
      case 'updated':
        return 'bg-blue-100 text-blue-800';
      case 'deleted':
        return 'bg-red-100 text-red-800';
      case 'excused':
        return 'bg-orange-100 text-orange-800';
      case 'unexcused':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getGradeChangeIndicator = (entry: GradeHistoryEntry) => {
    if (entry.change_type === 'created') return null;
    
    const oldValue = entry.previous_points_earned || entry.previous_percentage || 0;
    const newValue = entry.new_points_earned || entry.new_percentage || 0;
    
    if (newValue > oldValue) {
      return <TrendingUp className="h-4 w-4 text-green-600" />;
    } else if (newValue < oldValue) {
      return <TrendingDown className="h-4 w-4 text-red-600" />;
    }
    return null;
  };

  const formatGradeDisplay = (entry: GradeHistoryEntry, isNew: boolean = true) => {
    const points = isNew ? entry.new_points_earned : entry.previous_points_earned;
    const possible = isNew ? entry.new_points_possible : entry.previous_points_possible;
    const percentage = isNew ? entry.new_percentage : entry.previous_percentage;
    const letter = isNew ? entry.new_letter_grade : entry.previous_letter_grade;

    const parts = [];
    
    if (points !== null && points !== undefined && possible !== null && possible !== undefined) {
      parts.push(`${points}/${possible} pts`);
    }
    
    if (percentage !== null && percentage !== undefined) {
      parts.push(`${percentage}%`);
    }
    
    if (letter) {
      parts.push(letter);
    }

    return parts.join(' • ') || 'No grade';
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (history.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Grade History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No grade changes recorded yet.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Grade History
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {history.map((entry, index) => (
            <div key={entry.id}>
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 mt-1">
                  {getChangeIcon(entry.change_type)}
                </div>
                
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge className={getChangeBadgeColor(entry.change_type)}>
                        {entry.change_type}
                      </Badge>
                      {entry.assignment?.title && (
                        <span className="text-sm font-medium">{entry.assignment.title}</span>
                      )}
                      {entry.quiz?.title && (
                        <span className="text-sm font-medium">{entry.quiz.title}</span>
                      )}
                      {getGradeChangeIndicator(entry)}
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(new Date(entry.changed_at), { addSuffix: true })}
                    </div>
                  </div>

                  {entry.change_type !== 'deleted' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3 bg-gray-50 rounded-lg">
                      {entry.change_type !== 'created' && (
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Previous Grade</p>
                          <p className="text-sm font-medium text-gray-700">
                            {formatGradeDisplay(entry, false)}
                          </p>
                        </div>
                      )}
                      
                      <div>
                        <p className="text-xs text-gray-500 mb-1">
                          {entry.change_type === 'created' ? 'Grade' : 'New Grade'}
                        </p>
                        <p className="text-sm font-medium text-gray-900">
                          {formatGradeDisplay(entry, true)}
                        </p>
                      </div>
                    </div>
                  )}

                  {(entry.new_comments || entry.previous_comments) && (
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <p className="text-xs text-blue-600 mb-1">Feedback</p>
                      <p className="text-sm text-blue-800">
                        {entry.new_comments || entry.previous_comments}
                      </p>
                    </div>
                  )}

                  {entry.change_reason && (
                    <div className="p-3 bg-yellow-50 rounded-lg">
                      <p className="text-xs text-yellow-600 mb-1">Reason</p>
                      <p className="text-sm text-yellow-800">{entry.change_reason}</p>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <div className="flex items-center gap-2">
                      {entry.changer && (
                        <>
                          <Avatar className="h-5 w-5">
                            <AvatarImage src={entry.changer.avatar_url} />
                            <AvatarFallback>
                              {entry.changer.full_name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <span>{entry.changer.full_name}</span>
                        </>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-3">
                      {entry.grading_method && (
                        <Badge variant="outline" className="text-xs">
                          {entry.grading_method}
                        </Badge>
                      )}
                      {entry.rubric_data && (
                        <Badge variant="outline" className="text-xs">
                          <FileText className="h-3 w-3 mr-1" />
                          Rubric
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              {index < history.length - 1 && <Separator className="my-4" />}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};