// ABOUTME: Instructor-only page for managing who teaches a course. A thin
// ABOUTME: wrapper that puts CourseInstructorsTab on a route, matching the
// ABOUTME: gradebook / materials / quiz-results pages beside it.
//
// WHY THIS FILE EXISTS
// CourseInstructorsTab has been in the repo, complete and working, with nothing
// importing it — so no route reached it and no user could manage instructors.
// The dead-file audit (scripts/audit/dead-file-inventory.mjs) reported it as
// unreferenced, which made it a deletion candidate.
//
// It was not deleted, because the capability check asked the question that
// matters: does this ability survive anywhere else? It does not. `course_instructors`
// is touched by no other component in src/ — only the generated Supabase types
// mention the table. Deleting the file would have removed the only implementation
// of a capability the schema still supports, and the repo has done that before:
// a previously-deleted file turned out to hold the only working delete-course
// action.
//
// So the fix for an orphaned capability is a link, not a delete.

import { useParams } from 'react-router-dom';
import { CourseLayout } from '@/components/course/CourseLayout';
import CourseInstructorsTab from '@/components/course/CourseInstructorsTab';
import { useCoursePermissions } from '@/hooks/useCoursePermissions';
import { Card, CardContent } from '@/components/ui/card';

const CourseInstructors = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const { canEdit, isInstructor, isAdmin, loading } = useCoursePermissions(courseId);
  const canManage = canEdit || isInstructor || isAdmin;

  if (!courseId) {
    return (
      <CourseLayout>
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No course selected.
          </CardContent>
        </Card>
      </CourseLayout>
    );
  }

  // Held until permissions resolve. Rendering the "not allowed" card first and
  // swapping it for the table a moment later would tell a legitimate instructor
  // they lack access, which is worse than a brief blank.
  if (loading) {
    return (
      <CourseLayout>
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Checking your access…
          </CardContent>
        </Card>
      </CourseLayout>
    );
  }

  if (!canManage) {
    return (
      <CourseLayout>
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Only this course's instructors can manage its teaching team.
          </CardContent>
        </Card>
      </CourseLayout>
    );
  }

  return (
    <CourseLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Instructors</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Who can teach and manage this course.
          </p>
        </div>
        <CourseInstructorsTab courseId={courseId} />
      </div>
    </CourseLayout>
  );
};

export default CourseInstructors;
