
export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  first_name?: string;
  last_name?: string;
  enrolledCourses?: string[];
  avatar?: string;
  bio?: string;
  createdCourses?: string[];
}
