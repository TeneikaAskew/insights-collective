
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Pencil, Eye, Trash2, FileText, Star, ArrowUpRight, X } from 'lucide-react';
import { Hint } from '@/components/ui/hint';
import { FormData } from '@/types/forms';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { createFellowshipForm } from '@/components/forms/builder';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { useAuthenticatedNavigation } from '@/hooks/useAuthenticatedNavigation';
import { useAuth } from '@/contexts/AuthContext';
import { useFormSubmissionCounts } from '@/hooks/useFormSubmissionCounts';
import FormSubmissionsList from '@/components/admin/forms/FormSubmissionsList';
import FormSubmissionDetail from '@/components/admin/forms/FormSubmissionDetail';

import { createLogger } from '@/utils/logger';

const logger = createLogger('FormList');

interface FormListProps {
  searchTerm: string;
}

export function FormList({ searchTerm }: FormListProps) {
  const [forms, setForms] = useState<FormData[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [formToDelete, setFormToDelete] = useState<FormData | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedForm, setSelectedForm] = useState<FormData | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { navigateWithAuth } = useAuthenticatedNavigation();
  const { isAdmin } = useAuth();
  const { countsByForm, loading: countsLoading, error: countsError } = useFormSubmissionCounts();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await fetchForms();
      if (cancelled) return;
      // Self-heal the built-in fellowship form only when it is genuinely
      // missing — the common path performs zero writes.
      if (!list.some(form => form.slug === 'ai-fellowship')) {
        await ensureFellowshipForm();
        if (!cancelled) await fetchForms();
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Pure read: load forms and update state. Never writes.
  const fetchForms = async (): Promise<FormData[]> => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('forms')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;

      const formsList = (data || []) as unknown as FormData[];
      setForms(formsList);
      return formsList;
    } catch (error) {
      logger.error('Error fetching forms:', error);
      toast({
        title: "Error",
        description: "Failed to load forms",
        variant: "destructive"
      });
      // A failed load must not fabricate a phantom form row; leave the list
      // empty — the destructive toast above reports the failure.
      setForms([]);
      return [];
    } finally {
      setLoading(false);
    }
  };

  // Idempotent, race-safe seeding of the built-in fellowship form. forms.slug
  // is UNIQUE, so ignoreDuplicates turns concurrent seeds into a no-op instead
  // of a duplicate row or a unique-violation error. Kept out of fetchForms so
  // the list read has no side effects.
  const ensureFellowshipForm = async () => {
    try {
      const { error } = await supabase
        .from('forms')
        .upsert(createFellowshipForm(), { onConflict: 'slug', ignoreDuplicates: true });
      if (error) {
        logger.error('Error ensuring fellowship form:', error);
      }
    } catch (err) {
      logger.error('Exception ensuring fellowship form:', err);
    }
  };

  const handleDeleteForm = async () => {
    if (!formToDelete) return;

    // Don't allow deleting the fellowship form
    if (formToDelete.slug === 'ai-fellowship') {
      toast({
        title: "Cannot Delete",
        description: "The AI & Automation Skills Fellowship form cannot be deleted.",
        variant: "destructive"
      });
      setDeleteDialogOpen(false);
      setFormToDelete(null);
      return;
    }

    setDeleting(true);
    try {
      const { error } = await supabase
        .from('forms')
        .delete()
        .eq('id', formToDelete.id);

      if (error) throw error;

      // Update the forms list
      setForms(forms.filter(form => form.id !== formToDelete.id));
      // Close the detail drawer if it was showing the just-deleted form.
      setSelectedForm(cur => (cur?.id === formToDelete.id ? null : cur));
      toast({
        title: "Success",
        description: "Form deleted successfully"
      });
    } catch (error) {
      logger.error('Error deleting form:', error);
      toast({
        title: "Error",
        description: "Failed to delete form",
        variant: "destructive"
      });
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setFormToDelete(null);
    }
  };

  const confirmDelete = (form: FormData) => {
    setFormToDelete(form);
    setDeleteDialogOpen(true);
  };

  const toggleFeatured = async (form: FormData) => {
    try {
      const { error } = await supabase
        .from('forms')
        .update({ featured: !form.featured })
        .eq('id', form.id);

      if (error) throw error;

      // Update the forms list
      setForms(forms.map(f =>
        f.id === form.id ? { ...f, featured: !f.featured } : f
      ));
      // Keep the open drawer in sync with the toggled value.
      setSelectedForm(cur => (cur?.id === form.id ? { ...cur, featured: !cur.featured } : cur));

      toast({
        title: "Success",
        description: form.featured ? "Form unfeatured successfully" : "Form featured successfully"
      });
    } catch (error) {
      logger.error('Error toggling featured status:', error);
      toast({
        title: "Error",
        description: "Failed to update featured status",
        variant: "destructive"
      });
    }
  };

  const handleEditForm = (form: FormData) => {
    const editUrl = `/survey/${form.slug}/edit`;

    // If we're already authenticated as admin, use normal navigation
    if (isAdmin) {
      navigate(editUrl);
    } else {
      // Otherwise use authenticated navigation to preserve the redirect path
      navigateWithAuth(editUrl, {
        requireAuth: true,
        message: "You need to be logged in as an admin to edit forms",
        title: "Authentication Required"
      });
    }
  };

  const filteredForms = forms.filter(form =>
    form.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (form.description && form.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const submissionCount = (form: FormData): number | null =>
    countsLoading || countsError ? null : (countsByForm[form.id] ?? 0);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  // `loading` is already handled by the early return above, so it is
  // necessarily false here.
  if (filteredForms.length === 0) {
    return (
      <Card className="border-dashed rounded-3xl">
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center text-center">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No forms found</h3>
            <p className="text-muted-foreground mt-2">
              {searchTerm ? "No forms match your search criteria." : "Create your first form to get started."}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="rounded-3xl border border-border bg-card overflow-hidden shadow-[var(--ss-shadow)]">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-left">Form Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Submissions</TableHead>
                <TableHead>Last Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredForms.map((form) => {
                const count = submissionCount(form);
                return (
                  <TableRow
                    key={form.id}
                    className={cn('cursor-pointer', selectedForm?.id === form.id && 'bg-ss-lav-chip')}
                    onClick={() => setSelectedForm(form)}
                  >
                    <TableCell className="text-left">
                      <div className="flex items-center gap-3">
                        <span className="h-10 w-10 rounded-lg bg-ss-lav-chip text-ss-lav-deep flex items-center justify-center shrink-0">
                          <FileText className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                          <div className="font-semibold text-left flex items-center gap-2">
                            {form.title}
                            {form.featured && (
                              <Badge className="border-transparent bg-ss-warn-chip text-ss-warn gap-1">
                                <Star className="h-3 w-3 fill-current" /> Featured
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground text-left">{form.slug}</div>
                          {form.description && (
                            <div className="text-sm text-muted-foreground line-clamp-1 text-left">{form.description}</div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {form.status ? (
                        <Badge className="border-transparent bg-ss-good-chip text-ss-good">Active</Badge>
                      ) : (
                        <Badge className="border-transparent bg-ss-track text-muted-foreground">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {count === null ? <span className="text-muted-foreground">—</span> : count}
                    </TableCell>
                    <TableCell>
                      {form.updated_at ? format(new Date(form.updated_at), 'MMM d, yyyy') : 'N/A'}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Hint label={form.featured ? 'Unfeature' : 'Feature'}>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => toggleFeatured(form)}
                            className={cn('h-8 w-8 rounded-lg', form.featured && 'text-ss-warn')}
                          >
                            <Star className={cn('h-4 w-4', form.featured && 'fill-current')} />
                            <span className="sr-only">{form.featured ? 'Unfeature' : 'Feature'}</span>
                          </Button>
                        </Hint>
                        <Hint label="Edit">
                          <Button variant="ghost" size="icon" onClick={() => handleEditForm(form)} className="h-8 w-8 rounded-lg">
                            <Pencil className="h-4 w-4" />
                            <span className="sr-only">Edit</span>
                          </Button>
                        </Hint>
                        <Hint label="Preview">
                          <Button variant="ghost" size="icon" onClick={() => navigate(`/survey/${form.slug}`)} className="h-8 w-8 rounded-lg">
                            <Eye className="h-4 w-4" />
                            <span className="sr-only">Preview</span>
                          </Button>
                        </Hint>
                        <Hint label="Delete">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => confirmDelete(form)}
                            disabled={form.slug === 'ai-fellowship'}
                            className="h-8 w-8 rounded-lg text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Delete</span>
                          </Button>
                        </Hint>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Detail drawer — hooks live in the child so they only run when open */}
      <Sheet open={!!selectedForm} onOpenChange={(open) => { if (!open) setSelectedForm(null); }}>
        <SheetContent className="bg-background w-full sm:max-w-2xl overflow-y-auto">
          {selectedForm && (
            <FormDetailDrawer
              form={selectedForm}
              submissionCount={submissionCount(selectedForm)}
              onEdit={() => handleEditForm(selectedForm)}
              onPreview={() => navigate(`/survey/${selectedForm.slug}`)}
              onToggleFeature={() => toggleFeatured(selectedForm)}
              onDelete={() => confirmDelete(selectedForm)}
              onOpenFullPage={() => navigate(`/admin/forms/submissions/${selectedForm.slug}`)}
            />
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Form</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this form? This action cannot be undone, and all associated submissions will be deleted.
            </DialogDescription>
          </DialogHeader>

          {formToDelete && (
            <Alert variant="destructive" className="mt-4">
              <AlertDescription>
                You are about to delete "{formToDelete.title}".
              </AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteForm}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Detail drawer for a single form — Overview / Submissions / Settings. Reuses
// FormSubmissionsList and FormSubmissionDetail so the drawer never diverges
// from the standalone drill-down page (which remains as a deep-link target).
type DrawerSub = 'overview' | 'submissions' | 'settings';

function FormDetailDrawer({
  form,
  submissionCount,
  onEdit,
  onPreview,
  onToggleFeature,
  onDelete,
  onOpenFullPage,
}: {
  form: FormData;
  submissionCount: number | null;
  onEdit: () => void;
  onPreview: () => void;
  onToggleFeature: () => void;
  onDelete: () => void;
  onOpenFullPage: () => void;
}) {
  const [sub, setSub] = useState<DrawerSub>('overview');
  const [detailId, setDetailId] = useState<string | null>(null);

  const subTab = (key: DrawerSub, label: string) => (
    <button
      onClick={() => { setSub(key); setDetailId(null); }}
      className={cn(
        'px-3 py-1.5 text-sm font-medium rounded-lg',
        sub === key ? 'bg-ss-lav-chip text-ss-lav-deep' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {label}
    </button>
  );

  return (
    <>
      <SheetHeader className="text-left">
        <SheetTitle className="text-xl flex items-center gap-2">
          {form.title}
          {form.featured && (
            <Badge className="border-transparent bg-ss-warn-chip text-ss-warn gap-1">
              <Star className="h-3 w-3 fill-current" /> Featured
            </Badge>
          )}
        </SheetTitle>
        <SheetDescription>
          {form.slug} · {form.status ? 'Active' : 'Inactive'}
        </SheetDescription>
      </SheetHeader>

      <div className="flex gap-1 mt-4 mb-4 border-b border-border pb-2">
        {subTab('overview', 'Overview')}
        {subTab('submissions', 'Submissions')}
        {subTab('settings', 'Settings')}
      </div>

      {sub === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-border bg-card p-3">
              <div className="text-xl font-bold tabular-nums">{submissionCount === null ? '—' : submissionCount}</div>
              <div className="text-xs text-muted-foreground">Responses</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-3">
              <div className="text-sm font-bold">{form.status ? 'Active' : 'Inactive'}</div>
              <div className="text-xs text-muted-foreground">Status</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-3">
              <div className="text-sm font-bold">{form.updated_at ? format(new Date(form.updated_at), 'MMM d, yyyy') : 'N/A'}</div>
              <div className="text-xs text-muted-foreground">Last updated</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="rounded-xl bg-card" onClick={onEdit}>
              <Pencil className="h-4 w-4 mr-2" /> Edit
            </Button>
            <Button variant="outline" size="sm" className="rounded-xl bg-card" onClick={onPreview}>
              <Eye className="h-4 w-4 mr-2" /> Preview
            </Button>
            <Button variant="outline" size="sm" className="rounded-xl bg-card" onClick={() => setSub('submissions')}>
              View all responses
            </Button>
          </div>
          {form.description && (
            <div>
              <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground font-semibold mb-1">Description</p>
              <p className="text-sm">{form.description}</p>
            </div>
          )}
        </div>
      )}

      {sub === 'submissions' && (
        detailId ? (
          <div>
            <Button variant="ghost" size="sm" className="mb-3" onClick={() => setDetailId(null)}>
              <X className="h-4 w-4 mr-2" /> Back to all responses
            </Button>
            <FormSubmissionDetail formId={form.id} submissionId={detailId} form={form} />
          </div>
        ) : (
          <FormSubmissionsList formId={form.id} formSlug={form.slug} onSelectSubmission={setDetailId} />
        )
      )}

      {sub === 'settings' && (
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-3 py-3 border-b border-border">
            <div>
              <div className="text-sm font-semibold">Featured</div>
              <div className="text-xs text-muted-foreground">Highlight this form across the site</div>
            </div>
            <Button variant="outline" size="sm" className={cn('rounded-xl bg-card', form.featured && 'text-ss-warn')} onClick={onToggleFeature}>
              <Star className={cn('h-4 w-4 mr-2', form.featured && 'fill-current')} />
              {form.featured ? 'Unfeature' : 'Feature'}
            </Button>
          </div>
          <div className="flex items-center justify-between gap-3 py-3 border-b border-border">
            <div>
              <div className="text-sm font-semibold">Edit form</div>
              <div className="text-xs text-muted-foreground">Open the form builder</div>
            </div>
            <Button variant="outline" size="sm" className="rounded-xl bg-card" onClick={onEdit}>
              <Pencil className="h-4 w-4 mr-2" /> Edit
            </Button>
          </div>
          <div className="flex items-center justify-between gap-3 py-3 border-b border-border">
            <div>
              <div className="text-sm font-semibold">Full submissions page</div>
              <div className="text-xs text-muted-foreground">Open the standalone responses view</div>
            </div>
            <Button variant="outline" size="sm" className="rounded-xl bg-card" onClick={onOpenFullPage}>
              <ArrowUpRight className="h-4 w-4 mr-2" /> Open
            </Button>
          </div>
          <div className="flex items-center justify-between gap-3 py-3">
            <div>
              <div className="text-sm font-semibold text-destructive">Delete form</div>
              <div className="text-xs text-muted-foreground">
                {form.slug === 'ai-fellowship'
                  ? 'The AI & Automation Skills Fellowship form cannot be deleted'
                  : 'Permanently deletes the form and all submissions'}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl bg-card text-destructive hover:text-destructive"
              disabled={form.slug === 'ai-fellowship'}
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4 mr-2" /> Delete
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
