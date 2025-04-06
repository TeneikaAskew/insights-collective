
import { mockUsers } from './users';
import { mockCourses } from './courses';
import { mockModules } from './modules';
import { mockLessons } from './lessons';
import { mockAssignments } from './assignments';
import { mockQuizzes } from './quizzes';
import { mockNotifications } from './notifications';
import { mockEvents } from './events';
import { User, Course, Module, Lesson, Assignment, Quiz, Notification } from '@/types';

class MockDataService {
  private users = mockUsers;
  private courses = mockCourses;
  private modules = mockModules;
  private lessons = mockLessons;
  private assignments = mockAssignments;
  private quizzes = mockQuizzes;
  private notifications = mockNotifications;
  private events = mockEvents;

  getAllUsers(): User[] {
    return this.users;
  }

  getUserById(id: string): User | undefined {
    return this.users.find(user => user.id === id);
  }

  getAllCourses(): Course[] {
    return this.courses;
  }

  getCourseById(id: string): Course | undefined {
    return this.courses.find(course => course.id === id);
  }

  getCoursesByCategory(category: string): Course[] {
    return this.courses.filter(course => course.category === category);
  }

  getAllModules(): Module[] {
    return this.modules;
  }

  getModuleById(id: string): Module | undefined {
    return this.modules.find(module => module.id === id);
  }

  getAllLessons(): Lesson[] {
    return this.lessons;
  }

  getLessonById(id: string): Lesson | undefined {
    return this.lessons.find(lesson => lesson.id === id);
  }

  getAllAssignments(): Assignment[] {
    return this.assignments;
  }

  getAssignmentById(id: string): Assignment | undefined {
    return this.assignments.find(assignment => assignment.id === id);
  }

  getAllQuizzes(): Quiz[] {
    return this.quizzes;
  }

  getQuizById(id: string): Quiz | undefined {
    return this.quizzes.find(quiz => quiz.id === id);
  }

  getEnrolledCourses(userId: string): Course[] {
    const user = this.getUserById(userId);
    if (!user || !user.enrolledCourses) return [];
    
    return this.courses.filter(course => 
      user.enrolledCourses?.includes(course.id)
    );
  }

  getUserNotifications(userId: string): Notification[] {
    return this.notifications.filter(notification => 
      notification.userId === userId
    );
  }

  getEvents() {
    return this.events;
  }
}

export const mockService = new MockDataService();
