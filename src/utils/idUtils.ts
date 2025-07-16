
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '@/integrations/supabase/client';

import { createLogger } from '@/utils/logger';

const logger = createLogger('isValidUUID');

// Local storage keys
const COURSE_ENROLLMENT_KEY = 'insightsCollective_enrolledCourses';
const COURSE_WISHLIST_KEY = 'insightsCollective_wishlistedCourses';
const EVENT_REGISTRATION_KEY = 'insightsCollective_registeredEvents';
const COURSE_UUID_MAPPING_KEY = 'insightsCollective_courseUuidMapping';

// Validate UUID format
export const isValidUUID = (uuid: string): boolean => {
  if (!uuid) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

// Get or create persistent UUID mapping
const getCourseUuidMapping = (): Record<string, string> => {
  try {
    const storedMapping = localStorage.getItem(COURSE_UUID_MAPPING_KEY);
    const mapping = storedMapping ? JSON.parse(storedMapping) : {};
    
    // Validate stored UUIDs to ensure they're valid
    Object.entries(mapping).forEach(([key, value]) => {
      if (!isValidUUID(value as string)) {
        delete mapping[key];
      }
    });
    
    return mapping;
  } catch (error) {
    logger.error('Error getting course UUID mapping:', error);
    return {};
  }
};

// Save UUID mapping to localStorage
const saveCourseUuidMapping = (mapping: Record<string, string>): void => {
  try {
    localStorage.setItem(COURSE_UUID_MAPPING_KEY, JSON.stringify(mapping));
  } catch (error) {
    logger.error('Error saving course UUID mapping:', error);
  }
};

// Get course UUID - simplified to use IDs directly
export const getMappedCourseUuid = (courseId: string): string => {
  if (!courseId) return '';
  
  // If courseId already looks like a UUID, return it directly
  if (isValidUUID(courseId)) {
    return courseId;
  }
  
  // For non-UUID course IDs, return them as-is (they might be valid IDs)
  return courseId;
};

// Simplified UUID generation - use IDs directly when they're valid UUIDs
export const generatePersistentUUID = (id: string, prefix: string = ''): string => {
  if (!id) return '';
  
  // If ID already looks like a UUID, return it directly
  if (isValidUUID(id)) {
    return id;
  }
  
  // For courses, use our simplified mapping
  if (prefix === 'course') {
    return getMappedCourseUuid(id);
  }
  
  // For other entities, return the ID as-is or generate if needed
  return id;
};

// Course enrollment functions - now with UUID validation
export const getEnrolledCourses = (): string[] => {
  try {
    const storedData = localStorage.getItem(COURSE_ENROLLMENT_KEY);
    const courses = storedData ? JSON.parse(storedData) : [];
    // Filter out invalid UUIDs
    return courses.filter(isValidUUID);
  } catch (error) {
    logger.error('Error getting enrolled courses:', error);
    return [];
  }
};

export const addEnrolledCourse = (courseId: string): void => {
  if (!courseId) return;
  
  try {
    // Use courseId directly if it's a valid UUID
    const courseUUID = isValidUUID(courseId) ? courseId : generatePersistentUUID(courseId, 'course');
    if (!courseUUID) return;
    
    const enrolledCourses = getEnrolledCourses();
    
    if (!enrolledCourses.includes(courseUUID)) {
      enrolledCourses.push(courseUUID);
      localStorage.setItem(COURSE_ENROLLMENT_KEY, JSON.stringify(enrolledCourses));
    }
  } catch (error) {
    logger.error('Error adding enrolled course:', error);
  }
};

export const isEnrolledInCourse = (courseId: string): boolean => {
  if (!courseId) return false;
  
  try {
    const courseUUID = isValidUUID(courseId) ? courseId : generatePersistentUUID(courseId, 'course');
    if (!courseUUID) return false;
    
    return getEnrolledCourses().includes(courseUUID);
  } catch (error) {
    logger.error('Error checking if enrolled in course:', error);
    return false;
  }
};

// Course wishlist functions - now with UUID validation
export const getWishlistedCourses = (): string[] => {
  try {
    const storedData = localStorage.getItem(COURSE_WISHLIST_KEY);
    const courses = storedData ? JSON.parse(storedData) : [];
    // Filter out invalid UUIDs
    return courses.filter(isValidUUID);
  } catch (error) {
    logger.error('Error getting wishlisted courses:', error);
    return [];
  }
};

export const toggleWishlistedCourse = (courseId: string): boolean => {
  if (!courseId) return false;
  
  try {
    const courseUUID = isValidUUID(courseId) ? courseId : generatePersistentUUID(courseId, 'course');
    if (!courseUUID) return false;
    
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
  } catch (error) {
    logger.error('Error toggling wishlisted course:', error);
    return false;
  }
};

export const isWishlistedCourse = (courseId: string): boolean => {
  if (!courseId) return false;
  
  try {
    const courseUUID = isValidUUID(courseId) ? courseId : generatePersistentUUID(courseId, 'course');
    if (!courseUUID) return false;
    
    return getWishlistedCourses().includes(courseUUID);
  } catch (error) {
    logger.error('Error checking if course is wishlisted:', error);
    return false;
  }
};

// Event registration functions - now with UUID validation
export const getRegisteredEvents = (): string[] => {
  try {
    const storedData = localStorage.getItem(EVENT_REGISTRATION_KEY);
    const events = storedData ? JSON.parse(storedData) : [];
    // Filter out invalid UUIDs
    return events.filter(isValidUUID);
  } catch (error) {
    logger.error('Error getting registered events:', error);
    return [];
  }
};

export const registerForEvent = (eventId: string): void => {
  if (!eventId) return;
  
  try {
    const eventUUID = generatePersistentUUID(eventId, 'event');
    if (!isValidUUID(eventUUID)) return;
    
    const registeredEvents = getRegisteredEvents();
    
    if (!registeredEvents.includes(eventUUID)) {
      registeredEvents.push(eventUUID);
      localStorage.setItem(EVENT_REGISTRATION_KEY, JSON.stringify(registeredEvents));
    }
  } catch (error) {
    logger.error('Error registering for event:', error);
  }
};

export const isRegisteredForEvent = (eventId: string): boolean => {
  if (!eventId) return false;
  
  try {
    const eventUUID = generatePersistentUUID(eventId, 'event');
    if (!isValidUUID(eventUUID)) return false;
    
    return getRegisteredEvents().includes(eventUUID);
  } catch (error) {
    logger.error('Error checking if registered for event:', error);
    return false;
  }
};
