
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormData, FormSection, FormField, FormSubmission } from '@/types/forms';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { User, Calendar, Clock, CheckCircle, AlertCircle, Circle } from 'lucide-react';
import { format } from 'date-fns';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';

import { createLogger } from '@/utils/logger';

const logger = createLogger('FormSubmissionDetail');

interface FormSubmissionDetailProps {
  formId: string;
  submissionId: string;
  form: FormData;
}

export default function FormSubmissionDetail({ formId, submissionId, form }: FormSubmissionDetailProps) {
  const [submission, setSubmission] = useState<FormSubmission | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [userInfo, setUserInfo] = useState<{ name: string; email: string } | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchSubmission();
  }, [formId, submissionId]);
  
  const fetchSubmission = async () => {
    try {
      setLoading(true);
      setError(null);

      // form_submissions has no FK to profiles and profiles has no email
      // column — the previous embedded select failed with PGRST200 on every
      // load. Fetch the submission, then resolve the profile separately.
      const { data, error } = await supabase
        .from('form_submissions')
        .select('*')
        .eq('id', submissionId)
        .eq('form_id', formId)
        .single();

      if (error) throw error;

      setSubmission(data as unknown as FormSubmission);

      if (data?.user_id) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('id', data.user_id)
          .maybeSingle();
        if (profileError) throw profileError;
        if (profile) {
          setUserInfo({
            name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim(),
            // Email lives in auth.users and is not readable from the client.
            email: ''
          });
        }
      }
    } catch (error) {
      logger.error('Error fetching submission details:', error);
      setError('Failed to load submission details');
      toast({
        title: "Error",
        description: "Failed to load submission details",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-1/3" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !submission) {
    return (
      <Alert variant="destructive" className="mb-4">
        <AlertDescription>
          {error || 'Submission not found'}
        </AlertDescription>
      </Alert>
    );
  }

  // Format the submission data for display
  const renderSubmissionValue = (field: FormField, value: any) => {
    if (value === undefined || value === null) {
      return <span className="text-muted-foreground italic">Not answered</span>;
    }

    switch (field.type) {
      case 'checkbox':
        return value === true ? 'Yes' : 'No';
      case 'radio':
      case 'dropdown':
        return value;
      case 'multi_select':
        return Array.isArray(value) ? value.join(', ') : value;
      case 'date':
      case 'date_picker':
        try {
          return format(new Date(value), 'MMM d, yyyy');
        } catch (e) {
          return value;
        }
      case 'file_upload':
        return Array.isArray(value) ? (
          <ul className="list-disc pl-5">
            {value.map((file, idx) => (
              <li key={idx}>
                <a 
                  href={file.url} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="text-primary hover:underline"
                >
                  {file.name}
                </a>
              </li>
            ))}
          </ul>
        ) : value;
      default:
        return value;
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Submission Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start gap-2">
                <User className="h-4 w-4 mt-1 text-muted-foreground" />
                <div>
                  <div className="font-medium">Submitted By</div>
                  <div className="text-sm text-muted-foreground">
                    {userInfo && (userInfo.name || userInfo.email) ? (
                      <>
                        {userInfo.name && <div>{userInfo.name}</div>}
                        {userInfo.email && <div>{userInfo.email}</div>}
                      </>
                    ) : (
                      submission.user_id ? `User ID: ${submission.user_id.substring(0, 8)}...` : 'Anonymous'
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Calendar className="h-4 w-4 mt-1 text-muted-foreground" />
                <div>
                  <div className="font-medium">Date Submitted</div>
                  <div className="text-sm text-muted-foreground">
                    {format(new Date(submission.created_at), 'MMMM d, yyyy')}
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Clock className="h-4 w-4 mt-1 text-muted-foreground" />
                <div>
                  <div className="font-medium">Time Submitted</div>
                  <div className="text-sm text-muted-foreground">
                    {format(new Date(submission.created_at), 'h:mm a')}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Submission Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {form.form_structure?.sections && (
                <div>
                  <div className="mb-2 font-medium">Section Completion</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {form.form_structure.sections.map((section) => {
                      const completedFields = section.fields.filter(field => {
                        const value = submission.submission_data[field.id];
                        return value !== undefined && value !== null && value !== '';
                      }).length;
                      const totalFields = section.fields.length;
                      const isComplete = completedFields === totalFields;
                      
                      return (
                        <div 
                          key={section.id} 
                          className="flex items-center justify-between p-3 rounded-md border"
                        >
                          <div className="flex items-center gap-2">
                            {isComplete ? (
                              <CheckCircle className="h-4 w-4 text-ss-good" />
                            ) : completedFields > 0 ? (
                              <AlertCircle className="h-4 w-4 text-ss-warn" />
                            ) : (
                              <Circle className="h-4 w-4 text-muted-foreground" />
                            )}
                            <span className="text-sm font-medium">
                              {section.title}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {completedFields}/{totalFields} fields
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      
      {form.form_structure?.sections && form.form_structure.sections.map((section) => (
        <Card key={section.id} className="overflow-hidden">
          <CardHeader className="bg-muted/50">
            <CardTitle className="text-lg">{section.title}</CardTitle>
            {section.description && (
              <p className="text-sm text-muted-foreground">{section.description}</p>
            )}
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-1/3">Question</TableHead>
                  <TableHead>Answer</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {section.fields.map((field) => (
                  <TableRow key={field.id}>
                    <TableCell className="align-top">
                      <div className="font-medium">{field.label}</div>
                      {field.required && (
                        <Badge variant="outline" className="text-xs mt-1">Required</Badge>
                      )}
                    </TableCell>
                    <TableCell className="align-top">
                      {renderSubmissionValue(field, submission.submission_data[field.id])}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
