
import { Quiz } from '@/types';

export const mockQuizzes: Quiz[] = [
  {
    id: 'quiz1',
    title: 'Data Science Quiz',
    description: 'Test your knowledge of data science',
    moduleId: 'module1',
    questions: [
      {
        id: 'q1',
        text: 'What is data science?',
        options: ['The study of data', 'The study of science', 'The science of data', 'All of the above'],
        correctOption: 2,
        points: 10
      }
    ],
    timeLimit: 30,
    passingScore: 70,
    dueDate: '2023-12-31',
    status: 'Not Started'
  },
  {
    id: 'quiz2',
    title: 'Machine Learning Quiz',
    description: 'Test your knowledge of machine learning',
    moduleId: 'module2',
    questions: [
      {
        id: 'q1',
        text: 'What is machine learning?',
        options: ['The study of machines', 'The study of learning', 'The learning of machines', 'All of the above'],
        correctOption: 2,
        points: 10
      }
    ],
    timeLimit: 30,
    passingScore: 70,
    dueDate: '2023-12-31',
    status: 'Not Started'
  }
];
