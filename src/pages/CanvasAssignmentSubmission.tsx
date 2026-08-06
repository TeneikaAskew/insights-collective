// Canvas-style assignment submission page
import { lazy, Suspense, useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { CourseLayout } from '@/components/course/CourseLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import CourseHtml from '@/components/course/CourseHtml';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import CanvasContentService from '@/services/canvasContentService';
import CourseErrorState from '@/components/course/CourseErrorState';
import FileUploadZone from '@/components/course/content/FileUploadZone';
import { 
  FileText, 
  Upload, 
  Link as LinkIcon, 
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
  Download,
  X
} from 'lucide-react';
import { format } from 'date-fns';
import type { ContentItem, AssignmentSubmission } from '@/types/canvas';

import { createLogger } from '@/utils/logger';

const logger = createLogger('CanvasAssignmentSubmission');

// The rich-text editor drags in ProseMirror — a 320KB chunk plus the 65KB
// editor itself — and this route is the one place a student meets it. Of the
// three submission types only online_text_entry needs an editor, so a
// file-upload or URL submission was paying the whole cost for a control it
// never rendered.
//
// The module has both a named and a default export of the same component;
// lazy() takes the default.
const UnifiedCanvasEditor = lazy(() => import('@/components/ui/unified-canvas-editor'));

// Sized to the editor it stands in for, so the card does not resize under the
// reader when the chunk lands. `minHeight` is the editor's own prop, so the two
// cannot drift apart without someone noticing.
const EditorSkeleton = ({ minHeight }: { minHeight: string }) => (
  <Skeleton className="w-full rounded-md" style={{ height: minHeight }} />
);

export default function CanvasAssignmentSubmission() {
  const { courseId, moduleId, contentItemId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [contentItem, setContentItem] = useState<ContentItem | null>(null);
  const [submission, setSubmission] = useState<AssignmentSubmission | null>(null);
  const [loading, setLoading] = useState(true);
  // Load ERROR (as opposed to a genuinely missing assignment): rendering the
  // form with an unknown prior-submission state would misreport attempts.
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [submitting, setSubmitting] = useState(false);
  
  // Submission form state
  const [submissionType, setSubmissionType] = useState<string>('online_text_entry');
  const [textSubmission, setTextSubmission] = useState('');
  const [urlSubmission, setUrlSubmission] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([]);

  useEffect(() => {
    loadAssignmentData();
  }, [contentItemId]);

  const loadAssignmentData = async () => {
    if (!contentItemId || !user) {
      logger.warn('Missing contentItemId or user', { contentItemId, userId: user?.id });
      return;
    }

    try {
      setLoading(true);
      setLoadError(null);

      logger.info('Loading assignment data for content item:', contentItemId);

      // Load assignment details using the content item ID
      const item = await CanvasContentService.getContentItem(contentItemId);

      if (!item) {
        // Genuine not-found: the "Assignment Not Found" screen renders below.
        logger.error('Content item not found:', contentItemId);
        toast({
          title: 'Error loading assignment',
          description: 'Assignment not found',
          variant: 'destructive'
        });
        return;
      }

      if (!item.assignment?.id) {
        throw new Error('Assignment data not loaded. Please contact your instructor.');
      }

      setContentItem(item);

      // Load existing submission — a failed lookup must not be treated as
      // "no prior submission" (that misreports attempts and prior work).
      const { data: submissions, error } = await supabase
        .from('assignment_submissions')
        .select('*')
        .eq('assignment_id', item.assignment.id)
        .eq('user_id', user.id)
        .order('attempt', { ascending: false })
        .limit(1);

      if (error) {
        throw new Error(error.message);
      }

      if (submissions && submissions.length > 0) {
        setSubmission(submissions[0] as unknown as AssignmentSubmission);

        // Pre-fill form with existing submission
        if (submissions[0].submission_type === 'online_text_entry') {
          setTextSubmission(submissions[0].body || '');
        } else if (submissions[0].submission_type === 'online_url') {
          setUrlSubmission(submissions[0].url || '');
        }
      }

      // Set default submission type — normalize DB values to Canvas naming
      const normalizeType = (t: string) => t === 'file_upload' ? 'online_upload' : t;
      if (item.assignment?.submission_types && item.assignment.submission_types.length > 0) {
        setSubmissionType(normalizeType(item.assignment.submission_types[0]));
      }
      // else stays at initial 'online_text_entry'

    } catch (error: any) {
      logger.error('Error loading assignment:', error);
      setLoadError(error instanceof Error ? error : new Error(String(error?.message ?? error)));
      toast({
        title: 'Error loading assignment',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!contentItem?.assignment?.id) return;

    // Validate submission
    if (submissionType === 'online_text_entry' && !textSubmission.trim()) {
      toast({
        title: 'Submission required',
        description: 'Please enter your submission text',
        variant: 'destructive'
      });
      return;
    }

    if (submissionType === 'online_url' && !urlSubmission.trim()) {
      toast({
        title: 'URL required',
        description: 'Please enter a valid URL',
        variant: 'destructive'
      });
      return;
    }

    if (submissionType === 'online_upload' && uploadedFiles.length === 0) {
      toast({
        title: 'File required',
        description: 'Please upload at least one file',
        variant: 'destructive'
      });
      return;
    }

    try {
      setSubmitting(true);

      const submissionData = {
        submission_type: submissionType,
        body: submissionType === 'online_text_entry' ? textSubmission : null,
        url: submissionType === 'online_url' ? urlSubmission : null,
      };

      const newSubmission = await CanvasContentService.submitAssignment(
        contentItem.assignment.id,
        submissionData
      );

      // Handle file attachments — collect per-insert errors so a failed
      // attachment write is never masked by an unqualified success toast.
      let failedAttachments = 0;
      if (submissionType === 'online_upload' && uploadedFiles.length > 0) {
        for (const file of uploadedFiles) {
          const { error: attachmentError } = await supabase
            .from('submission_attachments')
            .insert({
              submission_id: newSubmission.id,
              filename: file.name,
              content_type: file.type,
              size: file.size,
              url: file.url
            });
          if (attachmentError) {
            failedAttachments += 1;
            logger.error('Failed to record submission attachment:', {
              filename: file.name,
              error: attachmentError,
            });
          }
        }
      }

      if (failedAttachments > 0) {
        // The submission row itself was saved — say exactly that, and name
        // how many attachments failed to record.
        toast({
          title: `Submission saved, but ${failedAttachments} attachment(s) failed to record`,
          description: 'Your submission was saved, but some attachments could not be recorded. Please contact your instructor or try resubmitting.',
          variant: 'destructive'
        });
      } else {
        toast({
          title: 'Assignment submitted',
          description: 'Your assignment has been submitted successfully.'
        });
      }

      // Navigate back to module
      navigate(`/courses/${courseId}/modules/${moduleId}`);

    } catch (error: any) {
      logger.error('Error submitting assignment:', error);
      toast({
        title: 'Error submitting assignment',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileUploaded = (file: any) => {
    setUploadedFiles([...uploadedFiles, file]);
  };

  const removeFile = (index: number) => {
    setUploadedFiles(uploadedFiles.filter((_, i) => i !== index));
  };

  const isLate = () => {
    if (!contentItem?.assignment?.due_at) return false;
    return new Date() > new Date(contentItem.assignment.due_at);
  };

  const canSubmit = () => {
    if (!contentItem?.assignment) return false;
    
    // Check if already submitted max attempts
    if (submission && submission.attempt >= contentItem.assignment.allowed_attempts) {
      return false;
    }

    // Check if assignment is locked
    if (contentItem.assignment.lock_at && new Date() > new Date(contentItem.assignment.lock_at)) {
      return false;
    }

    return true;
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

  // Load ERROR (backend/query failure) — distinct from a genuinely missing
  // assignment, and the form is withheld because prior-attempt state is unknown.
  if (loadError) {
    return (
      <CourseLayout>
        <div className="max-w-4xl mx-auto py-8">
          <CourseErrorState
            title="Couldn't load assignment"
            error={loadError}
            onRetry={() => void loadAssignmentData()}
          />
        </div>
      </CourseLayout>
    );
  }

  if (!contentItem) {
    return (
      <CourseLayout>
        <div className="text-center py-12">
          <h1 className="text-3xl font-bold mb-4">Assignment Not Found</h1>
          <Button asChild>
            <Link to={`/courses/${courseId}/modules/${moduleId}`}>Back to Module</Link>
          </Button>
        </div>
      </CourseLayout>
    );
  }

  return (
    <CourseLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Assignment Header */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-2xl">{contentItem.title}</CardTitle>
                <div className="flex items-center gap-4 mt-2">
                  {contentItem.assignment?.points_possible && (
                    <Badge variant="secondary">
                      {contentItem.assignment.points_possible} points
                    </Badge>
                  )}
                  {contentItem.assignment?.due_at && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      Due {format(new Date(contentItem.assignment.due_at), "MMM d, yyyy 'at' h:mm a")}
                    </div>
                  )}
                  {isLate() && (
                    <Badge variant="destructive">Late</Badge>
                  )}
                </div>
              </div>
              <Button variant="outline" asChild>
                <Link to={`/courses/${courseId}/modules/${moduleId}`}>
                  Back to Module
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* The instructions are read-only prose, so they do not need an
                editor at all — mounting one here started the ProseMirror
                download on EVERY assignment, including the file-upload and
                URL-only ones that never show a text box. That made the lazy
                import below pointless in the common case.

                CourseHtml is the renderer the rest of the course surfaces use
                for exactly this: it sanitizes, and it re-signs private-bucket
                asset URLs — which the editor's read-only path does not do, so
                an image stored in course-images inside an assignment brief was
                previously rendered with a URL that had already expired. */}
            <CourseHtml
              html={contentItem.content || ''}
              className="prose prose-lg max-w-none"
            />
          </CardContent>
        </Card>

        {/* Submission Status */}
        {submission && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-1">
                <div className="font-medium">
                  Submission {submission.attempt} - {submission.workflow_state}
                </div>
                <div className="text-sm">
                  Submitted {format(new Date(submission.submitted_at!), "MMM d, yyyy 'at' h:mm a")}
                </div>
                {submission.grade !== null && (
                  <div className="text-sm">
                    Grade: {submission.grade}/{contentItem.assignment?.points_possible || 0}
                  </div>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Submission Form */}
        {canSubmit() ? (
          <Card>
            <CardHeader>
              <CardTitle>Submit Assignment</CardTitle>
              <CardDescription>
                Choose your submission type and provide your work below
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Submission Type Selector */}
              {contentItem.assignment?.submission_types && contentItem.assignment.submission_types.length >= 1 && (
                <div className="space-y-2">
                  <Label>Submission Type</Label>
                  <Tabs value={submissionType} onValueChange={setSubmissionType}>
                    <TabsList className="grid grid-cols-3 w-full">
                      {contentItem.assignment.submission_types.includes('online_text_entry') && (
                        <TabsTrigger value="online_text_entry">
                          <FileText className="h-4 w-4 mr-2" />
                          Text Entry
                        </TabsTrigger>
                      )}
                      {contentItem.assignment.submission_types.includes('online_url') && (
                        <TabsTrigger value="online_url">
                          <LinkIcon className="h-4 w-4 mr-2" />
                          Website URL
                        </TabsTrigger>
                      )}
                      {(contentItem.assignment.submission_types.includes('online_upload') ||
                        contentItem.assignment.submission_types.includes('file_upload')) && (
                        <TabsTrigger value="online_upload">
                          <Upload className="h-4 w-4 mr-2" />
                          File Upload
                        </TabsTrigger>
                      )}
                    </TabsList>
                  </Tabs>
                </div>
              )}

              {/* Text Entry Submission */}
              {submissionType === 'online_text_entry' && (
                <div className="space-y-2">
                  <Label>Your Submission</Label>
                  <Suspense fallback={<EditorSkeleton minHeight="400px" />}>
                    <UnifiedCanvasEditor
                      content={textSubmission}
                      onChange={setTextSubmission}
                      placeholder="Write your assignment submission here..."
                      minHeight="400px"
                    />
                  </Suspense>
                </div>
              )}

              {/* URL Submission */}
              {submissionType === 'online_url' && (
                <div className="space-y-2">
                  <Label htmlFor="url">Website URL</Label>
                  <Input
                    id="url"
                    type="url"
                    value={urlSubmission}
                    onChange={(e) => setUrlSubmission(e.target.value)}
                    placeholder="https://example.com"
                  />
                  <p className="text-sm text-muted-foreground">
                    Enter the full URL including http:// or https://
                  </p>
                </div>
              )}

              {/* File Upload Submission */}
              {submissionType === 'online_upload' && (
                <div className="space-y-4">
                  <div>
                    <Label>Upload Files</Label>
                    <FileUploadZone
                      onFileUploaded={handleFileUploaded}
                      courseId={courseId}
                      submissionUserId={user?.id}
                      acceptedTypes="all"
                    />
                  </div>
                  
                  {uploadedFiles.length > 0 && (
                    <div className="space-y-2">
                      <Label>Uploaded Files</Label>
                      {uploadedFiles.map((file, index) => (
                        <div key={index} className="flex items-center justify-between p-2 border rounded">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            <span className="text-sm">{file.name}</span>
                            <span className="text-xs text-muted-foreground">
                              ({(file.size / 1024 / 1024).toFixed(2)} MB)
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFile(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Submit Button */}
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" asChild>
                  <Link to={`/courses/${courseId}/modules/${moduleId}`}>
                    Cancel
                  </Link>
                </Button>
                <Button 
                  onClick={handleSubmit} 
                  disabled={submitting}
                >
                  {submitting ? 'Submitting...' : 'Submit Assignment'}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {submission && submission.attempt >= (contentItem.assignment?.allowed_attempts || 1) 
                ? 'You have reached the maximum number of submission attempts.'
                : 'This assignment is no longer accepting submissions.'
              }
            </AlertDescription>
          </Alert>
        )}
      </div>
    </CourseLayout>
  );
}