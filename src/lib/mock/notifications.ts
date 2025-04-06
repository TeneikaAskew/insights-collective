
import { Notification } from '@/types';

export const mockNotifications: Notification[] = [
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
