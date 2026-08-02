// ABOUTME: "New message" for a course — pick who in this course to open a thread with.
// ABOUTME: Replaces NewConversationDialog, which listed every account on the site.
//
// The old dialog searched the whole user directory and opened a thread with whoever you
// picked. That is not what this product's messages are: a message exists because of a
// course. So this offers exactly the people open_course_thread would accept — everyone
// in this course, students and teaching staff alike — and nobody outside it, so the UI
// and the database agree instead of the UI offering choices the database rejects.

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, MessageSquarePlus, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { createLogger } from '@/utils/logger';

const logger = createLogger('CourseThreadComposer');

export interface CourseContact {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  role: 'instructor' | 'student';
}

const displayName = (contact: CourseContact) =>
  `${contact.first_name ?? ''} ${contact.last_name ?? ''}`.trim() || 'Course member';

const initials = (contact: CourseContact) =>
  (`${contact.first_name?.charAt(0) ?? ''}${contact.last_name?.charAt(0) ?? ''}`.toUpperCase() || 'U');

/**
 * Everyone in `courseId` the signed-in user is allowed to open a thread with.
 *
 * One `course_contacts` RPC, not three table reads, and the difference is not tidiness.
 *
 * This used to assemble the list client-side from `courses` + `enrollments` +
 * `course_assignments`. It could never show a student their classmates, because
 * `enrollments` is RLS-restricted to `user_id = auth.uid()` OR staff — a student reading
 * it back gets exactly one row, their own. So `enrolledIds` collapsed to `[me]` and the
 * picker offered nothing but teaching staff, however many people were in the course, and
 * regardless of the profile-visibility widening in 20260802140000. Measured against
 * production: 1 enrollment visible, 0 assignments, 16 profiles.
 *
 * `course_contacts` (20260802160000) is SECURITY DEFINER and answers with the same
 * membership rule `open_course_thread` enforces, so the picker offers exactly who the RPC
 * would accept — no more, and no fewer. A caller who neither takes nor teaches the course
 * gets zero rows, which is why this still returns [] rather than throwing for them.
 *
 * `userId` is no longer read: the function derives the caller from `auth.uid()`, so the
 * client cannot ask on someone else's behalf. It stays in the signature because callers
 * pass it and removing it is a wider change than this fix.
 */
export async function fetchCourseContacts(
  courseId: string,
  _userId: string,
): Promise<CourseContact[]> {
  const { data, error } = await supabase.rpc('course_contacts', { p_course_id: courseId });

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id: row.id,
    first_name: row.first_name,
    last_name: row.last_name,
    avatar_url: row.avatar_url,
    role: row.role === 'instructor' ? ('instructor' as const) : ('student' as const),
  }));
}

interface CourseThreadComposerProps {
  courseId: string;
  /** Called with the thread id open_course_thread returned. */
  onThreadOpened: (conversationId: string) => void;
}

export function CourseThreadComposer({ courseId, onThreadOpened }: CourseThreadComposerProps) {
  const [open, setOpen] = useState(false);
  const [contacts, setContacts] = useState<CourseContact[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<CourseContact | null>(null);
  const [opening, setOpening] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!open || !user) return;

    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setSelected(null);
    setQuery('');

    fetchCourseContacts(courseId, user.id)
      .then((result) => {
        if (!cancelled) setContacts(result);
      })
      .catch((error: any) => {
        logger.error('Failed to load course contacts:', error);
        // Surfaced instead of swallowed: an empty picker and a failed load look identical,
        // and "nobody to message" is a very different thing from "we could not ask".
        if (!cancelled) setLoadError(error?.message ?? 'Could not load the people in this course.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, courseId, user]);

  const visible = contacts.filter((contact) =>
    displayName(contact).toLowerCase().includes(query.trim().toLowerCase()),
  );

  const handleOpenThread = async () => {
    if (!selected) return;
    setOpening(true);
    try {
      const { data, error } = await supabase.rpc('open_course_thread', {
        p_course_id: courseId,
        p_other_user_id: selected.id,
      });
      if (error) throw error;
      if (!data) throw new Error('Could not open thread');

      setOpen(false);
      onThreadOpened(data as string);
    } catch (error: any) {
      toast({
        title: 'Unable to start that conversation',
        description: error?.message ?? 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setOpening(false);
    }
  };

  return (
    <>
      <Button onClick={() => setOpen(true)} className="gap-2">
        <MessageSquarePlus className="h-4 w-4" />
        New message
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New message</DialogTitle>
            <DialogDescription>
              Choose anyone from this course — classmates or teaching staff. You can only message
              people you share a course with.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search this course"
                className="pl-8"
                aria-label="Search this course"
              />
            </div>

            <div className="max-h-64 overflow-y-auto space-y-1">
              {loading ? (
                <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading people in this course…
                </div>
              ) : loadError ? (
                <p className="p-4 text-sm text-destructive" role="alert">
                  {loadError}
                </p>
              ) : visible.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">
                  {contacts.length === 0
                    ? 'There is nobody in this course you can message yet.'
                    : 'Nobody in this course matches that search.'}
                </p>
              ) : (
                visible.map((contact) => (
                  <button
                    key={contact.id}
                    type="button"
                    onClick={() => setSelected(contact)}
                    className={`flex w-full items-center gap-3 rounded-md p-2 text-left transition-colors hover:bg-accent ${
                      selected?.id === contact.id ? 'bg-accent' : ''
                    }`}
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={contact.avatar_url ?? undefined} />
                      <AvatarFallback>{initials(contact)}</AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{displayName(contact)}</span>
                      <span className="block text-xs capitalize text-muted-foreground">{contact.role}</span>
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={opening}>
              Cancel
            </Button>
            <Button onClick={handleOpenThread} disabled={!selected || opening}>
              {opening && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Start conversation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default CourseThreadComposer;
