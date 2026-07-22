// ABOUTME: Floating in-app feedback & report-a-problem trigger for every course screen.
// ABOUTME: Renders a fixed pill button on any /courses* route and opens a dialog to submit feedback.

import React, { useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { MessageSquareWarning, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

type Category = 'feedback' | 'bug' | 'question';

const CourseFeedbackButton: React.FC = () => {
  const location = useLocation();
  const params = useParams();
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<Category>('feedback');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onCoursePage = location.pathname.startsWith('/courses');
  if (!onCoursePage || !isAuthenticated) return null;

  const courseId = (params.courseId as string | undefined) ?? extractCourseId(location.pathname);

  const handleSubmit = async () => {
    if (!user || !message.trim()) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('course_feedback').insert({
        user_id: user.id,
        course_id: courseId ?? null,
        path: location.pathname,
        category,
        message: message.trim(),
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      });
      if (error) throw error;
      toast({
        title: 'Thanks for the feedback',
        description: 'Your report has been sent to the team.',
      });
      setMessage('');
      setCategory('feedback');
      setOpen(false);
    } catch (err: any) {
      toast({
        title: 'Could not send feedback',
        description: err?.message ?? 'Please try again in a moment.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 shadow-lg rounded-full h-11 pl-4 pr-5 gap-2"
        data-testid="course-feedback-trigger"
      >
        <MessageSquareWarning className="h-4 w-4" />
        <span className="hidden sm:inline">Feedback</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send feedback or report a problem</DialogTitle>
            <DialogDescription>
              Tell us what's happening on this screen. Your report is tagged with this page automatically.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="mb-2 block">Type</Label>
              <RadioGroup
                value={category}
                onValueChange={(v) => setCategory(v as Category)}
                className="grid grid-cols-3 gap-2"
              >
                {(['feedback', 'bug', 'question'] as Category[]).map((c) => (
                  <label
                    key={c}
                    className="flex items-center gap-2 rounded-md border p-2 cursor-pointer hover:bg-accent"
                  >
                    <RadioGroupItem value={c} />
                    <span className="text-sm capitalize">
                      {c === 'bug' ? 'Report a problem' : c}
                    </span>
                  </label>
                ))}
              </RadioGroup>
            </div>

            <div>
              <Label htmlFor="course-feedback-message" className="mb-2 block">
                What would you like us to know?
              </Label>
              <Textarea
                id="course-feedback-message"
                data-testid="course-feedback-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Describe the issue, suggestion, or question…"
                rows={5}
                maxLength={2000}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Page: <code className="font-mono">{location.pathname}</code>
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting || message.trim().length < 3}
              data-testid="course-feedback-submit"
            >
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

function extractCourseId(pathname: string): string | undefined {
  const match = pathname.match(/^\/courses\/([^/]+)/);
  const value = match?.[1];
  if (!value || value === 'new') return undefined;
  // Only accept UUID-ish strings so /courses (list) and other slugs don't get set.
  return /^[0-9a-f-]{8,}$/i.test(value) ? value : undefined;
}

export default CourseFeedbackButton;
