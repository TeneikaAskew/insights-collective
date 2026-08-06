// Canvas-style assignments list component
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { 
  Calendar, 
  Clock, 
  FileText, 
  CheckCircle,
  AlertCircle,
  ChevronRight
} from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import CourseErrorState from '@/components/course/CourseErrorState';
import type { ContentItem } from '@/types/canvas';
import { createLogger } from '@/utils/logger';

const logger = createLogger('CanvasAssignmentsList');

interface CanvasAssignmentsListProps {
  courseId: string;
}

export function CanvasAssignmentsList({ courseId }: CanvasAssignmentsListProps) {
  const [assignments, setAssignments] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submissions, setSubmissions] = useState<Record<string, any>>({});
  // Set when the user-submissions query fails: submission status is unknown,
  // so status badges must be suppressed instead of rendering a false "Missing".
  const [submissionsError, setSubmissionsError] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    loadAssignments();
  }, [courseId]);

  const loadAssignments = async () => {
    try {
      setLoading(true);
      setSubmissionsError(null);

      // Fetch all assignments for the course
      const { data: assignmentItems, error } = await supabase
        .from('content_items')
        .select(`
          *,
          assignment:assignments(*),
          module:modules(id, title, week)
        `)
        .eq('course_id', courseId)
        .eq('type', 'assignment')
        .eq('published', true)
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      setAssignments((assignmentItems || []) as unknown as ContentItem[]);

      // Load submission status for each assignment
      if (user && assignmentItems && assignmentItems.length > 0) {
        const assignmentIds = assignmentItems
          .map(item => item.assignment?.id)
          .filter(Boolean);

        const { data: userSubmissions, error: submissionsErr } = await supabase
          .from('assignment_submissions')
          .select('*')
          .in('assignment_id', assignmentIds)
          .eq('user_id', user.id);

        if (submissionsErr) {
          // Do NOT fall through with an empty submissions map — that would
          // render fabricated "Missing"/"Not Submitted" badges for work the
          // student may already have submitted.
          logger.error('Error loading submission statuses:', submissionsErr);
          setSubmissions({});
          setSubmissionsError(submissionsErr.message);
        } else {
          const submissionMap = (userSubmissions || []).reduce((acc, sub) => {
            acc[sub.assignment_id] = sub;
            return acc;
          }, {} as Record<string, any>);
          setSubmissions(submissionMap);
        }
      }

    } catch (error: any) {
      logger.error('Error loading assignments:', error);
      toast({
        title: 'Error loading assignments',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const getSubmissionStatus = (assignment: ContentItem) => {
    if (!assignment.assignment) return null;
    // Submission statuses are unknown when the query failed — show no badge
    // rather than inventing one.
    if (submissionsError) return null;

    const submission = submissions[assignment.assignment.id];
    if (!submission) {
      const isLate = assignment.assignment.due_at && new Date() > new Date(assignment.assignment.due_at);
      return isLate ? 'late' : 'not_submitted';
    }
    
    if (submission.workflow_state === 'graded') {
      return 'graded';
    }
    
    return 'submitted';
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'graded':
        return <Badge variant="default">Graded</Badge>;
      case 'submitted':
        return <Badge variant="secondary">Submitted</Badge>;
      case 'late':
        return <Badge variant="destructive">Missing</Badge>;
      case 'not_submitted':
        return <Badge variant="outline">Not Submitted</Badge>;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (assignments.length === 0) {
    return (
      <div className="text-center p-8 border rounded-lg bg-muted/20">
        <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground">No assignments yet.</p>
        <p className="text-sm text-muted-foreground mt-2">
          Assignments will appear here once they're published.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {submissionsError && (
        <CourseErrorState
          title="Couldn't load your submission status"
          error={submissionsError}
          onRetry={() => void loadAssignments()}
        />
      )}
      {assignments.map((assignment) => {
        const status = getSubmissionStatus(assignment);
        const submission = assignment.assignment ? submissions[assignment.assignment.id] : null;
        
        return (
          <Card key={assignment.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-lg">{assignment.title}</h3>
                    {getStatusBadge(status)}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Module Assignment
                  </p>
                </div>
                <div className="text-right">
                  {assignment.assignment?.points_possible && (
                    <div className="text-lg font-semibold">
                      {submission?.grade !== null && submission?.grade !== undefined ? (
                        <span>{submission.grade}/{assignment.assignment.points_possible} pts</span>
                      ) : (
                        <span>{assignment.assignment.points_possible} pts</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  {assignment.assignment?.due_at && (
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      <span>Due {format(new Date(assignment.assignment.due_at), "MMM d, yyyy 'at' h:mm a")}</span>
                    </div>
                  )}
                  {assignment.assignment?.submission_types && (
                    <div className="flex items-center gap-1">
                      <FileText className="h-4 w-4" />
                      <span>{assignment.assignment.submission_types.join(', ')}</span>
                    </div>
                  )}
                </div>
                <Button asChild size="sm">
                  <Link to={`/courses/${courseId}/modules/${assignment.module_id}/assignments/${assignment.id}/submit`}>
                    {status === 'graded' ? 'View Submission' : 'Submit Assignment'}
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export default CanvasAssignmentsList;