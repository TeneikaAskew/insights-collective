
import { v4 as uuidv4 } from 'uuid';

// Local storage keys
const COURSE_ENROLLMENT_KEY = 'insightsCollective_enrolledCourses';
const COURSE_WISHLIST_KEY = 'insightsCollective_wishlistedCourses';
const EVENT_REGISTRATION_KEY = 'insightsCollective_registeredEvents';

// Generate a consistent UUID based on a string ID
export const generatePersistentUUID = (id: string, prefix: string = ''): string => {
  // Create a namespace using the prefix to ensure different UUIDs for courses vs events with the same ID
  const namespace = `${prefix}_${id}`;
  
  // Use namespace as a seed to generate a UUID in a deterministic way
  // This is a simple implementation - in production, you might want more sophisticated UUID generation
  let hash = 0;
  for (let i = 0; i < namespace.length; i++) {
    const char = namespace.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  // Use hash as a seed for Math.random
  const seed = Math.abs(hash);
  const random = () => {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  };
  
  // Generate parts of a UUID using our seeded random function
  const parts = [];
  for (let i = 0; i < 8; i++) {
    parts.push(Math.floor(random() * 16).toString(16));
  }
  
  // Format as UUID
  return [
    parts.slice(0, 4).join(''),
    parts.slice(4, 6).join(''),
    parts.slice(6, 8).join('')
  ].join('-') + '-' + uuidv4().substring(14);
};

// Course enrollment functions
export const getEnrolledCourses = (): string[] => {
  const storedData = localStorage.getItem(COURSE_ENROLLMENT_KEY);
  return storedData ? JSON.parse(storedData) : [];
};

export const addEnrolledCourse = (courseId: string): void => {
  const courseUUID = generatePersistentUUID(courseId, 'course');
  const enrolledCourses = getEnrolledCourses();
  
  if (!enrolledCourses.includes(courseUUID)) {
    enrolledCourses.push(courseUUID);
    localStorage.setItem(COURSE_ENROLLMENT_KEY, JSON.stringify(enrolledCourses));
  }
};

export const isEnrolledInCourse = (courseId: string): boolean => {
  const courseUUID = generatePersistentUUID(courseId, 'course');
  return getEnrolledCourses().includes(courseUUID);
};

// Course wishlist functions
export const getWishlistedCourses = (): string[] => {
  const storedData = localStorage.getItem(COURSE_WISHLIST_KEY);
  return storedData ? JSON.parse(storedData) : [];
};

export const toggleWishlistedCourse = (courseId: string): boolean => {
  const courseUUID = generatePersistentUUID(courseId, 'course');
  const wishlistedCourses = getWishlistedCourses();
  
  const isWishlisted = wishlistedCourses.includes(courseUUID);
  
  if (isWishlisted) {
    // Remove from wishlist
    const updatedWishlist = wishlistedCourses.filter(id => id !== courseUUID);
    localStorage.setItem(COURSE_WISHLIST_KEY, JSON.stringify(updatedWishlist));
    return false;
  } else {
    // Add to wishlist
    wishlistedCourses.push(courseUUID);
    localStorage.setItem(COURSE_WISHLIST_KEY, JSON.stringify(wishlistedCourses));
    return true;
  }
};

export const isWishlistedCourse = (courseId: string): boolean => {
  const courseUUID = generatePersistentUUID(courseId, 'course');
  return getWishlistedCourses().includes(courseUUID);
};

// Event registration functions
export const getRegisteredEvents = (): string[] => {
  const storedData = localStorage.getItem(EVENT_REGISTRATION_KEY);
  return storedData ? JSON.parse(storedData) : [];
};

export const registerForEvent = (eventId: string): void => {
  const eventUUID = generatePersistentUUID(eventId, 'event');
  const registeredEvents = getRegisteredEvents();
  
  if (!registeredEvents.includes(eventUUID)) {
    registeredEvents.push(eventUUID);
    localStorage.setItem(EVENT_REGISTRATION_KEY, JSON.stringify(registeredEvents));
  }
};

export const isRegisteredForEvent = (eventId: string): boolean => {
  const eventUUID = generatePersistentUUID(eventId, 'event');
  return getRegisteredEvents().includes(eventUUID);
};
