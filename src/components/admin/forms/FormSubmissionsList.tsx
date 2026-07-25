
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Badge } from '@/components/ui/badge';
import { Eye, FileText, Search, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

import { createLogger } from '@/utils/logger';

const logger = createLogger('FormSubmissionsList');

interface FormSubmissionsListProps {
  formId: string;
  formSlug: string;
}

export default function FormSubmissionsList({ formId, formSlug }: FormSubmissionsListProps) {
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalSubmissions, setTotalSubmissions] = useState(0);
  const [pageSize] = useState(10);
  const { toast } = useToast();

  useEffect(() => {
    fetchSubmissions();
  }, [formId, currentPage]);

  const fetchSubmissions = async () => {
    setLoading(true);
    try {
      // Get count first
      const { count, error: countError } = await supabase
        .from('form_submissions')
        .select('*', { count: 'exact', head: true })
        .eq('form_id', formId);
      
      if (countError) throw countError;
      
      const totalCount = count || 0;
      setTotalSubmissions(totalCount);
      setTotalPages(Math.ceil(totalCount / pageSize));

      // Fetch submissions with pagination. NOTE: form_submissions has no FK
      // to profiles (and profiles has no email column), so the previous
      // embedded select failed with PGRST200 on every load and the page
      // always claimed "No one has submitted this form yet". Profiles are
      // resolved with a separate query instead.
      const { data, error } = await supabase
        .from('form_submissions')
        .select('*')
        .eq('form_id', formId)
        .order('created_at', { ascending: false })
        .range((currentPage - 1) * pageSize, currentPage * pageSize - 1);

      if (error) throw error;

      const rows = data || [];
      const userIds = Array.from(new Set(rows.map((r: any) => r.user_id).filter(Boolean)));
      const profilesById = new Map<string, any>();
      if (userIds.length > 0) {
        const { data: profileRows, error: profilesError } = await supabase
          .from('profiles')
          .select('id, first_name, last_name')
          .in('id', userIds);
        if (profilesError) throw profilesError;
        (profileRows || []).forEach((p: any) => profilesById.set(p.id, p));
      }

      setSubmissions(
        rows.map((r: any) => ({
          ...r,
          profiles: r.user_id ? profilesById.get(r.user_id) ?? null : null,
        }))
      );
    } catch (error) {
      logger.error('Error fetching submissions:', error);
      toast({
        title: "Error",
        description: "Failed to load form submissions",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  // Extract user name or ID from submission
  const getUserInfo = (submission: any) => {
    if (submission.profiles) {
      if (submission.profiles.first_name || submission.profiles.last_name) {
        return `${submission.profiles.first_name || ''} ${submission.profiles.last_name || ''}`.trim();
      }
      if (submission.profiles.email && submission.profiles.email.email) {
        return submission.profiles.email.email;
      }
    }
    return submission.user_id ? submission.user_id.substring(0, 8) + '...' : 'Anonymous';
  };

  // Filter submissions based on search term
  const filteredSubmissions = searchTerm 
    ? submissions.filter(sub => {
        const userInfo = getUserInfo(sub).toLowerCase();
        const submissionData = JSON.stringify(sub.submission_data).toLowerCase();
        return userInfo.includes(searchTerm.toLowerCase()) || 
               submissionData.includes(searchTerm.toLowerCase());
      })
    : submissions;

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-10 w-1/3" />
          <Skeleton className="h-10 w-1/4" />
        </div>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead><Skeleton className="h-4 w-20" /></TableHead>
                  <TableHead><Skeleton className="h-4 w-40" /></TableHead>
                  <TableHead><Skeleton className="h-4 w-32" /></TableHead>
                  <TableHead><Skeleton className="h-4 w-24" /></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="text-sm text-muted-foreground">
          {totalSubmissions === 0 ? (
            <span>No responses yet</span>
          ) : (
            <span>Showing {submissions.length} of {totalSubmissions} total responses</span>
          )}
        </div>
        <div className="relative w-full sm:w-auto">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search responses..."
            className="pl-10 w-full sm:w-[250px]"
            value={searchTerm}
            onChange={handleSearch}
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {filteredSubmissions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No submissions found</h3>
              <p className="text-muted-foreground mt-2">
                {totalSubmissions === 0
                  ? "No one has submitted this form yet."
                  : "No submissions match your search criteria."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Submitted By</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSubmissions.map((submission) => (
                  <TableRow key={submission.id}>
                    <TableCell className="font-mono text-sm">
                      {submission.id.substring(0, 8)}...
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span>{getUserInfo(submission)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {format(new Date(submission.created_at), 'MMM d, yyyy, h:mm a')}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          window.location.href = `/admin/unified-form-management/submissions/${formSlug}/submission/${submission.id}`;
                        }}
                        className="flex items-center gap-1"
                      >
                        <Eye className="h-4 w-4" />
                        <span>View</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      
      {totalPages > 1 && (
        <Pagination className="mt-4">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious 
                onClick={() => setCurrentPage(curr => Math.max(1, curr - 1))}
                className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
              />
            </PaginationItem>
            <PaginationItem>
              <span className="px-4">
                Page {currentPage} of {totalPages}
              </span>
            </PaginationItem>
            <PaginationItem>
              <PaginationNext 
                onClick={() => setCurrentPage(curr => Math.min(totalPages, curr + 1))}
                className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}
