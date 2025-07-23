// Canvas-style grading interface for instructors
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { CourseLayout } from '@/components/course/CourseLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { UnifiedCanvasEditor } from '@/components/ui/unified-canvas-editor';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import CanvasContentService from '@/services/canvasContentService';
import { withCoursePermission } from '@/components/course/withCoursePermission';
import { 
  FileText, 
  Clock, 
  Calendar,
  CheckCircle,
  AlertCircle,
  Download,
  MessageSquare,
  Save,
  ChevronLeft,
  ChevronRight,
  User,
  Hash,
  History,
  Eye
} from 'lucide-react';
import { format } from 'date-fns';
import type { ContentItem, Assignment, AssignmentSubmission } from '@/types/canvas';

import { createLogger } from '@/utils/logger';
import { GradeDetailView } from '@/components/course/grading/GradeDetailView';
import { SubmissionComments } from '@/components/course/grading/SubmissionComments';

const logger = createLogger('gradingSubmissions');

interface GradingSubmission extends AssignmentSubmission {
  user: {
    id: string;
    email: string;
    full_name: string;
  };
  grader_comments?: string;
  graded_at?: string;
}

function CanvasGradingInterface() {
  const { courseId, contentItemId } = useParams();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [contentItem, setContentItem] = useState<ContentItem | null>(null);
  const [submissions, setSubmissions] = useState<GradingSubmission[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<GradingSubmission | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Grading form state
  const [grade, setGrade] = useState<string>('');
  const [feedback, setFeedback] = useState<string>('');
  const [speedGraderIndex, setSpeedGraderIndex] = useState(0);

  useEffect(() => {
    loadGradingData();
  }, [contentItemId]);

  useEffect(() => {
    // Update form when submission changes
    if (selectedSubmission) {
      setGrade(selectedSubmission.grade?.toString() || '');
      setFeedback(selectedSubmission.grader_comments || '');
    }
  }, [selectedSubmission]);

  const loadGradingData = async () => {
    if (!contentItemId) return;

    try {
      setLoading(true);
      
      // Load assignment details
      const item = await CanvasContentService.getContentItem(contentItemId);
      if (!item || item.type !== 'assignment') {
        throw new Error('Assignment not found');
      }
      setContentItem(item);

      // Load all submissions with user info
      const { data: submissionsData, error } = await supabase
        .from('assignment_submissions')
        .select(`
          *,
          user:profiles!user_id (
            id,
            email,
            full_name
          )
        `)
        .eq('assignment_id', item.assignment?.id)
        .order('submitted_at', { ascending: false });

      if (error) throw error;
      
      const gradingSubmissions = (submissionsData || []).map(sub => ({
        ...sub,
        user: sub.user || { id: sub.user_id, email: 'Unknown', full_name: 'Unknown User' }
      }));
      
      setSubmissions(gradingSubmissions);
      
      // Select first submission by default
      if (gradingSubmissions.length > 0) {
        setSelectedSubmission(gradingSubmissions[0]);
      }

    } catch (error: any) {
      logger.error('Error loading grading data:', error);
      toast({
        title: 'Error loading submissions',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGradeSubmit = async () => {
    if (!selectedSubmission || !contentItem?.assignment) return;

    // Validate grade
    const gradeNum = parseFloat(grade);
    if (isNaN(gradeNum) || gradeNum < 0 || gradeNum > (contentItem.assignment.points_possible || 100)) {
      toast({
        title: 'Invalid grade',
        description: `Grade must be between 0 and ${contentItem.assignment.points_possible || 100}`,
        variant: 'destructive'
      });
      return;
    }

    try {
      setSaving(true);

      // Update submission
      const { error } = await supabase
        .from('assignment_submissions')
        .update({
          grade: gradeNum,
          grader_comments: feedback,
          graded_at: new Date().toISOString(),
          grader_id: user?.id,
          workflow_state: 'graded'
        })
        .eq('id', selectedSubmission.id);

      if (error) throw error;

      // Update local state
      const updatedSubmissions = submissions.map(sub => 
        sub.id === selectedSubmission.id 
          ? { ...sub, grade: gradeNum, grader_comments: feedback, workflow_state: 'graded' }
          : sub
      );
      setSubmissions(updatedSubmissions as GradingSubmission[]);
      setSelectedSubmission({
        ...selectedSubmission,
        grade: gradeNum,
        grader_comments: feedback,
        workflow_state: 'graded'
      });

      toast({
        title: 'Grade saved',
        description: 'The submission has been graded successfully.'
      });

      // Move to next submission if in speed grader mode
      if (speedGraderIndex < submissions.length - 1) {
        handleSpeedGraderNavigation(speedGraderIndex + 1);
      }

    } catch (error: any) {
      logger.error('Error saving grade:', error);
      toast({
        title: 'Error saving grade',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSpeedGraderNavigation = (newIndex: number) => {
    if (newIndex >= 0 && newIndex < submissions.length) {
      setSpeedGraderIndex(newIndex);
      setSelectedSubmission(submissions[newIndex]);
    }
  };

  const getSubmissionStatusBadge = (submission: GradingSubmission) => {
    if (submission.workflow_state === 'graded') {
      return <Badge variant="default">Graded</Badge>;
    }
    if (submission.late) {
      return <Badge variant="destructive">Late</Badge>;
    }
    if (submission.missing) {
      return <Badge variant="secondary">Missing</Badge>;
    }
    return <Badge variant="outline">Submitted</Badge>;
  };

  const renderSubmissionContent = () => {
    if (!selectedSubmission) return null;

    switch (selectedSubmission.submission_type) {
      case 'online_text_entry':
        return (
          <div className="prose prose-lg max-w-none">
            <UnifiedCanvasEditor
              content={selectedSubmission.body || 'No submission'}
              onChange={() => {}}
              readOnly={true}
            />
          </div>
        );
      
      case 'online_url':
        return (
          <div className="p-6 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground mb-2">Submitted URL:</p>
            <a 
              href={selectedSubmission.url || '#'} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              {selectedSubmission.url}
            </a>
          </div>
        );
      
      case 'online_upload':
        return (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Uploaded files:</p>
            {/* Would load actual attachments here */}
            <p className="text-muted-foreground">File attachments would be displayed here</p>
          </div>
        );
      
      default:
        return <p className="text-muted-foreground">No submission content</p>;
    }
  };

  if (loading) {
    return (
      <CourseLayout>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </CourseLayout>
    );
  }

  if (!contentItem) {
    return (
      <CourseLayout>
        <div className="text-center py-12">
          <h1 className="text-3xl font-bold mb-4">Assignment Not Found</h1>
        </div>
      </CourseLayout>
    );
  }

  return (
    <CourseLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-2xl">Grade: {contentItem.title}</CardTitle>
                <CardDescription>
                  {submissions.length} submission{submissions.length !== 1 ? 's' : ''} to grade
                </CardDescription>
              </div>
              <Button variant="outline" asChild>
                <Link to={`/courses/${courseId}/gradebook`}>
                  Back to Gradebook
                </Link>
              </Button>
            </div>
          </CardHeader>
        </Card>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Submissions List */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-lg">Submissions</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {submissions.map((submission, index) => (
                  <button
                    key={submission.id}
                    onClick={() => {
                      setSelectedSubmission(submission);
                      setSpeedGraderIndex(index);
                    }}
                    className={`w-full text-left p-4 hover:bg-muted transition-colors ${
                      selectedSubmission?.id === submission.id ? 'bg-muted' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{submission.user.full_name}</div>
                        <div className="text-sm text-muted-foreground">
                          {submission.submitted_at 
                            ? format(new Date(submission.submitted_at), 'MMM d, h:mm a')
                            : 'Not submitted'}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {getSubmissionStatusBadge(submission)}
                        {submission.grade !== null && (
                          <span className="text-sm font-medium">
                            {submission.grade}/{contentItem.assignment?.points_possible || 0}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Main Grading Area */}
          <Card className="lg:col-span-2">
            {selectedSubmission ? (
              <>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle>{selectedSubmission.user.full_name}</CardTitle>
                      <CardDescription>
                        Submitted {selectedSubmission.submitted_at 
                          ? format(new Date(selectedSubmission.submitted_at), 'MMMM d, yyyy at h:mm a')
                          : 'Not submitted'}
                      </CardDescription>
                    </div>
                    {/* Speed Grader Navigation */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSpeedGraderNavigation(speedGraderIndex - 1)}
                        disabled={speedGraderIndex === 0}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        {speedGraderIndex + 1} of {submissions.length}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSpeedGraderNavigation(speedGraderIndex + 1)}
                        disabled={speedGraderIndex === submissions.length - 1}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Submission Content */}
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Submission</h3>
                    {renderSubmissionContent()}
                  </div>

                  {/* Grading Form */}
                  <div className="border-t pt-6">
                    <h3 className="text-lg font-semibold mb-4">Grade & Feedback</h3>
                    <div className="grid gap-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="grade">Grade</Label>
                          <div className="flex items-center gap-2">
                            <Input
                              id="grade"
                              type="number"
                              value={grade}
                              onChange={(e) => setGrade(e.target.value)}
                              placeholder="0"
                              min="0"
                              max={contentItem.assignment?.points_possible || 100}
                            />
                            <span className="text-muted-foreground">
                              / {contentItem.assignment?.points_possible || 100}
                            </span>
                          </div>
                        </div>
                        <div>
                          <Label>Status</Label>
                          <Select 
                            value={selectedSubmission.workflow_state}
                            disabled
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="submitted">Submitted</SelectItem>
                              <SelectItem value="graded">Graded</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="feedback">Feedback</Label>
                        <UnifiedCanvasEditor
                          content={feedback}
                          onChange={setFeedback}
                          placeholder="Provide feedback for the student..."
                          minHeight="200px"
                        />
                      </div>

                      <Button 
                        onClick={handleGradeSubmit}
                        disabled={saving}
                        className="w-full"
                      >
                        <Save className="h-4 w-4 mr-2" />
                        {saving ? 'Saving...' : 'Save Grade & Continue'}
                      </Button>
                    </div>
                  </div>

                  {/* Submission History */}
                  {selectedSubmission.graded_at && (
                    <Alert>
                      <CheckCircle className="h-4 w-4" />
                      <AlertDescription>
                        Previously graded on {format(new Date(selectedSubmission.graded_at), 'MMM d, yyyy at h:mm a')}
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </>
            ) : (
              <CardContent className="text-center py-12">
                <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  Select a submission to begin grading
                </p>
              </CardContent>
            )}
          </Card>
        </div>
      </div>
    </CourseLayout>
  );
}

export default withCoursePermission(CanvasGradingInterface, { requiredRoles: ['instructor', 'admin'] });