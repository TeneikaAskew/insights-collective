// localStorageUtils.ts


import { createLogger } from '@/utils/logger';

const logger = createLogger('LocalStorageUtils');
interface LocalStorageItem {
  key: string;
  value: string | null;
}

interface LocalStorageMap {
  [key: string]: string | null;
}

interface StarResponseDraft {
  situation: string;
  task: string;
  action: string;
  result: string;
}

interface SavedStarResponse {
  response: any;
  feedback: any;
  timestamp: number;
}

type StarResponseDrafts = Record<string, StarResponseDraft>;
type SavedStarResponses = Record<string, SavedStarResponse>;

export class LocalStorageUtils {
  /**
   * Get all items from localStorage as an object
   */
  static getAllItems(): LocalStorageMap {
    const items: LocalStorageMap = {};
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        // Direct iteration through localStorage keys
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i);
          if (key) {
            items[key] = window.localStorage.getItem(key);
          }
        }
        
        // Double-check using Object.keys as a fallback
        Object.keys(window.localStorage).forEach(key => {
          if (!items[key]) {
            items[key] = window.localStorage.getItem(key);
          }
        });
      } catch (error) {
        logger.error('Error accessing localStorage:', error);
      }
    }
    return items;
  }

  /**
   * Get all items from localStorage as an array
   */
  static getAllItemsAsArray(): LocalStorageItem[] {
    const items: LocalStorageItem[] = [];
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        // Direct iteration through localStorage
        logger.log(`Total localStorage items: ${window.localStorage.length}`);
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i);
          if (key) {
            items.push({
              key,
              value: window.localStorage.getItem(key)
            });
          }
        }
        
        // Verify if we found all items by comparing with Object.keys
        const objKeys = Object.keys(window.localStorage);
        logger.log(`Items found via iteration: ${items.length}, via Object.keys: ${objKeys.length}`);
        
        // Add any keys we might have missed from Object.keys
        objKeys.forEach(key => {
          if (!items.some(item => item.key === key)) {
            items.push({
              key,
              value: window.localStorage.getItem(key)
            });
          }
        });
      } catch (error) {
        logger.error('Error accessing localStorage:', error);
      }
    }
    return items;
  }

  /**
   * Find items that match a pattern
   */
  static findItems(pattern: string): LocalStorageMap {
    const matchingItems: LocalStorageMap = {};
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i);
          if (key && key.toLowerCase().includes(pattern.toLowerCase())) {
            matchingItems[key] = window.localStorage.getItem(key);
          }
        }
      } catch (error) {
        logger.error('Error finding localStorage items:', error);
      }
    }
    return matchingItems;
  }

  /**
   * Get all resume-related items for a specific user
   */
  static getResumeItems(userId: string): LocalStorageMap {
    const resumeItems: LocalStorageMap = {};
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i);
          if (key && (key.includes('resume') || key.includes(userId))) {
            resumeItems[key] = window.localStorage.getItem(key);
          }
        }
      } catch (error) {
        logger.error('Error getting resume items:', error);
      }
    }
    return resumeItems;
  }

  /**
   * Clear all resume-related items for a specific user
   */
  static clearResumeItems(userId: string): void {
    logger.log(`Clearing all resume items for user: ${userId}`);
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        for (let i = window.localStorage.length - 1; i >= 0; i--) {
          const key = window.localStorage.key(i);
          if (key && (key.includes('resume') || key.includes(userId))) {
            logger.log(`Removing: ${key}`);
            window.localStorage.removeItem(key);
          }
        }
      } catch (error) {
        logger.error('Error clearing resume items:', error);
      }
    }
  }

  /**
   * Clear all items from localStorage that match any of the provided patterns
   */
  static clearItemsByPatterns(patterns: string[]): void {
    logger.log(`Clearing all localStorage items matching patterns: ${patterns.join(', ')}`);
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        for (let i = window.localStorage.length - 1; i >= 0; i--) {
          const key = window.localStorage.key(i);
          if (key) {
            const keyLower = key.toLowerCase();
            const shouldRemove = patterns.some(pattern => keyLower.includes(pattern.toLowerCase()));
            if (shouldRemove) {
              logger.log(`Removing localStorage item: ${key}`);
              window.localStorage.removeItem(key);
            }
          }
        }
      } catch (error) {
        logger.error('Error clearing items by patterns:', error);
      }
    }
  }

  /**
   * Clear specific job-related items from localStorage
   */
  static clearJobItems(): void {
    logger.log('Clearing job-related items from localStorage');
    if (typeof window !== 'undefined' && window.localStorage) {
      const jobKeys = [
        'job_description_url',
        'job_description_text',
        'job_analyzer_active_tab', 
        'job_analysis_result',
        'job_analyzer_use_filtering'
      ];
      
      try {
        jobKeys.forEach(key => {
          window.localStorage.removeItem(key);
          logger.log(`Removed job-related key: ${key}`);
        });
      } catch (error) {
        logger.error('Error clearing job items:', error);
      }
    }
  }

  /**
   * Save job study guide to localStorage
   */
  static saveStudyGuide(userId: string, studyGuide: any): void {
    logger.log('Saving study guide to localStorage');
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(`study_guide_${userId}`, JSON.stringify(studyGuide));
        logger.log('Study guide saved to localStorage');
      } catch (error) {
        logger.error('Error saving study guide to localStorage:', error);
      }
    }
  }

  /**
   * Get job study guide from localStorage
   */
  static getStudyGuide(userId: string): any {
    logger.log('Getting study guide from localStorage');
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const studyGuide = window.localStorage.getItem(`study_guide_${userId}`);
        return studyGuide ? JSON.parse(studyGuide) : null;
      } catch (error) {
        logger.error('Error getting study guide from localStorage:', error);
        return null;
      }
    }
    return null;
  }

  /**
   * Save submitted STAR responses with feedback to localStorage
   */
  static saveSavedStarResponses(userId: string, responses: SavedStarResponses): void {
    logger.log('Saving submitted STAR responses to localStorage');
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        logger.log(`Responses to save for user ${userId}:`, Object.keys(responses).length);
        logger.log('First few responses:', Object.entries(responses).slice(0, 2));
        window.localStorage.setItem(`saved_star_responses_${userId}`, JSON.stringify(responses));
        logger.log('Saved STAR responses stored to localStorage');
      } catch (error) {
        logger.error('Error saving STAR responses to localStorage:', error);
      }
    }
  }

  /**
   * Get saved STAR responses with feedback from localStorage
   */
  static getSavedStarResponses(userId: string): SavedStarResponses | null {
    logger.log('Getting saved STAR responses from localStorage');
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const savedResponsesKey = `saved_star_responses_${userId}`;
        const savedResponses = window.localStorage.getItem(savedResponsesKey);
        logger.log(`Key: ${savedResponsesKey}, Found data:`, savedResponses ? 'Yes' : 'No');
        if (savedResponses) {
          const parsed = JSON.parse(savedResponses);
          logger.log(`Parsed ${Object.keys(parsed).length} saved responses`);
          return parsed;
        }
        return null;
      } catch (error) {
        logger.error('Error getting saved STAR responses from localStorage:', error);
        return null;
      }
    }
    return null;
  }

  /**
   * Save STAR responses to localStorage
   */
  static saveStarResponses(userId: string, responses: any[]): void {
    logger.log('Saving STAR responses to localStorage');
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(`star_responses_${userId}`, JSON.stringify(responses));
        logger.log('STAR responses saved to localStorage');
      } catch (error) {
        logger.error('Error saving STAR responses to localStorage:', error);
      }
    }
  }

  /**
   * Get STAR responses from localStorage
   */
  static getStarResponses(userId: string): any[] {
    logger.log('Getting STAR responses from localStorage');
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const responses = window.localStorage.getItem(`star_responses_${userId}`);
        return responses ? JSON.parse(responses) : [];
      } catch (error) {
        logger.error('Error getting STAR responses from localStorage:', error);
        return [];
      }
    }
    return [];
  }

  /**
   * Add a single STAR response to localStorage
   */
  static addStarResponse(userId: string, response: any): void {
    logger.log('Adding STAR response to localStorage');
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const responses = this.getStarResponses(userId);
        responses.unshift(response); // Add new response at the beginning
        this.saveStarResponses(userId, responses);
        logger.log('STAR response added to localStorage');
      } catch (error) {
        logger.error('Error adding STAR response to localStorage:', error);
      }
    }
  }

  /**
   * Save draft STAR responses for each question
   */
  static saveStarResponseDrafts(userId: string, drafts: StarResponseDrafts): void {
    logger.log('Saving STAR response drafts to localStorage:', Object.keys(drafts).length);
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(`star_drafts_${userId}`, JSON.stringify(drafts));
      } catch (error) {
        logger.error('Error saving STAR drafts to localStorage:', error);
      }
    }
  }

  /**
   * Get draft STAR responses for each question
   */
  static getStarResponseDrafts(userId: string): StarResponseDrafts {
    logger.log('Getting STAR response drafts from localStorage');
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const draftsKey = `star_drafts_${userId}`;
        const drafts = window.localStorage.getItem(draftsKey);
        logger.log(`Found drafts for key ${draftsKey}:`, drafts ? 'Yes' : 'No');
        return drafts ? JSON.parse(drafts) : {};
      } catch (error) {
        logger.error('Error getting STAR drafts from localStorage:', error);
        return {};
      }
    }
    return {};
  }

  /**
   * Save draft STAR response for a specific question
   */
  static saveStarResponseDraftForQuestion(userId: string, questionId: string, draft: StarResponseDraft): void {
    logger.log(`Saving STAR response draft for question ${questionId}`);
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const allDrafts = this.getStarResponseDrafts(userId);
        allDrafts[questionId] = draft;
        this.saveStarResponseDrafts(userId, allDrafts);
      } catch (error) {
        logger.error('Error saving STAR draft for question to localStorage:', error);
      }
    }
  }

  /**
   * Get draft STAR response for a specific question
   */
  static getStarResponseDraftForQuestion(userId: string, questionId: string): StarResponseDraft | null {
    logger.log(`Getting STAR response draft for question ${questionId}`);
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const allDrafts = this.getStarResponseDrafts(userId);
        logger.log(`Looking for question ${questionId} in drafts:`, 
                   `Found: ${questionId in allDrafts ? 'Yes' : 'No'}`);
        return allDrafts[questionId] || null;
      } catch (error) {
        logger.error('Error getting STAR draft for question from localStorage:', error);
        return null;
      }
    }
    return null;
  }

  /**
   * Clear all draft STAR responses
   */
  static clearStarResponseDrafts(userId: string): void {
    logger.log('Clearing all STAR response drafts');
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.removeItem(`star_drafts_${userId}`);
      } catch (error) {
        logger.error('Error clearing STAR drafts from localStorage:', error);
      }
    }
  }

  /**
   * Print all items to console
   */
  static logAllItems(): void {
    logger.log('=== All localStorage items ===');
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i);
          if (key) {
            const value = window.localStorage.getItem(key);
            logger.log(`${key}: ${value}`);
          }
        }
        logger.log(`Total localStorage items: ${window.localStorage.length}`);
        logger.log('Direct object keys:', Object.keys(window.localStorage));
      } catch (error) {
        logger.error('Error logging localStorage items:', error);
      }
    }
    logger.log('==============================');
  }

  /**
   * Export all items as JSON
   */
  static exportToJSON(): string {
    return JSON.stringify(this.getAllItems(), null, 2);
  }

  /**
   * Create a test item in localStorage
   */
  static createTestItem(prefix: string = 'test'): string {
    const timestamp = new Date().getTime();
    const key = `${prefix}_${timestamp}`;
    const value = `Test value created at ${new Date().toISOString()}`;
    
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(key, value);
        logger.log(`Test item created: ${key}`);
      } catch (error) {
        logger.error('Error creating test item:', error);
      }
    }
    
    return key;
  }
  
  /**
   * Dump all localStorage items to browser console
   */
  static dumpToConsole(): void {
    logger.log('=== LocalStorage Dump Start ===');
    logger.log('Full localStorage object:', window.localStorage);
    logger.log('Total items:', window.localStorage.length);
    
    // Group items by prefix/category for easier reading
    const categorized: Record<string, LocalStorageMap> = {
      'resume': {},
      'job': {},
      'auth': {},
      'preferences': {},
      'other': {}
    };
    
    const allItems = this.getAllItems();
    
    Object.entries(allItems).forEach(([key, value]) => {
      if (key.includes('resume')) {
        categorized.resume[key] = value;
      } else if (key.includes('job')) {
        categorized.job[key] = value;
      } else if (key.includes('auth') || key.includes('supabase')) {
        categorized.auth[key] = value;
      } else if (key.includes('pref') || key.includes('setting')) {
        categorized.preferences[key] = value;
      } else {
        categorized.other[key] = value;
      }
    });
    
    logger.log('Categorized localStorage items:', categorized);
    logger.log('=== LocalStorage Dump End ===');
  }
}
