
import { Lesson } from '@/types';

export const mockLessons: Lesson[] = [
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
