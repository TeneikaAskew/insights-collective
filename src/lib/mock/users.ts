
import { User } from '@/types';

export const mockUsers: User[] = [
  {
    id: 'user1',
    name: 'John Doe',
    email: 'john.doe@ic.tech',
    role: 'student',
    avatar: 'https://api.dicebear.com/6.x/avataaars/svg?seed=John',
    bio: 'Passionate learner with interests in data science and machine learning.',
    enrolledCourses: ['course1', 'course3', 'course5']
  },
  {
    id: 'user2',
    name: 'Jane Smith',
    email: 'jane.smith@ic.tech',
    role: 'instructor',
    avatar: 'https://api.dicebear.com/6.x/avataaars/svg?seed=Jane',
    bio: 'Experienced data scientist with 10+ years in the field. Passionate about teaching and helping others grow.',
    createdCourses: ['course1', 'course2']
  },
  {
    id: 'user3',
    name: 'Admin User',
    email: 'admin@ic.tech',
    role: 'admin',
    avatar: 'https://api.dicebear.com/6.x/avataaars/svg?seed=Admin',
    bio: 'Platform administrator',
  }
];
