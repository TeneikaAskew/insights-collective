import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
  FileText, 
  Upload, 
  Link, 
  Mic, 
  Clock, 
  CalendarDays,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDropzone } from 'react-dropzone';
import { AssignmentSubmission, EnhancedAssignment } from '@/types/course';
import { formatDistanceToNow, isPast, isAfter } from 'date-fns';
import { CanvasEditor } from '@/components/ui/canvas-editor';
import { sanitizeHTML } from '@/utils/sanitize';
import { CourseHtml } from '@/components/course/CourseHtml';

const submissionSchema = z.object({
  submission_type: z.enum(['file_upload', 'text_entry', 'url', 'media_recording']),
  text_content: z.string().optional(),
  url: z.string().url().optional(),
  files: z.array(z.any()).optional(),
});

type SubmissionFormValues = z.infer<typeof submissionSchema>;

interface AssignmentSubmissionProps {
  assignment: EnhancedAssignment;
  submission?: AssignmentSubmission;
  onSubmit: (values: any) => void;
  isSubmitting?: boolean;
}

export const AssignmentSubmissionComponent: React.FC<AssignmentSubmissionProps> = ({
  assignment,
  submission,
  onSubmit,
  isSubmitting = false,
}) => {
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Media recording is not implemented — never default the form to it.
  const selectableSubmissionTypes = assignment.submission_types.filter(
    (t) => t !== 'media_recording'
  );

  const form = useForm<SubmissionFormValues>({
    resolver: zodResolver(submissionSchema),
    defaultValues: {
      submission_type: (selectableSubmissionTypes[0] ?? assignment.submission_types[0]) as any,
      text_content: submission?.submission_data?.text || '',
      url: submission?.submission_data?.url || '',
    },
  });

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: assignment.allowed_file_extensions
      ? Object.fromEntries(
          assignment.allowed_file_extensions.map(ext => [`application/${ext}`, [`.${ext}`]])
        )
      : undefined,
    onDrop: (acceptedFiles) => {
      setUploadedFiles([...uploadedFiles, ...acceptedFiles]);
    },
  });

  const handleSubmit = async (values: SubmissionFormValues) => {
    const submissionData: any = {
      type: values.submission_type,
    };

    switch (values.submission_type) {
      case 'text_entry':
        submissionData.text = values.text_content;
        break;
      case 'url':
        submissionData.url = values.url;
        break;
      case 'file_upload':
        // In a real implementation, you would upload files to storage first
        submissionData.file_urls = []; // Placeholder for uploaded file URLs
        break;
    }

    onSubmit(submissionData);
  };

  const isLate = assignment.due_date ? isPast(new Date(assignment.due_date)) : false;
  const canSubmit = submission?.attempt_number ? submission.attempt_number < assignment.max_attempts : true;

  const getStatusBadge = () => {
    if (!submission) return null;
    
    switch (submission.status) {
      case 'draft':
        return <Badge variant="secondary">Draft</Badge>;
      case 'submitted':
        return <Badge variant="default">Submitted</Badge>;
      case 'graded':
        return <Badge variant="success">Graded</Badge>;
      case 'returned':
        return <Badge variant="outline">Returned</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Assignment Details */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>{assignment.title}</CardTitle>
              <CardDescription className="mt-2">
                {assignment.description}
              </CardDescription>
            </div>
            {getStatusBadge()}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              <span>
                Due: {assignment.due_date 
                  ? new Date(assignment.due_date).toLocaleString()
                  : 'No due date'}
              </span>
              {isLate && <Badge variant="destructive">Late</Badge>}
            </div>
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span>Points: {assignment.points || 'Not graded'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>Attempts: {submission?.attempt_number || 0} / {assignment.max_attempts}</span>
            </div>
          </div>

          {assignment.instructions && (
            <div className="border rounded-lg p-4 bg-muted/50">
              <h4 className="font-semibold mb-2">Instructions</h4>
              <CourseHtml html={assignment.instructions} className="prose prose-sm max-w-none" />
            </div>
          )}

          {isLate && assignment.late_policy && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Late submission penalty: {assignment.late_policy.deduction_per_day}% per day
                (maximum {assignment.late_policy.maximum_deduction}%)
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Previous Submission */}
      {submission && submission.status !== 'draft' && (
        <Card>
          <CardHeader>
            <CardTitle>Previous Submission</CardTitle>
            <CardDescription>
              Submitted {formatDistanceToNow(new Date(submission.submitted_at!), { addSuffix: true })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {submission.grade !== null && (
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <span className="font-medium">Grade</span>
                <span className="text-2xl font-bold">
                  {submission.grade} / {assignment.points}
                </span>
              </div>
            )}
            
            {submission.feedback && (
              <div className="p-4 border rounded-lg bg-muted/50">
                <h4 className="font-semibold mb-2">Feedback</h4>
                <p className="text-sm">{submission.feedback}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Submission Form */}
      {canSubmit ? (
        <Card>
          <CardHeader>
            <CardTitle>Submit Assignment</CardTitle>
            <CardDescription>
              Choose your submission type and upload your work
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
                <Tabs 
                  value={form.watch('submission_type')} 
                  onValueChange={(value) => form.setValue('submission_type', value as any)}
                >
                  <TabsList className="grid grid-cols-4 w-full">
                    {assignment.submission_types.includes('file_upload') && (
                      <TabsTrigger value="file_upload">
                        <Upload className="h-4 w-4 mr-2" />
                        File Upload
                      </TabsTrigger>
                    )}
                    {assignment.submission_types.includes('text_entry') && (
                      <TabsTrigger value="text_entry">
                        <FileText className="h-4 w-4 mr-2" />
                        Text Entry
                      </TabsTrigger>
                    )}
                    {assignment.submission_types.includes('url') && (
                      <TabsTrigger value="url">
                        <Link className="h-4 w-4 mr-2" />
                        Website URL
                      </TabsTrigger>
                    )}
                    {assignment.submission_types.includes('media_recording') && (
                      // Media recording has no implementation yet — keep the
                      // option visible but disabled so it cannot be selected
                      // and dead-end.
                      <TabsTrigger
                        value="media_recording"
                        disabled
                        title="Media recording is not yet available"
                      >
                        <Mic className="h-4 w-4 mr-2" />
                        Media (unavailable)
                      </TabsTrigger>
                    )}
                  </TabsList>

                  <TabsContent value="file_upload" className="space-y-4">
                    <div
                      {...getRootProps()}
                      className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
                        ${isDragActive ? 'border-primary bg-primary/10' : 'border-border hover:border-primary'}`}
                    >
                      <input {...getInputProps()} />
                      <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        {isDragActive
                          ? 'Drop the files here...'
                          : 'Drag and drop files here, or click to select'}
                      </p>
                      {assignment.allowed_file_extensions && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Allowed types: {assignment.allowed_file_extensions.join(', ')}
                        </p>
                      )}
                    </div>

                    {uploadedFiles.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-medium">Uploaded Files</h4>
                        {uploadedFiles.map((file, index) => (
                          <div key={index} className="flex items-center justify-between p-2 border rounded">
                            <span className="text-sm">{file.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {(file.size / 1024 / 1024).toFixed(2)} MB
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {uploadProgress > 0 && uploadProgress < 100 && (
                      <Progress value={uploadProgress} className="w-full" />
                    )}
                  </TabsContent>

                  <TabsContent value="text_entry" className="space-y-4">
                    <FormField
                      control={form.control}
                      name="text_content"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Text Submission</FormLabel>
                          <FormControl>
                            <CanvasEditor
                              content={field.value || ''}
                              onChange={field.onChange}
                              placeholder="Enter your submission here..."
                            />
                          </FormControl>
                          <FormDescription>
                            Type or paste your submission directly
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </TabsContent>

                  <TabsContent value="url" className="space-y-4">
                    <FormField
                      control={form.control}
                      name="url"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Website URL</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="https://example.com" 
                              type="url"
                              {...field} 
                            />
                          </FormControl>
                          <FormDescription>
                            Enter the URL of your submission
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </TabsContent>

                  <TabsContent value="media_recording" className="space-y-4">
                    <Alert>
                      <Mic className="h-4 w-4" />
                      <AlertDescription>
                        Media recording is not yet available. Please use one of the other
                        submission types.
                      </AlertDescription>
                    </Alert>
                  </TabsContent>
                </Tabs>

                <div className="flex justify-end space-x-4">
                  <Button type="button" variant="outline">
                    Save Draft
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Clock className="h-4 w-4 mr-2 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Submit Assignment
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      ) : (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You have reached the maximum number of attempts for this assignment.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};