
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  // When provided, the "View" action opens the submission in place (e.g. inside
  // the form detail drawer) instead of navigating to the drill-down page. The
  // default navigation behavior is preserved when this is omitted.
  onSelectSubmission?: (submissionId: string) => void;
}

export default function FormSubmissionsList({ formId, formSlug, onSelectSubmission }: FormSubmissionsListProps) {
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalSubmissions, setTotalSubmissions] = useState(0);
  const [pageSize] = useState(10);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Debounce the search term so we hit the server once the user pauses, not on
  // every keystroke. Reset to page 1 whenever the effective query changes.
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  useEffect(() => {
    fetchSubmissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formId, currentPage, debouncedSearch]);

  const fetchSubmissions = async () => {
    setLoading(true);
    try {
      // Server-side search + pagination via RPC. Searching in the DB (over the
      // whole submission JSON and submitter name) means results are no longer
      // limited to the current page, unlike the previous client-side filter.
      const { data, error } = await supabase.rpc('search_form_submissions', {
        p_form_id: formId,
        p_search: debouncedSearch,
        p_limit: pageSize,
        p_offset: (currentPage - 1) * pageSize,
      });

      if (error) throw error;

      const rows = (data || []) as any[];
      const totalCount = rows.length > 0 ? Number(rows[0].total_count) : 0;
      setTotalSubmissions(totalCount);
      setTotalPages(Math.max(1, Math.ceil(totalCount / pageSize)));

      setSubmissions(
        rows.map((r: any) => ({
          id: r.id,
          form_id: r.form_id,
          user_id: r.user_id,
          submission_data: r.submission_data,
          created_at: r.created_at,
          profiles:
            r.first_name || r.last_name
              ? { first_name: r.first_name, last_name: r.last_name }
              : null,
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
  };

  // Extract user name or ID from submission
  const getUserInfo = (submission: any) => {
    if (submission.profiles && (submission.profiles.first_name || submission.profiles.last_name)) {
      return `${submission.profiles.first_name || ''} ${submission.profiles.last_name || ''}`.trim();
    }
    return submission.user_id ? submission.user_id.substring(0, 8) + '...' : 'Anonymous';
  };

  // Search + pagination are handled server-side; render the page rows directly.
  const filteredSubmissions = submissions;

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
                {debouncedSearch
                  ? "No submissions match your search criteria."
                  : "No one has submitted this form yet."}
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
                          if (onSelectSubmission) {
                            onSelectSubmission(submission.id);
                          } else {
                            navigate(`/admin/unified-form-management/submissions/${formSlug}/submission/${submission.id}`);
                          }
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
