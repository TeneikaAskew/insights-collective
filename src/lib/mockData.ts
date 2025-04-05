
import { User, Course, Module, Notification } from '@/types';

// Mock Users
export const users: User[] = [
  {
    id: "user1",
    name: "John Doe",
    email: "john.doe@example.com",
    role: "student",
    bio: "Enthusiastic learner exploring new technologies.",
    enrolledCourses: ["course1", "course2"]
  },
  {
    id: "user2",
    name: "Jane Smith",
    email: "jane.smith@example.com",
    role: "instructor",
    bio: "Experienced instructor with 10+ years in web development.",
    createdCourses: ["course1", "course3"]
  },
  {
    id: "user3",
    name: "Admin User",
    email: "admin@learnflow.com",
    role: "admin",
    bio: "Platform administrator"
  }
];

// Mock Courses
export const courses: Course[] = [
  {
    id: "course1",
    title: "Introduction to Web Development",
    description: "Learn the fundamentals of web development including HTML, CSS, and JavaScript.",
    instructor: users[1],
    thumbnail: "https://images.unsplash.com/photo-1593720219276-0b1eacd0aef4?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1061&q=80",
    enrollmentCount: 256,
    rating: 4.7,
    modules: [],
    category: "Web Development",
    tags: ["HTML", "CSS", "JavaScript", "Responsive Design"],
    duration: "8 weeks",
    level: "Beginner",
    enrollmentStatus: "Open",
    createdAt: "2023-01-15T00:00:00Z",
    updatedAt: "2023-02-10T00:00:00Z"
  },
  {
    id: "course2",
    title: "Data Science Fundamentals",
    description: "Explore essential concepts in data science, statistics, and machine learning algorithms.",
    instructor: users[1],
    thumbnail: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1050&q=80",
    enrollmentCount: 198,
    rating: 4.5,
    modules: [],
    category: "Data Science",
    tags: ["Python", "Statistics", "Machine Learning", "Data Visualization"],
    duration: "10 weeks",
    level: "Intermediate",
    enrollmentStatus: "Open",
    createdAt: "2023-02-05T00:00:00Z",
    updatedAt: "2023-03-12T00:00:00Z"
  },
  {
    id: "course3",
    title: "Mobile App Development with React Native",
    description: "Build cross-platform mobile applications using React Native and JavaScript.",
    instructor: users[1],
    thumbnail: "https://images.unsplash.com/photo-1551650975-87deedd944c3?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1074&q=80",
    enrollmentCount: 145,
    rating: 4.8,
    modules: [],
    category: "Mobile Development",
    tags: ["React Native", "JavaScript", "Mobile", "iOS", "Android"],
    duration: "12 weeks",
    level: "Intermediate",
    enrollmentStatus: "In Progress",
    createdAt: "2023-03-20T00:00:00Z",
    updatedAt: "2023-04-15T00:00:00Z"
  },
  {
    id: "course4",
    title: "UX/UI Design Principles",
    description: "Master the principles of user experience and interface design for digital products.",
    instructor: users[1],
    thumbnail: "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1055&q=80",
    enrollmentCount: 210,
    rating: 4.6,
    modules: [],
    category: "Design",
    tags: ["UX", "UI", "Wireframing", "Prototyping", "User Research"],
    duration: "8 weeks",
    level: "Beginner",
    enrollmentStatus: "Open",
    createdAt: "2023-04-10T00:00:00Z",
    updatedAt: "2023-05-05T00:00:00Z"
  }
];

