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

export default function CourseMessages() {
  const { courseId } = useParams<{ courseId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { course } = useCourseData(courseId);

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
