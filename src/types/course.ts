
export interface Course {
  id: string;
  title: string;
  description: string;
  category: string;
  level: string;
  duration?: string;
  tags?: string[];
  thumbnail?: string;
  image_url?: string;
  imageUrl?: string;
  enrollment_status: 'open' | 'closed' | 'waitlist';
  enrollmentStatus?: 'open' | 'closed' | 'waitlist';
  published: boolean;
  status: 'draft' | 'published' | 'archived';
  instructor_id?: string;
  instructor?: {
    id: string;
    name: string;
    firstName?: string;
    lastName?: string;
    avatar?: string;
  };
  enrollment_count?: number;
  enrollmentCount?: number;
  created_at: string;
  updated_at: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CourseFormData {
  title: string;
  description: string;
  category: string;
  level: string;
  duration?: string;
  tags?: string[];
  image_url?: string;
  enrollment_status?: 'open' | 'closed' | 'waitlist';
  published?: boolean;
  status?: 'draft' | 'published' | 'archived';
  instructor_id?: string;
}

export interface CourseEnrollment {
  id: string;
  user_id: string;
  course_id: string;
  enrolled_at: string;
  completion_status: number;
  user?: {
    id: string;
    first_name: string;
    last_name: string;
    email?: string;
    avatar_url?: string;
  };
}

export interface CourseInstructor {
  id: string;
  course_id: string;
  user_id: string;
  role: string;
  created_at: string;
  user?: {
    id: string;
    first_name: string;
    last_name: string;
    email?: string;
    avatar_url?: string;
  };
}

export interface CourseStats {
  enrollment_count: number;
  completion_rate: number;
}

export interface Module {
  id: string;
  course_id: string;
  title: string;
  description: string;
  week: number;
  created_at: string;
  updated_at: string;
}
