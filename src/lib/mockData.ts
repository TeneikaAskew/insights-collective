// This file previously contained mock data but has been migrated to use real Supabase data
// All course data now comes from the Supabase database via the useCoursesManagement hook

// Only keep the mock service for any remaining legacy components
import { mockService } from './mock';

export { 
  mockService
};

// Note: All course management now uses real data from:
// - useCoursesManagement hook for course CRUD operations
// - useCourseEnrollments hook for enrollment data
// - useCoursePermissions hook for role-based access control
// - Database tables: courses, enrollments, course_assignments, course_instructors
