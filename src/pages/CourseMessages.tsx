// ABOUTME: /courses/:courseId/messages — the messages for one course, sitting in the
// ABOUTME: course sidebar next to that course's Calendar.
//
// The open thread lives in ?conversation= rather than a path segment so the course
// sidebar's "Messages" entry stays the active route while a thread is open, and so a
// linked thread survives a reload.

import { useParams, useSearchParams } from 'react-router-dom';
import { CourseLayout } from '@/components/course/CourseLayout';
import { MessagesPanel } from '@/components/messages/MessagesPanel';
import { CourseThreadComposer } from '@/components/messages/CourseThreadComposer';
import { useCourseData } from '@/hooks/useCourseData';
import { usePageVisibility } from '@/contexts/PageVisibilityContext';
import ComingSoon from '@/pages/ComingSoon';

export default function CourseMessages() {
  const { courseId } = useParams<{ courseId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { course } = useCourseData(courseId);

  // Enforced here as well as in VisibilityGate, because the gate cannot see it:
  // resolveGoverningPaths('/courses/<id>/messages') returns ['/courses'], so this
  // route was governed by the Courses toggle and switching Messages off left the
  // whole messaging UI reachable from inside a course. Same predicate the
  // Dashboard tab and the course rail use, so the three agree.
  const { isPageVisible, isReady } = usePageVisibility();

  const conversationId = searchParams.get('conversation') ?? undefined;

  const selectConversation = (nextId?: string) => {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (nextId) {
          next.set('conversation', nextId);
        } else {
          next.delete('conversation');
        }
        return next;
      },
      // Opening and closing threads should not stack up in the back-stack; Back leaves
      // the page rather than walking every thread the user looked at.
      { replace: true },
    );
  };

  // Fail closed while the setting loads, exactly as VisibilityGate does — a page
  // that renders first and hides itself a moment later has already run its queries.
  if (!isReady) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!isPageVisible('/messages')) {
    return <ComingSoon />;
  }

  return (
    <CourseLayout>
      <div className="container mx-auto py-6 space-y-6 px-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Messages</h1>
          <p className="text-sm text-muted-foreground">
            {course?.title
              ? `Your conversations about ${course.title}.`
              : 'Your conversations about this course.'}
          </p>
        </div>

        {courseId && (
          <MessagesPanel
            courseId={courseId}
            conversationId={conversationId}
            onSelectConversation={selectConversation}
            actions={
              <CourseThreadComposer courseId={courseId} onThreadOpened={selectConversation} />
            }
          />
        )}
      </div>
    </CourseLayout>
  );
}
