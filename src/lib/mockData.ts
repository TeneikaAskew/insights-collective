import { User, Course, Module, Lesson, Assignment, AssignmentSubmission, Quiz, QuizQuestion, Notification, Certificate } from '@/types';

class MockDataService {
  private users: User[] = [
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

  private courses: Course[] = [
    {
      id: 'course1',
      title: 'Introduction to Data Science',
      description: 'Learn the fundamentals of data science, including data analysis, visualization, and basic machine learning concepts.',
      instructor: this.users[1],
      thumbnail: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&q=80&w=2000',
      enrollmentCount: 1248,
      rating: 4.7,
      modules: [],
      category: 'Data Science',
      tags: ['Python', 'Data Analysis', 'Statistics'],
      duration: '8 weeks',
      level: 'Beginner',
      enrollmentStatus: 'Open',
      createdAt: '2023-01-15T00:00:00Z',
      updatedAt: '2023-03-20T00:00:00Z'
    },
    {
      id: 'course2',
      title: 'Advanced Machine Learning',
      description: 'Dive deep into machine learning algorithms, neural networks, and practical implementations using TensorFlow and PyTorch.',
      instructor: this.users[1],
      thumbnail: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?auto=format&fit=crop&q=80&w=2000',
      enrollmentCount: 856,
      rating: 4.8,
      modules: [],
      category: 'Machine Learning & Artificial Intelligence',
      tags: ['Deep Learning', 'TensorFlow', 'PyTorch'],
      duration: '10 weeks',
      level: 'Advanced',
      enrollmentStatus: 'Open',
      createdAt: '2023-02-10T00:00:00Z',
      updatedAt: '2023-04-05T00:00:00Z'
    },
    {
      id: 'course3',
      title: 'Data Engineering Fundamentals',
      description: 'Learn about data pipelines, ETL processes, data warehousing, and working with big data technologies.',
      instructor: this.users[1],
      thumbnail: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&q=80&w=2000',
      enrollmentCount: 723,
      rating: 4.5,
      modules: [],
      category: 'Data Engineering',
      tags: ['SQL', 'ETL', 'Big Data'],
      duration: '6 weeks',
      level: 'Intermediate',
      enrollmentStatus: 'Open',
      createdAt: '2023-03-05T00:00:00Z',
      updatedAt: '2023-04-20T00:00:00Z'
    },
    {
      id: 'course4',
      title: 'Business Intelligence with Power BI',
      description: 'Master data visualization and reporting using Microsoft Power BI to create impactful business dashboards.',
      instructor: this.users[1],
      thumbnail: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&q=80&w=2000',
      enrollmentCount: 934,
      rating: 4.6,
      modules: [],
      category: 'Analytics & Business Intelligence',
      tags: ['Power BI', 'Data Visualization', 'Dashboards'],
      duration: '4 weeks',
      level: 'Beginner',
      enrollmentStatus: 'Open',
      createdAt: '2023-04-10T00:00:00Z',
      updatedAt: '2023-05-15T00:00:00Z'
    },
    {
      id: 'course5',
      title: 'Natural Language Processing',
      description: 'Explore NLP techniques and applications, including text classification, sentiment analysis, and language generation.',
      instructor: this.users[1],
      thumbnail: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&q=80&w=2000',
      enrollmentCount: 612,
      rating: 4.9,
      modules: [],
      category: 'Machine Learning & Artificial Intelligence',
      tags: ['NLP', 'BERT', 'Transformers'],
      duration: '8 weeks',
      level: 'Advanced',
      enrollmentStatus: 'Open',
      createdAt: '2023-05-20T00:00:00Z',
      updatedAt: '2023-06-25T00:00:00Z'
    },
    {
      id: 'course6',
      title: 'Data Visualization with Tableau',
      description: 'Learn to create powerful, interactive visualizations and dashboards using Tableau.',
      instructor: this.users[1],
      thumbnail: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&q=80&w=2000',
      enrollmentCount: 745,
      rating: 4.6,
      modules: [],
      category: 'Analytics & Business Intelligence',
      tags: ['Tableau', 'Data Visualization', 'Dashboards'],
      duration: '6 weeks',
      level: 'Intermediate',
      enrollmentStatus: 'Open',
      createdAt: '2023-01-15T00:00:00Z',
      updatedAt: '2023-02-20T00:00:00Z'
    }
  ];

  private modules: Module[] = [
    {
      id: 'module1',
      title: 'Introduction to Data Science',
      description: 'Learn the basics of data science',
      week: 1,
      lessons: [],
      assignments: [],
      quizzes: [],
      completionStatus: 0
    },
    {
      id: 'module2',
      title: 'Advanced Machine Learning',
      description: 'Dive deep into machine learning algorithms',
      week: 2,
      lessons: [],
      assignments: [],
      quizzes: [],
      completionStatus: 0
    }
  ];

  private lessons: Lesson[] = [
    {
      id: 'lesson1',
      title: 'What is Data Science?',
      description: 'An overview of data science',
      content: '<h1>What is Data Science?</h1><p>Data science is the study of data</p>',
      duration: '1 hour',
      isCompleted: false
    },
    {
      id: 'lesson2',
      title: 'Machine Learning Basics',
      description: 'Learn the basics of machine learning',
      content: '<h1>Machine Learning Basics</h1><p>Machine learning is the study of algorithms</p>',
      duration: '1 hour',
      isCompleted: false
    }
  ];

  private assignments: Assignment[] = [
    {
      id: 'assignment1',
      title: 'Data Science Assignment',
      description: 'Complete the data science assignment',
      dueDate: '2023-12-31',
      points: 100,
      status: 'Not Started'
    },
    {
      id: 'assignment2',
      title: 'Machine Learning Assignment',
      description: 'Complete the machine learning assignment',
      dueDate: '2023-12-31',
      points: 100,
      status: 'Not Started'
    }
  ];

  private quizzes: Quiz[] = [
    {
      id: 'quiz1',
      title: 'Data Science Quiz',
      description: 'Test your knowledge of data science',
      questions: [],
      dueDate: '2023-12-31',
      status: 'Not Started'
    },
    {
      id: 'quiz2',
      title: 'Machine Learning Quiz',
      description: 'Test your knowledge of machine learning',
      questions: [],
      dueDate: '2023-12-31',
      status: 'Not Started'
    }
  ];

  private notifications: Notification[] = [
    {
      id: '1',
      userId: 'user1',
      title: 'New Assignment',
      message: 'You have a new assignment in Data Science course',
      type: 'assignment',
      isRead: false,
      createdAt: '2023-09-01T10:30:00Z',
      link: '/courses/course1/modules/module1'
    },
    {
      id: '2',
      userId: 'user1',
      title: 'Quiz Reminder',
      message: 'Don\'t forget to complete the quiz for Machine Learning course',
      type: 'quiz',
      isRead: false,
      createdAt: '2023-09-02T14:00:00Z',
      link: '/courses/course2/modules/module2'
    },
    {
      id: '3',
      userId: 'user1',
      title: 'Course Announcement',
      message: 'Important update for your Data Engineering course',
      type: 'announcement',
      isRead: true,
      createdAt: '2023-09-03T09:15:00Z',
      link: '/courses/course3'
    }
  ];

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
}

export const mockService = new MockDataService();