// Mock Modules
export const modules: Module[] = [
  {
    id: "module1",
    title: "Week 1: HTML Fundamentals",
    description: "Learn the basics of HTML and document structure.",
    week: 1,
    lessons: [
      {
        id: "lesson1",
        title: "Introduction to HTML",
        description: "Understanding the basics of HTML markup.",
        content: "HTML (HyperText Markup Language) is the standard markup language for documents designed to be displayed in a web browser.",
        videoUrl: "https://example.com/videos/intro-html",
        duration: "45 minutes",
        isCompleted: true
      },
      {
        id: "lesson2",
        title: "HTML Elements & Tags",
        description: "Exploring common HTML elements and their usage.",
        content: "HTML elements are represented by tags. Tags come in pairs, with opening and closing tags.",
        videoUrl: "https://example.com/videos/html-elements",
        duration: "60 minutes",
        isCompleted: false
      }
    ],
    assignments: [
      {
        id: "assignment1",
        title: "Create a Basic Webpage",
        description: "Build a simple webpage with proper HTML structure including headings, paragraphs, lists, and links.",
        dueDate: "2023-01-22T23:59:59Z",
        points: 100,
        status: "Submitted",
        submission: {
          id: "submission1",
          userId: "user1",
          assignmentId: "assignment1",
          content: "My submission for the basic webpage assignment.",
          attachmentUrls: ["https://example.com/submissions/user1/assignment1.html"],
          submittedAt: "2023-01-21T15:30:00Z",
          grade: 95,
          feedback: "Excellent work on the structure! Consider adding more semantic elements."
        }
      }
    ],
    quizzes: [
      {
        id: "quiz1",
        title: "HTML Basics Quiz",
        description: "Test your knowledge of basic HTML concepts.",
        questions: [
          {
            id: "question1",
            question: "What does HTML stand for?",
            options: [
              "Hyper Text Markup Language",
              "High Tech Modern Language",
              "Hyper Transfer Markup Language",
              "Home Tool Markup Language"
            ],
            correctOptionIndex: 0,
            points: 10
          },
          {
            id: "question2",
            question: "Which tag is used to create a paragraph in HTML?",
            options: ["<paragraph>", "<p>", "<para>", "<text>"],
            correctOptionIndex: 1,
            points: 10
          }
        ],
        timeLimit: 15,
        dueDate: "2023-01-20T23:59:59Z",
        status: "Completed",
        score: 20
      }
    ],
    completionStatus: 75
  },
  {
    id: "module2",
    title: "Week 2: CSS Styling",
    description: "Master the fundamentals of CSS for styling web pages.",
    week: 2,
    lessons: [
      {
        id: "lesson3",
        title: "Introduction to CSS",
        description: "Learning the basics of Cascading Style Sheets.",
        content: "CSS is a style sheet language used for describing the presentation of a document written in HTML.",
        videoUrl: "https://example.com/videos/intro-css",
        duration: "50 minutes",
        isCompleted: false
      },
      {
        id: "lesson4",
        title: "CSS Selectors",
        description: "Understanding different types of CSS selectors.",
        content: "CSS selectors are patterns used to select the elements you want to style.",
        videoUrl: "https://example.com/videos/css-selectors",
        duration: "55 minutes",
        isCompleted: false
      }
    ],
    assignments: [
      {
        id: "assignment2",
        title: "Style Your Webpage",
        description: "Apply CSS styling to the webpage you created in the previous assignment.",
        dueDate: "2023-01-29T23:59:59Z",
        points: 100,
        status: "Not Started"
      }
    ],
    quizzes: [
      {
        id: "quiz2",
        title: "CSS Fundamentals Quiz",
        description: "Test your understanding of CSS concepts.",
        questions: [
          {
            id: "question3",
            question: "Which property is used to change the text color in CSS?",
            options: ["text-color", "font-color", "color", "text-style"],
            correctOptionIndex: 2,
            points: 10
          },
          {
            id: "question4",
            question: "What is the correct CSS syntax for making all paragraph elements bold?",
            options: [
              "p {text-size: bold;}",
              "p {font-weight: bold;}",
              "p style='font-bold'",
              "<p style='text-size: bold;'>"
            ],
            correctOptionIndex: 1,
            points: 10
          }
        ],
        timeLimit: 15,
        dueDate: "2023-01-27T23:59:59Z",
        status: "Not Started"
      }
    ],
    completionStatus: 0
  }
];

// Add modules to courses
courses[0].modules = [modules[0], modules[1]];

// Mock Notifications
export const notifications: Notification[] = [
  {
    id: "notification1",
    userId: "user1",
    title: "Assignment Due Soon",
    message: "Your 'Style Your Webpage' assignment is due in 2 days.",
    type: "assignment",
    isRead: false,
    createdAt: "2023-01-27T09:00:00Z",
    link: "/courses/course1/modules/module2"
  },
  {
    id: "notification2",
    userId: "user1",
    title: "Assignment Graded",
    message: "Your 'Create a Basic Webpage' assignment has been graded. You received 95/100.",
    type: "feedback",
    isRead: true,
    createdAt: "2023-01-25T14:30:00Z",
    link: "/courses/course1/modules/module1"
  },
  {
    id: "notification3",
    userId: "user1",
    title: "New Announcement",
    message: "Live Q&A session for Web Development course this Friday at 3 PM.",
    type: "announcement",
    isRead: false,
    createdAt: "2023-01-26T11:15:00Z",
    link: "/courses/course1"
  }
];

// Mock service functions
export const mockService = {
  // User related functions
  getCurrentUser: () => users[0],
  getUserById: (id: string) => users.find(user => user.id === id),
  
  // Course related functions
  getAllCourses: () => courses,
  getCourseById: (id: string) => courses.find(course => course.id === id),
  getEnrolledCourses: (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (!user || !user.enrolledCourses) return [];
    return courses.filter(course => user.enrolledCourses?.includes(course.id));
  },
  
  // Module related functions
  getModuleById: (id: string) => modules.find(module => module.id === id),
  getModulesByCourse: (courseId: string) => {
    const course = courses.find(c => c.id === courseId);
    return course ? course.modules : [];
  },
  
  // Notification related functions
  getUserNotifications: (userId: string) => 
    notifications.filter(notification => notification.userId === userId),
  
  // Enrollment functions
  enrollInCourse: (userId: string, courseId: string) => {
    const user = users.find(u => u.id === userId);
    if (user) {
      if (!user.enrolledCourses) {
        user.enrolledCourses = [];
      }
      if (!user.enrolledCourses.includes(courseId)) {
        user.enrolledCourses.push(courseId);
        return true;
      }
    }
    return false;
  },
  
  // Progress tracking
  updateLessonStatus: (userId: string, lessonId: string, isCompleted: boolean) => {
    // This would update the completion status in a real app
    return true;
  },
  
  // Assignment submission
  submitAssignment: (userId: string, assignmentId: string, content: string, attachments: string[]) => {
    // This would create a submission in a real app
    return {
      id: `submission-${Date.now()}`,
      userId,
      assignmentId,
      content,
      attachmentUrls: attachments,
      submittedAt: new Date().toISOString(),
    };
  }
};
