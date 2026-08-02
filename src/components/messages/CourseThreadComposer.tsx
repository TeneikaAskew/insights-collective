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
 * Mirrors open_course_thread: membership of the course is the whole rule, so everyone in
 * it can address everyone else in it. Returns [] rather than throwing when the caller is
 * not in the course — the RPC would refuse anyway, and an empty picker says so quietly.
 */
export async function fetchCourseContacts(
  courseId: string,
  userId: string,
): Promise<CourseContact[]> {
  const { data: course, error: courseError } = await supabase
    .from('courses')
    .select('id, instructor_id')
    .eq('id', courseId)
    .maybeSingle();

  if (courseError) throw courseError;
  if (!course) return [];

  const [{ data: enrollments, error: enrollmentError }, { data: assignments, error: assignmentError }] =
    await Promise.all([
      supabase.from('enrollments').select('user_id').eq('course_id', courseId),
      // A course can be taught by more than one person. `courses.instructor_id` is only
      // the primary; open_course_thread accepts anyone is_course_instructor() accepts,
      // which is that column OR a course_assignments row with role 'instructor'. Reading
      // only the column meant an assigned co-instructor was treated as a stranger to
      // their own course and got an empty picker, while students were never offered them.
      supabase
        .from('course_assignments')
        .select('user_id')
        .eq('course_id', courseId)
        .eq('role', 'instructor'),
    ]);

  if (enrollmentError) throw enrollmentError;
  if (assignmentError) throw assignmentError;

  const enrolledIds: string[] = (enrollments ?? []).map((row: any) => row.user_id);
  const instructorIds: string[] = [
    ...new Set(
      [course.instructor_id, ...(assignments ?? []).map((row: any) => row.user_id)].filter(
        Boolean,
      ) as string[],
    ),
  ];

  const isInstructor = instructorIds.includes(userId);
  const isEnrolled = enrolledIds.includes(userId);

  if (!isInstructor && !isEnrolled) return [];

  // Everyone in the course, minus yourself. Students used to be offered only the
  // teaching staff, mirroring an open_course_thread that refused student-to-student
  // threads; that rule was dropped (20260802020300) so classmates can talk, and this
  // has to match or the picker hides people the database would happily accept.
  const contactIds = [
    ...new Set([...enrolledIds, ...instructorIds].filter((id) => id !== userId)),
  ];

  if (contactIds.length === 0) return [];

  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, avatar_url')
    .in('id', contactIds);

  if (profileError) throw profileError;

  return (profiles ?? []).map((profile: any) => ({
    ...profile,
    role: instructorIds.includes(profile.id) ? ('instructor' as const) : ('student' as const),
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
