
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '@/integrations/supabase/client';

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
    console.error('Error getting course UUID mapping:', error);
    return {};
  }
};

// Save UUID mapping to localStorage
const saveCourseUuidMapping = (mapping: Record<string, string>): void => {
  try {
    localStorage.setItem(COURSE_UUID_MAPPING_KEY, JSON.stringify(mapping));
  } catch (error) {
    console.error('Error saving course UUID mapping:', error);
  }
};

// Generate a persistent UUID for a course ID or use existing real UUID
export const getMappedCourseUuid = (courseId: string): string => {
  if (!courseId) return '';
  
  // If courseId already looks like a UUID, validate it and return it directly
  if (isValidUUID(courseId)) {
    return courseId;
  }
  
  const mapping = getCourseUuidMapping();
  
  // If we already have a UUID for this course ID, return it
  if (mapping[courseId] && isValidUUID(mapping[courseId])) {
    return mapping[courseId];
  }
  
  // Check if this is a real course ID from our database
  const fetchRealCourseId = async (id: string) => {
    try {
      const { data } = await supabase
        .from('courses')
        .select('id')
        .eq('id', id)
        .maybeSingle();
      
      if (data?.id) {
        // If found in database, store mapping and return real ID
        mapping[courseId] = data.id;
        saveCourseUuidMapping(mapping);
        return data.id;
      }
    } catch (error) {
      console.error('Error checking course ID:', error);
    }
    return null;
  };
  
  // Try to fetch real course ID, but don't block rendering
  fetchRealCourseId(courseId);
  
  // Meanwhile, generate a new UUID if needed, save it, and return it
  const newUuid = uuidv4();
  mapping[courseId] = newUuid;
  saveCourseUuidMapping(mapping);
  
  return newUuid;
};

// Generate a consistent UUID based on a string ID with prefix
export const generatePersistentUUID = (id: string, prefix: string = ''): string => {
  if (!id) return '';
  
  // If ID already looks like a UUID, validate and return it directly
  if (isValidUUID(id)) {
    return id;
  }
  
  // For courses, use our UUID mapping system
  if (prefix === 'course') {
    return getMappedCourseUuid(id);
  }
  
  // Create a namespace using the prefix to ensure different UUIDs for different entity types
  const namespace = `${prefix}_${id}`;
  
  // Use namespace as a seed to generate a UUID in a deterministic way
  let hash = 0;
  for (let i = 0; i < namespace.length; i++) {
    const char = namespace.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  // Create a seeded random generator function
  const createSeededRandom = (initialSeed: number) => {
    let seed = initialSeed;
    return () => {
      const x = Math.sin(seed++) * 10000;
      return x - Math.floor(x);
    };
  };
  
  // Use the hash as a seed
  const seededRandom = createSeededRandom(Math.abs(hash));
  
  // Generate parts of a UUID using our seeded random function
  const parts = [];
  for (let i = 0; i < 8; i++) {
    parts.push(Math.floor(seededRandom() * 16).toString(16));
  }
  
  // Format as UUID
  return [
    parts.slice(0, 4).join(''),
    parts.slice(4, 6).join(''),
    parts.slice(6, 8).join('')
  ].join('-') + '-' + uuidv4().substring(14);
};

// Course enrollment functions - now with UUID validation
export const getEnrolledCourses = (): string[] => {
  try {
    const storedData = localStorage.getItem(COURSE_ENROLLMENT_KEY);
    const courses = storedData ? JSON.parse(storedData) : [];
    // Filter out invalid UUIDs
    return courses.filter(isValidUUID);
  } catch (error) {
    console.error('Error getting enrolled courses:', error);
    return [];
  }
};

export const addEnrolledCourse = (courseId: string): void => {
  if (!courseId) return;
  
  try {
    // Ensure we have a valid UUID
    const courseUUID = generatePersistentUUID(courseId, 'course');
    if (!isValidUUID(courseUUID)) return;
    
    const enrolledCourses = getEnrolledCourses();
    
    if (!enrolledCourses.includes(courseUUID)) {
      enrolledCourses.push(courseUUID);
      localStorage.setItem(COURSE_ENROLLMENT_KEY, JSON.stringify(enrolledCourses));
    }
  } catch (error) {
    console.error('Error adding enrolled course:', error);
  }
};

export const isEnrolledInCourse = (courseId: string): boolean => {
  if (!courseId) return false;
  
  try {
    const courseUUID = generatePersistentUUID(courseId, 'course');
    if (!isValidUUID(courseUUID)) return false;
    
    return getEnrolledCourses().includes(courseUUID);
  } catch (error) {
    console.error('Error checking if enrolled in course:', error);
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
    console.error('Error getting wishlisted courses:', error);
    return [];
  }
};

export const toggleWishlistedCourse = (courseId: string): boolean => {
  if (!courseId) return false;
  
  try {
    const courseUUID = generatePersistentUUID(courseId, 'course');
    if (!isValidUUID(courseUUID)) return false;
    
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
    console.error('Error toggling wishlisted course:', error);
    return false;
  }
};

export const isWishlistedCourse = (courseId: string): boolean => {
  if (!courseId) return false;
  
  try {
    const courseUUID = generatePersistentUUID(courseId, 'course');
    if (!isValidUUID(courseUUID)) return false;
    
    return getWishlistedCourses().includes(courseUUID);
  } catch (error) {
    console.error('Error checking if course is wishlisted:', error);
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
    console.error('Error getting registered events:', error);
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
    console.error('Error registering for event:', error);
  }
};

export const isRegisteredForEvent = (eventId: string): boolean => {
  if (!eventId) return false;
  
  try {
    const eventUUID = generatePersistentUUID(eventId, 'event');
    if (!isValidUUID(eventUUID)) return false;
    
    return getRegisteredEvents().includes(eventUUID);
  } catch (error) {
    console.error('Error checking if registered for event:', error);
    return false;
  }
};
